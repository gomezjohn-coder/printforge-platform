from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
import time
import random

app = FastAPI(title="order-service")

Instrumentator().instrument(app).expose(app)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/orders")
def create_order(payload: dict):
    # Simulate processing time (inject latency for SLO demo)
    time.sleep(random.uniform(0.05, 0.15))
    return {"order_id": "ord_123", "status": "confirmed", "payload": payload}
