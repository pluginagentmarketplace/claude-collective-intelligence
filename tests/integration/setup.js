/**
 * Integration Test Setup
 * Handles Docker RabbitMQ container management for integration tests
 */

import { execSync, spawn } from 'child_process';
import { RabbitMQClient } from '../../src/core/rabbitmq-client.js';

const RABBITMQ_CONTAINER_NAME = 'rabbitmq-test-integration';
const RABBITMQ_PORT = 5672;
const RABBITMQ_MANAGEMENT_PORT = 15672;
// UPDATED: Use Docker Compose credentials (admin:rabbitmq123)
// Following REAL test policy - use actual production-like credentials
const RABBITMQ_URL = process.env.RABBITMQ_URL || `amqp://admin:rabbitmq123@localhost:${RABBITMQ_PORT}`;

export class TestSetup {
  constructor() {
    this.containerRunning = false;
    this.client = null;
  }

  /**
   * Check if Docker is available
   */
  isDockerAvailable() {
    try {
      execSync('docker --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if RabbitMQ container exists
   */
  containerExists() {
    try {
      const result = execSync(
        `docker ps -a --filter name=${RABBITMQ_CONTAINER_NAME} --format "{{.Names}}"`,
        { encoding: 'utf-8' }
      );
      return result.trim() === RABBITMQ_CONTAINER_NAME;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if RabbitMQ container is running
   */
  isContainerRunning() {
    try {
      const result = execSync(
        `docker ps --filter name=${RABBITMQ_CONTAINER_NAME} --format "{{.Names}}"`,
        { encoding: 'utf-8' }
      );
      return result.trim() === RABBITMQ_CONTAINER_NAME;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start RabbitMQ Docker container
   *
   * UPDATED: Uses existing Docker Compose services instead of creating new containers!
   * Following REAL vs MOCK testing policy (Dec 7, 2025)
   *
   * Integration tests should use REAL production-like services from Docker Compose,
   * not create isolated test containers.
   */
  async startRabbitMQ() {
    console.log('🐰 Using existing RabbitMQ service for integration tests...');
    console.log('   (REAL test policy: no isolated containers, use Docker Compose services)');

    // Just wait for existing RabbitMQ to be ready
    // No container creation needed!
    await this.waitForRabbitMQ();

    this.containerRunning = false; // Not managing container lifecycle
    console.log('✅ Connected to existing RabbitMQ service');
  }

  /**
   * Wait for RabbitMQ to be ready
   */
  async waitForRabbitMQ(maxAttempts = 30, delayMs = 1000) {
    console.log('Waiting for RabbitMQ to be ready...');

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const testClient = new RabbitMQClient({
          url: RABBITMQ_URL,
          autoReconnect: false
        });

        await testClient.connect();
        await testClient.close();

        console.log('✅ RabbitMQ is ready!');
        return;
      } catch (error) {
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('RabbitMQ failed to become ready in time');
  }

  /**
   * Stop RabbitMQ Docker container
   *
   * UPDATED: No-op since we're using existing Docker Compose services
   * Following REAL vs MOCK testing policy (Dec 7, 2025)
   */
  async stopRabbitMQ() {
    // No-op: We don't manage the container lifecycle
    // Docker Compose services stay running for other tests
    console.log('\n✅ Test complete (RabbitMQ service remains running for other tests)');
  }

  /**
   * Create test client
   */
  createTestClient(agentId = 'test-agent') {
    return new RabbitMQClient({
      url: RABBITMQ_URL,
      agentId,
      autoReconnect: false
    });
  }

  /**
   * Get queue message count
   */
  async getQueueMessageCount(queueName) {
    try {
      const result = execSync(
        `docker exec ${RABBITMQ_CONTAINER_NAME} rabbitmqctl list_queues -p / name messages | grep "${queueName}"`,
        { encoding: 'utf-8' }
      );

      const match = result.match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Purge queue
   */
  async purgeQueue(queueName) {
    try {
      execSync(
        `docker exec ${RABBITMQ_CONTAINER_NAME} rabbitmqctl purge_queue ${queueName} -p /`,
        { stdio: 'ignore' }
      );
    } catch (error) {
      // Queue might not exist
    }
  }

  /**
   * Get all queues
   */
  async listQueues() {
    try {
      const result = execSync(
        `docker exec ${RABBITMQ_CONTAINER_NAME} rabbitmqctl list_queues -p / name messages`,
        { encoding: 'utf-8' }
      );
      return result;
    } catch (error) {
      return '';
    }
  }

  /**
   * Clean up all test queues
   */
  async cleanupQueues() {
    const client = this.createTestClient('cleanup-agent');
    await client.connect();

    try {
      // Delete common test queues
      const queues = [
        'agent.tasks',
        'agent.results',
        'test.tasks',
        'test.results'
      ];

      for (const queue of queues) {
        try {
          await client.channel.deleteQueue(queue);
        } catch (error) {
          // Queue might not exist
        }
      }
    } finally {
      await client.close();
    }
  }
}

/**
 * Helper function to wait for condition
 */
export async function waitForCondition(conditionFn, timeoutMs = 5000, checkIntervalMs = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await conditionFn()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }

  return false;
}

/**
 * Helper function to wait for a specific duration
 */
export async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert helper
 */
export function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert equal helper
 */
export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`
    );
  }
}

/**
 * Assert throws helper
 */
export async function assertThrows(fn, message) {
  let threw = false;
  try {
    await fn();
  } catch (error) {
    threw = true;
  }

  if (!threw) {
    throw new Error(`Expected function to throw: ${message}`);
  }
}

export default TestSetup;
