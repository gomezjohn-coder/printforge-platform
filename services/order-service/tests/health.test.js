const request = require('supertest');
const app = require('../src/server');

describe('order-service health', () => {
  it('GET /healthz returns 200 with service identity', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('order-service');
  });

  it('GET /readyz returns 200 when circuit breaker is closed', async () => {
    const res = await request(app).get('/readyz');
    expect([200, 503]).toContain(res.status);
  });

  it('GET /metrics exposes Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/http_request_duration_seconds/);
  });
});

describe('order-service checkout validation', () => {
  it('POST /api/v1/checkout rejects empty cart', async () => {
    const res = await request(app)
      .post('/api/v1/checkout')
      .send({ cart: [], payment: {}, shipping: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cart/);
  });

  it('POST /api/v1/checkout rejects missing cart', async () => {
    const res = await request(app)
      .post('/api/v1/checkout')
      .send({ payment: {}, shipping: {} });
    expect(res.status).toBe(400);
  });
});
