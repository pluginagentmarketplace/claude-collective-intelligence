#!/usr/bin/env node
/**
 * Monitor Dashboard
 * Real-time monitoring dashboard for multi-agent orchestration
 */

import { RabbitMQClient } from './rabbitmq-client.js';
import dotenv from 'dotenv';

dotenv.config();

class MonitorDashboard {
  constructor() {
    this.client = null;
    this.metrics = {
      agents: new Map(),
      tasks: {
        queued: 0,
        active: 0,
        completed: 0,
        failed: 0
      },
      performance: {
        durations: [],
        tasksPerMinute: 0
      },
      alerts: []
    };
  }

  async start() {
    console.log('🚀 Starting Monitor Dashboard...\n');

    this.client = new RabbitMQClient({
      agentId: 'monitor-dashboard'
    });

    await this.client.connect();

    // Subscribe to all status updates
    await this.client.subscribeStatus('agent.status.#', 'agent.status', async (msg) => {
      this.handleStatusUpdate(msg);
    });

    // Start dashboard update loop
    this.startDashboardLoop();

    // Start queue monitoring
    this.startQueueMonitoring();

    console.log('✅ Monitor Dashboard ready\n');
  }

  handleStatusUpdate(msg) {
    const { status } = msg;

    switch (status.event || status.state) {
      case 'connected':
        this.metrics.agents.set(status.agentId, {
          type: status.agentType,
          state: 'connected',
          lastSeen: Date.now(),
          tasksCompleted: 0,
          tasksFailed: 0
        });
        break;

      case 'disconnected':
        if (this.metrics.agents.has(status.agentId)) {
          const agent = this.metrics.agents.get(status.agentId);
          agent.state = 'disconnected';
          agent.lastSeen = Date.now();
        }
        break;

      case 'task_started':
        this.metrics.tasks.active++;
        break;

      case 'task_completed':
        this.metrics.tasks.active--;
        this.metrics.tasks.completed++;

        if (this.metrics.agents.has(status.agentId)) {
          this.metrics.agents.get(status.agentId).tasksCompleted++;
        }
        break;

      case 'task_failed':
        this.metrics.tasks.active--;
        this.metrics.tasks.failed++;

        if (this.metrics.agents.has(status.agentId)) {
          this.metrics.agents.get(status.agentId).tasksFailed++;
        }

        // Add alert
        this.metrics.alerts.push({
          type: 'task_failed',
          message: `Task failed: ${status.task}`,
          severity: 'warning',
          timestamp: Date.now()
        });
        break;
    }
  }

  async startQueueMonitoring() {
    setInterval(async () => {
      try {
        // Note: Requires RabbitMQ management plugin
        // For production, use RabbitMQ Management HTTP API
        // This is a placeholder
        this.metrics.tasks.queued = 0;  // Would fetch from API
      } catch (error) {
        // Silently ignore
      }
    }, 10000);
  }

  startDashboardLoop() {
    // Update display every 2 seconds
    setInterval(() => {
      this.displayDashboard();
    }, 2000);
  }

  displayDashboard() {
    console.clear();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 MULTI-AGENT ORCHESTRATION SYSTEM - REAL-TIME MONITOR');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Agents Section
    console.log('🤖 AGENTS');

    const connectedAgents = Array.from(this.metrics.agents.values())
      .filter(a => a.state === 'connected');

    const disconnectedAgents = Array.from(this.metrics.agents.values())
      .filter(a => a.state === 'disconnected');

    console.log(`   Total: ${this.metrics.agents.size}`);
    console.log(`   Connected: ${connectedAgents.length} ✅`);
    console.log(`   Disconnected: ${disconnectedAgents.length} ❌\n`);

    if (connectedAgents.length > 0) {
      console.log('   Connected Agents:');
      for (const [agentId, agent] of this.metrics.agents.entries()) {
        if (agent.state === 'connected') {
          const status = agent.tasksCompleted > 0 ? '⚙️ BUSY' : '💤 IDLE';
          console.log(`   • ${agentId} [${agent.type}] ${status}`);
          console.log(`     Tasks: ${agent.tasksCompleted} ✅ | ${agent.tasksFailed} ❌`);
        }
      }
      console.log('');
    }

    // Tasks Section
    console.log('📋 TASKS');
    console.log(`   Queued: ${this.metrics.tasks.queued}`);
    console.log(`   Active: ${this.metrics.tasks.active}`);
    console.log(`   Completed: ${this.metrics.tasks.completed} ✅`);
    console.log(`   Failed: ${this.metrics.tasks.failed} ❌\n`);

    // Performance Section
    console.log('⚡ PERFORMANCE');
    const successRate = this.metrics.tasks.completed + this.metrics.tasks.failed > 0
      ? (this.metrics.tasks.completed / (this.metrics.tasks.completed + this.metrics.tasks.failed)) * 100
      : 100;
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Tasks/min: ${this.metrics.performance.tasksPerMinute.toFixed(1)}\n`);

    // Alerts Section
    const activeAlerts = this.metrics.alerts.filter(a =>
      Date.now() - a.timestamp < 300000  // Last 5 minutes
    );

    if (activeAlerts.length > 0) {
      console.log('🚨 RECENT ALERTS');
      activeAlerts.slice(0, 5).forEach(alert => {
        const icon = alert.severity === 'critical' ? '⛔' : '⚠️';
        const elapsed = Math.floor((Date.now() - alert.timestamp) / 1000);
        console.log(`   ${icon} ${alert.message} (${elapsed}s ago)`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
    console.log('Press Ctrl+C to stop monitoring');
    console.log('═══════════════════════════════════════════════════════════════');
  }

  async shutdown() {
    console.log('\n🛑 Shutting down monitor...');
    await this.client.close();
    console.log('✅ Monitor stopped');
    process.exit(0);
  }
}

// Start dashboard
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new MonitorDashboard();

  process.on('SIGINT', async () => {
    await dashboard.shutdown();
  });

  dashboard.start().catch(error => {
    console.error('❌ Monitor failed:', error);
    process.exit(1);
  });
}

export default MonitorDashboard;
