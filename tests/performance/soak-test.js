/**
 * K6 Soak Test - 30 minute sustained load test
 *
 * Detects memory leaks, connection pool issues, and performance degradation
 * Runs sustained load for 30 minutes with periodic checks
 *
 * Metrics tracked:
 * - Memory growth over time
 * - GC pause duration
 * - Connection pool health
 * - Cache hit/miss ratios
 *
 * Run: k6 run k6-scripts/soak-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Configuration
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const SOAK_DURATION = __ENV.SOAK_DURATION || '30m'; // 30 minutes
const VERBOSE = __ENV.VERBOSE === 'true';

// Custom metrics for soak testing
const soakErrorRate = new Rate('soak_errors');
const soakLatency = new Trend('soak_http_request_duration');
const memoryUsage = new Gauge('soak_memory_usage');
const connectionPoolSize = new Gauge('soak_connection_pool_size');
const cacheHitRate = new Gauge('soak_cache_hit_ratio');
const gcPauseDuration = new Gauge('soak_gc_pause_ms');
const requestCount = new Counter('soak_request_count');
const uptime = new Gauge('soak_uptime_minutes');
const errorsByMinute = {}; // Track errors per minute
const latencyByMinute = {}; // Track avg latency per minute

// Test configuration - sustained load for 30 minutes
export const options = {
  stages: [
    // Single stage: sustained load for 30 minutes
    // Using low VU count but sustained to avoid system overload
    { duration: SOAK_DURATION, target: 50 } // 50 VUs = ~50-100 req/sec sustained
  ],

  // Relaxed thresholds for soak test (detecting degradation)
  thresholds: {
    'soak_http_request_duration': [
      'p(95)<1000',     // Allow higher latency as we're testing degradation
      'p(99)<3000',
      'max<10000',
    ],
    'soak_errors': [
      'rate<0.01',      // Error rate < 1% over soak period
    ],
    'soak_request_count': [
      'value>1000',     // Complete at least 1000 requests
    ]
  }
};

export function setup() {
  console.log('🔥 Starting 30-minute soak test...');
  console.log('   This will help identify memory leaks and degradation');

  // Sanity check
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('System not ready for soak test');
  }

  console.log('✅ System ready. Starting sustained load test...\n');

  return {
    startTime: new Date(),
    lastMemoryCheck: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    errorsSoFar: 0,
    latencySamples: [],
    minuteTracker: 0
  };
}

export default function (data) {
  const vuId = __VU;
  const iterationId = __ITER;
  const executionTime = new Date() - data.startTime;
  const currentMinute = Math.floor(executionTime / 60000);

  // Track metrics per minute
  if (!errorsByMinute[currentMinute]) {
    errorsByMinute[currentMinute] = 0;
    latencyByMinute[currentMinute] = [];

    if (VERBOSE && currentMinute > 0) {
      const prevMinute = currentMinute - 1;
      const avgLatency = latencyByMinute[prevMinute].length > 0
        ? latencyByMinute[prevMinute].reduce((a, b) => a + b, 0) / latencyByMinute[prevMinute].length
        : 0;
      console.log(`Minute ${prevMinute}: ${errorsByMinute[prevMinute]} errors, avg latency: ${avgLatency.toFixed(0)}ms`);
    }
  }

  // Update uptime
  uptime.add(executionTime / 60000);

  // Group 1: Main workload - task distribution (sustained)
  group('Soak Test - Main Workload', () => {
    const taskPayload = {
      taskId: `soak-task-${vuId}-${iterationId}`,
      agentId: `agent-${vuId}`,
      priority: Math.floor(Math.random() * 3) + 1,
      type: 'sustained_task',
      timestamp: new Date().toISOString(),
      executionMinute: currentMinute
    };

    const response = http.post(`${BASE_URL}/api/tasks/distribute`,
      JSON.stringify(taskPayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'soak_main_workload' }
      }
    );

    check(response, {
      'task distributed': (r) => r.status === 200 || r.status === 202,
      'response time acceptable': (r) => r.timings.duration < 1000,
    });

    soakLatency.add(response.timings.duration);
    soakErrorRate.add(response.status >= 400);
    requestCount.add(1);
    data.totalRequests++;

    if (response.status >= 400) {
      errorsByMinute[currentMinute]++;
      data.errorsSoFar++;
    }
    latencyByMinute[currentMinute].push(response.timings.duration);
  });

  // Group 2: Database operations (sustained)
  group('Soak Test - Database', () => {
    const dbPayload = {
      data: {
        soakId: `soak-${currentMinute}`,
        iteration: iterationId,
        timestamp: new Date().toISOString()
      }
    };

    const response = http.post(`${BASE_URL}/api/db/write`,
      JSON.stringify(dbPayload),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { scenario: 'soak_database' }
      }
    );

    check(response, {
      'database write ok': (r) => r.status === 200 || r.status === 201,
    });

    soakErrorRate.add(response.status >= 400);
    requestCount.add(1);
  });

  // Group 3: Cache operations (measure hit ratio)
  group('Soak Test - Cache Operations', () => {
    // Vary cache keys to simulate realistic hit/miss ratio
    const cacheKey = `soak-key-${Math.floor(iterationId / (Math.random() > 0.8 ? 5 : 20)) % 100}`;

    const response = http.get(`${BASE_URL}/api/cache/${cacheKey}`, {
      tags: { scenario: 'soak_cache' }
    });

    check(response, {
      'cache read ok': (r) => r.status === 200,
    });

    const isCacheHit = response.headers['X-Cache-Hit'] === 'true';
    if (isCacheHit) {
      data.cacheHits++;
    } else {
      data.cacheMisses++;
    }

    // Calculate and update cache hit ratio
    const totalCacheOps = data.cacheHits + data.cacheMisses;
    if (totalCacheOps > 0) {
      cacheHitRate.add((data.cacheHits / totalCacheOps) * 100);
    }

    soakErrorRate.add(response.status >= 400);
    requestCount.add(1);
  });

  // Group 4: Periodic health and resource checks (every 100 iterations)
  if (iterationId % 100 === 0) {
    group('Soak Test - Health & Resources', () => {
      // Health check
      const healthResponse = http.get(`${BASE_URL}/health`, {
        tags: { scenario: 'soak_health' }
      });

      check(healthResponse, {
        'system healthy': (r) => r.status === 200,
      });

      // Metrics check
      const metricsResponse = http.get(`${BASE_URL}/api/metrics`, {
        tags: { scenario: 'soak_metrics' }
      });

      if (metricsResponse.status === 200) {
        const metrics = metricsResponse.json();

        // Track memory usage
        if (metrics.memory) {
          memoryUsage.add(metrics.memory.heapUsed || 0);
        }

        // Track connection pool
        if (metrics.connections) {
          connectionPoolSize.add(metrics.connections.active || 0);
        }

        // Track GC pauses
        if (metrics.gc && metrics.gc.pauseMs) {
          gcPauseDuration.add(metrics.gc.pauseMs);
        }
      }

      soakErrorRate.add(metricsResponse.status >= 400);
    });
  }

  // Group 5: Connection pool stress test (every 500 iterations)
  if (iterationId % 500 === 0) {
    group('Soak Test - Connection Pool Stress', () => {
      const response = http.get(`${BASE_URL}/api/health/connections`, {
        tags: { scenario: 'soak_connection_stress' }
      });

      check(response, {
        'connection pool available': (r) => r.status === 200,
        'not exhausted': (r) => {
          if (r.status === 200) {
            const health = r.json();
            return (health.available || 0) > 0;
          }
          return true;
        }
      });

      soakErrorRate.add(response.status >= 400);
    });
  }

  // Reduce think time for sustained load
  const thinkTime = 100 + Math.random() * 100; // 100-200ms
  sleep(thinkTime / 1000);
}

export function teardown(data) {
  const duration = new Date() - data.startTime;
  const durationMinutes = duration / 60000;
  const errorRate = data.totalRequests > 0
    ? ((data.errorsSoFar / data.totalRequests) * 100).toFixed(2)
    : 0;

  const cacheHitRatio = (data.cacheHits + data.cacheMisses) > 0
    ? ((data.cacheHits / (data.cacheHits + data.cacheMisses)) * 100).toFixed(2)
    : 0;

  console.log('\n' + '='.repeat(60));
  console.log('🏁 SOAK TEST COMPLETED');
  console.log('='.repeat(60));

  console.log('\n📊 Soak Test Summary:');
  console.log(`  Duration: ${durationMinutes.toFixed(1)} minutes`);
  console.log(`  Total Requests: ${data.totalRequests}`);
  console.log(`  Total Errors: ${data.errorsSoFar}`);
  console.log(`  Error Rate: ${errorRate}%`);
  console.log(`  Cache Hit Ratio: ${cacheHitRatio}%`);

  console.log('\n🔍 Analysis Points:');
  console.log('  1. Memory Growth: Check if memory increases linearly');
  console.log('  2. Connection Pool: Should remain stable (not exhausting)');
  console.log('  3. Error Rate: Should remain consistent (< 1%)');
  console.log('  4. Cache Performance: Hit ratio should stabilize');
  console.log('  5. GC Pauses: Should not increase significantly');

  console.log('\n⚠️  Red Flags:');
  console.log('  - Linear memory growth → Possible memory leak');
  console.log('  - Increasing error rate → Degradation over time');
  console.log('  - Growing GC pauses → Memory pressure');
  console.log('  - Connection pool exhaustion → Connection leak');

  console.log('\nRefer to performance-report.md for detailed analysis\n');
}
