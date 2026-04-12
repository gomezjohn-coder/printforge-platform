package middleware

import (
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// RequestMetrics tracks basic per-route request metrics.
type RequestMetrics struct {
	mu       sync.RWMutex
	counters map[string]*RouteMetrics
}

// RouteMetrics holds metrics for a single route.
type RouteMetrics struct {
	TotalRequests int64         `json:"total_requests"`
	TotalErrors   int64         `json:"total_errors"`
	TotalDuration time.Duration `json:"total_duration"`
	MaxDuration   time.Duration `json:"max_duration"`
	MinDuration   time.Duration `json:"min_duration"`
}

var globalMetrics = &RequestMetrics{
	counters: make(map[string]*RouteMetrics),
}

// Metrics is middleware that tracks request duration and counts per route.
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := newMetricsResponseWriter(w)

		next.ServeHTTP(rw, r)

		duration := time.Since(start)
		routeKey := fmt.Sprintf("%s %s", r.Method, r.URL.Path)

		globalMetrics.record(routeKey, duration, rw.statusCode)

		if duration > 500*time.Millisecond {
			slog.Warn("slow request detected",
				"route", routeKey,
				"duration_ms", duration.Milliseconds(),
				"request_id", GetRequestID(r.Context()),
			)
		}
	})
}

func (m *RequestMetrics) record(route string, duration time.Duration, status int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rm, ok := m.counters[route]
	if !ok {
		rm = &RouteMetrics{
			MinDuration: duration,
		}
		m.counters[route] = rm
	}

	rm.TotalRequests++
	rm.TotalDuration += duration

	if duration > rm.MaxDuration {
		rm.MaxDuration = duration
	}
	if duration < rm.MinDuration {
		rm.MinDuration = duration
	}
	if status >= 500 {
		rm.TotalErrors++
	}
}

// GetMetrics returns a snapshot of all route metrics.
func GetMetrics() map[string]*RouteMetrics {
	globalMetrics.mu.RLock()
	defer globalMetrics.mu.RUnlock()

	snapshot := make(map[string]*RouteMetrics, len(globalMetrics.counters))
	for k, v := range globalMetrics.counters {
		copy := *v
		snapshot[k] = &copy
	}
	return snapshot
}

// metricsResponseWriter captures status codes for the metrics middleware.
type metricsResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func newMetricsResponseWriter(w http.ResponseWriter) *metricsResponseWriter {
	return &metricsResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (w *metricsResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}
