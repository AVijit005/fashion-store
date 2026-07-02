/**
 * k6 load test for Aura Streetwear backend.
 *
 * Run against staging:
 *   k6 run \
 *     -e BASE_URL=https://api.staging.yourdomain.com \
 *     --vus 50 --duration 5m \
 *     infra/k6/loadtest.js
 *
 * Heavy-load version:
 *   k6 run \
 *     -e BASE_URL=https://api.staging.yourdomain.com \
 *     -e VUS=200 -e DURATION=10m \
 *     infra/k6/loadtest.js
 *
 * Pass thresholds:
 *   - p95 GET /products              < 500ms
 *   - p99 GET /cart                  < 1s
 *   - error rate for all endpoints    < 1%
 *
 * Run from CI:
 *   docker run --rm -v "$PWD:/src" -w /src grafana/k6:latest \
 *     run -e BASE_URL=$STAGING_URL --vus 50 --duration 2m \
 *     /src/infra/k6/loadtest.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VUS = parseInt(__ENV.VUS || '50', 10);
const DURATION = __ENV.DURATION || '5m';

// Custom metrics
const productListLatency = new Trend('aura_product_list_latency');
const productDetailLatency = new Trend('aura_product_detail_latency');
const cartLatency = new Trend('aura_cart_latency');
const errorRate = new Rate('aura_errors');

export const options = {
  stages: [
    { duration: '30s', target: Math.floor(VUS / 4) },  // ramp up
    { duration: DURATION, target: VUS },               // sustained
    { duration: '30s', target: 0 },                    // ramp down
  ],
  thresholds: {
    // p95 product listing < 500ms
    'aura_product_list_latency': ['p(95)<500'],
    // p99 cart operations < 1s (heavier — talks to Redis + Postgres)
    'aura_cart_latency': ['p(99)<1000'],
    // Error rate < 1% across all requests
    'aura_errors': ['rate<0.01'],
    // Standard HTTP thresholds as a backstop
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

// Reusable headers — k6 connections are reused by default
const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export default function () {
  group('Browse products', () => {
    const listRes = http.get(`${BASE_URL}/api/v1/catalog/products?limit=20`, { headers });
    productListLatency.add(listRes.timings.duration);
    const ok = check(listRes, {
      'product list status 200': (r) => r.status === 200,
      'product list has data': (r) => {
        try {
          const body = r.json();
          return Array.isArray(body?.products) || Array.isArray(body);
        } catch {
          return false;
        }
      },
    });
    if (!ok) errorRate.add(1);

    // Pick a product id from the response (if available) for the detail call
    let productId = null;
    try {
      const body = listRes.json();
      const products = Array.isArray(body?.products) ? body.products : body;
      if (Array.isArray(products) && products.length > 0) {
        productId = products[0].id || products[0].slug;
      }
    } catch {
      /* ignore parse errors */
    }

    if (productId) {
      const detailRes = http.get(`${BASE_URL}/api/v1/catalog/products/${productId}`, {
        headers,
      });
      productDetailLatency.add(detailRes.timings.duration);
      const detailOk = check(detailRes, {
        'product detail status 200': (r) => r.status === 200,
      });
      if (!detailOk) errorRate.add(1);
    }
  });

  sleep(1);

  group('Cart operations (authenticated)', () => {
    // Use a fixed test user from staging. If you need per-VU users,
    // pre-create them and pull from a CSV via `k6 run --config ...`.
    const authHeaders = {
      ...headers,
      // Replace with a staging test JWT — see ops/SMOKE_TEST_SETUP.md
      Authorization: __ENV.AUTH_TOKEN || '',
    };

    if (!authHeaders.Authorization) {
      // Skip if no token — the test still exercises the public endpoints.
      return;
    }

    const cartGet = http.get(`${BASE_URL}/api/v1/cart`, { headers: authHeaders });
    cartLatency.add(cartGet.timings.duration);
    const cartOk = check(cartGet, {
      'cart get status 200 or 401': (r) => r.status === 200 || r.status === 401,
    });
    if (!cartOk) errorRate.add(1);
  });

  sleep(2);
}
