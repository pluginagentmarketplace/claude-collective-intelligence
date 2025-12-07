#!/usr/bin/env node
/**
 * Voting Scenario Example: Finance vs Compliance vs Growth
 *
 * Demonstrates a real-world multi-agent voting scenario where different
 * stakeholder agents must vote on a critical business decision using
 * different voting algorithms.
 *
 * Scenario: Should the company launch a new high-risk, high-reward product feature?
 *
 * Stakeholders:
 * - Finance Agent (Level 5): Concerned about ROI and budget
 * - Compliance Agent (Level 5): Concerned about legal/regulatory risks
 * - Growth Agent (Level 4): Focused on user acquisition and market expansion
 * - Engineering Agent (Level 3): Technical feasibility and maintenance
 * - Product Agent (Level 4): User experience and product-market fit
 * - Marketing Agent (Level 3): Brand impact and messaging
 */

import RabbitMQClient from '../src/core/rabbitmq-client.js';
import VotingSystem from '../src/systems/voting/system.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class VotingScenario {
  constructor() {
    this.agents = [];
    this.votingSystem = null;
    this.client = null;
  }

  async run() {
    console.log('\n' + '═'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}MULTI-AGENT VOTING SCENARIO: Product Launch Decision${colors.reset}`);
    console.log('═'.repeat(80) + '\n');

    try {
      await this.setup();
      await this.runScenario();
    } catch (error) {
      console.error(`${colors.red}Error:${colors.reset}`, error);
    } finally {
      await this.cleanup();
    }
  }

  async setup() {
    console.log(`${colors.blue}⚙️  Setting up RabbitMQ and voting system...${colors.reset}\n`);

    this.client = new RabbitMQClient({
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672'
    });

    await this.client.connect();
    await this.client.setupBrainstormExchange();

    this.votingSystem = new VotingSystem(this.client);

    // Define agents with their characteristics
    this.agents = [
      {
        id: 'finance-agent',
        name: 'Finance Agent',
        level: 5,
        role: 'CFO',
        color: colors.green,
        perspective: 'ROI and budget impact'
      },
      {
        id: 'compliance-agent',
        name: 'Compliance Agent',
        level: 5,
        role: 'Legal/Regulatory',
        color: colors.red,
        perspective: 'Legal risks and compliance'
      },
      {
        id: 'growth-agent',
        name: 'Growth Agent',
        level: 4,
        role: 'Growth Lead',
        color: colors.magenta,
        perspective: 'User acquisition and market expansion'
      },
      {
        id: 'engineering-agent',
        name: 'Engineering Agent',
        level: 3,
        role: 'Tech Lead',
        color: colors.cyan,
        perspective: 'Technical feasibility and maintenance'
      },
      {
        id: 'product-agent',
        name: 'Product Agent',
        level: 4,
        role: 'Product Manager',
        color: colors.blue,
        perspective: 'User experience and product-market fit'
      },
      {
        id: 'marketing-agent',
        name: 'Marketing Agent',
        level: 3,
        role: 'Marketing Lead',
        color: colors.yellow,
        perspective: 'Brand impact and messaging'
      }
    ];

    console.log(`${colors.green}✓ Setup complete${colors.reset}\n`);
  }

  async runScenario() {
    console.log('═'.repeat(80));
    console.log(`${colors.bright}SCENARIO: Launch High-Risk Cryptocurrency Payment Feature${colors.reset}`);
    console.log('═'.repeat(80) + '\n');

    console.log(`${colors.dim}The company must decide whether to launch a new cryptocurrency payment`);
    console.log(`feature. This decision involves significant financial, legal, and strategic`);
    console.log(`considerations. Each stakeholder agent will vote using different algorithms.${colors.reset}\n`);

    // Display agents
    console.log(`${colors.bright}Stakeholders (${this.agents.length} agents):${colors.reset}\n`);
    this.agents.forEach(agent => {
      console.log(`  ${agent.color}● ${agent.name}${colors.reset} (Level ${agent.level}) - ${agent.role}`);
      console.log(`    ${colors.dim}Perspective: ${agent.perspective}${colors.reset}\n`);
    });

    await this.wait(2000);

    // Run different voting scenarios
    await this.scenario1_SimpleMajority();
    await this.wait(1000);

    await this.scenario2_ConfidenceWeighted();
    await this.wait(1000);

    await this.scenario3_Quadratic();
    await this.wait(1000);

    await this.scenario4_Consensus();
    await this.wait(1000);

    await this.scenario5_RankedChoice();
  }

  /**
   * Scenario 1: Simple Majority Vote
   */
  async scenario1_SimpleMajority() {
    console.log('\n' + '─'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}SCENARIO 1: Simple Majority Vote${colors.reset}`);
    console.log(`${colors.dim}Each agent gets 1 vote, most votes win${colors.reset}`);
    console.log('─'.repeat(80) + '\n');

    const sessionId = await this.votingSystem.initiateVote({
      topic: 'Crypto Payment Feature Launch',
      question: 'Should we launch the cryptocurrency payment feature?',
      options: ['Launch Now', 'Delay 6 Months', 'Cancel Project'],
      algorithm: 'simple_majority',
      initiatedBy: 'product-agent',
      totalAgents: this.agents.length,
      minParticipation: 0.7
    });

    console.log(`${colors.blue}📊 Voting session initiated: ${sessionId}${colors.reset}\n`);

    // Agents cast votes
    const votes = [
      { agent: this.agents[0], choice: 'Delay 6 Months', reason: 'Need clearer ROI projections' },
      { agent: this.agents[1], choice: 'Delay 6 Months', reason: 'Regulatory framework still evolving' },
      { agent: this.agents[2], choice: 'Launch Now', reason: 'Competitors are moving fast' },
      { agent: this.agents[3], choice: 'Delay 6 Months', reason: 'Infrastructure needs more hardening' },
      { agent: this.agents[4], choice: 'Launch Now', reason: 'User demand is high' },
      { agent: this.agents[5], choice: 'Launch Now', reason: 'Good timing for brand positioning' }
    ];

    for (const vote of votes) {
      await this.votingSystem.castVote(sessionId, vote.agent.id, {
        choice: vote.choice
      });

      console.log(`${vote.agent.color}${vote.agent.name}${colors.reset} votes: ${colors.bright}${vote.choice}${colors.reset}`);
      console.log(`  ${colors.dim}Reason: ${vote.reason}${colors.reset}\n`);
      await this.wait(300);
    }

    const results = await this.votingSystem.closeVoting(sessionId);

    this.displayResults(results, 'Simple Majority');
  }

  /**
   * Scenario 2: Confidence-Weighted Vote
   */
  async scenario2_ConfidenceWeighted() {
    console.log('\n' + '─'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}SCENARIO 2: Confidence-Weighted Vote${colors.reset}`);
    console.log(`${colors.dim}Votes weighted by agent confidence and expertise${colors.reset}`);
    console.log('─'.repeat(80) + '\n');

    const sessionId = await this.votingSystem.initiateVote({
      topic: 'Crypto Payment Feature Launch',
      question: 'Should we launch the cryptocurrency payment feature?',
      options: ['Launch Now', 'Delay 6 Months', 'Cancel Project'],
      algorithm: 'confidence_weighted',
      initiatedBy: 'product-agent',
      totalAgents: this.agents.length,
      minParticipation: 0.7
    });

    console.log(`${colors.blue}📊 Voting session initiated: ${sessionId}${colors.reset}\n`);

    // Agents cast votes with confidence levels
    const votes = [
      {
        agent: this.agents[0], // Finance - Level 5
        choice: 'Delay 6 Months',
        confidence: 0.85,
        reason: 'High confidence: Financial analysis shows 6 months needed for positive ROI'
      },
      {
        agent: this.agents[1], // Compliance - Level 5
        choice: 'Delay 6 Months',
        confidence: 0.95,
        reason: 'Very high confidence: Regulatory requirements not yet clear'
      },
      {
        agent: this.agents[2], // Growth - Level 4
        choice: 'Launch Now',
        confidence: 0.70,
        reason: 'Medium-high confidence: Market window is closing'
      },
      {
        agent: this.agents[3], // Engineering - Level 3
        choice: 'Delay 6 Months',
        confidence: 0.60,
        reason: 'Medium confidence: Technical concerns exist but manageable'
      },
      {
        agent: this.agents[4], // Product - Level 4
        choice: 'Launch Now',
        confidence: 0.75,
        reason: 'High confidence: User research shows strong demand'
      },
      {
        agent: this.agents[5], // Marketing - Level 3
        choice: 'Launch Now',
        confidence: 0.50,
        reason: 'Low confidence: Uncertain about messaging strategy'
      }
    ];

    for (const vote of votes) {
      await this.votingSystem.castVote(sessionId, vote.agent.id, {
        choice: vote.choice,
        confidence: vote.confidence,
        agentLevel: vote.agent.level
      });

      console.log(`${vote.agent.color}${vote.agent.name}${colors.reset} votes: ${colors.bright}${vote.choice}${colors.reset}`);
      console.log(`  ${colors.dim}Confidence: ${(vote.confidence * 100).toFixed(0)}% | ${vote.reason}${colors.reset}\n`);
      await this.wait(300);
    }

    const results = await this.votingSystem.closeVoting(sessionId);

    this.displayResults(results, 'Confidence-Weighted');
  }

  /**
   * Scenario 3: Quadratic Voting
   */
  async scenario3_Quadratic() {
    console.log('\n' + '─'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}SCENARIO 3: Quadratic Voting${colors.reset}`);
    console.log(`${colors.dim}Agents allocate 100 tokens across options (votes = sqrt(tokens))${colors.reset}`);
    console.log('─'.repeat(80) + '\n');

    const sessionId = await this.votingSystem.initiateVote({
      topic: 'Crypto Payment Feature Launch',
      question: 'Allocate your tokens to show preference intensity',
      options: ['Launch Now', 'Delay 6 Months', 'Cancel Project'],
      algorithm: 'quadratic',
      initiatedBy: 'product-agent',
      totalAgents: this.agents.length,
      tokensPerAgent: 100,
      minParticipation: 0.7
    });

    console.log(`${colors.blue}📊 Voting session initiated: ${sessionId}${colors.reset}`);
    console.log(`${colors.dim}Each agent has 100 tokens to allocate${colors.reset}\n`);

    const votes = [
      {
        agent: this.agents[0], // Finance
        allocation: { 'Delay 6 Months': 81, 'Cancel Project': 16, 'Launch Now': 3 },
        reason: 'Strong preference for delay, very opposed to immediate launch'
      },
      {
        agent: this.agents[1], // Compliance
        allocation: { 'Delay 6 Months': 64, 'Cancel Project': 25, 'Launch Now': 11 },
        reason: 'Prefer delay, concerned about cancellation, risky to launch now'
      },
      {
        agent: this.agents[2], // Growth
        allocation: { 'Launch Now': 64, 'Delay 6 Months': 25, 'Cancel Project': 11 },
        reason: 'Strong preference to launch, delay acceptable, strongly oppose cancellation'
      },
      {
        agent: this.agents[3], // Engineering
        allocation: { 'Delay 6 Months': 49, 'Launch Now': 36, 'Cancel Project': 15 },
        reason: 'Slightly prefer delay for more testing time'
      },
      {
        agent: this.agents[4], // Product
        allocation: { 'Launch Now': 49, 'Delay 6 Months': 36, 'Cancel Project': 15 },
        reason: 'Slight preference to launch, open to delay'
      },
      {
        agent: this.agents[5], // Marketing
        allocation: { 'Launch Now': 40, 'Delay 6 Months': 40, 'Cancel Project': 20 },
        reason: 'Neutral between launch and delay'
      }
    ];

    for (const vote of votes) {
      await this.votingSystem.castVote(sessionId, vote.agent.id, {
        allocation: vote.allocation
      });

      const totalTokens = Object.values(vote.allocation).reduce((a, b) => a + b, 0);
      console.log(`${vote.agent.color}${vote.agent.name}${colors.reset} allocates ${totalTokens} tokens:`);

      Object.entries(vote.allocation).forEach(([option, tokens]) => {
        const votes = Math.sqrt(tokens);
        console.log(`  ${option}: ${tokens} tokens → ${votes.toFixed(1)} votes`);
      });
      console.log(`  ${colors.dim}${vote.reason}${colors.reset}\n`);
      await this.wait(300);
    }

    const results = await this.votingSystem.closeVoting(sessionId);

    this.displayResults(results, 'Quadratic');
  }

  /**
   * Scenario 4: Consensus Voting (75% threshold)
   */
  async scenario4_Consensus() {
    console.log('\n' + '─'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}SCENARIO 4: Consensus Voting (75% threshold)${colors.reset}`);
    console.log(`${colors.dim}Requires 75% agreement for decision to pass${colors.reset}`);
    console.log('─'.repeat(80) + '\n');

    const sessionId = await this.votingSystem.initiateVote({
      topic: 'Crypto Payment Feature Launch',
      question: 'Should we proceed with launch preparations?',
      options: ['Proceed', 'Do Not Proceed'],
      algorithm: 'consensus',
      initiatedBy: 'product-agent',
      totalAgents: this.agents.length,
      consensusThreshold: 0.75,
      minParticipation: 0.7
    });

    console.log(`${colors.blue}📊 Voting session initiated: ${sessionId}${colors.reset}\n`);

    const votes = [
      { agent: this.agents[0], choice: 'Do Not Proceed', reason: 'Financial concerns unresolved' },
      { agent: this.agents[1], choice: 'Do Not Proceed', reason: 'Compliance issues remain' },
      { agent: this.agents[2], choice: 'Proceed', reason: 'Market opportunity exists' },
      { agent: this.agents[3], choice: 'Do Not Proceed', reason: 'Technical debt concerns' },
      { agent: this.agents[4], choice: 'Proceed', reason: 'User value is clear' },
      { agent: this.agents[5], choice: 'Do Not Proceed', reason: 'Messaging strategy incomplete' }
    ];

    for (const vote of votes) {
      await this.votingSystem.castVote(sessionId, vote.agent.id, {
        choice: vote.choice
      });

      console.log(`${vote.agent.color}${vote.agent.name}${colors.reset} votes: ${colors.bright}${vote.choice}${colors.reset}`);
      console.log(`  ${colors.dim}${vote.reason}${colors.reset}\n`);
      await this.wait(300);
    }

    const results = await this.votingSystem.closeVoting(sessionId);

    this.displayResults(results, 'Consensus (75%)');

    if (results.consensusReached) {
      console.log(`\n${colors.green}✓ CONSENSUS REACHED${colors.reset}`);
    } else {
      console.log(`\n${colors.red}✗ NO CONSENSUS - Additional discussion needed${colors.reset}`);
    }
  }

  /**
   * Scenario 5: Ranked Choice Voting
   */
  async scenario5_RankedChoice() {
    console.log('\n' + '─'.repeat(80));
    console.log(`${colors.bright}${colors.cyan}SCENARIO 5: Ranked Choice Voting${colors.reset}`);
    console.log(`${colors.dim}Agents rank all options by preference, instant runoff elimination${colors.reset}`);
    console.log('─'.repeat(80) + '\n');

    const sessionId = await this.votingSystem.initiateVote({
      topic: 'Crypto Payment Feature Launch',
      question: 'Rank your preferences for the product launch',
      options: ['Launch Now', 'Delay 6 Months', 'Limited Beta', 'Cancel Project'],
      algorithm: 'ranked_choice',
      initiatedBy: 'product-agent',
      totalAgents: this.agents.length,
      minParticipation: 0.7
    });

    console.log(`${colors.blue}📊 Voting session initiated: ${sessionId}${colors.reset}\n`);

    const votes = [
      {
        agent: this.agents[0], // Finance
        rankings: ['Delay 6 Months', 'Limited Beta', 'Cancel Project', 'Launch Now'],
        reason: 'Prefer delay for better ROI, beta is acceptable compromise'
      },
      {
        agent: this.agents[1], // Compliance
        rankings: ['Limited Beta', 'Delay 6 Months', 'Cancel Project', 'Launch Now'],
        reason: 'Beta allows us to test compliance approach'
      },
      {
        agent: this.agents[2], // Growth
        rankings: ['Launch Now', 'Limited Beta', 'Delay 6 Months', 'Cancel Project'],
        reason: 'Want to move fast, beta is second choice'
      },
      {
        agent: this.agents[3], // Engineering
        rankings: ['Limited Beta', 'Delay 6 Months', 'Launch Now', 'Cancel Project'],
        reason: 'Beta lets us validate architecture at scale'
      },
      {
        agent: this.agents[4], // Product
        rankings: ['Limited Beta', 'Launch Now', 'Delay 6 Months', 'Cancel Project'],
        reason: 'Beta gives us user feedback before full launch'
      },
      {
        agent: this.agents[5], // Marketing
        rankings: ['Limited Beta', 'Launch Now', 'Delay 6 Months', 'Cancel Project'],
        reason: 'Beta creates buzz, full launch is second choice'
      }
    ];

    for (const vote of votes) {
      await this.votingSystem.castVote(sessionId, vote.agent.id, {
        rankings: vote.rankings
      });

      console.log(`${vote.agent.color}${vote.agent.name}${colors.reset} preferences:`);
      vote.rankings.forEach((option, index) => {
        console.log(`  ${index + 1}. ${option}`);
      });
      console.log(`  ${colors.dim}${vote.reason}${colors.reset}\n`);
      await this.wait(300);
    }

    const results = await this.votingSystem.closeVoting(sessionId);

    this.displayResults(results, 'Ranked Choice');

    if (results.rounds && results.rounds.length > 1) {
      console.log(`\n${colors.bright}Elimination Rounds:${colors.reset}\n`);
      results.rounds.forEach((round, index) => {
        console.log(`  Round ${index + 1}:`);
        const roundCopy = { ...round };
        delete roundCopy.eliminated;

        Object.entries(roundCopy).forEach(([option, votes]) => {
          const eliminated = round.eliminated.includes(option);
          console.log(`    ${option}: ${votes} votes ${eliminated ? colors.red + '(eliminated)' + colors.reset : ''}`);
        });
        console.log('');
      });
    }
  }

  /**
   * Display voting results
   */
  displayResults(results, algorithmName) {
    console.log('\n' + '═'.repeat(80));
    console.log(`${colors.bright}${colors.green}RESULTS: ${algorithmName}${colors.reset}`);
    console.log('═'.repeat(80) + '\n');

    if (results.status === 'QUORUM_NOT_MET') {
      console.log(`${colors.red}✗ QUORUM NOT MET${colors.reset}\n`);
      return;
    }

    console.log(`${colors.bright}Winner: ${colors.green}${results.winner}${colors.reset}\n`);

    // Display vote tallies
    console.log(`${colors.bright}Vote Distribution:${colors.reset}\n`);

    const tally = results.tally || results.weightedTally;
    if (tally) {
      const maxVotes = Math.max(...Object.values(tally));
      Object.entries(tally).forEach(([option, votes]) => {
        const percentage = (votes / Object.values(tally).reduce((a, b) => a + b, 0)) * 100;
        const barLength = Math.round((votes / maxVotes) * 40);
        const bar = '█'.repeat(barLength);

        const isWinner = option === results.winner;
        const color = isWinner ? colors.green : colors.dim;

        console.log(`  ${color}${option.padEnd(20)} ${bar} ${votes.toFixed(1)} (${percentage.toFixed(0)}%)${colors.reset}`);
      });
    }

    console.log('');

    // Additional metrics
    if (results.totalVotes !== undefined) {
      console.log(`  Total Votes: ${results.totalVotes}`);
    }
    if (results.totalWeight !== undefined) {
      console.log(`  Total Weight: ${results.totalWeight.toFixed(2)}`);
    }
    if (results.averageConfidence !== undefined) {
      console.log(`  Average Confidence: ${(results.averageConfidence * 100).toFixed(0)}%`);
    }
    if (results.winnerPercentage !== undefined) {
      console.log(`  Winner Support: ${(results.winnerPercentage * 100).toFixed(0)}%`);
    }

    console.log('\n' + '═'.repeat(80) + '\n');
  }

  async cleanup() {
    console.log(`\n${colors.blue}🧹 Cleaning up...${colors.reset}`);

    if (this.client) {
      await this.client.close();
    }

    console.log(`${colors.green}✓ Cleanup complete${colors.reset}\n`);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run scenario
const scenario = new VotingScenario();
scenario.run().catch(error => {
  console.error('Scenario error:', error);
  process.exit(1);
});
