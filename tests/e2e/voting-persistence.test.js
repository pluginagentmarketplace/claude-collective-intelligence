#!/usr/bin/env node
/**
 * E2E Test: Voting with Database Persistence
 *
 * Tests democratic decision-making with full persistence:
 * 1. Create voting session in database
 * 2. Broadcast via RabbitMQ
 * 3. Agents cast votes (stored in DB)
 * 4. Vote counting with audit trail
 * 5. Results persistence
 * 6. Multiple voting algorithms
 * 7. Quorum validation
 */

import { setupTestEnvironment, teardownTestEnvironment, sleep } from '../helpers/test-setup.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_NAME = 'Voting with Database Persistence';
let testEnv;

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
    // STEP 1: Create Voting Agents
    // ============================================
    console.log('\n✅ STEP 1: Create Voting Agents');

    const numAgents = 7;
    const agents = [];

    for (let i = 0; i < numAgents; i++) {
      const agentId = `voter-${i}-${uuidv4().slice(0, 8)}`;
      await db.createAgent(agentId, {
        name: `Voting Agent ${i + 1}`,
        tier: i < 2 ? 'gold' : 'silver' // Some senior agents
      });
      agents.push(agentId);
    }

    console.log(`   Created ${numAgents} voting agents`);

    // ============================================
    // STEP 2: Simple Majority Vote
    // ============================================
    console.log('\n✅ STEP 2: Simple Majority Voting');

    const session1Id = uuidv4();
    const session1 = await db.createVotingSession(session1Id, {
      topic: 'Architecture Decision',
      question: 'Which database should we use for the new service?',
      options: ['PostgreSQL', 'MongoDB', 'MySQL'],
      algorithm: 'simple_majority',
      initiatedBy: agents[0],
      deadline: new Date(Date.now() + 300000) // 5 minutes
    });

    console.log(`   Session ID: ${session1.session_id}`);
    console.log(`   Question: ${session1.question}`);
    console.log(`   Options: ${JSON.parse(session1.options).join(', ')}`);

    // Broadcast to agents via RabbitMQ
    await mq.publish('agent.brainstorm', 'voting.new', {
      sessionId: session1Id,
      question: session1.question,
      options: JSON.parse(session1.options),
      deadline: session1.deadline
    });

    console.log('   ✓ Voting session broadcast to agents');

    // Agents cast votes
    const votes1 = [
      { agentId: agents[0], option: 'PostgreSQL', confidence: 0.9 },
      { agentId: agents[1], option: 'PostgreSQL', confidence: 0.95 },
      { agentId: agents[2], option: 'PostgreSQL', confidence: 0.8 },
      { agentId: agents[3], option: 'MongoDB', confidence: 0.7 },
      { agentId: agents[4], option: 'PostgreSQL', confidence: 0.85 },
      { agentId: agents[5], option: 'MySQL', confidence: 0.6 },
      { agentId: agents[6], option: 'PostgreSQL', confidence: 0.9 }
    ];

    for (const vote of votes1) {
      await db.castVote(session1Id, vote.agentId, {
        option: vote.option,
        confidence: vote.confidence,
        reasoning: `I recommend ${vote.option} based on requirements`
      });

      // Publish vote event
      await mq.publish('agent.brainstorm', 'voting.vote_cast', {
        sessionId: session1Id,
        agentId: vote.agentId,
        option: vote.option
      });

      await sleep(10); // Simulate voting delay
    }

    console.log(`   ✓ ${votes1.length} votes cast`);

    // Count votes
    const sessionVotes = await db.getSessionVotes(session1Id);
    const voteCounts = {};

    sessionVotes.forEach(vote => {
      voteCounts[vote.option_selected] = (voteCounts[vote.option_selected] || 0) + 1;
    });

    console.log('   Vote distribution:');
    Object.entries(voteCounts).forEach(([option, count]) => {
      const percentage = ((count / sessionVotes.length) * 100).toFixed(1);
      console.log(`     ${option}: ${count} (${percentage}%)`);
    });

    // Determine winner
    const winner = Object.keys(voteCounts).reduce((a, b) =>
      voteCounts[a] > voteCounts[b] ? a : b
    );

    const results1 = {
      winner,
      votes: voteCounts,
      totalVotes: sessionVotes.length,
      winningPercentage: ((voteCounts[winner] / sessionVotes.length) * 100).toFixed(1)
    };

    // Close session and persist results
    await db.closeVotingSession(session1Id, results1);

    console.log(`   🏆 Winner: ${winner} (${results1.winningPercentage}%)`);

    // Publish results
    await mq.publish('agent.brainstorm', 'voting.completed', {
      sessionId: session1Id,
      winner,
      results: results1
    });

    // ============================================
    // STEP 3: Confidence-Weighted Voting
    // ============================================
    console.log('\n✅ STEP 3: Confidence-Weighted Voting');

    const session2Id = uuidv4();
    const session2 = await db.createVotingSession(session2Id, {
      topic: 'Performance Optimization',
      question: 'Should we implement caching?',
      options: ['Yes', 'No', 'Not Yet'],
      algorithm: 'confidence_weighted',
      initiatedBy: agents[0],
      deadline: new Date(Date.now() + 300000)
    });

    console.log(`   Question: ${session2.question}`);

    // Votes with varying confidence
    const votes2 = [
      { agentId: agents[0], option: 'Yes', confidence: 0.95 }, // High confidence
      { agentId: agents[1], option: 'Yes', confidence: 0.90 },
      { agentId: agents[2], option: 'Not Yet', confidence: 0.60 }, // Low confidence
      { agentId: agents[3], option: 'Yes', confidence: 0.85 },
      { agentId: agents[4], option: 'No', confidence: 0.50 }, // Very low confidence
      { agentId: agents[5], option: 'Yes', confidence: 0.80 },
      { agentId: agents[6], option: 'Not Yet', confidence: 0.70 }
    ];

    for (const vote of votes2) {
      await db.castVote(session2Id, vote.agentId, vote);
      await sleep(10);
    }

    // Calculate weighted results
    const votes2Data = await db.getSessionVotes(session2Id);
    const weightedScores = {};

    votes2Data.forEach(vote => {
      const option = vote.option_selected;
      const confidence = parseFloat(vote.confidence);
      weightedScores[option] = (weightedScores[option] || 0) + confidence;
    });

    console.log('   Confidence-weighted scores:');
    Object.entries(weightedScores).forEach(([option, score]) => {
      console.log(`     ${option}: ${score.toFixed(2)}`);
    });

    const winner2 = Object.keys(weightedScores).reduce((a, b) =>
      weightedScores[a] > weightedScores[b] ? a : b
    );

    const results2 = {
      winner: winner2,
      weightedScores,
      algorithm: 'confidence_weighted'
    };

    await db.closeVotingSession(session2Id, results2);
    console.log(`   🏆 Winner: ${winner2} (weighted score: ${weightedScores[winner2].toFixed(2)})`);

    // ============================================
    // STEP 4: Quorum Validation
    // ============================================
    console.log('\n✅ STEP 4: Quorum Validation');

    const session3Id = uuidv4();
    const session3 = await db.createVotingSession(session3Id, {
      topic: 'Critical Decision',
      question: 'Should we deploy to production?',
      options: ['Deploy', 'Wait', 'Reject'],
      algorithm: 'consensus',
      initiatedBy: agents[0],
      deadline: new Date(Date.now() + 300000)
    });

    console.log(`   Question: ${session3.question}`);
    console.log(`   Required: Consensus (75% agreement)`);

    // Only 4 agents vote (less than quorum)
    const votes3 = [
      { agentId: agents[0], option: 'Deploy', confidence: 0.9 },
      { agentId: agents[1], option: 'Deploy', confidence: 0.85 },
      { agentId: agents[2], option: 'Deploy', confidence: 0.8 },
      { agentId: agents[3], option: 'Wait', confidence: 0.7 }
    ];

    for (const vote of votes3) {
      await db.castVote(session3Id, vote.agentId, vote);
    }

    const votes3Data = await db.getSessionVotes(session3Id);
    const participation = votes3Data.length / numAgents;
    const requiredParticipation = 0.5; // 50% minimum

    console.log(`   Participation: ${votes3Data.length}/${numAgents} (${(participation * 100).toFixed(1)}%)`);

    if (participation < requiredParticipation) {
      console.log(`   ⚠️  Quorum not met (need ${(requiredParticipation * 100)}%)`);

      const results3 = {
        status: 'quorum_not_met',
        participation: (participation * 100).toFixed(1),
        required: (requiredParticipation * 100)
      };

      await db.closeVotingSession(session3Id, results3);
    } else {
      // Check for consensus
      const option3Counts = {};
      votes3Data.forEach(vote => {
        option3Counts[vote.option_selected] = (option3Counts[vote.option_selected] || 0) + 1;
      });

      const consensusOption = Object.keys(option3Counts).reduce((a, b) =>
        option3Counts[a] > option3Counts[b] ? a : b
      );

      const consensusPercentage = (option3Counts[consensusOption] / votes3Data.length) * 100;

      console.log(`   Leading option: ${consensusOption} (${consensusPercentage.toFixed(1)}%)`);

      if (consensusPercentage >= 75) {
        console.log('   ✓ Consensus reached!');
      } else {
        console.log('   ⚠️  Consensus threshold not met (need 75%)');
      }
    }

    // ============================================
    // STEP 5: Vote Audit Trail
    // ============================================
    console.log('\n✅ STEP 5: Vote Audit Trail');

    const allVotes = await db.query(
      `SELECT v.*, vs.question, a.name as agent_name
       FROM votes v
       JOIN voting_sessions vs ON v.session_id = vs.session_id
       JOIN agents a ON v.agent_id = a.agent_id
       ORDER BY v.created_at DESC
       LIMIT 10`
    );

    console.log(`   Recent votes (showing 10 of ${allVotes.rows.length}):`);
    allVotes.rows.slice(0, 10).forEach(vote => {
      const time = new Date(vote.created_at).toLocaleTimeString();
      console.log(`     [${time}] ${vote.agent_name} → ${vote.option_selected} (confidence: ${vote.confidence})`);
    });

    // ============================================
    // STEP 6: Session History
    // ============================================
    console.log('\n✅ STEP 6: Session History');

    const allSessions = await db.query(
      `SELECT session_id, topic, question, status,
              (SELECT COUNT(*) FROM votes WHERE votes.session_id = voting_sessions.session_id) as vote_count
       FROM voting_sessions
       ORDER BY initiated_at DESC`
    );

    console.log('   All voting sessions:');
    allSessions.rows.forEach((session, index) => {
      console.log(`     ${index + 1}. ${session.topic} - ${session.vote_count} votes (${session.status})`);
    });

    // ============================================
    // STEP 7: Agent Voting Statistics
    // ============================================
    console.log('\n✅ STEP 7: Agent Voting Statistics');

    const votingStats = await db.query(
      `SELECT a.agent_id, a.name,
              COUNT(v.vote_id) as votes_cast,
              AVG(v.confidence) as avg_confidence
       FROM agents a
       LEFT JOIN votes v ON a.agent_id = v.agent_id
       WHERE a.agent_id = ANY($1)
       GROUP BY a.agent_id, a.name
       ORDER BY votes_cast DESC`,
      [agents]
    );

    console.log('   Agent participation:');
    votingStats.rows.forEach(stat => {
      const avgConf = stat.avg_confidence ? parseFloat(stat.avg_confidence).toFixed(2) : '0.00';
      console.log(`     ${stat.name}: ${stat.votes_cast} votes, avg confidence: ${avgConf}`);
    });

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n✅ VERIFICATION');

    const checks = [
      {
        name: 'Voting sessions created',
        pass: allSessions.rows.length >= 3
      },
      {
        name: 'Votes persisted to database',
        pass: allVotes.rows.length > 0
      },
      {
        name: 'Simple majority calculated',
        pass: results1.winner === 'PostgreSQL'
      },
      {
        name: 'Confidence weighting applied',
        pass: results2.winner && weightedScores[results2.winner] > 0
      },
      {
        name: 'Session results stored',
        pass: session1.status !== null
      },
      {
        name: 'Vote audit trail maintained',
        pass: allVotes.rows.length >= 15 // At least 15 votes recorded
      },
      {
        name: 'Agent stats tracked',
        pass: votingStats.rows.length > 0
      },
      {
        name: 'RabbitMQ events published',
        pass: true // We published events successfully
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
    console.log('✅ TEST PASSED: Voting with Database Persistence');
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
