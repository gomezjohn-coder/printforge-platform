from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="artist-service")
Instrumentator().instrument(app).expose(app)

_ARTISTS: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/artists/{artist_id}")
def get_artist(artist_id: str):
    return _ARTISTS.get(artist_id, {"artist_id": artist_id, "name": "Unknown"})


@app.post("/artists")
def create_artist(payload: dict):
    artist_id = payload.get("id", "art_001")
    _ARTISTS[artist_id] = payload
    return {"artist_id": artist_id, "status": "created"}
