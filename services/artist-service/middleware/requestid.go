package middleware

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/http"
)

type contextKey string

const requestIDKey contextKey = "request_id"

// RequestID propagates or generates an X-Request-ID header and stores it in context.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = generateRequestID()
		}

		// Set the header on the response so downstream services can trace it
		w.Header().Set("X-Request-ID", id)

		// Store in context for handlers and other middleware
		ctx := context.WithValue(r.Context(), requestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID retrieves the request ID from context.
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}

// Chain applies a list of middleware to a handler in reverse order,
// so the first middleware in the list is the outermost wrapper.
func Chain(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}
	return handler
}

func generateRequestID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("req-%x", b)
}
