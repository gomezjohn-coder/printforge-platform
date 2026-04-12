package handlers

import (
	"net/http"
	"sync/atomic"
	"time"
)

// HealthHandler provides health and readiness check endpoints.
type HealthHandler struct {
	startTime time.Time
	ready     atomic.Bool
}

// NewHealthHandler returns a HealthHandler that is immediately ready.
func NewHealthHandler() *HealthHandler {
	h := &HealthHandler{
		startTime: time.Now(),
	}
	h.ready.Store(true)
	return h
}

// Healthz is a liveness probe. It always returns 200 if the process is running.
func (h *HealthHandler) Healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "healthy",
		"service": "artist-service",
		"uptime":  time.Since(h.startTime).String(),
	})
}

// Readyz is a readiness probe. It returns 200 only when the service is ready
// to accept traffic (e.g., connections to backing stores are established).
func (h *HealthHandler) Readyz(w http.ResponseWriter, r *http.Request) {
	if !h.ready.Load() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"status": "not_ready",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ready",
		"service": "artist-service",
	})
}

// SetReady allows toggling readiness (useful for graceful shutdown).
func (h *HealthHandler) SetReady(ready bool) {
	h.ready.Store(ready)
}
