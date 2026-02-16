/**
 * K6 Load Test - Gradual load increase (10 → 100 → 1000 req/sec)
 *
 * Tests system capacity through gradual ramp-up
 * Measures: Response time (P50/P95/P99), Throughput, Error rate
 *
 * Run: k6 run k6-scripts/load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Configuration
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const DURATION = __ENV.DURATION || '15m';
const VERBOSE = __ENV.VERBOSE === 'true';

// Custom metrics
const errorRate = new Rate('errors');
const requestLatency = new Trend('http_request_duration');
const requestThroughput = new Counter('request_count');
const agentTaskLatency = new Trend('agent_task_latency');
const databaseQueryLatency = new Trend('db_query_latency');
const cacheHitRatio = new Gauge('cache_hit_ratio');
const rabbitMQLatency = new Trend('rabbitmq_latency');
const activeConnections = new Gauge('active_connections');

// Test configuration
export const options = {
  stages: [
    // Phase 1: Warm-up (10 VUs, 2 minutes)
    // Simulates 10 requests/sec with 100ms response time
    { duration: '2m', target: 10, rampUp: '30s' },

    // Phase 2: Low load (50 VUs, 3 minutes)
    // Simulates 50 requests/sec
    { duration: '3m', target: 50 },

    // Phase 3: Medium load (100 VUs, 3 minutes)
    // Simulates 100 requests/sec
    { duration: '3m', target: 100 },

    // Phase 4: High load (500 VUs, 3 minutes)
    // Simulates 500 requests/sec
    { duration: '3m', target: 500 },

    // Phase 5: Peak load (1000 VUs, 5 minutes)
    // Simulates 1000 requests/sec
    { duration: '5m', target: 1000 },

    // Phase 6: Cool-down (Ramp down, 3 minutes)
    { duration: '3m', target: 0, rampDown: '1m' }
  ],

  // Performance thresholds
  thresholds: {
    'http_req_duration': [
      'p(95)<500',      // P95 response time < 500ms (critical)
      'p(99)<2000',     // P99 response time < 2000ms
      'max<5000',       // Max response time < 5 seconds
    ],
    'http_req_failed': [
      'rate<0.001',     // Error rate < 0.1% (critical)
    ],
    'errors': [
      'rate<0.001',     // Error metric < 0.1%
    ],
    'request_count': [
      'value>1000',     // At least 1000 requests completed
    ],
  }
};

/**
 * Mock API endpoints for testing
 * In production, these would be real API calls
 */

export function setup() {
  // Warm up - make initial requests
  console.log('🔥 Warming up system...');

  for (let i = 0; i < 10; i++) {
    http.get(`${BASE_URL}/health`, { tags: { name: 'warmup' } });
  }

  console.log('✅ Warm-up complete');
  return {};
}

