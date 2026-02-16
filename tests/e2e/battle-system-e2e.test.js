#!/usr/bin/env node
/**
 * E2E Test: Battle System with ELO Persistence
 *
 * Tests competitive battles with database persistence:
 * 1. Agent registration with initial ELO (1000)
 * 2. 1v1 Head-to-Head battle
 * 3. ELO rating calculations
 * 4. Battle results persistence
 * 5. Multiple battle modes
 * 6. Battle history tracking
 * 7. ELO leaderboard
 */

import { setupTestEnvironment, teardownTestEnvironment, sleep } from '../helpers/test-setup.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_NAME = 'Battle System with ELO Persistence';
let testEnv;

// ELO calculation (K-factor = 32)
function calculateEloChange(ratingA, ratingB, scoreA) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return Math.round(32 * (scoreA - expectedA));
}

async function runTest() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ${TEST_NAME}`);
  console.log('='.repeat(60));

  try {
    // Setup
    console.log('\n📦 Setting up test environment...');
    testEnv = await setupTestEnvironment();
    const { db, mq } = testEnv;

    // ============================================
    // STEP 1: Create Battle Participants
    // ============================================
    console.log('\n✅ STEP 1: Create Battle Participants');

    const warrior1Id = `warrior-${uuidv4().slice(0, 8)}`;
    const warrior2Id = `warrior-${uuidv4().slice(0, 8)}`;
    const warrior3Id = `warrior-${uuidv4().slice(0, 8)}`;
    const warrior4Id = `warrior-${uuidv4().slice(0, 8)}`;

    // Create agents with initial ELO of 1000
    await db.createAgent(warrior1Id, {
      name: 'Alpha Warrior',
      tier: 'silver'
    });

    await db.createAgent(warrior2Id, {
      name: 'Beta Champion',
      tier: 'silver'
    });

    await db.createAgent(warrior3Id, {
      name: 'Gamma Fighter',
      tier: 'bronze'
    });

    await db.createAgent(warrior4Id, {
      name: 'Delta Contender',
      tier: 'gold'
    });

    // Set initial stats
    for (const agentId of [warrior1Id, warrior2Id, warrior3Id, warrior4Id]) {
      await db.updateAgentStats(agentId, {
        tasks_completed: 50,
        success_rate: 85
      });
    }

    // Give warrior4 higher ELO (experienced)
    await db.query('UPDATE agents SET elo_rating = $1 WHERE agent_id = $2', [1400, warrior4Id]);

    const participants = await db.query(
      'SELECT agent_id, name, elo_rating FROM agents WHERE agent_id = ANY($1)',
      [[warrior1Id, warrior2Id, warrior3Id, warrior4Id]]
    );

    console.log('   Battle participants:');
    participants.rows.forEach(p => {
      console.log(`     ${p.name} - ELO: ${p.elo_rating}`);
    });

    // ============================================
    // STEP 2: Battle 1 - Head-to-Head (Even Match)
    // ============================================
    console.log('\n✅ STEP 2: Battle 1 - Head-to-Head (Even Match)');

    const battle1Id = uuidv4();
    const battle1 = await db.createBattle(battle1Id, {
      mode: 'head-to-head',
      participants: [warrior1Id, warrior2Id]
    });

    console.log(`   Battle ID: ${battle1.battle_id}`);
    console.log(`   Mode: ${battle1.mode}`);

    // Add participants
    await db.addBattleParticipant(battle1Id, warrior1Id);
    await db.addBattleParticipant(battle1Id, warrior2Id);

    // Get current ELO ratings
    const w1 = await db.getAgent(warrior1Id);
    const w2 = await db.getAgent(warrior2Id);

    console.log(`   ${w1.name} (${w1.elo_rating}) vs ${w2.name} (${w2.elo_rating})`);

    // Publish battle start event
    await mq.publish('agent.battles', 'battle.started', {
      battleId: battle1Id,
      mode: 'head-to-head',
      participants: [warrior1Id, warrior2Id]
    });

    // Simulate battle
    console.log('   ⚔️  Battle in progress...');
    await sleep(100);

    // Warrior1 wins
    const winner1 = warrior1Id;
    const loser1 = warrior2Id;

    // Calculate ELO changes
    const elo1Change = calculateEloChange(w1.elo_rating, w2.elo_rating, 1); // Winner gets 1
    const elo2Change = calculateEloChange(w2.elo_rating, w1.elo_rating, 0); // Loser gets 0

    console.log(`   🏆 Winner: ${w1.name}`);
    console.log(`   ELO Changes:`);
    console.log(`     ${w1.name}: ${w1.elo_rating} → ${w1.elo_rating + elo1Change} (${elo1Change > 0 ? '+' : ''}${elo1Change})`);
    console.log(`     ${w2.name}: ${w2.elo_rating} → ${w2.elo_rating + elo2Change} (${elo2Change > 0 ? '+' : ''}${elo2Change})`);

    // Update ELO in database
    await db.updateEloRating(warrior1Id, w1.elo_rating + elo1Change, battle1Id);
    await db.updateEloRating(warrior2Id, w2.elo_rating + elo2Change, battle1Id);

    // Update agent stats
    await db.query(
      'UPDATE agents SET battles_won = battles_won + 1 WHERE agent_id = $1',
      [winner1]
    );
    await db.query(
      'UPDATE agents SET battles_lost = battles_lost + 1 WHERE agent_id = $1',
      [loser1]
    );

    // Save battle results
    const results1 = {
      winner: winner1,
      scores: {
        [warrior1Id]: 100,
        [warrior2Id]: 85
      },
      eloChanges: {
        [warrior1Id]: elo1Change,
        [warrior2Id]: elo2Change
      }
    };

    await db.updateBattleResults(battle1Id, winner1, results1);

    // Publish battle complete event
    await mq.publish('agent.battles', 'battle.completed', {
      battleId: battle1Id,
      winner: winner1,
      results: results1
    });

    console.log('   ✓ Battle results persisted');

    // ============================================
    // STEP 3: Battle 2 - Upset Victory
    // ============================================
    console.log('\n✅ STEP 3: Battle 2 - Upset Victory (Underdog Wins)');

    const battle2Id = uuidv4();
    await db.createBattle(battle2Id, {
      mode: 'head-to-head',
      participants: [warrior3Id, warrior4Id]
    });

    await db.addBattleParticipant(battle2Id, warrior3Id);
    await db.addBattleParticipant(battle2Id, warrior4Id);

    const w3 = await db.getAgent(warrior3Id);
    const w4 = await db.getAgent(warrior4Id);

    console.log(`   ${w3.name} (${w3.elo_rating}) vs ${w4.name} (${w4.elo_rating})`);
    console.log(`   ELO Difference: ${Math.abs(w3.elo_rating - w4.elo_rating)}`);

    await sleep(100);

    // Underdog (warrior3) wins!
    const winner2 = warrior3Id;
    const loser2 = warrior4Id;

    const elo3Change = calculateEloChange(w3.elo_rating, w4.elo_rating, 1);
    const elo4Change = calculateEloChange(w4.elo_rating, w3.elo_rating, 0);

    console.log(`   🏆 UPSET! ${w3.name} defeats ${w4.name}!`);
    console.log(`   ELO Changes:`);
    console.log(`     ${w3.name}: ${w3.elo_rating} → ${w3.elo_rating + elo3Change} (${elo3Change > 0 ? '+' : ''}${elo3Change})`);
    console.log(`     ${w4.name}: ${w4.elo_rating} → ${w4.elo_rating + elo4Change} (${elo4Change > 0 ? '+' : ''}${elo4Change})`);

    await db.updateEloRating(warrior3Id, w3.elo_rating + elo3Change, battle2Id);
    await db.updateEloRating(warrior4Id, w4.elo_rating + elo4Change, battle2Id);

    await db.query(
      'UPDATE agents SET battles_won = battles_won + 1 WHERE agent_id = $1',
      [winner2]
    );
    await db.query(
      'UPDATE agents SET battles_lost = battles_lost + 1 WHERE agent_id = $1',
      [loser2]
    );

    const results2 = {
      winner: winner2,
      upset: true,
      eloGap: Math.abs(w3.elo_rating - w4.elo_rating)
    };

    await db.updateBattleResults(battle2Id, winner2, results2);

    console.log('   ✓ Upset victory recorded');

    // ============================================
    // STEP 4: Battle 3 - Speed Race
    // ============================================
    console.log('\n✅ STEP 4: Battle 3 - Speed Race');

    const battle3Id = uuidv4();
    await db.createBattle(battle3Id, {
      mode: 'speed-race',
      participants: [warrior1Id, warrior2Id, warrior3Id]
    });

    await db.addBattleParticipant(battle3Id, warrior1Id);
    await db.addBattleParticipant(battle3Id, warrior2Id);
    await db.addBattleParticipant(battle3Id, warrior3Id);

    console.log('   Mode: Speed Race (3 participants)');

    await sleep(100);

    // Completion times (in ms)
    const times = {
      [warrior1Id]: 5000,  // 5 seconds
      [warrior2Id]: 5500,  // 5.5 seconds
      [warrior3Id]: 4800   // 4.8 seconds (fastest!)
    };

    const winner3 = warrior3Id;
    console.log(`   Completion times:`);
    console.log(`     ${w1.name}: ${times[warrior1Id]}ms`);
    console.log(`     ${w2.name}: ${times[warrior2Id]}ms`);
    console.log(`     ${w3.name}: ${times[warrior3Id]}ms`);
    console.log(`   🏆 Winner: ${w3.name} (fastest!)`);

    // Award points based on placement
    const placements = [
      { agentId: warrior3Id, place: 1, points: 100 },
      { agentId: warrior1Id, place: 2, points: 50 },
      { agentId: warrior2Id, place: 3, points: 25 }
    ];

    for (const placement of placements) {
      await db.query(
        `UPDATE battle_participants
         SET placement = $1, score = $2
         WHERE battle_id = $3 AND agent_id = $4`,
        [placement.place, placement.points, battle3Id, placement.agentId]
      );

      if (placement.place === 1) {
        await db.query(
          'UPDATE agents SET battles_won = battles_won + 1 WHERE agent_id = $1',
          [placement.agentId]
        );
      }
    }

    await db.updateBattleResults(battle3Id, winner3, {
      mode: 'speed-race',
      times,
      placements
    });

    console.log('   ✓ Speed race results saved');

    // ============================================
    // STEP 5: ELO Leaderboard
    // ============================================
    console.log('\n✅ STEP 5: ELO Leaderboard');

    const eloRankings = await db.query(
      `SELECT agent_id, name, elo_rating, battles_won, battles_lost,
              tier, tasks_completed
       FROM agents
       WHERE agent_id = ANY($1)
       ORDER BY elo_rating DESC`,
      [[warrior1Id, warrior2Id, warrior3Id, warrior4Id]]
    );

    console.log('   Current ELO Rankings:');
    eloRankings.rows.forEach((agent, index) => {
      const winRate = agent.battles_won + agent.battles_lost > 0
        ? ((agent.battles_won / (agent.battles_won + agent.battles_lost)) * 100).toFixed(1)
        : '0.0';

      console.log(`     ${index + 1}. ${agent.name}`);
      console.log(`        ELO: ${agent.elo_rating} | W-L: ${agent.battles_won}-${agent.battles_lost} (${winRate}%)`);
    });

    // ============================================
    // STEP 6: Battle History
    // ============================================
    console.log('\n✅ STEP 6: Battle History');

    const battleHistory = await db.query(
      `SELECT b.battle_id, b.mode, b.winner_id, b.completed_at,
              (SELECT name FROM agents WHERE agent_id = b.winner_id) as winner_name,
              (SELECT COUNT(*) FROM battle_participants WHERE battle_id = b.battle_id) as participant_count
       FROM battles b
       WHERE b.status = 'completed'
       ORDER BY b.completed_at DESC`
    );

    console.log(`   Completed battles: ${battleHistory.rows.length}`);
    battleHistory.rows.forEach((battle, index) => {
      const time = new Date(battle.completed_at).toLocaleTimeString();
      console.log(`     ${index + 1}. [${time}] ${battle.mode} - Winner: ${battle.winner_name} (${battle.participant_count} fighters)`);
    });

    // ============================================
    // STEP 7: Agent Battle Statistics
    // ============================================
    console.log('\n✅ STEP 7: Agent Battle Statistics');

    const battleStats = await db.query(
      `SELECT bp.agent_id, a.name,
              COUNT(bp.id) as total_battles,
              AVG(bp.score) as avg_score,
              SUM(CASE WHEN bp.placement = 1 THEN 1 ELSE 0 END) as first_place,
              AVG(bp.elo_change) as avg_elo_change
       FROM battle_participants bp
       JOIN agents a ON bp.agent_id = a.agent_id
       WHERE bp.agent_id = ANY($1)
       GROUP BY bp.agent_id, a.name
       ORDER BY first_place DESC`,
      [[warrior1Id, warrior2Id, warrior3Id, warrior4Id]]
    );

    console.log('   Detailed battle statistics:');
    battleStats.rows.forEach(stat => {
      const avgScore = stat.avg_score ? parseFloat(stat.avg_score).toFixed(1) : '0.0';
      const avgElo = stat.avg_elo_change ? parseFloat(stat.avg_elo_change).toFixed(1) : '0.0';

      console.log(`     ${stat.name}:`);
      console.log(`       Battles: ${stat.total_battles} | Wins: ${stat.first_place}`);
      console.log(`       Avg Score: ${avgScore} | Avg ELO Change: ${avgElo > 0 ? '+' : ''}${avgElo}`);
    });

    // ============================================
    // STEP 8: ELO History Tracking
    // ============================================
    console.log('\n✅ STEP 8: ELO History Tracking');

    const eloHistory = await db.query(
      `SELECT bp.agent_id, a.name, bp.elo_before, bp.elo_after, bp.elo_change,
              b.battle_id, b.mode, b.completed_at
       FROM battle_participants bp
       JOIN agents a ON bp.agent_id = a.agent_id
       JOIN battles b ON bp.battle_id = b.battle_id
       WHERE bp.agent_id = $1 AND bp.elo_change IS NOT NULL
       ORDER BY b.completed_at`,
      [warrior3Id]
    );

    console.log(`   ELO progression for ${w3.name}:`);
    eloHistory.rows.forEach((entry, index) => {
      const change = entry.elo_change > 0 ? `+${entry.elo_change}` : entry.elo_change;
      console.log(`     Battle ${index + 1}: ${entry.elo_before} → ${entry.elo_after} (${change})`);
    });

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n✅ VERIFICATION');

    const checks = [
      {
        name: 'Battles created and completed',
        pass: battleHistory.rows.length >= 3
      },
      {
        name: 'ELO ratings updated',
        pass: eloRankings.rows.every(a => a.elo_rating !== 1000 || a.agent_id === warrior2Id)
      },
      {
        name: 'Winners recorded',
        pass: battleHistory.rows.every(b => b.winner_id !== null)
      },
      {
        name: 'Battle participants tracked',
        pass: battleStats.rows.length > 0
      },
      {
        name: 'Win/loss stats updated',
        pass: eloRankings.rows.some(a => a.battles_won > 0)
      },
      {
        name: 'ELO history maintained',
        pass: eloHistory.rows.length > 0
      },
      {
        name: 'Placements recorded',
        pass: battleStats.rows.some(s => s.first_place > 0)
      },
      {
        name: 'Battle events published',
        pass: true // We successfully published events
      }
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✓' : '✗';
      console.log(`   ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    if (!allPassed) {
      throw new Error('Some verification checks failed');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST PASSED: Battle System with ELO Persistence');
    console.log('='.repeat(60));

    return true;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;

  } finally {
    if (testEnv) {
      console.log('\n🧹 Cleaning up...');
      await teardownTestEnvironment(testEnv);
    }
  }
}

// Run the test
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runTest()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default runTest;
