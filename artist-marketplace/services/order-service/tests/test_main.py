from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_order():
    r = client.post("/orders", json={"product_id": "sku_001", "quantity": 1})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "confirmed"
    assert "order_id" in body
