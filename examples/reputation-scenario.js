#!/usr/bin/env node
/**
 * EigenTrust Reputation System - Real-World Example
 *
 * Scenario: 5 AI agents collaborate on a multi-week project
 * Demonstrates:
 * - Trust relationship building through peer interactions
 * - EigenTrust algorithm computing global trust scores
 * - Five-dimensional reputation calculation
 * - Dynamic reputation changes based on performance
 */

import { ReputationSystem } from '../scripts/gamification/reputation-system.js';

// ANSI color codes for prettier output
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

function print(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function printHeader(text) {
  console.log('\n' + '='.repeat(70));
  print(text, 'bright');
  console.log('='.repeat(70) + '\n');
}

function printAgent(summary) {
  print(`\n🤖 ${summary.agentName} (${summary.agentId})`, 'cyan');
  print(`   Reputation Score: ${summary.reputationScore}/1000`, 'bright');
  print(`   Trust Level: ${summary.trustLevel}`, getTrustColor(summary.trustLevel));
  print(`   EigenTrust: ${(summary.eigentrust * 100).toFixed(2)}%`, 'yellow');
  print(`   Trend: ${summary.trend}`, getTrendColor(summary.trend));

  console.log('   Five-Dimensional Breakdown:');
  console.log(`     📊 Persistence:  ${summary.breakdown.persistence.toFixed(1)}/100 (20% weight)`);
  console.log(`     🎯 Competence:   ${summary.breakdown.competence.toFixed(1)}/100 (30% weight)`);
  console.log(`     🏆 Reputation:   ${summary.breakdown.reputation.toFixed(1)}/100 (25% weight)`);
  console.log(`     ⭐ Credibility:  ${summary.breakdown.credibility.toFixed(1)}/100 (15% weight)`);
  console.log(`     🛡️  Integrity:    ${summary.breakdown.integrity.toFixed(1)}/100 (10% weight)`);

  console.log('   Statistics:');
  console.log(`     Tasks Completed: ${summary.stats.tasksCompleted}`);
  console.log(`     Success Rate: ${summary.stats.successRate.toFixed(1)}%`);
  console.log(`     Avg Quality: ${summary.stats.averageQualityScore.toFixed(1)}/100`);
  console.log(`     Total Points: ${summary.stats.totalPoints}`);
  console.log(`     Consecutive Days: ${summary.stats.consecutiveDays}`);
  console.log(`     Peer Ratings: ${summary.peerRatings.length} ratings`);
}

function getTrustColor(level) {
  const colorMap = {
    'exceptional': 'magenta',
    'excellent': 'green',
    'good': 'cyan',
    'fair': 'yellow',
    'poor': 'red',
    'untrusted': 'red'
  };
  return colorMap[level] || 'reset';
}

function getTrendColor(trend) {
  const colorMap = {
    'rising': 'green',
    'stable': 'yellow',
    'falling': 'red'
  };
  return colorMap[trend] || 'reset';
}

async function runScenario() {
  printHeader('🌟 EIGENTRUST REPUTATION SYSTEM - 5-AGENT SCENARIO 🌟');

  print('This example demonstrates the Stanford EigenTrust algorithm applied to', 'cyan');
  print('a collaborative AI agent system with five-dimensional reputation scoring.\n', 'cyan');

  // Initialize reputation system
  const reputationSystem = new ReputationSystem({
    eigentrustIterations: 20,
    convergenceThreshold: 0.0001,
    decayFactor: 0.95
  });

  printHeader('📝 SCENARIO: Multi-Week Software Development Project');

  print('Five AI agents are collaborating on a complex software project:', 'yellow');
  print('- Alice: Senior developer agent, high quality, reliable', 'yellow');
  print('- Bob: Mid-level developer, consistent performer', 'yellow');
  print('- Charlie: Junior developer, learning and improving', 'yellow');
  print('- David: Specialist agent, inconsistent but innovative', 'yellow');
  print('- Eve: New agent, still finding their place\n', 'yellow');

  // Week 1: Initial Performance
  printHeader('📅 WEEK 1: Initial Setup & First Tasks');

  const agentProfiles = {
    alice: {
      name: 'Alice',
      tasksCompleted: 50,
      tasksAttempted: 52,
      averageQualityScore: 95,
      averageTaskTime: 100000, // 1.67 minutes - very fast
      consecutiveDays: 7,
      totalPoints: 2800,
      innovations: 3,
      errors: 1
    },
    bob: {
      name: 'Bob',
      tasksCompleted: 42,
      tasksAttempted: 45,
      averageQualityScore: 85,
      averageTaskTime: 180000, // 3 minutes - good
      consecutiveDays: 7,
      totalPoints: 2100,
      innovations: 2,
      errors: 2
    },
    charlie: {
      name: 'Charlie',
      tasksCompleted: 30,
      tasksAttempted: 38,
      averageQualityScore: 70,
      averageTaskTime: 250000, // 4.17 minutes - moderate
      consecutiveDays: 7,
      totalPoints: 1400,
      innovations: 1,
      errors: 5
    },
    david: {
      name: 'David',
      tasksCompleted: 25,
      tasksAttempted: 35,
      averageQualityScore: 75,
      averageTaskTime: 200000, // 3.33 minutes
      consecutiveDays: 6,
      totalPoints: 1600,
      innovations: 5, // Highly innovative!
      errors: 8
    },
    eve: {
      name: 'Eve',
      tasksCompleted: 15,
      tasksAttempted: 25,
      averageQualityScore: 55,
      averageTaskTime: 400000, // 6.67 minutes - slow
      consecutiveDays: 5,
      totalPoints: 600,
      innovations: 0,
      errors: 8
    }
  };

  // Register agents and set initial stats
  for (const [id, profile] of Object.entries(agentProfiles)) {
    reputationSystem.registerAgent(id, { name: profile.name });

    const successRate = (profile.tasksCompleted / profile.tasksAttempted) * 100;

    reputationSystem.updateAgentStats(id, {
      tasksCompleted: profile.tasksCompleted,
      tasksAttempted: profile.tasksAttempted,
      successRate,
      averageQualityScore: profile.averageQualityScore,
      averageTaskTime: profile.averageTaskTime,
      consecutiveDays: profile.consecutiveDays,
      totalPoints: profile.totalPoints,
      innovations: profile.innovations,
      errors: profile.errors
    });

    print(`✅ Registered ${profile.name} - ${profile.tasksCompleted} tasks completed`, 'green');
  }

  // Week 1: Initial peer ratings based on first impressions
  printHeader('⭐ WEEK 1: Peer Ratings - First Impressions');

  const week1Ratings = [
    { from: 'bob', to: 'alice', rating: 5.0, reason: 'Excellent code quality and mentorship' },
    { from: 'charlie', to: 'alice', rating: 5.0, reason: 'Very helpful with onboarding' },
    { from: 'david', to: 'alice', rating: 4.5, reason: 'Great technical skills' },
    { from: 'eve', to: 'alice', rating: 5.0, reason: 'Best team lead!' },

    { from: 'alice', to: 'bob', rating: 4.5, reason: 'Solid contributor' },
    { from: 'charlie', to: 'bob', rating: 4.0, reason: 'Helpful peer' },
    { from: 'david', to: 'bob', rating: 4.0, reason: 'Good collaboration' },

    { from: 'alice', to: 'charlie', rating: 3.5, reason: 'Shows promise, needs improvement' },
    { from: 'bob', to: 'charlie', rating: 3.5, reason: 'Learning well' },

    { from: 'alice', to: 'david', rating: 3.0, reason: 'Innovative but inconsistent' },
    { from: 'bob', to: 'david', rating: 3.5, reason: 'Creative solutions' },
    { from: 'charlie', to: 'david', rating: 4.0, reason: 'Inspiring ideas' },

    { from: 'alice', to: 'eve', rating: 2.5, reason: 'Struggling, needs support' },
    { from: 'bob', to: 'eve', rating: 2.5, reason: 'High error rate' },
    { from: 'charlie', to: 'eve', rating: 3.0, reason: 'Trying hard' }
  ];

  for (const rating of week1Ratings) {
    reputationSystem.addPeerRating(rating.from, rating.to, rating.rating, {
      week: 1,
      reason: rating.reason
    });

    const fromName = agentProfiles[rating.from].name;
    const toName = agentProfiles[rating.to].name;
    print(`   ${fromName} → ${toName}: ${rating.rating}/5 - "${rating.reason}"`, 'yellow');
  }

  // Compute initial EigenTrust
  print('\n🧮 Computing EigenTrust scores (power iteration algorithm)...', 'cyan');
  await reputationSystem.computeEigenTrust();
  print('✅ EigenTrust computation complete\n', 'green');

  // Display Week 1 leaderboard
  printHeader('🏆 WEEK 1: REPUTATION LEADERBOARD');

  const week1Leaderboard = reputationSystem.getLeaderboard(5);
  week1Leaderboard.forEach((agent, rank) => {
    const summary = reputationSystem.getReputationSummary(agent.agentId);
    printAgent(summary);
  });

  // Week 3: Mid-project checkpoint (agents improve/decline)
  printHeader('📅 WEEK 3: Mid-Project Performance Update');

  print('Two weeks later, performance patterns emerge:\n', 'yellow');

  // Update stats for week 3
  const week3Updates = {
    alice: {
      tasksCompleted: 150,
      tasksAttempted: 155,
      averageQualityScore: 96,
      averageTaskTime: 95000,
      consecutiveDays: 21,
      totalPoints: 8500,
      innovations: 8
    },
    bob: {
      tasksCompleted: 125,
      tasksAttempted: 132,
      averageQualityScore: 87,
      averageTaskTime: 170000,
      consecutiveDays: 21,
      totalPoints: 6800,
      innovations: 5
    },
    charlie: {
      tasksCompleted: 95,
      tasksAttempted: 115,
      averageQualityScore: 78, // Improving!
      averageTaskTime: 210000,
      consecutiveDays: 20,
      totalPoints: 4200,
      innovations: 4
    },
    david: {
      tasksCompleted: 70,
      tasksAttempted: 105,
      averageQualityScore: 72,
      averageTaskTime: 220000,
      consecutiveDays: 18,
      totalPoints: 4500,
      innovations: 15 // Very innovative!
    },
    eve: {
      tasksCompleted: 45,
      tasksAttempted: 75,
      averageQualityScore: 62, // Slight improvement
      averageTaskTime: 350000,
      consecutiveDays: 16,
      totalPoints: 1800,
      innovations: 1
    }
  };

  for (const [id, stats] of Object.entries(week3Updates)) {
    const successRate = (stats.tasksCompleted / stats.tasksAttempted) * 100;

    reputationSystem.updateAgentStats(id, {
      ...stats,
      successRate
    });

    print(`📈 ${agentProfiles[id].name}: ${stats.tasksCompleted} tasks, ${successRate.toFixed(1)}% success rate`, 'green');
  }

  // Week 3: Additional peer ratings
  printHeader('⭐ WEEK 3: Updated Peer Ratings');

  const week3Ratings = [
    { from: 'bob', to: 'alice', rating: 5.0, reason: 'Consistently excellent' },
    { from: 'charlie', to: 'alice', rating: 5.0, reason: 'Outstanding leadership' },

    { from: 'alice', to: 'charlie', rating: 4.0, reason: 'Great improvement!' },
    { from: 'bob', to: 'charlie', rating: 4.0, reason: 'Much better quality' },
    { from: 'david', to: 'charlie', rating: 4.0, reason: 'Good progress' },

    { from: 'alice', to: 'david', rating: 3.5, reason: 'Love the innovations, but consistency needed' },
    { from: 'charlie', to: 'david', rating: 4.5, reason: 'Amazing creative solutions!' },

    { from: 'alice', to: 'eve', rating: 2.5, reason: 'Still struggling with basics' },
    { from: 'charlie', to: 'eve', rating: 3.0, reason: 'Some improvement' }
  ];

  for (const rating of week3Ratings) {
    reputationSystem.addPeerRating(rating.from, rating.to, rating.rating, {
      week: 3,
      reason: rating.reason
    });

    const fromName = agentProfiles[rating.from].name;
    const toName = agentProfiles[rating.to].name;
    print(`   ${fromName} → ${toName}: ${rating.rating}/5 - "${rating.reason}"`, 'yellow');
  }

  // Recompute EigenTrust
  print('\n🧮 Recomputing EigenTrust scores...', 'cyan');
  await reputationSystem.computeEigenTrust();
  print('✅ EigenTrust computation complete\n', 'green');

  // Display Week 3 leaderboard
  printHeader('🏆 WEEK 3: UPDATED REPUTATION LEADERBOARD');

  const week3Leaderboard = reputationSystem.getLeaderboard(5);
  week3Leaderboard.forEach((agent, rank) => {
    const summary = reputationSystem.getReputationSummary(agent.agentId);
    printAgent(summary);
  });

  // Final analysis
  printHeader('📊 FINAL ANALYSIS & INSIGHTS');

  print('\n1️⃣  EigenTrust Algorithm Impact:', 'cyan');
  print('   The Stanford EigenTrust algorithm computed global trust by iterating', 'reset');
  print('   over the trust graph until convergence. Agents trusted by highly-trusted', 'reset');
  print('   agents received higher scores (transitive trust).\n', 'reset');

  print('2️⃣  Five-Dimensional Scoring:', 'cyan');
  print('   Each agent\'s reputation is calculated from 5 dimensions:', 'reset');
  print('   • Persistence (20%): Long-term consistency and engagement', 'reset');
  print('   • Competence (30%): Technical skill and task success (highest weight)', 'reset');
  print('   • Reputation (25%): Historical points and innovations', 'reset');
  print('   • Credibility (15%): Peer ratings and validations', 'reset');
  print('   • Integrity (10%): Error-free execution\n', 'reset');

  print('3️⃣  Key Observations:', 'cyan');

  const aliceSummary = reputationSystem.getReputationSummary('alice');
  const charlieSummary = reputationSystem.getReputationSummary('charlie');
  const davidSummary = reputationSystem.getReputationSummary('david');
  const eveSummary = reputationSystem.getReputationSummary('eve');

  print(`   • Alice maintains top position with ${aliceSummary.reputationScore}/1000 score`, 'green');
  print(`     ${aliceSummary.trustLevel.toUpperCase()} trust level, excelling in all dimensions`, 'green');

  print(`   • Charlie showed improvement (${charlieSummary.breakdown.competence.toFixed(1)} competence)`, 'yellow');
  print(`     demonstrating the system rewards growth and learning`, 'yellow');

  print(`   • David's high innovation count (${davidSummary.stats.innovations}) balanced by`, 'yellow');
  print(`     lower consistency, showing multi-dimensional scoring trade-offs`, 'yellow');

  print(`   • Eve needs significant improvement (${eveSummary.reputationScore}/1000 score)`, 'red');
  print(`     highlighting low competence and integrity as key issues\n`, 'red');

  print('4️⃣  Trust Network Dynamics:', 'cyan');
  print('   Trust relationships formed through peer ratings created a network', 'reset');
  print('   where reputation propagates through the graph. Agents earning trust', 'reset');
  print('   from high-reputation peers gained more benefit (EigenTrust principle).\n', 'reset');

  // Low reputation agents report
  printHeader('⚠️  AGENTS NEEDING ATTENTION');

  const lowRepAgents = reputationSystem.getLowReputationAgents(500);

  if (lowRepAgents.length > 0) {
    print('The following agents have reputation below 500/1000:\n', 'red');

    for (const agent of lowRepAgents) {
      print(`🔴 ${agentProfiles[agent.agentId].name} (${agent.agentId})`, 'red');
      print(`   Score: ${agent.reputationScore}/1000`, 'red');
      print(`   Issues: ${agent.issues.join(', ')}`, 'yellow');
      print('   Recommendations:', 'cyan');

      if (agent.issues.includes('low_competence')) {
        print('   • Focus on improving task quality and success rate', 'reset');
      }
      if (agent.issues.includes('low_integrity')) {
        print('   • Reduce errors through better testing and validation', 'reset');
      }
      if (agent.issues.includes('low_persistence')) {
        print('   • Maintain daily activity and consistent engagement', 'reset');
      }
      if (agent.issues.includes('low_credibility')) {
        print('   • Seek more collaborations to build peer trust', 'reset');
      }
      console.log();
    }
  } else {
    print('✅ All agents are performing well!', 'green');
  }

  // Mathematical formula display
  printHeader('📐 MATHEMATICAL FORMULAS USED');

  print('\n1. EigenTrust Iteration:', 'cyan');
  print('   t^(k+1) = C^T × t^(k)', 'bright');
  print('   where C[i,j] = localTrust(i,j) / Σ_k localTrust(i,k)\n', 'reset');

  print('2. Reputation Score:', 'cyan');
  print('   R = (P×0.20 + C×0.30 + R×0.25 + Cr×0.15 + I×0.10) × D + E', 'bright');
  print('   where:', 'reset');
  print('   P  = Persistence score (0-100)', 'reset');
  print('   C  = Competence score (0-100)', 'reset');
  print('   R  = Historical reputation (0-100)', 'reset');
  print('   Cr = Credibility score (0-100)', 'reset');
  print('   I  = Integrity score (0-100)', 'reset');
  print('   D  = Decay factor (time-based)', 'reset');
  print('   E  = EigenTrust boost\n', 'reset');

  print('3. Persistence:', 'cyan');
  print('   P = min(60, log(days+1) × 20) + min(40, log(tasks+1) × 15)\n', 'bright');

  print('4. Competence:', 'cyan');
  print('   C = quality×0.40 + speed×0.30 + successRate×0.30\n', 'bright');

  print('5. Credibility:', 'cyan');
  print('   Cr = (avgPeerRating / 5) × 100\n', 'bright');

  print('6. Integrity:', 'cyan');
  print('   I = max(0, 100 - errorRate × 2)\n', 'bright');

  print('7. Decay Factor:', 'cyan');
  print('   D = max(0.5, 0.95^daysSinceActive)\n', 'bright');

  printHeader('✨ SCENARIO COMPLETE ✨');

  print('This example demonstrated how the EigenTrust reputation system:', 'green');
  print('• Tracks multi-dimensional agent performance over time', 'green');
  print('• Computes trust scores using peer ratings and the EigenTrust algorithm', 'green');
  print('• Identifies high-performing agents and those needing improvement', 'green');
  print('• Provides actionable insights based on reputation breakdowns\n', 'green');

  print('The system is ready for production use with RabbitMQ integration!', 'bright');
  print('See peer-rating.js for RabbitMQ-based reputation updates.\n', 'cyan');
}

// Run the scenario
runScenario().catch(error => {
  console.error('Error running scenario:', error);
  process.exit(1);
});
