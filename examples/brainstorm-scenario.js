#!/usr/bin/env node
/**
 * Example: Collaborative Brainstorming Scenario
 *
 * Demonstrates a complete brainstorming session with:
 * - 3 AI agents working collaboratively
 * - 150+ ideas generated over 12 minutes
 * - Idea combination and refinement
 * - Democratic voting for best ideas
 * - Real-time statistics and reporting
 *
 * Usage:
 *   node examples/brainstorm-scenario.js
 */

import { BrainstormSystem, IdeaCategory } from '../src/systems/brainstorm/system.js';
import chalk from 'chalk';

// Configuration
const CONFIG = {
  agentCount: 3,
  sessionDuration: 12 * 60 * 1000, // 12 minutes
  targetIdeas: 150,
  ideasPerRound: 5,
  roundDelay: 2000, // 2 seconds between rounds
  combinationChance: 0.3, // 30% chance to combine ideas
  refinementChance: 0.25, // 25% chance to refine ideas
  votingInterval: 30000, // Vote every 30 seconds
};

// Sample idea templates by category
const IDEA_TEMPLATES = {
  [IdeaCategory.FEATURE]: [
    'Implement real-time collaboration features',
    'Add support for multi-language interface',
    'Create advanced search and filter capabilities',
    'Build mobile-first responsive design',
    'Integrate third-party API connections',
    'Add customizable dashboard widgets',
    'Implement drag-and-drop functionality',
    'Create automated workflow system',
    'Add voice command integration',
    'Build plugin/extension marketplace'
  ],
  [IdeaCategory.IMPROVEMENT]: [
    'Optimize database query performance',
    'Enhance user interface responsiveness',
    'Improve error handling and recovery',
    'Streamline onboarding process',
    'Enhance accessibility features',
    'Improve data visualization',
    'Optimize memory usage',
    'Enhance security protocols',
    'Improve caching strategy',
    'Streamline authentication flow'
  ],
  [IdeaCategory.PERFORMANCE]: [
    'Implement lazy loading for components',
    'Add server-side rendering',
    'Optimize image compression',
    'Implement code splitting',
    'Add connection pooling',
    'Optimize bundle size',
    'Implement progressive web app features',
    'Add service worker caching',
    'Optimize render performance',
    'Implement virtual scrolling'
  ],
  [IdeaCategory.TESTING]: [
    'Add end-to-end testing suite',
    'Implement visual regression testing',
    'Add performance benchmarking',
    'Create automated integration tests',
    'Add chaos engineering tests',
    'Implement load testing',
    'Add security penetration tests',
    'Create accessibility testing',
    'Add mutation testing',
    'Implement contract testing'
  ],
  [IdeaCategory.DOCUMENTATION]: [
    'Create interactive API documentation',
    'Add video tutorials',
    'Build comprehensive FAQ section',
    'Create getting started guide',
    'Add code examples repository',
    'Build architecture diagrams',
    'Create troubleshooting guide',
    'Add changelog automation',
    'Build developer portal',
    'Create API playground'
  ],
  [IdeaCategory.ARCHITECTURE]: [
    'Implement microservices architecture',
    'Add event-driven design patterns',
    'Create modular component structure',
    'Implement hexagonal architecture',
    'Add domain-driven design',
    'Create service mesh',
    'Implement CQRS pattern',
    'Add event sourcing',
    'Create plugin architecture',
    'Implement clean architecture'
  ]
};

class BrainstormScenario {
  constructor() {
    this.agents = [];
    this.sessionId = null;
    this.startTime = null;
    this.statistics = {
      totalIdeas: 0,
      combinations: 0,
      refinements: 0,
      votes: 0
    };
  }

