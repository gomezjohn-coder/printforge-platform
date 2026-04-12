from flask import Flask, jsonify, request

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/legacy-order")
def legacy_order():
    payload = request.get_json(silent=True) or {}
    return jsonify(
        order_id="legacy_ord_001",
        status="accepted",
        source="monolith",
        payload=payload,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
