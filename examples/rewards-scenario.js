#!/usr/bin/env node
/**
 * Rewards System Scenario - Agent Progresses Through Tiers
 *
 * This example demonstrates:
 * 1. Agent initialization at Bronze tier
 * 2. Task completion with points and achievements
 * 3. Streak building and multipliers
 * 4. Tier progression from Bronze → Silver → Gold
 * 5. Resource allocation increases
 * 6. Permission upgrades
 */

import { RewardsSystem, ACHIEVEMENTS } from '../scripts/rewards-system.js';
import chalk from 'chalk';

class RewardsScenario {
  constructor() {
    this.rewardsSystem = new RewardsSystem();
    this.agentId = 'demo-agent-alice';
  }

  log(emoji, message, data = null) {
    console.log(`${emoji} ${message}`);
    if (data) {
      console.log(`   ${chalk.dim(JSON.stringify(data, null, 2))}`);
    }
  }

  displayStatus(status) {
    console.log('\n' + '─'.repeat(70));
    console.log(chalk.bold.cyan(`📊 Agent Status: ${status.agentId}`));
    console.log('─'.repeat(70));
    console.log(chalk.yellow(`🏆 Tier: ${status.tier} (Level ${status.level})`));
    console.log(chalk.green(`💎 Points: ${status.points}`));
    console.log(chalk.red(`🔥 Current Streak: ${status.currentStreak}`));
    console.log(chalk.magenta(`⚡ Longest Streak: ${status.longestStreak}`));
    console.log(chalk.blue(`✅ Tasks Completed: ${status.stats.tasksCompleted}`));
    console.log(chalk.gray(`📈 Success Rate: ${(status.metrics.successRate * 100).toFixed(1)}%`));
    console.log(chalk.white(`🧠 Brainstorms: ${status.stats.brainstormsParticipated}`));
    console.log('\n' + chalk.bold('Resource Allocation:'));
    console.log(`   Prefetch Count: ${status.allocation.prefetchCount}`);
    console.log(`   Timeout Multiplier: ${status.allocation.timeoutMultiplier}x`);
    console.log(`   Message Rate Limit: ${status.allocation.config?.messageRateLimit || 10}/s`);
    console.log('─'.repeat(70) + '\n');
  }