  /**
   * Initialize all agents
   */
  async initialize() {
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║     COLLABORATIVE BRAINSTORMING SCENARIO                   ║'));
    console.log(chalk.bold.cyan('║     3 Agents • 150 Ideas • 12 Minutes                      ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.yellow('📋 Configuration:'));
    console.log(`   Agents: ${CONFIG.agentCount}`);
    console.log(`   Duration: ${CONFIG.sessionDuration / 60000} minutes`);
    console.log(`   Target Ideas: ${CONFIG.targetIdeas}`);
    console.log(`   Ideas per Round: ${CONFIG.ideasPerRound}`);
    console.log('');

    // Create agents
    for (let i = 0; i < CONFIG.agentCount; i++) {
      const agent = new BrainstormSystem(`brainstorm-agent-${i + 1}`);
      await agent.initialize();
      this.agents.push(agent);
      console.log(chalk.green(`✓ Agent ${i + 1} initialized`));
    }

    console.log('');
  }

  /**
   * Start brainstorming session
   */
  async startSession() {
    console.log(chalk.bold.blue('\n🚀 Starting Brainstorm Session...\n'));

    // Agent 1 starts the session
    this.sessionId = await this.agents[0].startSession(
      'Advanced Platform Enhancement Ideas',
      {
        duration: CONFIG.sessionDuration,
        minIdeas: CONFIG.targetIdeas,
        maxIdeas: CONFIG.targetIdeas * 2,
        allowCombination: true,
        allowRefinement: true,
        allowVoting: true,
        categories: Object.values(IdeaCategory)
      }
    );

    this.startTime = Date.now();

    console.log(chalk.green(`✅ Session Started: ${this.sessionId.substring(0, 8)}`));
    console.log(chalk.gray(`   Started at: ${new Date().toLocaleTimeString()}`));
    console.log('');

    // Wait for session to propagate
    await this.wait(1000);
  }

  /**
   * Run idea generation rounds
   */
  async runIdeaGeneration() {
    console.log(chalk.bold.magenta('💡 Phase 1: Idea Generation\n'));

    const categories = Object.keys(IDEA_TEMPLATES);
    let round = 1;

    while (this.statistics.totalIdeas < CONFIG.targetIdeas) {
      console.log(chalk.cyan(`Round ${round}:`));

      // Each agent generates ideas
      for (let agentIdx = 0; agentIdx < this.agents.length; agentIdx++) {
        const agent = this.agents[agentIdx];

        for (let i = 0; i < CONFIG.ideasPerRound; i++) {
          if (this.statistics.totalIdeas >= CONFIG.targetIdeas) break;

          // Random category
          const category = categories[Math.floor(Math.random() * categories.length)];
          const templates = IDEA_TEMPLATES[category];
          const template = templates[Math.floor(Math.random() * templates.length)];

          // Generate unique idea
          const idea = `${template} - Enhanced by Agent ${agentIdx + 1} (Round ${round}, Idea ${i + 1})`;

          try {
            await agent.proposeIdea(this.sessionId, idea, category);
            this.statistics.totalIdeas++;

            if (this.statistics.totalIdeas % 10 === 0) {
              console.log(chalk.green(`  ✓ ${this.statistics.totalIdeas} ideas generated`));
            }
          } catch (error) {
            console.log(chalk.red(`  ✗ Error proposing idea: ${error.message}`));
          }
        }
      }

      // Occasionally combine ideas
      if (Math.random() < CONFIG.combinationChance && this.statistics.totalIdeas > 10) {
        await this.combineRandomIdeas();
      }

      // Occasionally refine ideas
      if (Math.random() < CONFIG.refinementChance && this.statistics.totalIdeas > 5) {
        await this.refineRandomIdea();
      }

      round++;
      await this.wait(CONFIG.roundDelay);
    }

    console.log(chalk.green(`\n✅ Idea Generation Complete: ${this.statistics.totalIdeas} ideas\n`));
  }

  /**
   * Combine random ideas
   */
  async combineRandomIdeas() {
    const agent = this.getRandomAgent();
    const ideas = Array.from(agent.allIdeas.values())
      .filter(idea => idea.sessionId === this.sessionId);

    if (ideas.length < 2) return;

    // Select 2-3 random ideas
    const count = Math.floor(Math.random() * 2) + 2; // 2 or 3
    const selectedIdeas = this.shuffleArray(ideas).slice(0, count);
    const ideaIds = selectedIdeas.map(idea => idea.id);

    try {
      const combinedContent = `Combined solution integrating: ${selectedIdeas.map((idea, i) =>
        idea.content.substring(0, 40) + '...'
      ).join(', ')}`;

      await agent.combineIdeas(
        this.sessionId,
        ideaIds,
        combinedContent,
        selectedIdeas[0].category
      );

      this.statistics.combinations++;
      console.log(chalk.blue(`  🔗 Combined ${count} ideas`));
    } catch (error) {
      // Silently ignore combination errors
    }
  }

  /**
   * Refine random idea
   */
  async refineRandomIdea() {
    const agent = this.getRandomAgent();
    const ideas = Array.from(agent.allIdeas.values())
      .filter(idea => idea.sessionId === this.sessionId && idea.proposedBy !== agent.agentId);

    if (ideas.length === 0) return;

    const originalIdea = ideas[Math.floor(Math.random() * ideas.length)];

    try {
      const refinedContent = `Refined: ${originalIdea.content} + Additional improvements: Better error handling, enhanced UX, optimized performance`;

      await agent.refineIdea(
        this.sessionId,
        originalIdea.id,
        refinedContent
      );

      this.statistics.refinements++;
      console.log(chalk.yellow(`  ✨ Refined an idea`));
    } catch (error) {
      // Silently ignore refinement errors
    }
  }

  /**
   * Run voting phase
   */
  async runVoting() {
    console.log(chalk.bold.magenta('👍 Phase 2: Democratic Voting\n'));

    // Each agent votes for their favorite ideas
    for (const agent of this.agents) {
      const ideas = Array.from(agent.allIdeas.values())
        .filter(idea =>
          idea.sessionId === this.sessionId &&
          idea.proposedBy !== agent.agentId
        );

      if (ideas.length === 0) continue;

      // Vote for top 10-20 ideas
      const voteCount = Math.min(Math.floor(Math.random() * 10) + 10, ideas.length);
      const selectedIdeas = this.shuffleArray(ideas).slice(0, voteCount);

      for (const idea of selectedIdeas) {
        try {
          const weight = Math.floor(Math.random() * 3) + 1; // 1-3 weight
          await agent.voteForIdea(this.sessionId, idea.id, weight);
          this.statistics.votes++;
        } catch (error) {
          // Already voted or other error, skip
        }
      }

      console.log(chalk.green(`  ✓ Agent ${agent.agentId.split('-').pop()} cast votes`));
    }

    console.log(chalk.green(`\n✅ Voting Complete: ${this.statistics.votes} votes cast\n`));
  }

  /**
   * Display results
   */
  displayResults() {
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                     FINAL RESULTS                          ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    const duration = Date.now() - this.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(chalk.yellow('⏱️  Session Statistics:'));
    console.log(`   Duration: ${minutes}m ${seconds}s`);
    console.log(`   Total Ideas: ${this.statistics.totalIdeas}`);
    console.log(`   Combinations: ${this.statistics.combinations}`);
    console.log(`   Refinements: ${this.statistics.refinements}`);
    console.log(`   Total Votes: ${this.statistics.votes}`);
    console.log('');

    // Get top ideas from first agent
    const topIdeas = this.agents[0].getTopIdeas(this.sessionId, 10);

    console.log(chalk.yellow('🏆 Top 10 Ideas (by votes):'));
    topIdeas.forEach((idea, index) => {
      const rank = index + 1;
      const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      console.log(chalk.green(`\n${emoji} ${idea.content.substring(0, 80)}...`));
      console.log(chalk.gray(`   Votes: ${idea.votes} | Category: ${idea.category} | Score: ${idea.score.toFixed(1)}`));
      console.log(chalk.gray(`   Proposed by: ${idea.proposedBy}`));

      if (idea.combinedFrom.length > 0) {
        console.log(chalk.blue(`   🔗 Combined from ${idea.combinedFrom.length} ideas`));
      }
      if (idea.refinedFrom) {
        console.log(chalk.yellow(`   ✨ Refined from another idea`));
      }
    });

    console.log('');

    // Agent statistics
    console.log(chalk.yellow('👥 Agent Statistics:'));
    this.agents.forEach((agent, index) => {
      const stats = agent.getStats();
      console.log(chalk.cyan(`\n   Agent ${index + 1} (${agent.agentId}):`));
      console.log(`      Ideas Generated: ${stats.ideasGenerated}`);
      console.log(`      Ideas Combined: ${stats.ideasCombined}`);
      console.log(`      Ideas Refined: ${stats.ideasRefined}`);
      console.log(`      Votes Cast: ${stats.votesCast}`);
      console.log(`      Votes Received: ${stats.votesReceived}`);
    });

    console.log('');

    // Category breakdown
    const categoryCount = {};
    Array.from(this.agents[0].allIdeas.values())
      .filter(idea => idea.sessionId === this.sessionId)
      .forEach(idea => {
        categoryCount[idea.category] = (categoryCount[idea.category] || 0) + 1;
      });

    console.log(chalk.yellow('📊 Ideas by Category:'));
    Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const percentage = ((count / this.statistics.totalIdeas) * 100).toFixed(1);
        console.log(`   ${category}: ${count} (${percentage}%)`);
      });

    console.log('\n');
  }

  /**
   * Clean up
   */
  async cleanup() {
    console.log(chalk.gray('\n🧹 Cleaning up...\n'));

    // Stop session
    if (this.sessionId && this.agents.length > 0) {
      await this.agents[0].stopSession(this.sessionId);
    }

    // Close all agents
    for (const agent of this.agents) {
      await agent.close();
    }

    console.log(chalk.green('✅ Cleanup complete\n'));
  }

  /**
   * Helper: Get random agent
   */
  getRandomAgent() {
    return this.agents[Math.floor(Math.random() * this.agents.length)];
  }

  /**
   * Helper: Shuffle array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Helper: Wait
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run complete scenario
   */
  async run() {
    try {
      await this.initialize();
      await this.startSession();
      await this.runIdeaGeneration();
      await this.wait(2000);
      await this.runVoting();
      await this.wait(1000);
      this.displayResults();
    } catch (error) {
      console.error(chalk.red('\n❌ Error running scenario:', error.message));
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }
}

// Run scenario if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scenario = new BrainstormScenario();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n⚠️  Interrupted by user'));
    await scenario.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n\n⚠️  Terminated'));
    await scenario.cleanup();
    process.exit(0);
  });

  await scenario.run();
}

export default BrainstormScenario;
