from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_list_products():
    r = client.get("/products")
    assert r.status_code == 200
    assert "sku_001" in r.json()["products"]
