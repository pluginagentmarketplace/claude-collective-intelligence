/**
 * 🎮 BATTLE SCENARIO EXAMPLE
 * Agent 13 - Interactive Battle & Leaderboard Demo
 *
 * This example demonstrates:
 * 1. Creating a 1v1 Head-to-Head duel
 * 2. Running a Speed Race competition
 * 3. Updating leaderboards with battle results
 * 4. Checking Hall of Fame eligibility
 */

import { BattleManager, BATTLE_MODES } from '../scripts/gamification/battle-system.js';
import { LeaderboardManager, RANKING_PERIODS } from '../scripts/gamification/leaderboard-system.js';

// ============================================
// SETUP
// ============================================

console.log('🎮 BATTLE & LEADERBOARD SYSTEM DEMO');
console.log('='.repeat(60));
console.log('');

// Initialize managers
const battleManager = new BattleManager();
const leaderboardManager = new LeaderboardManager();

// Create test agents
const agents = [
  {
    id: 'agent-speedy',
    name: 'SpeedyBot',
    type: 'worker',
    eloRating: 1600,
    tier: 'Gold',
    badges: ['Speed Demon'],
    points: { total: 5000 },
    stats: {
      tasksCompleted: 150,
      battlesWon: 20,
      battlesLost: 5,
      averageQuality: 92,
      daysActive: 45
    }
  },
  {
    id: 'agent-quality',
    name: 'QualityBot',
    type: 'worker',
    eloRating: 1550,
    tier: 'Gold',
    badges: ['Quality Master'],
    points: { total: 4800 },
    stats: {
      tasksCompleted: 120,
      battlesWon: 18,
      battlesLost: 7,
      averageQuality: 98,
      daysActive: 40
    }
  },
  {
    id: 'agent-collab',
    name: 'CollabBot',
    type: 'collaborator',
    eloRating: 1500,
    tier: 'Silver',
    badges: ['Team Player'],
    points: { total: 4200 },
    stats: {
      tasksCompleted: 100,
      battlesWon: 15,
      battlesLost: 10,
      averageQuality: 90,
      daysActive: 35
    }
  },
  {
    id: 'agent-legend',
    name: 'LegendBot',
    type: 'worker',
    eloRating: 1800,
    tier: 'Diamond',
    badges: ['Speed Demon', 'Quality Master', 'Innovator'],
    points: { total: 25000 },
    stats: {
      tasksCompleted: 2000,
      battlesWon: 150,
      battlesLost: 20,
      averageQuality: 97,
      daysActive: 365
    }
  }
];

// ============================================
// EXAMPLE 1: 1v1 HEAD-TO-HEAD DUEL
// ============================================

console.log('📍 EXAMPLE 1: 1v1 HEAD-TO-HEAD DUEL');
console.log('-'.repeat(60));

// SpeedyBot challenges QualityBot
const headToHeadBattle = battleManager.challenge(
  'HEAD_TO_HEAD',
  agents[0], // SpeedyBot
  agents[1].id // QualityBot
);

console.log(`✓ ${agents[0].name} challenges ${agents[1].name}`);
console.log(`  Battle ID: ${headToHeadBattle.id}`);
console.log(`  Mode: ${headToHeadBattle.config.name}`);
console.log(`  Duration: ${headToHeadBattle.config.duration / 1000}s`);
console.log('');

// QualityBot accepts the challenge
battleManager.acceptChallenge(headToHeadBattle.id, agents[1]);
console.log(`✓ ${agents[1].name} accepts the challenge!`);
console.log(`  Status: ${headToHeadBattle.status}`);
console.log('');

// Simulate battle progress
console.log('⚔️  Battle in progress...');

// SpeedyBot completes faster but with slightly lower quality
headToHeadBattle.submitResult('agent-speedy', {
  baseScore: 100,
  completionTime: 120000, // 2 minutes
  accuracy: 0.95,
  completeness: 1.0,
  codeQuality: 0.90,
  documentation: 0.85,
  testCoverage: 0.80
});

console.log(`  ${agents[0].name} submitted result`);
console.log(`    - Completion time: 2m 0s`);
console.log(`    - Quality score: 90/100`);

// QualityBot completes slower but with higher quality
headToHeadBattle.submitResult('agent-quality', {
  baseScore: 100,
  completionTime: 180000, // 3 minutes
  accuracy: 0.98,
  completeness: 1.0,
  codeQuality: 0.98,
  documentation: 0.95,
  testCoverage: 0.95
});

console.log(`  ${agents[1].name} submitted result`);
console.log(`    - Completion time: 3m 0s`);
console.log(`    - Quality score: 97/100`);
console.log('');

// End battle
headToHeadBattle.end();