export default function (data) {
  const startTime = new Date();
  const vuId = __VU;
  const iterationId = __ITER;

  // Log every 100th request
  if (iterationId % 100 === 0 && VERBOSE) {
    console.log(`VU ${vuId}: Iteration ${iterationId}`);
  }

  // Test 1: Health check (baseline)
  group('1. Health Check', () => {
    const response = http.get(`${BASE_URL}/health`, {
      tags: { scenario: 'health_check' }
    });

    check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 50ms': (r) => r.timings.duration < 50,
    });

    requestLatency.add(response.timings.duration);
    errorRate.add(response.status >= 400);
    requestThroughput.add(1);
  });

  // Test 2: Agent task distribution (main workload)
  // Simulates distributing tasks to agents
  group('2. Agent Task Distribution', () => {
    const taskPayload = {
      agentId: `agent-${vuId}-${iterationId}`,
      taskType: 'brainstorm',
      priority: Math.floor(Math.random() * 5) + 1,
      dataSize: Math.floor(Math.random() * 1000) + 100,
      timestamp: new Date().toISOString()
    };

    const response = http.post(`${BASE_URL}/api/tasks/distribute`,
      JSON.stringify(taskPayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'task_distribution' }
      }
    );

    check(response, {
      'task distribution status is 200': (r) => r.status === 200,
      'task distribution latency < 100ms': (r) => r.timings.duration < 100,
      'task has valid ID': (r) => r.json() && r.json().taskId
    });

    agentTaskLatency.add(response.timings.duration);
    errorRate.add(response.status >= 400);
    requestThroughput.add(1);
  });

  // Test 3: Voting consensus (concurrent voting)
  group('3. Voting Consensus', () => {
    const votePayload = {
      proposalId: `proposal-${Math.floor(iterationId / 10)}`,
      agentId: `agent-${vuId}`,
      vote: Math.random() > 0.5 ? 'yes' : 'no',
      confidence: Math.random() * 100,
      timestamp: new Date().toISOString()
    };

    const response = http.post(`${BASE_URL}/api/voting/submit-vote`,
      JSON.stringify(votePayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'voting' }
      }
    );

    check(response, {
      'vote submission status is 200': (r) => r.status === 200,
      'vote submission latency < 200ms': (r) => r.timings.duration < 200,
    });

    errorRate.add(response.status >= 400);
    requestThroughput.add(1);
  });

  // Test 4: Database CRUD operations
  group('4. Database Operations', () => {
    const dbOperationType = [
      'INSERT',
      'SELECT',
      'UPDATE',
      'DELETE'
    ][iterationId % 4];

    const recordPayload = {
      id: iterationId,
      agentId: `agent-${vuId}`,
      data: {
        value: Math.random() * 1000,
        timestamp: new Date().toISOString(),
        operationType: dbOperationType
      }
    };

    const response = http.post(`${BASE_URL}/api/db/${dbOperationType.toLowerCase()}`,
      JSON.stringify(recordPayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'database_crud', operation: dbOperationType }
      }
    );

    check(response, {
      'database operation status is 200': (r) => r.status === 200,
      'database operation latency < 50ms': (r) => r.timings.duration < 50,
    });

    databaseQueryLatency.add(response.timings.duration);
    errorRate.add(response.status >= 400);
    requestThroughput.add(1);
  });

  // Test 5: Cache performance
  group('5. Cache Performance', () => {
    const cacheKey = `key-${iterationId % 100}`; // 1% hit rate variance

    const response = http.get(`${BASE_URL}/api/cache/${cacheKey}`, {
      tags: { scenario: 'cache' }
    });

    const isHit = response.headers['X-Cache-Hit'] === 'true';

    check(response, {
      'cache read status is 200': (r) => r.status === 200,
      'cache latency < 5ms for hits': (r) => {
        if (isHit) return r.timings.duration < 5;
        return true;
      },
      'cache latency < 50ms for misses': (r) => {
        if (!isHit) return r.timings.duration < 50;
        return true;
      }
    });

    cacheHitRatio.add(isHit ? 100 : 0);
    errorRate.add(response.status >= 400);
    requestThroughput.add(1);
  });

  // Test 6: RabbitMQ message operations (simulated)
  group('6. RabbitMQ Performance', () => {
    const messagePayload = {
      messageId: `msg-${vuId}-${iterationId}`,
      routingKey: `tasks.${['brainstorm', 'voting', 'execute'][iterationId % 3]}`,
      content: JSON.stringify({
        data: Math.random() * 10000,
        timestamp: new Date().toISOString()
      })
    };

    const response = http.post(`${BASE_URL}/api/rabbitmq/publish`,
      JSON.stringify(messagePayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'rabbitmq' }
      }
    );

    check(response, {
      'rabbitmq publish status is 200': (r) => r.status === 200,
      'rabbitmq latency < 100ms': (r) => r.timings.duration < 100,
    });

    rabbitMQLatency.add(response.timings.duration);
    errorRate.add(response.status >= 400);
    requestThroughput.add(1);
  });

  // Test 7: Metrics and monitoring
  group('7. Metrics Collection', () => {
    const response = http.get(`${BASE_URL}/api/metrics`, {
      tags: { scenario: 'metrics' }
    });

    check(response, {
      'metrics endpoint status is 200': (r) => r.status === 200,
      'metrics response includes data': (r) => r.json() && Object.keys(r.json()).length > 0
    });

    errorRate.add(response.status >= 400);
    requestThroughput.add(1);
  });

  // Update active connections gauge
  activeConnections.add(__VU);

  // Think time (simulates user think time)
  const thinkTime = Math.random() * 1000 + 500; // 0.5-1.5 seconds
  sleep(thinkTime / 1000);

  const endTime = new Date();
  const totalIterationTime = endTime - startTime;

  if (VERBOSE && iterationId % 100 === 0) {
    console.log(`VU ${vuId}: Total iteration time: ${totalIterationTime}ms`);
  }
}

export function teardown(data) {
  console.log('🏁 Load test completed');
  console.log(`Total requests: ${requestThroughput.value || 0}`);
  console.log(`Error rate: ${(errorRate.value * 100).toFixed(2)}%`);
}
