# Voting System Integration Guide

This guide shows how to integrate the voting system with the existing orchestrator.

---

## Quick Integration

### 1. Add to Orchestrator

```javascript
// scripts/orchestrator.js

import VotingSystem from './voting-system.js';

export class AgentOrchestrator extends EventEmitter {
  constructor(agentType = 'worker') {
    super();
    // ... existing code ...

    // Add voting system
    this.votingSystem = null;
  }

  async initialize() {
    // ... existing initialization ...

    // Initialize voting system
    this.votingSystem = new VotingSystem(this.client);

    // Listen for voting sessions
    this.client.listenBrainstorm(this.brainstormQueueName, async (msg) => {
      if (msg.message?.type === 'voting_session') {
        await this.handleVotingSession(msg);
      } else {
        await this.handleBrainstormMessage(msg);
      }
    });
  }

  /**
   * Handle incoming voting session
   */
  async handleVotingSession(msg) {
    const { sessionId, question, options, algorithm, deadline } = msg.message;

    console.log(`📊 Voting session: ${question}`);
    console.log(`   Options: ${options.join(', ')}`);
    console.log(`   Algorithm: ${algorithm}`);

    // Agent decides how to vote based on its role and expertise
    const vote = await this.decideVote(msg.message);

    if (vote) {
      // Cast vote
      await this.votingSystem.castVote(sessionId, this.agentId, vote);

      console.log(`✅ Voted: ${vote.choice || 'ranked'}`);
    }
  }

  /**
   * Agent decides how to vote
   */
  async decideVote(votingSession) {
    const { question, options, algorithm } = votingSession;

    // Example: Finance agent logic
    if (this.agentType === 'finance') {
      return this.financeAgentVote(question, options, algorithm);
    }

    // Example: Compliance agent logic
    if (this.agentType === 'compliance') {
      return this.complianceAgentVote(question, options, algorithm);
    }

    // Default: Random with medium confidence
    const choice = options[Math.floor(Math.random() * options.length)];
    return {
      choice,
      confidence: 0.6,
      agentLevel: this.level || 3
    };
  }

  /**
   * Finance agent voting strategy
   */
  financeAgentVote(question, options, algorithm) {
    // Finance focuses on ROI and cost
    if (question.includes('cost') || question.includes('budget')) {
      return {
        choice: options.find(o => o.includes('delay') || o.includes('reduce')),
        confidence: 0.9,  // High confidence in financial matters
        agentLevel: 5
      };
    }

    return {
      choice: options[0],
      confidence: 0.5,  // Low confidence outside domain
      agentLevel: 5
    };
  }

  /**
   * Compliance agent voting strategy
   */
  complianceAgentVote(question, options, algorithm) {
    // Compliance focuses on risk and regulation
    if (question.includes('risk') || question.includes('legal')) {
      return {
        choice: options.find(o => o.includes('safe') || o.includes('delay')),
        confidence: 0.95,  // Very high confidence in compliance matters
        agentLevel: 5
      };
    }

    return {
      choice: options[0],
      confidence: 0.4,  // Low confidence outside domain
      agentLevel: 5
    };
  }

  /**
   * Initiate a vote from this agent
   */
  async initiateVote(config) {
    const sessionId = await this.votingSystem.initiateVote({
      ...config,
      initiatedBy: this.agentId
    });

    console.log(`📊 Initiated vote: ${config.question}`);

    return sessionId;
  }
}
```

---

## 2. Usage in Leader Agent

```javascript
// Leader agent can initiate votes

import AgentOrchestrator from './orchestrator.js';

const leader = new AgentOrchestrator('leader');
await leader.initialize();

// Initiate a vote
const sessionId = await leader.initiateVote({
  topic: 'API Design',
  question: 'Should we use REST or GraphQL?',
  options: ['REST', 'GraphQL', 'Both'],
  algorithm: 'confidence_weighted',
  totalAgents: 5,
  minParticipation: 0.6,
  deadline: Date.now() + 300000  // 5 minutes
});

// Listen for results
leader.votingSystem.on('voting_closed', (session) => {
  if (session.id === sessionId) {
    console.log(`\n📊 Vote Results:`);
    console.log(`   Winner: ${session.results.winner}`);
    console.log(`   Support: ${(session.results.winnerPercentage * 100).toFixed(0)}%`);

    // Take action based on results
    if (session.results.winner === 'GraphQL') {
      // Proceed with GraphQL implementation
    }
  }
});
```

