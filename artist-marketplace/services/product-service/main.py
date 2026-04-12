from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="product-service")
Instrumentator().instrument(app).expose(app)

_CATALOG = {
    "sku_001": {"name": "Limited Print", "price": 49.99, "stock": 120},
    "sku_002": {"name": "Signed Poster", "price": 29.99, "stock": 300},
}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/products")
def list_products():
    return {"products": _CATALOG}


@app.get("/products/{sku}")
def get_product(sku: str):
    return _CATALOG.get(sku, {"error": "not_found"})
