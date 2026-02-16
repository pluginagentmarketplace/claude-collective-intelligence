#!/usr/bin/env node
/**
 * Task Sender - Sends tasks to the agent orchestration system
 * Use this to demonstrate multi-agent task processing
 */

import amqplib from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:rabbitmq123@localhost:5672';
const TASK_QUEUE = 'agent.tasks';
const RESULT_QUEUE = 'agent.results';

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Sample tasks for demo
const sampleTasks = [
  {
    type: 'code_review',
    description: 'Review authentication module',
    priority: 'high',
    data: { module: 'auth', files: ['login.js', 'session.js'] }
  },
  {
    type: 'data_analysis',
    description: 'Analyze user engagement metrics',
    priority: 'medium',
    data: { metric: 'engagement', period: 'last_7_days' }
  },
  {
    type: 'brainstorm',
    description: 'Generate ideas for new feature',
    priority: 'low',
    data: { topic: 'AI-powered recommendations' }
  },
  {
    type: 'testing',
    description: 'Run integration tests',
    priority: 'high',
    data: { suite: 'integration', coverage: true }
  },
  {
    type: 'documentation',
    description: 'Update API documentation',
    priority: 'medium',
    data: { section: 'REST API', format: 'OpenAPI' }
  }
];

class TaskSender {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.tasksSent = 0;
    this.resultsReceived = 0;
  }

  async connect() {
    console.log(`${colors.cyan}🔌 Connecting to RabbitMQ...${colors.reset}`);
    this.connection = await amqplib.connect(RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    // Ensure queues exist (must match rabbitmq-client.js options!)
    await this.channel.assertQueue(TASK_QUEUE, {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 hour
        'x-max-length': 10000
      }
    });
    await this.channel.assertQueue(RESULT_QUEUE, { durable: true });

    console.log(`${colors.green}✅ Connected to RabbitMQ${colors.reset}\n`);
  }

  async sendTask(task) {
    const taskId = uuidv4();
    // Message format must match what orchestrator.js expects
    const message = {
      id: taskId,
      type: 'task',
      from: 'task-sender',
      timestamp: Date.now(),
      task: {
        title: task.description,
        description: task.description,
        priority: task.priority || 'normal',
        type: task.type,
        data: task.data,
        context: {}
      }
    };

    this.channel.sendToQueue(
      TASK_QUEUE,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        messageId: taskId,
        timestamp: Date.now()
      }
    );

    this.tasksSent++;

    console.log(`${colors.yellow}📤 Task Sent:${colors.reset}`);
    console.log(`   ID: ${colors.bright}${taskId.slice(0, 8)}${colors.reset}`);
    console.log(`   Type: ${colors.cyan}${task.type}${colors.reset}`);
    console.log(`   Description: ${task.description}`);
    console.log(`   Priority: ${this.getPriorityColor(task.priority)}${task.priority}${colors.reset}`);
    console.log('');

    return taskId;
  }

  getPriorityColor(priority) {
    switch(priority) {
      case 'high': return colors.red;
      case 'medium': return colors.yellow;
      case 'low': return colors.green;
      default: return colors.reset;
    }
  }

  async listenForResults() {
    console.log(`${colors.magenta}👂 Listening for results...${colors.reset}\n`);

    await this.channel.consume(RESULT_QUEUE, (msg) => {
      if (msg) {
        const result = JSON.parse(msg.content.toString());
        this.resultsReceived++;

        console.log(`${colors.green}📥 Result Received:${colors.reset}`);
        console.log(`   Task ID: ${colors.bright}${result.taskId?.slice(0, 8) || 'N/A'}${colors.reset}`);
        console.log(`   Agent: ${colors.cyan}${result.agentId || result.agent || 'Unknown'}${colors.reset}`);
        console.log(`   Status: ${result.status === 'completed' ? colors.green : colors.red}${result.status}${colors.reset}`);
        if (result.result) {
          console.log(`   Result: ${JSON.stringify(result.result).slice(0, 100)}`);
        }
        console.log('');

        this.channel.ack(msg);
      }
    });
  }

  async sendBatchTasks(count = 5) {
    console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.yellow}  Sending ${count} tasks to workers...${colors.reset}`);
    console.log(`${colors.bright}${colors.yellow}═══════════════════════════════════════${colors.reset}\n`);

    for (let i = 0; i < count; i++) {
      const task = sampleTasks[i % sampleTasks.length];
      await this.sendTask(task);
      await this.sleep(500); // Small delay between tasks
    }

    console.log(`${colors.green}✅ Batch complete: ${count} tasks sent${colors.reset}\n`);
  }

  async runInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║     📋 TASK SENDER - Interactive       ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);

    console.log('Commands:');
    console.log(`  ${colors.yellow}1${colors.reset} - Send single task`);
    console.log(`  ${colors.yellow}5${colors.reset} - Send 5 tasks (batch)`);
    console.log(`  ${colors.yellow}10${colors.reset} - Send 10 tasks (load test)`);
    console.log(`  ${colors.yellow}s${colors.reset} - Show stats`);
    console.log(`  ${colors.yellow}q${colors.reset} - Quit`);
    console.log('');

    const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

    while (true) {
      const input = await question(`${colors.cyan}Enter command: ${colors.reset}`);

      switch(input.trim().toLowerCase()) {
        case '1':
          const randomTask = sampleTasks[Math.floor(Math.random() * sampleTasks.length)];
          await this.sendTask(randomTask);
          break;
        case '5':
          await this.sendBatchTasks(5);
          break;
        case '10':
          await this.sendBatchTasks(10);
          break;
        case 's':
          console.log(`\n${colors.bright}Stats:${colors.reset}`);
          console.log(`  Tasks Sent: ${colors.yellow}${this.tasksSent}${colors.reset}`);
          console.log(`  Results Received: ${colors.green}${this.resultsReceived}${colors.reset}\n`);
          break;
        case 'q':
        case 'quit':
        case 'exit':
          console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
          rl.close();
          await this.close();
          process.exit(0);
        default:
          console.log(`${colors.red}Unknown command. Try 1, 5, 10, s, or q${colors.reset}`);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    console.log(`${colors.yellow}Connection closed${colors.reset}`);
  }
}

// Main execution
const sender = new TaskSender();

async function main() {
  try {
    await sender.connect();
    await sender.listenForResults();
    await sender.runInteractive();
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

main();
