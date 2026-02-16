#!/usr/bin/env node
/**
 * Penalties System Scenario Example
 *
 * Demonstrates a complete retraining flow where an agent:
 * 1. Experiences performance degradation
 * 2. Receives progressive penalties (Level 1 → 2 → 3)
 * 3. Enters mandatory retraining (Level 5)
 * 4. Completes 4-stage retraining curriculum
 * 5. Graduates and enters probation
 * 6. Successfully recovers and returns to normal operation
 *
 * This example shows the constructive, educational approach of the penalty system.
 */

import chalk from 'chalk';
import { PenaltySystem } from '../scripts/penalties-system.js';
import { RetrainingManager } from '../scripts/penalties/retraining-manager.js';

// Mock client for demonstration
class DemoClient {
  constructor() {
    this.published = [];
  }

  isHealthy() {
    return true;
  }

  async publish(exchange, routingKey, message) {
    console.log(chalk.gray(`  📤 Published to ${exchange}/${routingKey}`));
    this.published.push({ exchange, routingKey, message });
  }

  async publishMessage(queue, message) {
    console.log(chalk.gray(`  📤 Sent to ${queue}`));
    this.published.push({ queue, message });
  }
}

// Mock monitor with controllable metrics
class DemoMonitor {
  constructor() {
    this.currentMetrics = {
      agentId: 'worker-alpha',
      errorRate: 0.05,
      timeoutRate: 0.10,
      successRate: 0.95,
      qualityScore: 0.90,
      baselineQuality: 0.90,
      currentQuality: 0.90,
      collaborationSuccessRate: 0.95,
      collaborationFailureRate: 0.05,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 50,
      avgResponseTime: 1000
    };
  }

  async getAgentMetrics(agentId) {
    return { ...this.currentMetrics, agentId };
  }

  setPerformance(scenario) {
    switch (scenario) {
      case 'excellent':
        this.currentMetrics.errorRate = 0.02;
        this.currentMetrics.successRate = 0.98;
        this.currentMetrics.currentQuality = 0.95;
        break;
      case 'good':
        this.currentMetrics.errorRate = 0.05;
        this.currentMetrics.successRate = 0.95;
        this.currentMetrics.currentQuality = 0.90;
        break;
      case 'degrading':
        this.currentMetrics.errorRate = 0.12;
        this.currentMetrics.successRate = 0.88;
        this.currentMetrics.currentQuality = 0.85;
        break;
      case 'poor':
        this.currentMetrics.errorRate = 0.22;
        this.currentMetrics.successRate = 0.78;
        this.currentMetrics.currentQuality = 0.75;
        break;
      case 'critical':
        this.currentMetrics.errorRate = 0.35;
        this.currentMetrics.successRate = 0.65;
        this.currentMetrics.currentQuality = 0.65;
        break;
    }
  }

