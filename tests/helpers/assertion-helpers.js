/**
 * Custom Assertion Helpers
 * Specialized assertions for testing multi-agent systems
 */

import { jest } from '@jest/globals';

/**
 * Assert message was sent
 */
export function assertMessageSent(channel, queueName, predicate) {
  const calls = channel.sendToQueue.mock.calls;
  const matchingCall = calls.find(call => {
    if (call[0] !== queueName) return false;

    try {
      const content = JSON.parse(call[1].toString());
      return predicate ? predicate(content) : true;
    } catch {
      return false;
    }
  });

  if (!matchingCall) {
    throw new Error(
      `Expected message to be sent to queue "${queueName}" ` +
      `${predicate ? 'matching predicate' : ''}\n` +
      `Actual calls: ${JSON.stringify(calls.map(c => c[0]))}`
    );
  }

  return JSON.parse(matchingCall[1].toString());
}

/**
 * Assert message was published to exchange
 */
export function assertMessagePublished(channel, exchangeName, routingKey, predicate) {
  const calls = channel.publish.mock.calls;
  const matchingCall = calls.find(call => {
    if (call[0] !== exchangeName) return false;
    if (routingKey && call[1] !== routingKey) return false;

    try {
      const content = JSON.parse(call[2].toString());
      return predicate ? predicate(content) : true;
    } catch {
      return false;
    }
  });

  if (!matchingCall) {
    throw new Error(
      `Expected message to be published to exchange "${exchangeName}" ` +
      `${routingKey ? `with routing key "${routingKey}" ` : ''}` +
      `${predicate ? 'matching predicate' : ''}`
    );
  }

  return JSON.parse(matchingCall[2].toString());
}

/**
 * Assert queue was consumed
 */
export function assertQueueConsumed(channel, queueName) {
  const calls = channel.consume.mock.calls;
  const matchingCall = calls.find(call => call[0] === queueName);

  if (!matchingCall) {
    throw new Error(
      `Expected queue "${queueName}" to be consumed\n` +
      `Actual queues consumed: ${JSON.stringify(calls.map(c => c[0]))}`
    );
  }

  return matchingCall[1]; // Return the handler function
}

/**
 * Assert message was acknowledged
 */
export function assertMessageAcked(channel, message) {
  const calls = channel.ack.mock.calls;
  const matchingCall = calls.find(call =>
    call[0] === message || call[0]?.fields?.deliveryTag === message?.fields?.deliveryTag
  );

  if (!matchingCall) {
    throw new Error('Expected message to be acknowledged');
  }

  return true;
}

/**
 * Assert message was not acknowledged
 */
export function assertMessageNacked(channel, message, requeue = undefined) {
  const calls = channel.nack.mock.calls;
  const matchingCall = calls.find(call => {
    if (call[0] !== message && call[0]?.fields?.deliveryTag !== message?.fields?.deliveryTag) {
      return false;
    }
    if (requeue !== undefined && call[2] !== requeue) {
      return false;
    }
    return true;
  });

  if (!matchingCall) {
    throw new Error(
      `Expected message to be nacked${requeue !== undefined ? ` with requeue=${requeue}` : ''}`
    );
  }

  return true;
}

/**
 * Assert task completed successfully
 */
export function assertTaskCompleted(result, expectedData = {}) {
  if (!result) {
    throw new Error('Task result is null or undefined');
  }

  if (result.status !== 'completed') {
    throw new Error(`Expected task status to be "completed" but got "${result.status}"`);
  }

  if (!result.result?.success) {
    throw new Error(
      `Expected task to succeed but got: ${JSON.stringify(result.result)}`
    );
  }

  for (const [key, value] of Object.entries(expectedData)) {
    if (result.result.data?.[key] !== value) {
      throw new Error(
        `Expected result.data.${key} to be ${value} but got ${result.result.data?.[key]}`
      );
    }
  }

  return true;
}

/**
 * Assert task failed
 */
export function assertTaskFailed(result, expectedError = null) {
  if (!result) {
    throw new Error('Task result is null or undefined');
  }

  if (result.status !== 'failed') {
    throw new Error(`Expected task status to be "failed" but got "${result.status}"`);
  }

  if (expectedError && !result.result?.error?.message?.includes(expectedError)) {
    throw new Error(
      `Expected error message to include "${expectedError}" ` +
      `but got "${result.result?.error?.message}"`
    );
  }

  return true;
}

/**
 * Assert agent heartbeat is valid
 */
export function assertValidHeartbeat(heartbeat, agentId) {
  if (!heartbeat) {
    throw new Error('Heartbeat is null or undefined');
  }

  if (heartbeat.agentId !== agentId) {
    throw new Error(`Expected agentId to be "${agentId}" but got "${heartbeat.agentId}"`);
  }

  if (!heartbeat.timestamp || typeof heartbeat.timestamp !== 'number') {
    throw new Error('Heartbeat timestamp is invalid');
  }

  if (!heartbeat.metrics) {
    throw new Error('Heartbeat metrics are missing');
  }

  const requiredMetrics = ['tasksProcessed', 'tasksInProgress', 'errors', 'uptime'];
  for (const metric of requiredMetrics) {
    if (!(metric in heartbeat.metrics)) {
      throw new Error(`Heartbeat is missing required metric: ${metric}`);
    }
  }

  return true;
}

/**
 * Assert workflow completed
 */
export function assertWorkflowCompleted(results, stepCount) {
  if (!Array.isArray(results)) {
    throw new Error('Workflow results must be an array');
  }

  if (results.length !== stepCount) {
    throw new Error(
      `Expected ${stepCount} workflow steps but got ${results.length}`
    );
  }

  const allCompleted = results.every(r => r.status === 'completed' && r.result?.success);
  if (!allCompleted) {
    const failed = results.filter(r => r.status !== 'completed' || !r.result?.success);
    throw new Error(
      `Expected all workflow steps to complete but ${failed.length} failed: ` +
      JSON.stringify(failed)
    );
  }

  return true;
}

/**
 * Assert metrics match expected values
 */
export function assertMetrics(actual, expected, tolerance = 0) {
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) {
      throw new Error(`Expected metric "${key}" is missing from actual metrics`);
    }

    const actualValue = actual[key];
    if (typeof value === 'number' && typeof actualValue === 'number') {
      const diff = Math.abs(actualValue - value);
      if (diff > tolerance) {
        throw new Error(
          `Expected metric "${key}" to be ${value} (±${tolerance}) but got ${actualValue}`
        );
      }
    } else if (actualValue !== value) {
      throw new Error(
        `Expected metric "${key}" to be ${value} but got ${actualValue}`
      );
    }
  }

  return true;
}

export default {
  assertMessageSent,
  assertMessagePublished,
  assertQueueConsumed,
  assertMessageAcked,
  assertMessageNacked,
  assertTaskCompleted,
  assertTaskFailed,
  assertValidHeartbeat,
  assertWorkflowCompleted,
  assertMetrics
};
