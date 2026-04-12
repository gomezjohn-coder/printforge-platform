package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/printforge/artist-service/middleware"
)

// Artist represents a PrintForge artist profile.
type Artist struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Bio       string    `json:"bio"`
	StoreName string    `json:"store_name"`
	Verified  bool      `json:"verified"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateArtistRequest is the payload for creating an artist.
type CreateArtistRequest struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	Bio       string `json:"bio"`
	StoreName string `json:"store_name"`
}

// ArtistHandler manages artist CRUD operations with an in-memory store.
type ArtistHandler struct {
	mu      sync.RWMutex
	artists map[string]*Artist
}

// NewArtistHandler returns an ArtistHandler seeded with demo data.
func NewArtistHandler() *ArtistHandler {
	h := &ArtistHandler{
		artists: make(map[string]*Artist),
	}

	// Seed demo data
	now := time.Now()
	seed := []Artist{
		{ID: "art-001", Name: "Maya Chen", Email: "maya@printforge.io", Bio: "Digital illustrator specializing in botanical prints", StoreName: "Botanical Dreams", Verified: true, CreatedAt: now, UpdatedAt: now},
		{ID: "art-002", Name: "Jake Rivera", Email: "jake@printforge.io", Bio: "3D artist creating geometric sculptures for print", StoreName: "GeoPrint Studio", Verified: true, CreatedAt: now, UpdatedAt: now},
		{ID: "art-003", Name: "Aisha Patel", Email: "aisha@printforge.io", Bio: "Typography and poster design artist", StoreName: "TypeCraft", Verified: false, CreatedAt: now, UpdatedAt: now},
	}
	for i := range seed {
		h.artists[seed[i].ID] = &seed[i]
	}

	return h
}

// List returns all artists.
func (h *ArtistHandler) List(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make([]Artist, 0, len(h.artists))
	for _, a := range h.artists {
		result = append(result, *a)
	}

	slog.Info("listing artists", "count", len(result), "request_id", reqID)
	writeJSON(w, http.StatusOK, map[string]any{
		"artists": result,
		"total":   len(result),
	})
}

// Get returns a single artist by ID.
func (h *ArtistHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	reqID := middleware.GetRequestID(r.Context())

	h.mu.RLock()
	artist, ok := h.artists[id]
	h.mu.RUnlock()

	if !ok {
		slog.Warn("artist not found", "id", id, "request_id", reqID)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "artist not found"})
		return
	}

	writeJSON(w, http.StatusOK, artist)
}

// Create adds a new artist.
func (h *ArtistHandler) Create(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())

	var req CreateArtistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Name == "" || req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and email are required"})
		return
	}

	now := time.Now()
	artist := &Artist{
		ID:        generateID("art"),
		Name:      req.Name,
		Email:     req.Email,
		Bio:       req.Bio,
		StoreName: req.StoreName,
		Verified:  false,
		CreatedAt: now,
		UpdatedAt: now,
	}

	h.mu.Lock()
	h.artists[artist.ID] = artist
	h.mu.Unlock()

	slog.Info("artist created", "id", artist.ID, "name", artist.Name, "request_id", reqID)
	writeJSON(w, http.StatusCreated, artist)
}

// Update modifies an existing artist.
func (h *ArtistHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	reqID := middleware.GetRequestID(r.Context())

	h.mu.Lock()
	defer h.mu.Unlock()

	artist, ok := h.artists[id]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "artist not found"})
		return
	}

	var req CreateArtistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Name != "" {
		artist.Name = req.Name
	}
	if req.Email != "" {
		artist.Email = req.Email
	}
	if req.Bio != "" {
		artist.Bio = req.Bio
	}
	if req.StoreName != "" {
		artist.StoreName = req.StoreName
	}
	artist.UpdatedAt = time.Now()

	slog.Info("artist updated", "id", id, "request_id", reqID)
	writeJSON(w, http.StatusOK, artist)
}

// Delete removes an artist.
func (h *ArtistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	reqID := middleware.GetRequestID(r.Context())

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.artists[id]; !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "artist not found"})
		return
	}

	delete(h.artists, id)

	slog.Info("artist deleted", "id", id, "request_id", reqID)
	writeJSON(w, http.StatusNoContent, nil)
}

// writeJSON is a helper that sends a JSON response.
func writeJSON(w http.ResponseWriter, status int, v any) {
	if v == nil {
		w.WriteHeader(status)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// generateID creates a simple prefixed ID using timestamp for demo purposes.
func generateID(prefix string) string {
	return prefix + "-" + time.Now().Format("20060102150405.000")[9:]
}
