#!/usr/bin/env node
/**
 * Integration Tests for Penalties System
 * Tests complete workflows: penalty application, appeals, retraining, and recovery
 */

import { PenaltySystem } from '../../scripts/penalties-system.js';
import { PerformanceEvaluator } from '../../scripts/penalties/performance-evaluator.js';
import { RetrainingManager } from '../../scripts/penalties/retraining-manager.js';

// Test utilities
class TestMonitor {
  constructor() {
    this.metrics = new Map();
  }

  setMetrics(agentId, metrics) {
    this.metrics.set(agentId, metrics);
  }

  async getAgentMetrics(agentId) {
    return this.metrics.get(agentId) || {
      agentId,
      errorRate: 0.05,
      timeoutRate: 0.10,
      successRate: 0.95,
      qualityScore: 0.90,
      baselineQuality: 0.90,
      currentQuality: 0.90,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    };
  }
}

class TestClient {
  constructor() {
    this.published = [];
  }

  isHealthy() {
    return true;
  }

  async publish(exchange, routingKey, message) {
    this.published.push({ exchange, routingKey, message });
    return 'msg-' + this.published.length;
  }

  async publishMessage(queue, message) {
    this.published.push({ queue, message });
    return 'msg-' + this.published.length;
  }

  getPublishedMessages() {
    return this.published;
  }

  clearPublished() {
    this.published = [];
  }
}