---

## 3. Worker Agents Auto-Vote

```javascript
// Worker agents automatically participate in votes

import AgentOrchestrator from './orchestrator.js';

const worker = new AgentOrchestrator('worker');
await worker.initialize();

// Agent automatically handles voting sessions via handleVotingSession()
// No additional code needed - votes are cast based on agent's decideVote() logic
```

---

## 4. Custom Voting Strategies

### Strategy Pattern

```javascript
// Create different voting strategies for different scenarios

class VotingStrategy {
  shouldParticipate(votingSession, agent) {
    return true;  // Always participate by default
  }

  decideVote(votingSession, agent) {
    throw new Error('Must implement decideVote()');
  }
}

class ExpertiseBasedStrategy extends VotingStrategy {
  shouldParticipate(votingSession, agent) {
    // Only participate if topic matches expertise
    return agent.expertise.includes(votingSession.topic);
  }

  decideVote(votingSession, agent) {
    const { question, options, algorithm } = votingSession;

    // High confidence in area of expertise
    return {
      choice: agent.getPreferredOption(question, options),
      confidence: 0.9,
      agentLevel: agent.level
    };
  }
}

class RandomStrategy extends VotingStrategy {
  decideVote(votingSession, agent) {
    const { options } = votingSession;

    return {
      choice: options[Math.floor(Math.random() * options.length)],
      confidence: 0.5,
      agentLevel: agent.level || 3
    };
  }
}

class CautiousStrategy extends VotingStrategy {
  shouldParticipate(votingSession, agent) {
    // Only participate if confidence threshold met
    const confidence = this.calculateConfidence(votingSession, agent);
    return confidence >= 0.5;
  }

  decideVote(votingSession, agent) {
    const { options } = votingSession;

    // Prefer conservative options
    const conservativeOption = options.find(o =>
      o.includes('delay') || o.includes('wait') || o.includes('review')
    ) || options[0];

    return {
      choice: conservativeOption,
      confidence: this.calculateConfidence(votingSession, agent),
      agentLevel: agent.level
    };
  }

  calculateConfidence(votingSession, agent) {
    // Calculate confidence based on expertise match
    const topicMatch = agent.expertise.some(e =>
      votingSession.topic.toLowerCase().includes(e.toLowerCase())
    );

    return topicMatch ? 0.8 : 0.3;
  }
}

// Use strategy in orchestrator
class AgentOrchestrator extends EventEmitter {
  constructor(agentType = 'worker') {
    super();
    this.votingStrategy = this.getVotingStrategy(agentType);
  }

  getVotingStrategy(agentType) {
    switch (agentType) {
      case 'expert':
        return new ExpertiseBasedStrategy();
      case 'compliance':
      case 'finance':
        return new CautiousStrategy();
      default:
        return new RandomStrategy();
    }
  }

  async handleVotingSession(msg) {
    const votingSession = msg.message;

    // Check if agent should participate
    if (!this.votingStrategy.shouldParticipate(votingSession, this)) {
      console.log(`⏭️  Abstaining from vote: ${votingSession.question}`);
      return;
    }

    // Decide vote using strategy
    const vote = this.votingStrategy.decideVote(votingSession, this);

    // Cast vote
    await this.votingSystem.castVote(
      votingSession.sessionId,
      this.agentId,
      vote
    );

    console.log(`✅ Voted: ${vote.choice} (confidence: ${vote.confidence})`);
  }
}
```

---

## 5. Workflow Integration

### Example: Task Assignment with Voting

```javascript
class TaskAssignmentWorkflow {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
  }

  async assignComplexTask(task) {
    // Step 1: Assess if task needs team decision
    if (task.complexity > 7 || task.priority === 'critical') {
      console.log('🗳️  Complex task detected, initiating team vote...');

      // Step 2: Initiate vote on approach
      const sessionId = await this.orchestrator.initiateVote({
        topic: `Task Assignment: ${task.title}`,
        question: 'How should we approach this task?',
        options: [
          'Single agent (fast)',
          'Pair programming (quality)',
          'Team collaboration (thorough)'
        ],
        algorithm: 'confidence_weighted',
        totalAgents: 5,
        minParticipation: 0.6
      });

      // Step 3: Wait for vote to close
      const results = await this.waitForVoteResults(sessionId);

      // Step 4: Execute based on vote
      if (results.winner === 'Single agent (fast)') {
        return await this.assignToSingleAgent(task);
      } else if (results.winner === 'Pair programming (quality)') {
        return await this.assignToPair(task);
      } else {
        return await this.assignToTeam(task);
      }
    } else {
      // Simple task, no vote needed
      return await this.assignToSingleAgent(task);
    }
  }

  async waitForVoteResults(sessionId) {
    return new Promise((resolve) => {
      this.orchestrator.votingSystem.on('voting_closed', (session) => {
        if (session.id === sessionId) {
          resolve(session.results);
        }
      });
    });
  }

  async assignToSingleAgent(task) {
    // Existing single agent assignment logic
  }

  async assignToPair(task) {
    // Pair programming assignment logic
  }

  async assignToTeam(task) {
    // Team collaboration assignment logic
  }
}
```

