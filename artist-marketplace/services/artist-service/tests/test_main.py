from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_create_artist():
    r = client.post("/artists", json={"id": "art_001", "name": "Nina"})
    assert r.status_code == 200
    assert r.json()["status"] == "created"
