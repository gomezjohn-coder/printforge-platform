from main import app


def test_health():
    client = app.test_client()
    r = client.get("/health")
    assert r.status_code == 200
    assert r.get_json() == {"status": "ok"}


def test_legacy_order():
    client = app.test_client()
    r = client.post("/legacy-order", json={"item": "x"})
    assert r.status_code == 200
    assert r.get_json()["status"] == "accepted"
