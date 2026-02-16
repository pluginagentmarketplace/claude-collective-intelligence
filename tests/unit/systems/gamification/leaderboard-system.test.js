/**
 * 🧪 LEADERBOARD SYSTEM TESTS
 * Unit and integration tests for rankings and Hall of Fame
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  ELORatingSystem,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardManager,
  LEADERBOARD_CATEGORIES,
  RANKING_PERIODS,
  HALL_OF_FAME_TIERS
} from '../../../src/systems/leaderboard/system.js';

describe('Leaderboard System', () => {

  // ============================================
  // ELO RATING SYSTEM TESTS
  // ============================================

  describe('ELORatingSystem', () => {

    let eloSystem;

    beforeEach(() => {
      eloSystem = new ELORatingSystem();
    });

    test('should initialize with default values', () => {
      expect(eloSystem.defaultRating).toBe(1500);
      expect(eloSystem.kFactor).toBe(32);
      expect(eloSystem.decayHalfLife).toBe(30);
    });

    test('should calculate expected score correctly', () => {
      const expected = eloSystem.calculateExpectedScore(1500, 1500);
      expect(expected).toBe(0.5); // Equal ratings = 50% expected

      const higherExpected = eloSystem.calculateExpectedScore(1600, 1500);
      expect(higherExpected).toBeGreaterThan(0.5); // Higher rating = > 50%

      const lowerExpected = eloSystem.calculateExpectedScore(1400, 1500);
      expect(lowerExpected).toBeLessThan(0.5); // Lower rating = < 50%
    });

    test('should update rating correctly after win', () => {
      const currentRating = 1500;
      const expectedScore = 0.5;
      const actualScore = 1.0; // Win

      const newRating = eloSystem.updateRating(currentRating, expectedScore, actualScore);

      expect(newRating).toBeGreaterThan(currentRating);
      expect(newRating).toBe(1516); // 1500 + 32 * (1 - 0.5)
    });

    test('should update rating correctly after loss', () => {
      const currentRating = 1500;
      const expectedScore = 0.5;
      const actualScore = 0.0; // Loss

      const newRating = eloSystem.updateRating(currentRating, expectedScore, actualScore);

      expect(newRating).toBeLessThan(currentRating);
      expect(newRating).toBe(1484); // 1500 + 32 * (0 - 0.5)
    });

    test('should get appropriate K-factor for new agents', () => {
      expect(eloSystem.getKFactor(1500, 5)).toBe(40);
      expect(eloSystem.getKFactor(1500, 25)).toBe(32);
      expect(eloSystem.getKFactor(1500, 100)).toBe(24);
      expect(eloSystem.getKFactor(1500, 500)).toBe(16);
    });

    test('should calculate actual score from performance', () => {
      const benchmark = 100;

      expect(eloSystem.calculateActualScore(120, benchmark)).toBe(1.0); // Exceeded
      expect(eloSystem.calculateActualScore(100, benchmark)).toBe(0.5); // Met
      expect(eloSystem.calculateActualScore(70, benchmark)).toBe(0.0); // Below
    });

    test('should calculate time decay weight correctly', () => {
      const weight0 = eloSystem.calculateDecayWeight(0);
      expect(weight0).toBe(1.0); // No decay for today

      const weight30 = eloSystem.calculateDecayWeight(30);
      expect(weight30).toBeCloseTo(0.5, 1); // Half-life at 30 days

      const weight60 = eloSystem.calculateDecayWeight(60);
      expect(weight60).toBeCloseTo(0.25, 1); // Quarter at 60 days
    });

    test('should calculate weighted score with time decay', () => {
      const performances = [
        { score: 100, timestamp: Date.now() }, // Today
        { score: 80, timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000 }, // 30 days ago
        { score: 60, timestamp: Date.now() - 60 * 24 * 60 * 60 * 1000 }  // 60 days ago
      ];

      const weightedScore = eloSystem.calculateWeightedScore(performances);

      expect(weightedScore).toBeGreaterThan(60);
      expect(weightedScore).toBeLessThan(100);
      expect(weightedScore).toBeCloseTo(90, 0); // Recent performances weighted more
    });

    test('should apply time decay to inactive agents', () => {
      const rating = 1700;
      const daysSinceActive = 13 * 7; // 13 weeks

      const decayedRating = eloSystem.applyTimeDecay(rating, daysSinceActive);

      expect(decayedRating).toBeLessThan(rating);
      // 20% of 200 above default = 40 points decay
      expect(decayedRating).toBe(1660);
    });

    test('should not decay rating below default', () => {
      const rating = 1550;
      const daysSinceActive = 100 * 7; // 100 weeks

      const decayedRating = eloSystem.applyTimeDecay(rating, daysSinceActive);

      expect(decayedRating).toBeGreaterThanOrEqual(1500);
    });
  });

  // ============================================
  // LEADERBOARD ENTRY TESTS
  // ============================================

  describe('LeaderboardEntry', () => {

    test('should create entry with correct properties', () => {
      const agent = {
        id: 'agent-1',
        name: 'TestAgent',
        type: 'worker',
        eloRating: 1600,
        tier: 'Gold'
      };

      const entry = new LeaderboardEntry(agent, 'OVERALL', RANKING_PERIODS.WEEKLY);

      expect(entry.agentId).toBe('agent-1');
      expect(entry.agentName).toBe('TestAgent');
      expect(entry.category).toBe('OVERALL');
      expect(entry.period).toBe(RANKING_PERIODS.WEEKLY);
      expect(entry.eloRating).toBe(1600);
    });

    test('should update entry with new metrics', () => {
      const agent = { id: 'agent-1', name: 'TestAgent', type: 'worker' };
      const entry = new LeaderboardEntry(agent, 'SPEED', RANKING_PERIODS.MONTHLY);

      const metrics = {
        tasksCompleted: 100,
        averageQuality: 95,
        averageSpeed: 120
      };

      entry.update(metrics, 250);

      expect(entry.score).toBe(250);
      expect(entry.metrics.tasksCompleted).toBe(100);
      expect(entry.metrics.averageQuality).toBe(95);
    });

    test('should calculate rank change correctly', () => {
      const agent = { id: 'agent-1', name: 'TestAgent', type: 'worker' };
      const entry = new LeaderboardEntry(agent, 'QUALITY', RANKING_PERIODS.ALL_TIME);

      entry.previousRank = 5;
      entry.rank = 3;

      expect(entry.getRankChange()).toBe(2); // Moved up 2 positions

      entry.rank = 7;
      expect(entry.getRankChange()).toBe(-2); // Moved down 2 positions
    });

    test('should convert to display object', () => {
      const agent = {
        id: 'agent-1',
        name: 'TestAgent',
        type: 'worker',
        badges: ['Speed Demon', 'Quality Master', 'Team Player', 'Innovator']
      };

      const entry = new LeaderboardEntry(agent, 'OVERALL', RANKING_PERIODS.WEEKLY);
      entry.rank = 1;
      entry.previousRank = 3;
      entry.score = 500;

      const display = entry.toDisplay();

      expect(display.rank).toBe(1);
      expect(display.rankChange).toBe(2);
      expect(display.badges).toHaveLength(3); // Top 3 only
      expect(display.score).toBe(500);
    });
  });

  // ============================================
  // LEADERBOARD TESTS
  // ============================================

  describe('Leaderboard', () => {

    let leaderboard;

    beforeEach(() => {
      leaderboard = new Leaderboard('OVERALL', RANKING_PERIODS.WEEKLY);
    });

    test('should create leaderboard with correct configuration', () => {
      expect(leaderboard.category).toBe('OVERALL');
      expect(leaderboard.period).toBe(RANKING_PERIODS.WEEKLY);
      expect(leaderboard.config).toBeDefined();
      expect(leaderboard.entries).toBeInstanceOf(Map);
    });

    test('should upsert entry correctly', () => {
      const agent = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const metrics = { tasksCompleted: 50 };

      leaderboard.upsertEntry(agent, metrics, 100);

      expect(leaderboard.entries.has('agent-1')).toBe(true);
      expect(leaderboard.rankings).toHaveLength(1);
    });

    test('should update existing entry', () => {
      const agent = { id: 'agent-1', name: 'Agent1', type: 'worker' };

      leaderboard.upsertEntry(agent, { tasksCompleted: 50 }, 100);
      leaderboard.upsertEntry(agent, { tasksCompleted: 75 }, 150);

      const entry = leaderboard.entries.get('agent-1');
      expect(entry.score).toBe(150);
      expect(entry.metrics.tasksCompleted).toBe(75);
    });

    test('should sort rankings correctly by score', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };
      const agent3 = { id: 'agent-3', name: 'Agent3', type: 'worker' };

      leaderboard.upsertEntry(agent1, {}, 100);
      leaderboard.upsertEntry(agent2, {}, 200);
      leaderboard.upsertEntry(agent3, {}, 150);

      expect(leaderboard.rankings[0].agentId).toBe('agent-2'); // Highest score
      expect(leaderboard.rankings[1].agentId).toBe('agent-3');
      expect(leaderboard.rankings[2].agentId).toBe('agent-1'); // Lowest score
    });

    test('should assign ranks correctly', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      leaderboard.upsertEntry(agent1, {}, 100);
      leaderboard.upsertEntry(agent2, {}, 200);

      expect(leaderboard.rankings[0].rank).toBe(1);
      expect(leaderboard.rankings[1].rank).toBe(2);
    });

    test('should get top N entries', () => {
      for (let i = 1; i <= 20; i++) {
        const agent = { id: `agent-${i}`, name: `Agent${i}`, type: 'worker' };
        leaderboard.upsertEntry(agent, {}, i * 10);
      }

      const top10 = leaderboard.getTop(10);
      expect(top10).toHaveLength(10);
      expect(top10[0].score).toBeGreaterThan(top10[9].score);
    });

    test('should get agent rank', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      leaderboard.upsertEntry(agent1, {}, 100);
      leaderboard.upsertEntry(agent2, {}, 200);

      const rank = leaderboard.getAgentRank('agent-1');
      expect(rank.rank).toBe(2);
      expect(rank.score).toBe(100);
    });

    test('should get range of entries', () => {
      for (let i = 1; i <= 50; i++) {
        const agent = { id: `agent-${i}`, name: `Agent${i}`, type: 'worker' };
        leaderboard.upsertEntry(agent, {}, i * 10);
      }

      const range = leaderboard.getRange(10, 20);
      expect(range).toHaveLength(11);
      expect(range[0].rank).toBe(10);
      expect(range[10].rank).toBe(20);
    });

    test('should get trending agents', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };
      const agent3 = { id: 'agent-3', name: 'Agent3', type: 'worker' };

      // Initial rankings
      leaderboard.upsertEntry(agent1, {}, 100);
      leaderboard.upsertEntry(agent2, {}, 200);
      leaderboard.upsertEntry(agent3, {}, 150);

      // Update rankings (agent1 makes big jump)
      leaderboard.upsertEntry(agent1, {}, 300);

      const trending = leaderboard.getTrending(1);
      expect(trending[0].agentId).toBe('agent-1'); // Biggest mover
    });

    test('should reset leaderboard', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      leaderboard.upsertEntry(agent1, {}, 100);

      const archive = leaderboard.reset();

      expect(archive).toBeDefined();
      expect(archive.rankings).toHaveLength(1);
      expect(leaderboard.entries.size).toBe(0);
      expect(leaderboard.rankings).toHaveLength(0);
    });

    test('should get leaderboard summary', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      leaderboard.upsertEntry(agent1, {}, 100);
      leaderboard.upsertEntry(agent2, {}, 200);

      const summary = leaderboard.getSummary();

      expect(summary.category).toBe('OVERALL');
      expect(summary.totalAgents).toBe(2);
      expect(summary.top3).toHaveLength(2);
    });
  });

  // ============================================
  // LEADERBOARD MANAGER TESTS
  // ============================================

  describe('LeaderboardManager', () => {

    let manager;

    beforeEach(() => {
      manager = new LeaderboardManager();
    });

    test('should create manager with all leaderboards', () => {
      expect(manager).toBeDefined();
      expect(manager.leaderboards.size).toBeGreaterThan(0);

      // Should have all categories × all periods
      const expectedCount = Object.keys(LEADERBOARD_CATEGORIES).length *
                           Object.keys(RANKING_PERIODS).length;
      expect(manager.leaderboards.size).toBe(expectedCount);
    });

    test('should get leaderboard by category and period', () => {
      const leaderboard = manager.getLeaderboard('OVERALL', RANKING_PERIODS.WEEKLY);

      expect(leaderboard).toBeInstanceOf(Leaderboard);
      expect(leaderboard.category).toBe('OVERALL');
      expect(leaderboard.period).toBe(RANKING_PERIODS.WEEKLY);
    });

    test('should calculate category scores', () => {
      const agent = {
        id: 'agent-1',
        name: 'TestAgent',
        type: 'worker',
        eloRating: 1500
      };

      const metrics = {
        taskCompletion: 0.9,
        quality: 0.95,
        speed: 0.85,
        collaboration: 0.8,
        innovation: 0.7,
        consistency: 0.9,
        averageSpeed: 100,
        averageQuality: 95,
        uptime: 98
      };

      const scores = manager.calculateCategoryScores(agent, metrics);

      expect(scores.OVERALL).toBeGreaterThan(0);
      expect(scores.SPEED).toBeGreaterThan(0);
      expect(scores.QUALITY).toBeGreaterThan(0);
      expect(scores.COLLABORATION).toBeGreaterThan(0);
    });

    test('should update agent rankings across all leaderboards', () => {
      const agent = {
        id: 'agent-1',
        name: 'TestAgent',
        type: 'worker',
        eloRating: 1500
      };

      const metrics = {
        taskCompletion: 0.9,
        quality: 0.95,
        averageSpeed: 100,
        averageQuality: 95
      };

      const scores = manager.updateAgentRankings(agent, metrics);

      // Check that all categories have scores
      expect(Object.keys(scores)).toHaveLength(8);

      // Check that leaderboards were updated
      const overallLeaderboard = manager.getLeaderboard('OVERALL', RANKING_PERIODS.ALL_TIME);
      expect(overallLeaderboard.entries.has('agent-1')).toBe(true);
    });

    test('should get agent rankings across all categories', () => {
      const agent = {
        id: 'agent-1',
        name: 'TestAgent',
        type: 'worker',
        eloRating: 1500
      };

      const metrics = { averageQuality: 95 };
      manager.updateAgentRankings(agent, metrics);

      const rankings = manager.getAgentRankings('agent-1', RANKING_PERIODS.ALL_TIME);

      expect(rankings.OVERALL).toBeDefined();
      expect(rankings.SPEED).toBeDefined();
      expect(rankings.QUALITY).toBeDefined();
    });

    test('should get all leaderboards summary', () => {
      const summaries = manager.getAllLeaderboards(RANKING_PERIODS.WEEKLY);

      expect(Object.keys(summaries)).toHaveLength(8);
      expect(summaries.OVERALL).toBeDefined();
      expect(summaries.SPEED).toBeDefined();
    });

    test('should check Hall of Fame eligibility', () => {
      const agent = {
        id: 'agent-1',
        name: 'LegendAgent',
        type: 'worker',
        points: { total: 50000 },
        stats: {
          averageQuality: 98,
          daysActive: 365 * 3
        }
      };

      const meetsLegend = manager.meetsHallOfFameCriteria(
        agent,
        HALL_OF_FAME_TIERS.LEGEND
      );

      expect(meetsLegend).toBe(true);
    });

    test('should induct agent to Hall of Fame', () => {
      const agent = {
        id: 'agent-1',
        name: 'MasterAgent',
        type: 'worker',
        points: { total: 20000 },
        stats: {
          averageQuality: 95,
          daysActive: 365,
          tasksCompleted: 1000
        }
      };

      const entry = manager.inductToHallOfFame(agent, 'MASTER');

      expect(entry.tier).toBe('MASTER');
      expect(manager.hallOfFame.has('agent-1')).toBe(true);
    });

    test('should not upgrade Hall of Fame tier', () => {
      const agent = {
        id: 'agent-1',
        name: 'Agent',
        type: 'worker',
        points: { total: 50000 },
        stats: { averageQuality: 98, daysActive: 1095 }
      };

      manager.inductToHallOfFame(agent, 'LEGEND');
      manager.inductToHallOfFame(agent, 'MASTER');

      const entry = manager.hallOfFame.get('agent-1');
      expect(entry.tier).toBe('LEGEND'); // Stays at highest tier
    });

    test('should get Hall of Fame members', () => {
      const agent1 = {
        id: 'agent-1',
        name: 'Legend1',
        points: { total: 50000 },
        stats: { averageQuality: 98 }
      };

      const agent2 = {
        id: 'agent-2',
        name: 'Master1',
        points: { total: 20000 },
        stats: { averageQuality: 95 }
      };

      manager.inductToHallOfFame(agent1, 'LEGEND');
      manager.inductToHallOfFame(agent2, 'MASTER');

      const allMembers = manager.getHallOfFame();
      expect(allMembers).toHaveLength(2);
      expect(allMembers[0].tier).toBe('LEGEND'); // Sorted by tier

      const legendsOnly = manager.getHallOfFame('LEGEND');
      expect(legendsOnly).toHaveLength(1);
      expect(legendsOnly[0].agentId).toBe('agent-1');
    });

    test('should reset period-based leaderboards', () => {
      const agent = {
        id: 'agent-1',
        name: 'Agent1',
        type: 'worker',
        eloRating: 1500
      };

      manager.updateAgentRankings(agent, { averageQuality: 95 });

      const archives = manager.resetPeriod(RANKING_PERIODS.WEEKLY);

      expect(archives.length).toBeGreaterThan(0);

      // Check that weekly leaderboards are empty
      const overallWeekly = manager.getLeaderboard('OVERALL', RANKING_PERIODS.WEEKLY);
      expect(overallWeekly.entries.size).toBe(0);
    });

    test('should get system statistics', () => {
      const agent1 = {
        id: 'agent-1',
        name: 'Agent1',
        type: 'worker',
        eloRating: 1500
      };

      const agent2 = {
        id: 'agent-2',
        name: 'Agent2',
        type: 'worker',
        eloRating: 1600
      };

      manager.updateAgentRankings(agent1, { averageQuality: 95 });
      manager.updateAgentRankings(agent2, { averageQuality: 98 });

      const stats = manager.getStatistics();

      expect(stats.totalAgents).toBe(2);
      expect(stats.totalLeaderboards).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.byPeriod).toBeDefined();
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================

  describe('Integration Tests', () => {

    test('should handle complete ranking lifecycle', () => {
      const manager = new LeaderboardManager();

      // Create agents
      const agents = [
        { id: 'agent-1', name: 'SpeedyBot', type: 'worker', eloRating: 1600 },
        { id: 'agent-2', name: 'QualityBot', type: 'worker', eloRating: 1550 },
        { id: 'agent-3', name: 'CollabBot', type: 'worker', eloRating: 1500 }
      ];

      // Update rankings for all agents
      agents.forEach((agent, index) => {
        const metrics = {
          averageQuality: 90 + index * 2,
          averageSpeed: 100 - index * 10,
          uptime: 95 + index,
          tasksCompleted: 50 + index * 10
        };

        manager.updateAgentRankings(agent, metrics);
      });

      // Check overall leaderboard
      const overallLeaderboard = manager.getLeaderboard('OVERALL', RANKING_PERIODS.ALL_TIME);
      expect(overallLeaderboard.entries.size).toBe(3);

      // Check top performer
      const top = overallLeaderboard.getTop(1);
      expect(top).toHaveLength(1);
      expect(top[0].rank).toBe(1);

      // Check individual rankings
      const agent1Rankings = manager.getAgentRankings('agent-1', RANKING_PERIODS.ALL_TIME);
      expect(agent1Rankings.OVERALL).toBeDefined();
      expect(agent1Rankings.SPEED).toBeDefined();
    });

    test('should handle Hall of Fame induction', () => {
      const manager = new LeaderboardManager();

      const legendAgent = {
        id: 'legend-1',
        name: 'LegendBot',
        type: 'worker',
        eloRating: 2000,
        points: { total: 50000 },
        stats: {
          averageQuality: 98,
          daysActive: 1095,
          tasksCompleted: 5000,
          battlesWon: 500
        }
      };

      // Update rankings (triggers Hall of Fame check)
      manager.updateAgentRankings(legendAgent, {
        averageQuality: 98,
        tasksCompleted: 5000
      });

      // Check Hall of Fame
      const hofMembers = manager.getHallOfFame();
      expect(hofMembers.length).toBeGreaterThan(0);

      const inducted = hofMembers.find(m => m.agentId === 'legend-1');
      expect(inducted).toBeDefined();
      expect(inducted.tier).toBe('LEGEND');
    });

    test('should emit events correctly', (done) => {
      const manager = new LeaderboardManager();

      manager.on('rankings-updated', (data) => {
        expect(data.category).toBeDefined();
        expect(data.period).toBeDefined();
        expect(data.rankings).toBeDefined();
        done();
      });

      const agent = {
        id: 'agent-1',
        name: 'TestAgent',
        type: 'worker',
        eloRating: 1500
      };

      manager.updateAgentRankings(agent, { averageQuality: 95 });
    });
  });
});
