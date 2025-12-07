/**
 * K6 Infrastructure Performance Test
 *
 * Tests actual running services:
 * - RabbitMQ Management API (15672)
 * - Prometheus Metrics (9090)
 * - Grafana Health (3000)
 * - PostgreSQL (via health endpoint if available)
 *
 * Run: k6 run tests/performance/infrastructure-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import encoding from 'k6/encoding';

// Custom metrics
const errorRate = new Rate('errors');
const requestLatency = new Trend('http_request_duration');
const requestThroughput = new Counter('request_count');

// Test configuration - SHORT duration for baseline
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Warm-up: 5 VUs
    { duration: '1m', target: 20 },   // Load: 20 VUs
    { duration: '1m', target: 50 },   // Peak: 50 VUs
    { duration: '30s', target: 0 },   // Ramp-down
  ],

  thresholds: {
    'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
    'http_req_failed': ['rate<0.05'],  // 5% error tolerance
    'errors': ['rate<0.05'],
  }
};

export function setup() {
  console.log('🔥 Infrastructure Performance Test Starting...');
  console.log('📊 Testing: RabbitMQ, Prometheus, Grafana');
  return {};
}

export default function () {
  // Test 1: RabbitMQ Management API
  group('RabbitMQ Management API', () => {
    const rabbitmqUrl = 'http://localhost:15672/api/overview';
    const response = http.get(rabbitmqUrl, {
      headers: {
        'Authorization': 'Basic ' + encoding.b64encode('admin:rabbitmq123')
      },
      tags: { service: 'rabbitmq' }
    });

    const success = check(response, {
      'RabbitMQ API responds': (r) => r.status === 200,
      'RabbitMQ response time < 500ms': (r) => r.timings.duration < 500,
      'RabbitMQ has version info': (r) => {
        try {
          return r.json() && r.json().rabbitmq_version;
        } catch (e) {
          return false;
        }
      }
    });

    requestLatency.add(response.timings.duration);
    errorRate.add(!success);
    requestThroughput.add(1);
  });

  // Test 2: Prometheus Metrics
  group('Prometheus Metrics', () => {
    const prometheusUrl = 'http://localhost:9090/api/v1/status/config';
    const response = http.get(prometheusUrl, {
      tags: { service: 'prometheus' }
    });

    const success = check(response, {
      'Prometheus API responds': (r) => r.status === 200,
      'Prometheus response time < 500ms': (r) => r.timings.duration < 500,
      'Prometheus has config': (r) => {
        try {
          return r.json() && r.json().status === 'success';
        } catch (e) {
          return false;
        }
      }
    });

    requestLatency.add(response.timings.duration);
    errorRate.add(!success);
    requestThroughput.add(1);
  });

  // Test 3: Prometheus Query Performance
  group('Prometheus Query', () => {
    const query = encodeURIComponent('up');
    const queryUrl = `http://localhost:9090/api/v1/query?query=${query}`;
    const response = http.get(queryUrl, {
      tags: { service: 'prometheus', type: 'query' }
    });

    const success = check(response, {
      'Prometheus query responds': (r) => r.status === 200,
      'Prometheus query time < 1000ms': (r) => r.timings.duration < 1000,
    });

    requestLatency.add(response.timings.duration);
    errorRate.add(!success);
    requestThroughput.add(1);
  });

  // Test 4: Grafana Health
  group('Grafana Health', () => {
    const grafanaUrl = 'http://localhost:3000/api/health';
    const response = http.get(grafanaUrl, {
      tags: { service: 'grafana' }
    });

    const success = check(response, {
      'Grafana health responds': (r) => r.status === 200,
      'Grafana response time < 500ms': (r) => r.timings.duration < 500,
    });

    requestLatency.add(response.timings.duration);
    errorRate.add(!success);
    requestThroughput.add(1);
  });

  // Test 5: RabbitMQ Queues List
  group('RabbitMQ Queues', () => {
    const queuesUrl = 'http://localhost:15672/api/queues';
    const response = http.get(queuesUrl, {
      headers: {
        'Authorization': 'Basic ' + encoding.b64encode('admin:rabbitmq123')
      },
      tags: { service: 'rabbitmq', type: 'queues' }
    });

    const success = check(response, {
      'RabbitMQ queues API responds': (r) => r.status === 200,
      'RabbitMQ queues response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    requestLatency.add(response.timings.duration);
    errorRate.add(!success);
    requestThroughput.add(1);
  });

  // Think time
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function teardown(data) {
  console.log('');
  console.log('🏁 Infrastructure Performance Test Complete');
  console.log('═══════════════════════════════════════════');
  console.log(`📊 Total Requests: ${requestThroughput.value || 0}`);
  console.log(`❌ Error Rate: ${((errorRate.value || 0) * 100).toFixed(2)}%`);
  console.log('');
}
