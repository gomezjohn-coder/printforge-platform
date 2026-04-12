package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/printforge/artist-service/handlers"
	"github.com/printforge/artist-service/middleware"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	mux := http.NewServeMux()

	healthHandler := handlers.NewHealthHandler()
	artistHandler := handlers.NewArtistHandler()
	designHandler := handlers.NewDesignHandler()

	// Health and readiness probes
	mux.HandleFunc("GET /healthz", healthHandler.Healthz)
	mux.HandleFunc("GET /readyz", healthHandler.Readyz)

	// Artist CRUD routes
	mux.HandleFunc("GET /api/v1/artists", artistHandler.List)
	mux.HandleFunc("POST /api/v1/artists", artistHandler.Create)
	mux.HandleFunc("GET /api/v1/artists/{id}", artistHandler.Get)
	mux.HandleFunc("PUT /api/v1/artists/{id}", artistHandler.Update)
	mux.HandleFunc("DELETE /api/v1/artists/{id}", artistHandler.Delete)

	// Design routes
	mux.HandleFunc("GET /api/v1/designs", designHandler.List)
	mux.HandleFunc("POST /api/v1/designs/upload", designHandler.Upload)

	// Apply middleware chain
	handler := middleware.Chain(
		mux,
		middleware.RequestID,
		middleware.Logging,
		middleware.Metrics,
	)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in background
	go func() {
		slog.Info("artist-service starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutdown signal received", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("artist-service stopped gracefully")
}
