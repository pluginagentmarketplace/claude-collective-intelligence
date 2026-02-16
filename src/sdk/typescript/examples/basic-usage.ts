/**
 * Basic Usage Examples - TypeScript SDK
 */

import { AgentClient, TaskSubmitParams } from '../src/index.js';

/**
 * Example 1: Create an agent and submit a task
 */
async function example1() {
  const client = new AgentClient({
    apiUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    // Create an agent
    const agent = await client.agents.create({
      name: 'Data Processing Agent',
      type: 'WORKER',
      capabilities: ['data-processing', 'analysis']
    });

    console.log('Agent created:', agent.id);

    // Submit a task to the agent
    const task = await client.tasks.submit({
      name: 'Process Customer Data',
      type: 'data-processing',
      payload: {
        customers: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' }
        ]
      }
    });

    console.log('Task submitted:', task.id);

    // Wait for task completion
    const result = await client.tasks.waitForCompletion(task.id);
    console.log('Task completed:', result.status);
    console.log('Result:', result.result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

/**
 * Example 2: List agents and filter by type
 */
async function example2() {
  const client = new AgentClient({
    apiUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    // List all agents
    const agents = await client.agents.list();
    console.log(`Found ${agents.pagination.total} agents`);

    // Check agent statuses
    for (const agent of agents.data) {
      const capabilities = await client.agents.getCapabilities(agent.id);
      console.log(`${agent.name}: ${agent.status} - capabilities: ${capabilities.join(', ')}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

/**
 * Example 3: Submit multiple tasks and wait for all
 */
async function example3() {
  const client = new AgentClient({
    apiUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    const tasks: TaskSubmitParams[] = [
      {
        name: 'Task 1',
        type: 'processing',
        payload: { data: 'content1' }
      },
      {
        name: 'Task 2',
        type: 'processing',
        payload: { data: 'content2' }
      },
      {
        name: 'Task 3',
        type: 'processing',
        payload: { data: 'content3' }
      }
    ];

    // Submit all tasks
    const submittedTasks = await client.tasks.submitBatch(tasks);
    console.log(`Submitted ${submittedTasks.length} tasks`);

    // Wait for all to complete
    const results = await client.tasks.waitForAll(
      submittedTasks.map(t => t.id),
      60000 // 1 minute timeout
    );

    // Process results
    results.forEach(task => {
      console.log(`Task ${task.id}: ${task.status}`);
      if (task.result) {
        console.log(`  Result: ${task.result.output}`);
      }
      if (task.error) {
        console.log(`  Error: ${task.error.message}`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

/**
 * Example 4: Error handling
 */
async function example4() {
  import { ValidationError, NotFoundError, TimeoutError, AgentClientError } from '../src/index.js';

  const client = new AgentClient({
    apiUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    // Try to submit a task
    await client.tasks.submit({
      name: 'My Task',
      type: 'invalid-type',
      payload: {}
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation failed:', error.details);
    } else if (error instanceof NotFoundError) {
      console.error('Resource not found:', error.message);
    } else if (error instanceof TimeoutError) {
      console.error('Request timed out after', error.timeout, 'ms');
    } else if (error instanceof AgentClientError) {
      console.error('Client error:', error.code, '-', error.message);
    }
  } finally {
    await client.close();
  }
}

/**
 * Example 5: Check health and metrics
 */
async function example5() {
  const client = new AgentClient({
    apiUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    // Check API health
    const health = await client.health();
    console.log('Health status:', health.status);
    console.log('Health checks:', health.checks);

    // Get client metrics
    const metrics = await client.getMetrics();
    console.log('Client Metrics:');
    console.log(`  Total requests: ${metrics.totalRequests}`);
    console.log(`  Success rate: ${metrics.successRate.toFixed(2)}%`);
    console.log(`  Error rate: ${metrics.errorRate.toFixed(2)}%`);
    console.log(`  Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

/**
 * Example 6: Task cancellation and retry
 */
async function example6() {
  const client = new AgentClient({
    apiUrl: 'http://localhost:3000',
    apiKey: 'your-api-key'
  });

  try {
    // Submit a task
    const task = await client.tasks.submit({
      name: 'Long Running Task',
      type: 'processing',
      payload: { duration: 3600000 } // 1 hour
    });

    console.log('Task started:', task.id);

    // Wait a bit, then cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    const cancelled = await client.tasks.cancel(task.id, 'User cancelled');
    console.log('Task cancelled:', cancelled.status);

    // Try again
    const retried = await client.tasks.retry(task.id);
    console.log('Task retried:', retried.status);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run examples
async function main() {
  console.log('Running TypeScript SDK Examples\n');

  console.log('=== Example 1: Basic Usage ===');
  await example1();

  console.log('\n=== Example 2: List and Query Agents ===');
  await example2();

  console.log('\n=== Example 3: Batch Operations ===');
  await example3();

  console.log('\n=== Example 4: Error Handling ===');
  await example4();

  console.log('\n=== Example 5: Health and Metrics ===');
  await example5();

  console.log('\n=== Example 6: Cancellation and Retry ===');
  await example6();
}

if (require.main === module) {
  main().catch(console.error);
}