console.log('🏆 BATTLE RESULTS:');
console.log(`  Winner: ${headToHeadBattle.winner === 'agent-quality' ? agents[1].name : agents[0].name}`);
console.log(`  Status: ${headToHeadBattle.status}`);

// Display final scores
headToHeadBattle.participants.forEach((participant) => {
  const agent = agents.find(a => a.id === participant.agentId);
  console.log(`  ${agent.name}: ${Math.round(participant.score)} points`);
});

console.log('');
console.log('');

// ============================================
// EXAMPLE 2: SPEED RACE
// ============================================

console.log('📍 EXAMPLE 2: SPEED RACE');
console.log('-'.repeat(60));

// Create Speed Race battle
const speedRaceBattle = battleManager.createBattle('SPEED_RACE');

console.log(`✓ Speed Race created`);
console.log(`  Battle ID: ${speedRaceBattle.id}`);
console.log(`  Mode: ${speedRaceBattle.config.name}`);
console.log(`  Participants: 0/${speedRaceBattle.config.participants}`);
console.log('');

// Matchmaking: agents join automatically
console.log('🔍 Matchmaking...');
battleManager.matchmake('SPEED_RACE', agents[0]);
console.log(`  ${agents[0].name} joined`);

battleManager.matchmake('SPEED_RACE', agents[2]);
console.log(`  ${agents[2].name} joined`);
console.log('');

console.log('⚡ Speed Race started!');
console.log('');