---

## 6. Monitoring & Analytics

### Vote Participation Tracking

```javascript
class VotingAnalytics {
  constructor(votingSystem) {
    this.votingSystem = votingSystem;
    this.stats = {
      totalVotes: 0,
      totalSessions: 0,
      participationByAgent: new Map(),
      algorithmUsage: {},
      averageConfidence: 0,
      quorumFailures: 0
    };

    this.setupListeners();
  }

  setupListeners() {
    this.votingSystem.on('voting_initiated', (session) => {
      this.stats.totalSessions++;
      this.stats.algorithmUsage[session.algorithm] =
        (this.stats.algorithmUsage[session.algorithm] || 0) + 1;
    });

    this.votingSystem.on('vote_cast', ({ sessionId, agentId, vote }) => {
      this.stats.totalVotes++;

      const agentStats = this.stats.participationByAgent.get(agentId) || {
        votes: 0,
        totalConfidence: 0
      };

      agentStats.votes++;
      agentStats.totalConfidence += (vote.confidence || 1.0);

      this.stats.participationByAgent.set(agentId, agentStats);
    });

    this.votingSystem.on('voting_failed', (session) => {
      this.stats.quorumFailures++;
    });
  }

  getReport() {
    const report = {
      ...this.stats,
      averageConfidence: this.calculateAverageConfidence(),
      topParticipants: this.getTopParticipants(5),
      mostUsedAlgorithm: this.getMostUsedAlgorithm()
    };

    return report;
  }

  calculateAverageConfidence() {
    let totalConfidence = 0;
    let count = 0;

    for (const [agentId, stats] of this.stats.participationByAgent) {
      totalConfidence += stats.totalConfidence;
      count += stats.votes;
    }

    return count > 0 ? totalConfidence / count : 0;
  }

  getTopParticipants(n) {
    return Array.from(this.stats.participationByAgent.entries())
      .sort((a, b) => b[1].votes - a[1].votes)
      .slice(0, n)
      .map(([agentId, stats]) => ({
        agentId,
        votes: stats.votes,
        avgConfidence: stats.totalConfidence / stats.votes
      }));
  }

  getMostUsedAlgorithm() {
    const entries = Object.entries(this.stats.algorithmUsage);
    if (entries.length === 0) return null;

    return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }
}

// Usage
const analytics = new VotingAnalytics(votingSystem);

// Later...
const report = analytics.getReport();
console.log('📊 Voting Analytics:');
console.log(`   Total Sessions: ${report.totalSessions}`);
console.log(`   Total Votes: ${report.totalVotes}`);
console.log(`   Avg Confidence: ${(report.averageConfidence * 100).toFixed(0)}%`);
console.log(`   Most Used: ${report.mostUsedAlgorithm}`);
console.log(`   Top Participants:`, report.topParticipants);
```

---

## 7. Error Handling

```javascript
class SafeVotingOrchestrator extends AgentOrchestrator {
  async handleVotingSession(msg) {
    try {
      const votingSession = msg.message;

      // Validate voting session
      if (!this.isValidVotingSession(votingSession)) {
        console.error('Invalid voting session:', votingSession);
        return;
      }

      // Check if deadline passed
      if (Date.now() > votingSession.deadline) {
        console.log('⏰ Voting deadline passed, skipping');
        return;
      }

      // Decide vote with timeout
      const vote = await Promise.race([
        this.decideVote(votingSession),
        this.timeout(5000, 'Vote decision timeout')
      ]);

      // Cast vote with retry
      await this.castVoteWithRetry(
        votingSession.sessionId,
        this.agentId,
        vote,
        3  // max retries
      );

      console.log(`✅ Voted successfully`);

    } catch (error) {
      console.error('Error handling voting session:', error.message);

      // Emit error event for monitoring
      this.emit('voting_error', {
        agentId: this.agentId,
        sessionId: msg.message?.sessionId,
        error: error.message
      });
    }
  }

  isValidVotingSession(session) {
    return session &&
           session.sessionId &&
           session.question &&
           session.options &&
           Array.isArray(session.options) &&
           session.options.length > 0;
  }

  async castVoteWithRetry(sessionId, agentId, vote, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.votingSystem.castVote(sessionId, agentId, vote);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        console.log(`⚠️  Vote failed (attempt ${attempt}/${maxRetries}), retrying...`);
        await this.sleep(1000 * attempt);  // Exponential backoff
      }
    }
  }

  timeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 8. Testing Integration

```javascript
// tests/integration/orchestrator-voting.test.js

