package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/printforge/artist-service/middleware"
)

// Design represents an uploaded design asset.
type Design struct {
	ID          string    `json:"id"`
	ArtistID    string    `json:"artist_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	FileURL     string    `json:"file_url"`
	ThumbnailURL string  `json:"thumbnail_url"`
	Format      string    `json:"format"`
	SizeBytes   int64     `json:"size_bytes"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// UploadRequest simulates a design upload payload.
type UploadRequest struct {
	ArtistID    string `json:"artist_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	FileName    string `json:"file_name"`
	Format      string `json:"format"`
	SizeBytes   int64  `json:"size_bytes"`
}

// DesignHandler manages design operations.
type DesignHandler struct {
	mu      sync.RWMutex
	designs map[string]*Design
}

// NewDesignHandler returns a DesignHandler seeded with demo data.
func NewDesignHandler() *DesignHandler {
	h := &DesignHandler{
		designs: make(map[string]*Design),
	}

	now := time.Now()
	seed := []Design{
		{
			ID: "dsgn-001", ArtistID: "art-001", Title: "Monstera Leaf Print",
			Description: "High-resolution monstera leaf illustration",
			FileURL:     "https://cdn.printforge.io/designs/dsgn-001/original.png",
			ThumbnailURL: "https://cdn.printforge.io/designs/dsgn-001/thumb.webp",
			Format: "PNG", SizeBytes: 4_500_000, Status: "approved", CreatedAt: now,
		},
		{
			ID: "dsgn-002", ArtistID: "art-002", Title: "Geometric Cube Set",
			Description: "Set of interlocking geometric cubes for 3D printing",
			FileURL:     "https://cdn.printforge.io/designs/dsgn-002/original.stl",
			ThumbnailURL: "https://cdn.printforge.io/designs/dsgn-002/thumb.webp",
			Format: "STL", SizeBytes: 12_300_000, Status: "approved", CreatedAt: now,
		},
	}
	for i := range seed {
		h.designs[seed[i].ID] = &seed[i]
	}

	return h
}

// List returns all designs.
func (h *DesignHandler) List(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make([]Design, 0, len(h.designs))
	for _, d := range h.designs {
		result = append(result, *d)
	}

	slog.Info("listing designs", "count", len(result), "request_id", reqID)
	writeJSON(w, http.StatusOK, map[string]any{
		"designs": result,
		"total":   len(result),
	})
}

// Upload simulates a design file upload and returns mock CDN URLs.
func (h *DesignHandler) Upload(w http.ResponseWriter, r *http.Request) {
	reqID := middleware.GetRequestID(r.Context())

	var req UploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.ArtistID == "" || req.Title == "" || req.FileName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "artist_id, title, and file_name are required",
		})
		return
	}

	if req.Format == "" {
		req.Format = "PNG"
	}
	if req.SizeBytes == 0 {
		req.SizeBytes = 2_000_000
	}

	id := generateID("dsgn")
	design := &Design{
		ID:           id,
		ArtistID:     req.ArtistID,
		Title:        req.Title,
		Description:  req.Description,
		FileURL:      fmt.Sprintf("https://cdn.printforge.io/designs/%s/original.%s", id, req.Format),
		ThumbnailURL: fmt.Sprintf("https://cdn.printforge.io/designs/%s/thumb.webp", id),
		Format:       req.Format,
		SizeBytes:    req.SizeBytes,
		Status:       "pending_review",
		CreatedAt:    time.Now(),
	}

	h.mu.Lock()
	h.designs[design.ID] = design
	h.mu.Unlock()

	slog.Info("design uploaded",
		"id", design.ID,
		"artist_id", design.ArtistID,
		"title", design.Title,
		"request_id", reqID,
	)

	writeJSON(w, http.StatusCreated, map[string]any{
		"design":     design,
		"upload_url": fmt.Sprintf("https://upload.printforge.io/presigned/%s", id),
		"message":    "Design registered. Use upload_url to upload the actual file.",
	})
}