// Helper function to wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test Runner
async function runIntegrationTests() {
  console.log('🧪 Starting Penalties System Integration Tests\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Complete penalty lifecycle
  try {
    console.log('Test 1: Complete penalty lifecycle (apply → improve → recover)');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    // Set poor performance
    monitor.setMetrics('agent-test-1', {
      agentId: 'agent-test-1',
      errorRate: 0.15,
      timeoutRate: 0.10,
      successRate: 0.85,
      qualityScore: 0.85,
      baselineQuality: 0.90,
      currentQuality: 0.85,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    });

    // Apply penalty
    const penalty = await system.evaluateAgentPerformance('agent-test-1');

    if (!penalty) {
      throw new Error('Expected penalty to be applied');
    }

    if (!system.penalties.has('agent-test-1')) {
      throw new Error('Penalty not stored in system');
    }

    // Improve performance
    monitor.setMetrics('agent-test-1', {
      agentId: 'agent-test-1',
      errorRate: 0.03,
      timeoutRate: 0.05,
      successRate: 0.97,
      qualityScore: 0.90,
      baselineQuality: 0.90,
      currentQuality: 0.90,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    });

    // Check for recovery
    await system.checkForRecovery('agent-test-1');

    if (system.penalties.has('agent-test-1')) {
      throw new Error('Penalty should have been removed after recovery');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 2: Multiple triggers → Higher penalty level
  try {
    console.log('Test 2: Multiple triggers result in higher penalty level');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    // Set multiple performance issues
    monitor.setMetrics('agent-test-2', {
      agentId: 'agent-test-2',
      errorRate: 0.25,
      timeoutRate: 0.30,
      successRate: 0.70,
      qualityScore: 0.65,
      baselineQuality: 0.90,
      currentQuality: 0.65,
      collaborationSuccessRate: 0.65,
      collaborationFailureRate: 0.35,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    });

    const penalty = await system.evaluateAgentPerformance('agent-test-2');

    if (penalty.level < 2) {
      throw new Error(`Expected penalty level >= 2, got ${penalty.level}`);
    }

    if (penalty.triggeredBy.length < 2) {
      throw new Error('Expected multiple triggers');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 3: Appeal workflow
  try {
    console.log('Test 3: Appeal workflow (file → review → approve → reverse)');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    // Apply penalty
    monitor.setMetrics('agent-test-3', {
      agentId: 'agent-test-3',
      errorRate: 0.15,
      timeoutRate: 0.10,
      successRate: 0.85,
      qualityScore: 0.85,
      baselineQuality: 0.90,
      currentQuality: 0.85,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    });

    const penalty = await system.evaluateAgentPerformance('agent-test-3');

    // File appeal
    const grounds = {
      type: 'environmental_factors',
      explanation: 'Network outage during test period',
      evidence: { networkLatency: 5000 }
    };

    const appealId = await system.fileAppeal(penalty.id, 'agent-test-3', grounds);

    if (!system.appeals.has(appealId)) {
      throw new Error('Appeal not stored');
    }

    // Review and approve
    await system.reviewAppeal(appealId, 'coordinator', 'approved', [
      'Valid environmental factors detected'
    ]);

    if (system.penalties.has('agent-test-3')) {
      throw new Error('Penalty should be reversed after approved appeal');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 4: Resource throttling
  try {
    console.log('Test 4: Resource throttling with token bucket');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    // Apply penalty that triggers throttling
    monitor.setMetrics('agent-test-4', {
      agentId: 'agent-test-4',
      errorRate: 0.20,
      timeoutRate: 0.10,
      successRate: 0.80,
      qualityScore: 0.85,
      baselineQuality: 0.90,
      currentQuality: 0.85,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    });

    await system.evaluateAgentPerformance('agent-test-4');

    const throttle = system.throttles.get('agent-test-4');

    if (!throttle) {
      throw new Error('Throttle not created');
    }

    const status = throttle.getStatus();

    if (status.penaltyMultiplier >= 1.0) {
      throw new Error('Penalty multiplier should be reduced');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 5: Retraining workflow
  try {
    console.log('Test 5: Retraining workflow');

    const client = new TestClient();
    const retrainingManager = new RetrainingManager(client);

    const triggers = [
      { type: 'error_rate', value: 0.45, severity: 4 },
      { type: 'quality_drop', value: 0.30, severity: 3 }
    ];

    const sessionId = await retrainingManager.startRetraining('agent-test-5', triggers);

    if (!sessionId) {
      throw new Error('Session ID not returned');
    }

    const session = retrainingManager.getSession('agent-test-5');

    if (!session) {
      throw new Error('Session not created');
    }

    if (session.currentStage !== 1) {
      throw new Error('Should start at stage 1 (Diagnosis)');
    }

    if (!session.deficiencies.includes('error_handling')) {
      throw new Error('Should identify error_handling deficiency');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 6: Anomaly detection triggers auto-appeal
  try {
    console.log('Test 6: Anomaly detection triggers automatic appeal review');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    let autoAppealCreated = false;

    system.on('appeal_filed', (appeal) => {
      if (appeal.grounds.type === 'systemic_issue') {
        autoAppealCreated = true;
      }
    });

    // Create high penalty with environmental issues
    monitor.setMetrics('agent-test-6', {
      agentId: 'agent-test-6',
      errorRate: 0.18,
      timeoutRate: 0.10,
      successRate: 0.82,
      qualityScore: 0.50,
      baselineQuality: 0.90,
      currentQuality: 0.50,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    });

    // Mock high system stress and network issues
    const evaluator = system.evaluator;
    const originalGetSystemLoad = evaluator.getSystemLoad;
    const originalAnalyzeContext = evaluator.analyzeContext.bind(evaluator);
    const originalThreshold = evaluator.anomalyThresholds.autoReviewScore;

    evaluator.getSystemLoad = () => 0.95;
    evaluator.analyzeContext = async (agentId, metrics) => {
      const context = await originalAnalyzeContext(agentId, metrics);
      context.systemConditions.systemLoad = 0.95;
      context.externalFactors.networkIssues = true;
      return context;
    };
    // Lower threshold to ensure auto-review triggers
    evaluator.anomalyThresholds.autoReviewScore = 0.4;

    await system.evaluateAgentPerformance('agent-test-6');

    // Restore original methods
    evaluator.getSystemLoad = originalGetSystemLoad;
    evaluator.anomalyThresholds.autoReviewScore = originalThreshold;

    await sleep(100);

    if (!autoAppealCreated) {
      throw new Error('Auto-appeal should be created for anomalous penalty');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 7: Dashboard statistics
  try {
    console.log('Test 7: Dashboard provides accurate statistics');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    // Create multiple penalties at different levels
    for (let i = 1; i <= 5; i++) {
      monitor.setMetrics(`agent-${i}`, {
        agentId: `agent-${i}`,
        errorRate: 0.10 + (i * 0.05),
        timeoutRate: 0.10,
        successRate: 0.90 - (i * 0.05),
        qualityScore: 0.85,
        baselineQuality: 0.90,
        currentQuality: 0.85,
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      });

      await system.evaluateAgentPerformance(`agent-${i}`);
    }

    const dashboard = system.getDashboard();

    if (dashboard.totalPenalties !== 5) {
      throw new Error(`Expected 5 total penalties, got ${dashboard.totalPenalties}`);
    }

    if (!dashboard.byLevel) {
      throw new Error('Dashboard should have byLevel statistics');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 8: Probation period
  try {
    console.log('Test 8: Probation period after retraining');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    const probation = await system.startProbation('agent-test-8', 7200000);

    if (!probation) {
      throw new Error('Probation period not created');
    }

    if (!system.probation.has('agent-test-8')) {
      throw new Error('Probation not stored in system');
    }

    if (probation.requirements.minimumSuccessRate !== 0.90) {
      throw new Error('Probation should have strict requirements');
    }

    await system.endProbation('agent-test-8');

    if (system.probation.has('agent-test-8')) {
      throw new Error('Probation should be ended');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 9: RabbitMQ event publishing
  try {
    console.log('Test 9: RabbitMQ event publishing for penalties');

    const client = new TestClient();
    const monitor = new TestMonitor();
    const system = new PenaltySystem(client, monitor);

    monitor.setMetrics('agent-test-9', {
      agentId: 'agent-test-9',
      errorRate: 0.15,
      timeoutRate: 0.10,
      successRate: 0.85,
      qualityScore: 0.85,
      baselineQuality: 0.90,
      currentQuality: 0.85,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 20,
      avgResponseTime: 1000
    });

    await system.evaluateAgentPerformance('agent-test-9');

    const messages = client.getPublishedMessages();

    const penaltyEvent = messages.find(m =>
      m.exchange === 'agent.penalties' && m.routingKey.includes('penalty.applied')
    );

    if (!penaltyEvent) {
      throw new Error('Penalty event not published to RabbitMQ');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Test 10: Fairness safeguards
  try {
    console.log('Test 10: Fairness safeguards prevent unfair penalties');

    const evaluator = new PerformanceEvaluator();

    // Test minimum samples safeguard
    const insufficientMetrics = {
      taskCount: 5,
      errorRate: 0.50
    };
    const context = await evaluator.analyzeContext('agent-test-10', insufficientMetrics);
    const triggers = await evaluator.evaluateTriggers(insufficientMetrics, context);

    if (triggers.length > 0) {
      throw new Error('Should not trigger penalty with insufficient samples');
    }

    // Test minimum resource guarantees
    const lowAllocation = { cpu: 0.01, memory: 0.01, network: 0.01, taskRate: 0.01 };
    const validated = evaluator.validateMinimumResources(lowAllocation);

    if (validated.cpu < evaluator.minimumResources.cpu) {
      throw new Error('Should enforce minimum CPU allocation');
    }

    console.log('  ✅ PASSED\n');
    passed++;
  } catch (error) {
    console.log('  ❌ FAILED:', error.message, '\n');
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runIntegrationTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