import AgentOrchestrator from '../../scripts/orchestrator.js';
import TestSetup from './setup.js';

describe('Orchestrator Voting Integration', () => {
  let setup, leader, workers;

  beforeEach(async () => {
    setup = new TestSetup();
    await setup.startRabbitMQ();

    leader = new AgentOrchestrator('leader');
    await leader.initialize();

    workers = [];
    for (let i = 0; i < 3; i++) {
      const worker = new AgentOrchestrator('worker');
      await worker.initialize();
      workers.push(worker);
    }
  });

  afterEach(async () => {
    await leader.shutdown();
    for (const worker of workers) {
      await worker.shutdown();
    }
    await setup.stopRabbitMQ();
  });

  test('should conduct vote among agents', async () => {
    // Leader initiates vote
    const sessionId = await leader.initiateVote({
      topic: 'Test Vote',
      question: 'Test question?',
      options: ['A', 'B'],
      algorithm: 'simple_majority',
      totalAgents: 4,
      minParticipation: 0.5
    });

    // Wait for workers to vote
    await wait(2000);

    // Close vote
    const results = await leader.votingSystem.closeVoting(sessionId);

    expect(results.status).toBe('SUCCESS');
    expect(results.winner).toBeDefined();
    expect(results.totalVotes).toBeGreaterThanOrEqual(2);
  });
});
```

---

## 9. Configuration

### Environment Variables

```bash
# .env

# Voting System Configuration
VOTING_DEFAULT_ALGORITHM=confidence_weighted
VOTING_DEFAULT_TIMEOUT=300000  # 5 minutes
VOTING_MIN_PARTICIPATION=0.6   # 60%
VOTING_MIN_CONFIDENCE=0.0
VOTING_MIN_EXPERTS=0

# Enable voting analytics
VOTING_ANALYTICS_ENABLED=true

# Auto-participation
VOTING_AUTO_PARTICIPATE=true
```

### Configuration Class

```javascript
class VotingConfig {
  static get defaults() {
    return {
      algorithm: process.env.VOTING_DEFAULT_ALGORITHM || 'simple_majority',
      timeout: parseInt(process.env.VOTING_DEFAULT_TIMEOUT) || 300000,
      minParticipation: parseFloat(process.env.VOTING_MIN_PARTICIPATION) || 0.5,
      minConfidence: parseFloat(process.env.VOTING_MIN_CONFIDENCE) || 0.0,
      minExperts: parseInt(process.env.VOTING_MIN_EXPERTS) || 0,
      autoParticipate: process.env.VOTING_AUTO_PARTICIPATE !== 'false',
      analyticsEnabled: process.env.VOTING_ANALYTICS_ENABLED === 'true'
    };
  }

  static getConfig(overrides = {}) {
    return {
      ...this.defaults,
      ...overrides
    };
  }
}

// Usage
const config = VotingConfig.getConfig({
  algorithm: 'quadratic',  // Override default
  timeout: 600000          // 10 minutes
});
```

---

## Summary

The voting system integrates seamlessly with the existing orchestrator:

✅ **Drop-in integration** - Add to existing orchestrator with minimal changes
✅ **Auto-participation** - Agents automatically respond to votes
✅ **Flexible strategies** - Customize voting behavior per agent type
✅ **Error handling** - Robust retry and timeout mechanisms
✅ **Analytics** - Track participation and outcomes
✅ **Testing** - Integration tests verify multi-agent voting

**Next Steps:**
1. Add voting system to orchestrator
2. Implement agent-specific voting strategies
3. Test with real scenarios
4. Monitor analytics and adjust quorums
5. Scale to production