  getStatus() {
    return `Error: ${(this.currentMetrics.errorRate * 100).toFixed(1)}%, Success: ${(this.currentMetrics.successRate * 100).toFixed(1)}%, Quality: ${(this.currentMetrics.currentQuality * 100).toFixed(0)}%`;
  }
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Display penalty info
function displayPenalty(penalty) {
  console.log(chalk.yellow('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.yellow('│           ⚠️  PENALTY APPLIED              │'));
  console.log(chalk.yellow('└─────────────────────────────────────────────┘'));
  console.log(chalk.white(`  Agent:       ${penalty.agentId}`));
  console.log(chalk.white(`  Level:       ${penalty.level} - ${penalty.name}`));
  console.log(chalk.white(`  Reason:      ${penalty.reason}`));
  console.log(chalk.white(`  Triggers:    ${penalty.triggeredBy.join(', ')}`));
  console.log(chalk.white(`  Compute:     ${(penalty.restrictions.computeMultiplier * 100).toFixed(0)}%`));
  console.log(chalk.white(`  Priority:    ${penalty.restrictions.taskPriority}`));
  console.log(chalk.white(`  Appealable:  ${penalty.appealable ? 'Yes' : 'No'}`));
  console.log('');
}

// Display retraining progress
function displayRetrainingProgress(progress) {
  console.log(chalk.blue('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.blue('│           🎓 RETRAINING PROGRESS           │'));
  console.log(chalk.blue('└─────────────────────────────────────────────┘'));
  console.log(chalk.white(`  Session:     ${progress.sessionId}`));
  console.log(chalk.white(`  Stage:       ${progress.currentStage} (${progress.completedStages}/${progress.totalStages})`));
  console.log(chalk.white(`  Progress:    ${(progress.overallProgress * 100).toFixed(0)}%`));
  console.log(chalk.white(`  Status:      ${progress.status}`));
  console.log('');
}

// Main scenario
async function runScenario() {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║     PENALTIES SYSTEM - RETRAINING SCENARIO EXAMPLE        ║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════╝\n'));

  const client = new DemoClient();
  const monitor = new DemoMonitor();
  const system = new PenaltySystem(client, monitor);

  console.log(chalk.green('📊 Initial State: Agent "worker-alpha" performing well'));
  console.log(chalk.gray(`   ${monitor.getStatus()}\n`));

  await sleep(1000);

  // ================== PHASE 1: PERFORMANCE DEGRADATION ==================
  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('PHASE 1: Performance Degradation'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.yellow('⚠️  Agent performance starts to degrade...'));
  monitor.setPerformance('degrading');
  console.log(chalk.gray(`   ${monitor.getStatus()}\n`));

  await sleep(500);

  // Evaluate and apply Level 1 penalty (Warning)
  console.log(chalk.white('🔍 Performance evaluation in progress...'));
  const penalty1 = await system.evaluateAgentPerformance('worker-alpha');

  if (penalty1) {
    displayPenalty(penalty1);
  }

  await sleep(1000);

  // ================== PHASE 2: CONTINUED POOR PERFORMANCE ==================
  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('PHASE 2: Performance Continues to Decline'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.yellow('⚠️  Agent performance worsens despite warning...'));
  monitor.setPerformance('poor');
  console.log(chalk.gray(`   ${monitor.getStatus()}\n`));

  await sleep(500);

  // Remove old penalty and apply higher level
  system.penalties.delete('worker-alpha');

  console.log(chalk.white('🔍 Re-evaluating performance...'));
  const penalty2 = await system.evaluateAgentPerformance('worker-alpha');

  if (penalty2) {
    displayPenalty(penalty2);
  }

  await sleep(1000);

  // ================== PHASE 3: CRITICAL PERFORMANCE → RETRAINING ==================
  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('PHASE 3: Critical Performance - Mandatory Retraining'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  console.log(chalk.red('🚨 Agent performance reaches critical levels!'));
  monitor.setPerformance('critical');
  console.log(chalk.gray(`   ${monitor.getStatus()}\n`));

  await sleep(500);

  // Remove old penalty and apply Level 5 (Retraining)
  system.penalties.delete('worker-alpha');

  console.log(chalk.white('🔍 Critical evaluation in progress...'));
  const penalty5 = await system.evaluateAgentPerformance('worker-alpha');

  if (penalty5 && penalty5.level >= 5) {
    displayPenalty(penalty5);

    console.log(chalk.blue('🎓 Mandatory retraining initiated...\n'));

    // Start retraining manually to demonstrate
    const retrainingManager = system.retrainingManager;
    const triggers = [
      { type: 'error_rate', value: 0.35, severity: 4 },
      { type: 'quality_drop', value: 0.28, severity: 3 }
    ];

    const sessionId = await retrainingManager.startRetraining('worker-alpha', triggers);

    await sleep(500);

    // ================== PHASE 4: RETRAINING CURRICULUM ==================
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('PHASE 4: 4-Stage Retraining Curriculum'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    // Stage 1: Diagnosis
    console.log(chalk.cyan('📋 Stage 1/4: Diagnosis (5 minutes)'));
    console.log(chalk.gray('   Activities: Analyze failures, identify root causes\n'));

    await sleep(1000);

    let progress = retrainingManager.getProgress('worker-alpha');
    if (progress) {
      displayRetrainingProgress(progress);
    }

    // Stage 2: Skill Review
    console.log(chalk.cyan('📚 Stage 2/4: Skill Review (10 minutes)'));
    console.log(chalk.gray('   Activities: Review best practices, learn from high performers\n'));

    await sleep(1000);

    // Stage 3: Supervised Practice
    console.log(chalk.cyan('👨‍🏫 Stage 3/4: Supervised Practice (30 minutes)'));
    console.log(chalk.gray('   Activities: Execute tasks with immediate feedback\n'));

    // Simulate some supervised tasks
    for (let i = 1; i <= 3; i++) {
      console.log(chalk.white(`   Task ${i}/3: Executing with supervision...`));
      await sleep(300);

      const result = await retrainingManager.executeSupervisedTask('worker-alpha', {
        id: `training-task-${i}`,
        type: 'simple',
        description: 'Practice task'
      });

      if (result.success) {
        console.log(chalk.green(`   ✅ Task ${i} completed successfully`));
      } else {
        console.log(chalk.yellow(`   ⚠️  Task ${i} needed correction`));
      }
    }

    console.log('');

    // Stage 4: Graduated Tasks
    console.log(chalk.cyan('🎯 Stage 4/4: Graduated Tasks (1 hour)'));
    console.log(chalk.gray('   Activities: Progressively harder tasks, prove consistency\n'));

    await sleep(1000);

    progress = retrainingManager.getProgress('worker-alpha');
    if (progress) {
      displayRetrainingProgress(progress);
    }

    // ================== PHASE 5: GRADUATION & PROBATION ==================
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('PHASE 5: Graduation and Probation'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    console.log(chalk.green('🎓 Retraining completed successfully!'));
    console.log(chalk.blue('📊 Starting probation period (4 hours)...\n'));

    const probation = await system.startProbation('worker-alpha', 14400000);

    console.log(chalk.white('  Probation Requirements:'));
    console.log(chalk.gray(`    • Min Success Rate: ${(probation.requirements.minimumSuccessRate * 100).toFixed(0)}%`));
    console.log(chalk.gray(`    • Max Error Rate: ${(probation.requirements.maximumErrorRate * 100).toFixed(0)}%`));
    console.log(chalk.gray(`    • Quality Threshold: ${(probation.requirements.qualityThreshold * 100).toFixed(0)}%\n`));

    await sleep(1000);

    // ================== PHASE 6: SUCCESSFUL RECOVERY ==================
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('PHASE 6: Performance Recovery'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    console.log(chalk.green('✨ Agent performance improves during probation!'));
    monitor.setPerformance('good');
    console.log(chalk.gray(`   ${monitor.getStatus()}\n`));

    await sleep(500);

    console.log(chalk.white('🔍 Probation performance check...'));
    await sleep(500);

    console.log(chalk.green('✅ All probation requirements met!'));
    await system.endProbation('worker-alpha');

    console.log(chalk.green('🎉 Agent successfully recovered and returned to normal operation!\n'));

    // ================== FINAL STATUS ==================
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('FINAL STATUS'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    const finalStatus = system.getPenaltyStatus('worker-alpha');

    console.log(chalk.white('📊 Agent Status Summary:'));
    console.log(chalk.gray(`   Active Penalty:     ${finalStatus.active ? finalStatus.active.name : 'None'}`));
    console.log(chalk.gray(`   Probation:          ${finalStatus.probation ? 'Active' : 'None'}`));
    console.log(chalk.gray(`   Penalty History:    ${finalStatus.history} total`));
    console.log(chalk.gray(`   Current Performance: ${monitor.getStatus()}`));

    const dashboard = system.getDashboard();
    console.log(chalk.white('\n📈 System Dashboard:'));
    console.log(chalk.gray(`   Total Penalties:    ${dashboard.totalPenalties}`));
    console.log(chalk.gray(`   Pending Appeals:    ${dashboard.appeals.pending}`));
    console.log(chalk.gray(`   Active Retraining:  ${dashboard.retraining.count}`));

    console.log(chalk.bold.green('\n✅ Scenario completed successfully!\n'));

    console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
    console.log(chalk.cyan('Key Takeaways:'));
    console.log(chalk.white('  • Progressive penalties allow multiple chances to improve'));
    console.log(chalk.white('  • Retraining is constructive, not punitive'));
    console.log(chalk.white('  • 4-stage curriculum helps agents systematically improve'));
    console.log(chalk.white('  • Probation period ensures sustained improvement'));
    console.log(chalk.white('  • System is fair, transparent, and focused on recovery'));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════\n'));
  }
}

// Run the scenario
runScenario().catch(error => {
  console.error(chalk.red('❌ Scenario failed:', error));
  console.error(error.stack);
  process.exit(1);
});
