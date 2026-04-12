package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/printforge/artist-service/handlers"
)

func TestHealthz(t *testing.T) {
	h := handlers.NewHealthHandler()

	tests := []struct {
		name       string
		wantStatus int
		wantBody   string
	}{
		{
			name:       "returns healthy status",
			wantStatus: http.StatusOK,
			wantBody:   "healthy",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
			rec := httptest.NewRecorder()

			h.Healthz(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("Healthz() status = %d, want %d", rec.Code, tt.wantStatus)
			}

			var body map[string]any
			json.NewDecoder(rec.Body).Decode(&body)
			if body["status"] != tt.wantBody {
				t.Errorf("Healthz() body status = %v, want %v", body["status"], tt.wantBody)
			}
		})
	}
}

func TestReadyz(t *testing.T) {
	tests := []struct {
		name       string
		ready      bool
		wantStatus int
		wantBody   string
	}{
		{
			name:       "returns ready when service is ready",
			ready:      true,
			wantStatus: http.StatusOK,
			wantBody:   "ready",
		},
		{
			name:       "returns not ready when service is not ready",
			ready:      false,
			wantStatus: http.StatusServiceUnavailable,
			wantBody:   "not_ready",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := handlers.NewHealthHandler()
			h.SetReady(tt.ready)

			req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
			rec := httptest.NewRecorder()

			h.Readyz(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("Readyz() status = %d, want %d", rec.Code, tt.wantStatus)
			}

			var body map[string]any
			json.NewDecoder(rec.Body).Decode(&body)
			if body["status"] != tt.wantBody {
				t.Errorf("Readyz() body status = %v, want %v", body["status"], tt.wantBody)
			}
		})
	}
}

func TestArtistList(t *testing.T) {
	h := handlers.NewArtistHandler()

	tests := []struct {
		name       string
		wantStatus int
		wantMin    float64
	}{
		{
			name:       "returns seeded artists",
			wantStatus: http.StatusOK,
			wantMin:    3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/artists", nil)
			rec := httptest.NewRecorder()

			h.List(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("List() status = %d, want %d", rec.Code, tt.wantStatus)
			}

			var body map[string]any
			json.NewDecoder(rec.Body).Decode(&body)
			total, ok := body["total"].(float64)
			if !ok || total < tt.wantMin {
				t.Errorf("List() total = %v, want >= %v", total, tt.wantMin)
			}
		})
	}
}

func TestArtistCreate(t *testing.T) {
	h := handlers.NewArtistHandler()

	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
	}{
		{
			name: "creates artist successfully",
			body: map[string]string{
				"name":       "Test Artist",
				"email":      "test@printforge.io",
				"bio":        "A test artist",
				"store_name": "Test Store",
			},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "rejects empty name",
			body:       map[string]string{"email": "test@printforge.io"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "rejects empty email",
			body:       map[string]string{"name": "Test Artist"},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bodyBytes, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/artists", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			h.Create(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("Create() status = %d, want %d", rec.Code, tt.wantStatus)
			}

			if tt.wantStatus == http.StatusCreated {
				var body map[string]any
				json.NewDecoder(rec.Body).Decode(&body)
				if body["id"] == nil {
					t.Error("Create() response missing 'id' field")
				}
				if body["verified"] != false {
					t.Error("Create() new artist should not be verified")
				}
			}
		})
	}
}

func TestArtistGetNotFound(t *testing.T) {
	h := handlers.NewArtistHandler()

	tests := []struct {
		name       string
		id         string
		wantStatus int
	}{
		{
			name:       "returns 404 for nonexistent artist",
			id:         "art-nonexistent",
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/artists/"+tt.id, nil)
			req.SetPathValue("id", tt.id)
			rec := httptest.NewRecorder()

			h.Get(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("Get() status = %d, want %d", rec.Code, tt.wantStatus)
			}
		})
	}
}
