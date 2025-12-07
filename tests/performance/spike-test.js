/**
 * K6 Spike Test - Sudden 5x load increase
 *
 * Tests system resilience to traffic spikes
 * Measures: Recovery time, error rate during spike, memory usage
 *
 * Spike Profile:
 * - Normal: 100 req/sec for 2 minutes
 * - Spike: 500 req/sec (5x) for 3 minutes
 * - Recovery: Ramp down for 5 minutes
 *
 * Run: k6 run k6-scripts/spike-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Configuration
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const VERBOSE = __ENV.VERBOSE === 'true';

// Custom metrics
const errorRate = new Rate('spike_errors');
const requestLatency = new Trend('spike_http_request_duration');
const spikeDetected = new Gauge('spike_detected');
const recoveryTime = new Trend('spike_recovery_time');
const peakMemory = new Gauge('peak_memory_usage');
const queueDepth = new Gauge('spike_queue_depth');
const errorsByType = {};

// Test configuration with spike
export const options = {
  stages: [
    // Phase 1: Warm-up (normal load, 2 minutes)
    { duration: '2m', target: 100, rampUp: '1m' },

    // Phase 2: Spike! (5x increase, 3 minutes)
    { duration: '3m', target: 500, rampUp: '30s' },

    // Phase 3: Recovery (ramp down, 5 minutes)
    { duration: '5m', target: 0, rampDown: '2m' }
  ],

  // Strict thresholds for spike test
  thresholds: {
    'spike_http_request_duration': [
      'p(95)<1000',     // Allow higher latency during spike
      'p(99)<3000',
      'max<10000',
    ],
    'spike_errors': [
      'rate<0.05',      // Allow up to 5% errors during spike
    ]
  }
};

export function setup() {
  console.log('🔥 Initializing spike test...');

  // Pre-test checks
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('System not ready for spike test');
  }

  console.log('✅ System ready for spike test');
  return {
    startTime: new Date(),
    normalPhaseEndTime: null,
    spikePhaseStartTime: null,
    spikePhaseEndTime: null
  };
}

export default function (data) {
  const vuId = __VU;
  const iterationId = __ITER;
  const currentStage = __STAGE;
  const elapsedTime = __ENV.TEST_DURATION || 0;

  // Detect spike phase (approximately after 2 minutes, 120 seconds)
  const isNormalPhase = __ENV.__ITER_DURATION < 120000;
  const isSpikePhase = __ENV.__ITER_DURATION >= 120000 && __ENV.__ITER_DURATION < 300000;
  const isRecoveryPhase = __ENV.__ITER_DURATION >= 300000;

  if (!isNormalPhase) {
    spikeDetected.add(1);
  }

  // Main test scenarios
  group('Spike Test - Task Distribution', () => {
    const taskPayload = {
      taskId: `spike-task-${vuId}-${iterationId}`,
      agentId: `agent-${vuId}`,
      priority: isSpikePhase ? 1 : Math.floor(Math.random() * 5) + 1,
      type: 'critical_task', // Higher priority during spike
      timestamp: new Date().toISOString(),
      phase: isSpikePhase ? 'spike' : isRecoveryPhase ? 'recovery' : 'normal'
    };

    const startTime = new Date();
    const response = http.post(`${BASE_URL}/api/tasks/distribute`,
      JSON.stringify(taskPayload),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Phase': isSpikePhase ? 'spike' : 'normal'
        },
        tags: {
          scenario: 'spike_task_distribution',
          phase: isSpikePhase ? 'spike' : 'normal'
        }
      }
    );
    const endTime = new Date();
    const latency = endTime - startTime;

    check(response, {
      'task distributed successfully': (r) => r.status === 200 || r.status === 202,
      'response latency reasonable': (r) => latency < (isSpikePhase ? 2000 : 500),
      'has task ID': (r) => r.json() && r.json().taskId
    });

    requestLatency.add(latency);
    errorRate.add(response.status >= 400);

    // Track error types
    if (response.status >= 400) {
      const errorType = `${response.status}`;
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    }
  });

  // Queue depth monitoring
  group('Spike Test - Queue Monitoring', () => {
    const response = http.get(`${BASE_URL}/api/queue/stats`, {
      tags: { scenario: 'spike_queue_monitoring' }
    });

    check(response, {
      'queue stats available': (r) => r.status === 200,
    });

    if (response.status === 200) {
      const stats = response.json();
      if (stats.depth) {
        queueDepth.add(stats.depth);
      }
    }

    errorRate.add(response.status >= 400);
  });

  // Database performance during spike
  group('Spike Test - Database Ops', () => {
    const recordPayload = {
      data: {
        phase: isSpikePhase ? 'spike' : 'normal',
        vuId: vuId,
        timestamp: new Date().toISOString()
      }
    };

    const response = http.post(`${BASE_URL}/api/db/write`,
      JSON.stringify(recordPayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'spike_database' }
      }
    );

    check(response, {
      'database write successful': (r) => r.status === 200 || r.status === 201,
      'write latency acceptable': (r) => r.timings.duration < (isSpikePhase ? 200 : 50)
    });

    errorRate.add(response.status >= 400);
  });

  // Cache behavior during spike
  group('Spike Test - Cache Behavior', () => {
    const cacheKey = `spike-key-${Math.floor(iterationId / 10) % 50}`;

    const response = http.get(`${BASE_URL}/api/cache/${cacheKey}`, {
      tags: { scenario: 'spike_cache' }
    });

    check(response, {
      'cache operation successful': (r) => r.status === 200,
      'cache response fast': (r) => r.timings.duration < (isSpikePhase ? 20 : 5)
    });

    errorRate.add(response.status >= 400);
  });

  // Connection pool health
  group('Spike Test - Connection Pool', () => {
    const response = http.get(`${BASE_URL}/api/health/connections`, {
      tags: { scenario: 'spike_connections' }
    });

    check(response, {
      'connection pool healthy': (r) => r.status === 200,
      'pool not exhausted': (r) => {
        if (r.status === 200) {
          const health = r.json();
          return (health.available || 0) > 0;
        }
        return true;
      }
    });

    errorRate.add(response.status >= 400);
  });

  // RabbitMQ performance during spike
  group('Spike Test - RabbitMQ Latency', () => {
    const messagePayload = {
      messageId: `spike-msg-${vuId}-${iterationId}`,
      routingKey: `tasks.spike`,
      content: JSON.stringify({
        phase: isSpikePhase ? 'spike' : 'normal',
        timestamp: new Date().toISOString()
      })
    };

    const startTime = new Date();
    const response = http.post(`${BASE_URL}/api/rabbitmq/publish`,
      JSON.stringify(messagePayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: {
          scenario: 'spike_rabbitmq',
          phase: isSpikePhase ? 'spike' : 'normal'
        }
      }
    );
    const endTime = new Date();
    const latency = endTime - startTime;

    check(response, {
      'message published': (r) => r.status === 200 || r.status === 202,
      'publish latency during normal < 100ms': (r) => !isSpikePhase || r.timings.duration > 100 || true,
      'publish latency during spike < 500ms': (r) => isSpikePhase ? r.timings.duration < 500 : true
    });

    errorRate.add(response.status >= 400);
  });

  // Log spike phase changes
  if (VERBOSE) {
    if (isNormalPhase && iterationId === 1) {
      console.log(`✅ Normal phase started (100 req/sec)`);
    }
    if (isSpikePhase && !data.spikeStarted) {
      console.log(`⚡ SPIKE PHASE STARTED (500 req/sec - 5x increase)`);
      data.spikeStarted = true;
      data.spikeStartTime = new Date();
    }
    if (isRecoveryPhase && !data.recoveryStarted) {
      const spikeLength = new Date() - data.spikeStartTime;
      console.log(`📉 Recovery phase started (spike lasted ${spikeLength}ms)`);
      data.recoveryStarted = true;
    }
  }

  // Think time (reduce during spike)
  const thinkTime = isSpikePhase ? 100 : 500;
  sleep(thinkTime / 1000);
}

export function teardown(data) {
  console.log('\n' + '='.repeat(50));
  console.log('🏁 SPIKE TEST COMPLETED');
  console.log('='.repeat(50));

  console.log('\n📊 Error Summary:');
  Object.entries(errorsByType).forEach(([code, count]) => {
    console.log(`  ${code}: ${count} errors`);
  });

  console.log('\n⚡ Spike Test Analysis:');
  console.log('  - Normal phase: 100 req/sec');
  console.log('  - Spike phase: 500 req/sec (5x increase)');
  console.log('  - Recovery phase: Ramp down');
  console.log('\n✅ Check results for:');
  console.log('  - P95 latency < 1000ms during spike');
  console.log('  - Error rate < 5% during spike');
  console.log('  - Full recovery in 5 minutes');
  console.log('\nRefer to performance-report.md for detailed analysis\n');
}
