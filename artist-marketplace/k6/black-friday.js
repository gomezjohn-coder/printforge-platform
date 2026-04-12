import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },    // ramp up
    { duration: '5m', target: 150 },   // 3x normal load
    { duration: '2m', target: 0 },     // cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],   // SLO: p95 < 300ms
    http_req_failed:   ['rate<0.001'],  // SLO: 99.9% availability
  },
};

export default function () {
  const res = http.post(
    'http://order-service/orders',
    JSON.stringify({ product_id: 'sku_001', quantity: 1 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