// Simulate race
setTimeout(() => {
  // SpeedyBot finishes first
  speedRaceBattle.submitResult('agent-speedy', {
    completionTime: 45000 // 45 seconds
  });

  console.log(`  🏁 ${agents[0].name} finished! Time: 45s`);

  // CollabBot finishes second
  speedRaceBattle.submitResult('agent-collab', {
    completionTime: 75000 // 1m 15s
  });

  console.log(`  🏁 ${agents[2].name} finished! Time: 1m 15s`);
  console.log('');

  // End race
  speedRaceBattle.end();

  console.log('🏆 RACE RESULTS:');
  console.log(`  Winner: ${speedRaceBattle.winner === 'agent-speedy' ? agents[0].name : agents[2].name}`);

  speedRaceBattle.participants.forEach((participant, index) => {
    const agent = agents.find(a => a.id === participant.agentId);
    const medal = index === 0 ? '🥇' : '🥈';
    console.log(`  ${medal} ${agent.name}: ${Math.round(participant.score)} points`);
  });

  console.log('');
  console.log('');

  // ============================================
  // EXAMPLE 3: UPDATE LEADERBOARDS
  // ============================================

  console.log('📍 EXAMPLE 3: UPDATE LEADERBOARDS');
  console.log('-'.repeat(60));
  console.log('');

  // Update rankings for all agents
  agents.forEach(agent => {
    const metrics = {
      taskCompletion: agent.stats.tasksCompleted / 200,
      quality: agent.stats.averageQuality / 100,
      speed: 1 / (agent.stats.tasksCompleted / 100),
      collaboration: agent.type === 'collaborator' ? 0.9 : 0.7,
      innovation: 0.75,
      consistency: 0.85,
      averageQuality: agent.stats.averageQuality,
      averageSpeed: 100,
      uptime: 98,
      tasksCompleted: agent.stats.tasksCompleted
    };

    leaderboardManager.updateAgentRankings(agent, metrics);
  });

  console.log('✓ All agents ranked');
  console.log('');

  // Display Overall Leaderboard
  console.log('🏆 OVERALL LEADERBOARD (All-Time)');
  console.log('-'.repeat(60));

  const overallLeaderboard = leaderboardManager.getLeaderboard('OVERALL', RANKING_PERIODS.ALL_TIME);
  const topAgents = overallLeaderboard.getTop(5);

  topAgents.forEach((entry) => {
    const rankSymbol = entry.rank === 1 ? '🥇' :
                      entry.rank === 2 ? '🥈' :
                      entry.rank === 3 ? '🥉' : '  ';

    const trendSymbol = entry.trend === 'rising' ? '📈' :
                       entry.trend === 'falling' ? '📉' :
                       entry.trend === 'new' ? '🆕' : '  ';

    console.log(`${rankSymbol} #${entry.rank} ${entry.agentName.padEnd(15)} ${Math.round(entry.score).toString().padStart(6)} pts ${trendSymbol}`);
    console.log(`     ELO: ${entry.eloRating} | Tier: ${entry.tier} | ${entry.badges.join(', ')}`);
  });

  console.log('');
  console.log('');

  // Display Speed Leaderboard
  console.log('⚡ SPEED LEADERBOARD (All-Time)');
  console.log('-'.repeat(60));

  const speedLeaderboard = leaderboardManager.getLeaderboard('SPEED', RANKING_PERIODS.ALL_TIME);
  const topSpeed = speedLeaderboard.getTop(3);

  topSpeed.forEach((entry) => {
    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';
    console.log(`${medal} #${entry.rank} ${entry.agentName.padEnd(15)} ${Math.round(entry.score).toString().padStart(6)} pts`);
  });

  console.log('');
  console.log('');

  // Display Quality Leaderboard
  console.log('💎 QUALITY LEADERBOARD (All-Time)');
  console.log('-'.repeat(60));

  const qualityLeaderboard = leaderboardManager.getLeaderboard('QUALITY', RANKING_PERIODS.ALL_TIME);
  const topQuality = qualityLeaderboard.getTop(3);

  topQuality.forEach((entry) => {
    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';
    console.log(`${medal} #${entry.rank} ${entry.agentName.padEnd(15)} ${Math.round(entry.score).toString().padStart(6)} pts`);
  });

  console.log('');
  console.log('');

  // ============================================
  // EXAMPLE 4: HALL OF FAME
  // ============================================

  console.log('📍 EXAMPLE 4: HALL OF FAME');
  console.log('-'.repeat(60));
  console.log('');

  // Check Hall of Fame eligibility
  const hofMembers = leaderboardManager.getHallOfFame();

  if (hofMembers.length > 0) {
    console.log('🏛️  HALL OF FAME MEMBERS');
    console.log('');

    hofMembers.forEach((member) => {
      console.log(`${member.badge} ${member.tier} - ${member.agentName}`);
      console.log(`   Inducted: ${new Date(member.inductionDate).toLocaleDateString()}`);
      console.log(`   Total Points: ${member.achievements.totalPoints.toLocaleString()}`);
      console.log(`   Total Tasks: ${member.achievements.totalTasks.toLocaleString()}`);
      console.log(`   Average Quality: ${member.achievements.averageQuality}%`);
      console.log(`   Battles Won: ${member.achievements.battlesWon || 0}`);
      console.log('');
    });
  } else {
    console.log('No Hall of Fame members yet.');
    console.log('Keep competing to achieve legendary status!');
    console.log('');
  }

  // ============================================
  // EXAMPLE 5: AGENT PROFILE
  // ============================================

  console.log('📍 EXAMPLE 5: AGENT PROFILE');
  console.log('-'.repeat(60));
  console.log('');

  // Get detailed profile for SpeedyBot
  const profileAgent = agents[0];
  const agentRankings = leaderboardManager.getAgentRankings(
    profileAgent.id,
    RANKING_PERIODS.ALL_TIME
  );

  console.log(`👤 ${profileAgent.name}`);
  console.log(`   Type: ${profileAgent.type}`);
  console.log(`   Tier: ${profileAgent.tier}`);
  console.log(`   ELO Rating: ${profileAgent.eloRating}`);
  console.log(`   Total Points: ${profileAgent.points.total.toLocaleString()}`);
  console.log('');

  console.log('📊 RANKINGS:');
  Object.entries(agentRankings).forEach(([category, ranking]) => {
    if (ranking) {
      console.log(`   ${category.padEnd(15)}: #${ranking.rank} (${Math.round(ranking.score)} pts)`);
    }
  });

  console.log('');
  console.log('🎖️  BADGES:');
  profileAgent.badges.forEach(badge => {
    console.log(`   • ${badge}`);
  });

  console.log('');
  console.log('⚔️  BATTLE RECORD:');
  console.log(`   Wins: ${profileAgent.stats.battlesWon}`);
  console.log(`   Losses: ${profileAgent.stats.battlesLost}`);
  const winRate = (profileAgent.stats.battlesWon /
                  (profileAgent.stats.battlesWon + profileAgent.stats.battlesLost) * 100).toFixed(1);
  console.log(`   Win Rate: ${winRate}%`);

  console.log('');
  console.log('');

  // ============================================
  // STATISTICS
  // ============================================

  console.log('📍 SYSTEM STATISTICS');
  console.log('-'.repeat(60));
  console.log('');

  const battleStats = battleManager.getStatistics();
  const leaderboardStats = leaderboardManager.getStatistics();

  console.log('⚔️  BATTLE SYSTEM:');
  console.log(`   Total Battles: ${battleStats.totalBattles}`);
  console.log(`   Active Battles: ${battleStats.activeBattles}`);
  console.log(`   Completed: ${battleStats.completedBattles}`);
  console.log('');

  console.log('🏆 LEADERBOARD SYSTEM:');
  console.log(`   Total Agents: ${leaderboardStats.totalAgents}`);
  console.log(`   Active Leaderboards: ${leaderboardStats.totalLeaderboards}`);
  console.log(`   Hall of Fame Members: ${leaderboardStats.hallOfFameMembers}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('✅ Demo completed successfully!');
  console.log('');

}, 100); // Small delay for async operations