  async pause(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    console.log('\n' + '='.repeat(70));
    console.log(chalk.bold.cyan('🏆 REWARDS SYSTEM DEMONSTRATION'));
    console.log(chalk.dim('Agent progresses from Bronze → Silver → Gold'));
    console.log('='.repeat(70) + '\n');

    // Phase 1: Initialization
    console.log(chalk.bold.yellow('\n📍 PHASE 1: Agent Initialization'));
    console.log('─'.repeat(70));

    this.log('🚀', 'Initializing agent in rewards system...');
    const initResult = this.rewardsSystem.initializeAgent(this.agentId);
    this.log('✅', 'Agent initialized', {
      tier: initResult.tier,
      points: initResult.points,
      prefetchCount: initResult.resources.prefetchCount
    });

    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Phase 2: First Tasks (Bronze Tier)
    console.log(chalk.bold.yellow('\n📍 PHASE 2: First Tasks - Building Foundation'));
    console.log('─'.repeat(70));

    this.log('📋', 'Completing first task...');
    const firstTask = { priority: 'NORMAL', complexity: 1 };
    const firstResult = { quality: 0.85, duration: 2000 };
    const firstPoints = await this.rewardsSystem.awardTaskPoints(this.agentId, firstTask, firstResult);

    this.log('✅', 'First task completed!', {
      points: firstPoints.points,
      breakdown: firstPoints.breakdown
    });

    // Check for first_task achievement
    const achievements1 = await this.rewardsSystem.checkAchievements(this.agentId);
    if (achievements1.length > 0) {
      this.log('🏆', `Achievement unlocked: ${achievements1[0].name}`, {
        description: achievements1[0].description,
        points: achievements1[0].points
      });
    }

    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Phase 3: Building a Streak
    console.log(chalk.bold.yellow('\n📍 PHASE 3: Building Momentum - Task Streak'));
    console.log('─'.repeat(70));

    const tasks = [
      { priority: 'HIGH', complexity: 2 },
      { priority: 'NORMAL', complexity: 1 },
      { priority: 'HIGH', complexity: 2 },
      { priority: 'CRITICAL', complexity: 3 },
      { priority: 'NORMAL', complexity: 1 }
    ];

    for (let i = 0; i < tasks.length; i++) {
      this.log('📋', `Completing task ${i + 2}/${tasks.length + 1}...`);
      const task = tasks[i];
      const result = { quality: 0.90, duration: 1500 };
      const points = await this.rewardsSystem.awardTaskPoints(this.agentId, task, result);

      this.log('✅', `Task completed! +${points.points} points`, {
        priority: task.priority,
        streakMultiplier: points.breakdown.streak
      });

      const status = this.rewardsSystem.getAgentStatus(this.agentId);
      if (status.currentStreak === 5) {
        this.log('🔥', chalk.bold.red('5-task streak! Multiplier bonus activated!'));
      }

      await this.pause(500);
    }

    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Phase 4: Brainstorm Participation
    console.log(chalk.bold.yellow('\n📍 PHASE 4: Collaboration - Brainstorm Sessions'));
    console.log('─'.repeat(70));

    for (let i = 0; i < 5; i++) {
      this.log('🧠', `Participating in brainstorm session ${i + 1}/5...`);
      const points = await this.rewardsSystem.awardBrainstormPoints(this.agentId);
      this.log('✅', `Brainstorm complete! +${points} points`);
      await this.pause(500);
    }

    const achievements2 = await this.rewardsSystem.checkAchievements(this.agentId);
    const teamPlayer = achievements2.find(a => a.id === 'team_player');
    if (teamPlayer) {
      this.log('🏆', chalk.bold(`Achievement unlocked: ${teamPlayer.name}!`), {
        description: teamPlayer.description,
        points: teamPlayer.points
      });
    }

    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Phase 5: More Tasks for Points
    console.log(chalk.bold.yellow('\n📍 PHASE 5: Grinding Points - Path to Silver'));
    console.log('─'.repeat(70));

    this.log('💪', 'Completing additional tasks to reach 1000 points...');
    let currentPoints = this.rewardsSystem.permissionManager.getAgentPoints(this.agentId);
    let taskCount = 0;

    while (currentPoints < 1000) {
      const task = {
        priority: taskCount % 3 === 0 ? 'HIGH' : 'NORMAL',
        complexity: 1
      };
      const result = { quality: 0.88, duration: 1800 };
      await this.rewardsSystem.awardTaskPoints(this.agentId, task, result);

      taskCount++;
      currentPoints = this.rewardsSystem.permissionManager.getAgentPoints(this.agentId);

      if (taskCount % 10 === 0) {
        this.log('📊', `Progress: ${currentPoints}/1000 points (${taskCount} tasks)`);
      }
    }

    this.log('✅', chalk.bold.green(`Reached ${currentPoints} points!`));
    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Phase 6: Silver Tier Upgrade
    console.log(chalk.bold.yellow('\n📍 PHASE 6: Tier Upgrade - Bronze → Silver'));
    console.log('─'.repeat(70));

    this.log('🔍', 'Checking tier upgrade eligibility...');
    const metrics = this.rewardsSystem.getAgentMetrics(this.agentId);
    const upgrade1 = await this.rewardsSystem.checkTierUpgrade(this.agentId);

    if (upgrade1) {
      this.log('🎊', chalk.bold.green('TIER UPGRADE SUCCESSFUL!'), {
        from: upgrade1.oldTier,
        to: upgrade1.newTier,
        bonusPoints: upgrade1.bonusPoints
      });

      console.log('\n' + chalk.bold.cyan('New Capabilities Unlocked:'));
      upgrade1.newCapabilities.forEach(cap => {
        console.log(`   ✓ ${cap}`);
      });
    } else {
      this.log('⚠️', 'Upgrade criteria not yet met', metrics);
    }

    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Phase 7: Silver Tier Benefits
    console.log(chalk.bold.yellow('\n📍 PHASE 7: Silver Tier Benefits'));
    console.log('─'.repeat(70));

    this.log('⚡', 'New resource allocation:');
    const allocation = this.rewardsSystem.resourceAllocator.calculateAllocation(this.agentId);
    console.log(`   Prefetch Count: ${chalk.green(allocation.prefetchCount)} (was 1)`);
    console.log(`   Timeout Multiplier: ${chalk.green(allocation.timeoutMultiplier)}x (was 1.0x)`);

    this.log('🔐', 'New permissions:');
    console.log(`   Brainstorm Initiation: ${chalk.green('✓ Granted')}`);
    console.log(`   Task Prioritization: ${chalk.green('✓ Granted')}`);

    await this.pause(2000);

    // Phase 8: Continuing to Gold
    console.log(chalk.bold.yellow('\n📍 PHASE 8: The Road to Gold'));
    console.log('─'.repeat(70));

    this.log('🎯', 'Target: 5000 points and 200 tasks for Gold tier');
    this.log('💪', 'Completing additional tasks...');

    // Complete more tasks
    for (let i = 0; i < 30; i++) {
      const task = {
        priority: i % 4 === 0 ? 'CRITICAL' : i % 2 === 0 ? 'HIGH' : 'NORMAL',
        complexity: Math.floor(Math.random() * 3) + 1
      };
      const result = {
        quality: 0.85 + Math.random() * 0.1,
        duration: 1000 + Math.random() * 1000
      };

      await this.rewardsSystem.awardTaskPoints(this.agentId, task, result);

      if (i % 10 === 9) {
        const status = this.rewardsSystem.getAgentStatus(this.agentId);
        this.log('📊', `Progress: ${status.points}/5000 points, ${status.stats.tasksCompleted}/200 tasks`);
      }
    }

    // Initiate brainstorms
    this.log('🧠', 'Initiating brainstorm sessions...');
    for (let i = 0; i < 5; i++) {
      await this.rewardsSystem.awardBrainstormPoints(this.agentId, true);
    }

    // Fast forward simulation
    this.log('⏩', 'Fast-forwarding task completion...');
    const currentStatus = this.rewardsSystem.getAgentStatus(this.agentId);
    const tasksNeeded = 200 - currentStatus.stats.tasksCompleted;

    for (let i = 0; i < tasksNeeded; i++) {
      const task = { priority: 'NORMAL', complexity: 1 };
      const result = { quality: 0.87, duration: 1500 };
      await this.rewardsSystem.awardTaskPoints(this.agentId, task, result);
    }

    // Award remaining points
    const pointsNeeded = 5000 - this.rewardsSystem.permissionManager.getAgentPoints(this.agentId);
    if (pointsNeeded > 0) {
      await this.rewardsSystem.permissionManager.awardPoints(this.agentId, pointsNeeded, 'bonus');
    }

    // Award achievements
    await this.rewardsSystem.permissionManager.awardAchievement(this.agentId, 'reliable_agent');
    await this.rewardsSystem.permissionManager.awardAchievement(this.agentId, 'collaborator');
    await this.rewardsSystem.permissionManager.awardAchievement(this.agentId, 'speed_demon');

    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Phase 9: Gold Tier Upgrade
    console.log(chalk.bold.yellow('\n📍 PHASE 9: Ultimate Achievement - Gold Tier'));
    console.log('─'.repeat(70));

    const finalMetrics = this.rewardsSystem.getAgentMetrics(this.agentId);
    const goldUpgrade = await this.rewardsSystem.checkTierUpgrade(this.agentId);

    if (goldUpgrade) {
      console.log('\n' + '🎊'.repeat(35));
      this.log('👑', chalk.bold.yellow('GOLD TIER ACHIEVED!'), {
        from: goldUpgrade.oldTier,
        to: goldUpgrade.newTier,
        bonusPoints: goldUpgrade.bonusPoints
      });
      console.log('🎊'.repeat(35) + '\n');

      console.log(chalk.bold.cyan('Elite Capabilities Unlocked:'));
      goldUpgrade.newCapabilities.forEach(cap => {
        console.log(`   ${chalk.yellow('★')} ${cap}`);
      });
    }

    this.displayStatus(this.rewardsSystem.getAgentStatus(this.agentId));
    await this.pause(2000);

    // Final Summary
    console.log(chalk.bold.yellow('\n📍 FINAL SUMMARY'));
    console.log('─'.repeat(70));

    const finalStatus = this.rewardsSystem.getAgentStatus(this.agentId);

    console.log(chalk.bold.green('\n🎯 Journey Complete!'));
    console.log(`
${chalk.cyan('Starting Point:')}
  • Tier: Bronze (Level 1)
  • Points: 0
  • Prefetch Count: 1
  • Permissions: Basic

${chalk.yellow('Final Achievement:')}
  • Tier: ${finalStatus.tier} (Level ${finalStatus.level})
  • Points: ${finalStatus.points}
  • Prefetch Count: ${finalStatus.allocation.prefetchCount}
  • Tasks Completed: ${finalStatus.stats.tasksCompleted}
  • Current Streak: ${finalStatus.currentStreak}
  • Longest Streak: ${finalStatus.longestStreak}
  • Brainstorms: ${finalStatus.stats.brainstormsParticipated}

${chalk.magenta('Special Abilities:')}
${finalStatus.specialAbilities.map(a => `  • ${a}`).join('\n')}
    `);

    console.log('─'.repeat(70));
    console.log(chalk.bold.green('\n✨ Rewards system demonstration complete! ✨\n'));
  }
}

// Run the scenario
console.log(chalk.dim('\nStarting rewards system scenario...'));
const scenario = new RewardsScenario();
scenario.run().catch(error => {
  console.error(chalk.red('\n❌ Scenario failed:'), error);
  process.exit(1);
});
