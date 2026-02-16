/**
 * Example Custom K6 Test
 *
 * This is a template for creating custom K6 tests
 * Use this as a reference for your own test scenarios
 *
 * Run: k6 run k6-scripts/example-custom-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const DURATION = __ENV.DURATION || '5m';
const VERBOSE = __ENV.VERBOSE === 'true';

// Custom Metrics
const errorRate = new Rate('custom_errors');
const requestLatency = new Trend('custom_http_request_duration');
const customMetric = new Counter('custom_metric');

// ============================================================================
// Test Configuration
// ============================================================================

export const options = {
  // Define test stages (ramp-up pattern)
  stages: [
    { duration: '1m', target: 10 },    // Ramp-up
    { duration: '2m', target: 20 },    // Stay at 20 VUs
    { duration: '1m', target: 0 },     // Ramp-down
  ],

  // Define performance thresholds
  thresholds: {
    'custom_http_request_duration': [
      'p(95)<500',      // 95th percentile must be below 500ms
      'max<2000',       // Max latency must be below 2 seconds
    ],
    'custom_errors': [
      'rate<0.1',       // Error rate must be below 10%
    ],
  },

  // Define extended options
  ext: {
    loadimpact: {
      projectID: 123456,  // Your LoadImpact project ID
      name: 'Custom Test'
    }
  }
};

// ============================================================================
// Setup & Teardown
// ============================================================================

export function setup() {
  // Pre-test setup
  console.log('🔧 Setting up test environment...');

  // Sanity check
  const response = http.get(`${BASE_URL}/health`);
  if (response.status !== 200) {
    throw new Error('System not ready for testing');
  }

  console.log('✅ Setup complete');
  return { startTime: new Date() };
}

export function teardown(data) {
  // Post-test cleanup
  const duration = new Date() - data.startTime;
  console.log(`✅ Test complete (${Math.round(duration / 1000)}s)`);
}

// ============================================================================
// Main Test Function
// ============================================================================

export default function (data) {
  // Get test metadata
  const vuId = __VU;                    // Virtual user ID
  const iterationId = __ITER;           // Iteration number
  const now = new Date();

  // Log every 100th iteration
  if (VERBOSE && iterationId % 100 === 0) {
    console.log(`VU ${vuId}: Iteration ${iterationId}`);
  }

  // =========================================================================
  // Test Group 1: Basic Endpoint Test
  // =========================================================================

  group('1. Health Check', () => {
    // Make request
    const response = http.get(`${BASE_URL}/health`);

    // Verify response
    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 100ms': (r) => r.timings.duration < 100,
      'has correct content': (r) => r.body.includes('OK'),
    });

    // Track metrics
    requestLatency.add(response.timings.duration);
    errorRate.add(response.status >= 400);
    customMetric.add(1);
  });

  // =========================================================================
  // Test Group 2: POST Request with Payload
  // =========================================================================

  group('2. Create Task', () => {
    // Prepare payload
    const payload = {
      taskId: `task-${vuId}-${iterationId}`,
      name: `Test Task ${iterationId}`,
      priority: Math.floor(Math.random() * 5) + 1,
      data: {
        timestamp: now.toISOString(),
        randomValue: Math.random() * 1000
      }
    };

    // Make request
    const response = http.post(
      `${BASE_URL}/api/tasks`,
      JSON.stringify(payload),
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'K6-Test'
        },
        tags: { name: 'CreateTask' }  // Tag for metrics
      }
    );

    // Verify response
    check(response, {
      'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'response time < 200ms': (r) => r.timings.duration < 200,
      'has task ID': (r) => {
        try {
          return r.json().taskId != null;
        } catch {
          return false;
        }
      },
    });

    // Track metrics
    requestLatency.add(response.timings.duration);
    errorRate.add(response.status >= 400);
  });

  // =========================================================================
  // Test Group 3: Multiple Sequential Requests
  // =========================================================================

  group('3. Sequential Operations', () => {
    // Operation 1: Create
    const createResponse = http.post(
      `${BASE_URL}/api/data`,
      JSON.stringify({ value: Math.random() * 100 }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (createResponse.status === 200 || createResponse.status === 201) {
      const dataId = createResponse.json().id;

      // Operation 2: Read
      const readResponse = http.get(`${BASE_URL}/api/data/${dataId}`);
      check(readResponse, {
        'read status 200': (r) => r.status === 200
      });
      requestLatency.add(readResponse.timings.duration);

      // Operation 3: Update
      const updateResponse = http.put(
        `${BASE_URL}/api/data/${dataId}`,
        JSON.stringify({ value: Math.random() * 100 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(updateResponse, {
        'update status 200': (r) => r.status === 200
      });
      requestLatency.add(updateResponse.timings.duration);

      // Operation 4: Delete
      const deleteResponse = http.del(`${BASE_URL}/api/data/${dataId}`);
      check(deleteResponse, {
        'delete status 200 or 204': (r) => r.status === 200 || r.status === 204
      });
      requestLatency.add(deleteResponse.timings.duration);
    }

    errorRate.add(createResponse.status >= 400);
  });

  // =========================================================================
  // Test Group 4: Conditional Logic
  // =========================================================================

  group('4. Conditional Test', () => {
    const response = http.get(`${BASE_URL}/api/random`);

    if (response.status === 200) {
      const data = response.json();

      if (data.type === 'success') {
        check(response, {
          'success type received': (r) => r.json().type === 'success'
        });
      } else if (data.type === 'error') {
        check(response, {
          'error handled gracefully': (r) => r.status >= 400
        });
      }
    }

    requestLatency.add(response.timings.duration);
    errorRate.add(response.status >= 400);
  });

  // =========================================================================
  // Pause/Think Time
  // =========================================================================

  // Simulate user think time (random 0.5-1.5 seconds)
  const thinkTime = 500 + Math.random() * 1000;
  sleep(thinkTime / 1000);
}

// ============================================================================
// Helper Functions (Optional)
// ============================================================================

/**
 * Generate random user ID
 * @returns {string} Random user ID
 */
function generateUserId() {
  return `user-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse JSON response safely
 * @param {Response} response - HTTP response
 * @returns {object|null} Parsed JSON or null
 */
function parseJSON(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Extract error message from response
 * @param {Response} response - HTTP response
 * @returns {string} Error message
 */
function getErrorMessage(response) {
  const body = parseJSON(response);
  return body?.message || response.body || response.statusText;
}

// ============================================================================
// Export Utilities (for reuse in other tests)
// ============================================================================

export const utils = {
  generateUserId,
  parseJSON,
  getErrorMessage
};

/**
 * Usage Examples
 *
 * 1. Run with custom parameters:
 *    k6 run -u 50 -d 10m -e API_BASE_URL=https://api.example.com example-custom-test.js
 *
 * 2. Run with verbose output:
 *    VERBOSE=true k6 run example-custom-test.js
 *
 * 3. Save results to JSON:
 *    k6 run --out json=results.json example-custom-test.js
 *
 * 4. Run with tags for filtering:
 *    k6 run --include-tags "smoke" example-custom-test.js
 *
 * 5. Run in cloud (LoadImpact):
 *    k6 cloud example-custom-test.js
 */
