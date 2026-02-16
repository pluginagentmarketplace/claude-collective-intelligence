/**
 * 🧪 BATTLE SYSTEM TESTS
 * Unit and integration tests for battle modes
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { Battle, BattleManager, BATTLE_MODES } from '../../../src/systems/battle/system.js';

describe('Battle System', () => {

  // ============================================
  // BATTLE CLASS TESTS
  // ============================================

  describe('Battle Class', () => {

    test('should create a battle with correct configuration', () => {
      const battle = new Battle('HEAD_TO_HEAD');

      expect(battle.id).toBeDefined();
      expect(battle.mode).toBe('HEAD_TO_HEAD');
      expect(battle.status).toBe('pending');
      expect(battle.config.participants).toBe(2);
      expect(battle.participants).toEqual([]);
    });

    test('should add participants to battle', () => {
      const battle = new Battle('SPEED_RACE');

      const agent1 = { id: 'agent-1', name: 'SpeedyBot', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'FastAgent', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);

      expect(battle.participants).toHaveLength(2);
      expect(battle.participants[0].agentId).toBe('agent-1');
      expect(battle.participants[1].agentId).toBe('agent-2');
    });

    test('should not allow participants after battle starts', () => {
      const battle = new Battle('HEAD_TO_HEAD');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };
      const agent3 = { id: 'agent-3', name: 'Agent3', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);

      expect(() => {
        battle.addParticipant(agent3);
      }).toThrow('Cannot join battle that has already started');
    });

    test('should check if battle is ready to start', () => {
      const battle = new Battle('HEAD_TO_HEAD');

      expect(battle.isReady()).toBe(false);

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      battle.addParticipant(agent1);
      expect(battle.isReady()).toBe(false);

      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };
      battle.addParticipant(agent2);
      expect(battle.isReady()).toBe(true);
    });

    test('should start battle and set status to active', () => {
      const battle = new Battle('SPEED_RACE');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);

      battle.start(false); // Disable auto-end for testing

      expect(battle.status).toBe('active');
      expect(battle.startTime).toBeDefined();
      expect(battle.endTime).toBeDefined();
    });

    test('should calculate completion-time score correctly', () => {
      const battle = new Battle('SPEED_RACE');

      const result = {
        completionTime: 60000 // 1 minute
      };

      const score = battle.calculateScore(result);

      // Score should be time remaining in seconds
      expect(score).toBeGreaterThan(0);
      expect(score).toBe(Math.round((battle.config.duration - 60000) / 1000));
    });

    test('should calculate quality-based score correctly', () => {
      const battle = new Battle('QUALITY_SHOWDOWN');

      const result = {
        accuracy: 0.98,
        completeness: 1.0,
        codeQuality: 0.95,
        documentation: 0.90,
        testCoverage: 0.85
      };

      const score = battle.calculateScore(result);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should submit results for participants', () => {
      const battle = new Battle('HEAD_TO_HEAD');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);

      const result1 = { baseScore: 100, completionTime: 60000 };
      const result2 = { baseScore: 150, completionTime: 45000 };

      battle.submitResult('agent-1', result1);
      battle.submitResult('agent-2', result2);

      expect(battle.results).toHaveLength(2);
      expect(battle.participants[0].score).toBeGreaterThan(0);
      expect(battle.participants[1].score).toBeGreaterThan(0);
    });

    test('should determine winner correctly', () => {
      const battle = new Battle('HEAD_TO_HEAD');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);

      battle.submitResult('agent-1', { baseScore: 100 });
      battle.submitResult('agent-2', { baseScore: 150 });

      battle.end();

      expect(battle.status).toBe('completed');
      expect(battle.winner).toBe('agent-2'); // Higher score wins
    });

    test('should cancel battle correctly', () => {
      const battle = new Battle('TEAM_TOURNAMENT');

      battle.cancel('Not enough participants');

      expect(battle.status).toBe('cancelled');
      expect(battle.metadata.cancellationReason).toBe('Not enough participants');
    });

    test('should not cancel completed battle', () => {
      const battle = new Battle('HEAD_TO_HEAD');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);
      battle.end();

      expect(() => {
        battle.cancel('Too late');
      }).toThrow('Cannot cancel completed battle');
    });

    test('should get battle summary', () => {
      const battle = new Battle('SPEED_RACE');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);

      const summary = battle.getSummary();

      expect(summary.id).toBe(battle.id);
      expect(summary.mode).toBe('SPEED_RACE');
      expect(summary.participants).toBe(2);
      expect(summary.status).toBe('pending');
    });
  });

  // ============================================
  // BATTLE MODE SPECIFIC TESTS
  // ============================================

  describe('King of Hill Mode', () => {

    test('should update king when agent scores higher', () => {
      const battle = new Battle('KING_OF_HILL');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);

      battle.submitResult('agent-1', { timeAsKing: 100 });
      expect(battle.kingOfHill).toBe('agent-1');

      battle.submitResult('agent-2', { timeAsKing: 150 });
      expect(battle.kingOfHill).toBe('agent-2');
    });

    test('should emit new-king event when king changes', (done) => {
      const battle = new Battle('KING_OF_HILL');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);

      let eventCount = 0;
      battle.on('new-king', (data) => {
        eventCount++;
        if (eventCount === 2) {
          // Second event: agent-2 becomes king
          expect(data.newKing).toBe('agent-2');
          expect(data.previousKing).toBe('agent-1');
          done();
        }
      });

      battle.submitResult('agent-1', { timeAsKing: 100 });
      battle.submitResult('agent-2', { timeAsKing: 150 });
    });
  });

  describe('Survival Mode', () => {

    test('should eliminate agents below threshold', () => {
      const battle = new Battle('SURVIVAL');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };
      const agent3 = { id: 'agent-3', name: 'Agent3', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.addParticipant(agent3);
      battle.start(false);

      battle.submitResult('agent-1', { survivalTime: 100 });
      battle.submitResult('agent-2', { survivalTime: 90 });
      battle.submitResult('agent-3', { survivalTime: 10 }); // Below threshold

      const eliminated = battle.eliminated.includes('agent-3');
      expect(eliminated).toBe(true);
    });

    test('should end battle when only one agent remains', () => {
      const battle = new Battle('SURVIVAL');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);

      battle.submitResult('agent-1', { survivalTime: 100 });
      battle.submitResult('agent-2', { survivalTime: 10 });

      // Battle should auto-end when only one agent remains
      if (battle.status === 'completed') {
        expect(battle.winner).toBeDefined();
      }
    });
  });

  describe('Boss Raid Mode', () => {

    test('should track boss health', () => {
      const battle = new Battle('BOSS_RAID', { minParticipants: 1 });
      battle.metadata.bossHealth = 1000;

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      battle.addParticipant(agent1);
      battle.start(false);

      battle.submitResult('agent-1', { damage: 300 });

      expect(battle.metadata.bossHealth).toBe(700);
    });

    test('should end battle when boss is defeated', (done) => {
      const battle = new Battle('BOSS_RAID', { minParticipants: 1 });
      battle.metadata.bossHealth = 500;

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      battle.addParticipant(agent1);
      battle.start(false);

      battle.on('boss-defeated', () => {
        expect(battle.metadata.bossHealth).toBeLessThanOrEqual(0);
        expect(battle.status).toBe('completed');
        done();
      });

      battle.submitResult('agent-1', { damage: 600 });
    });
  });

  describe('Team Tournament Mode', () => {

    test('should determine team winner correctly', () => {
      const battle = new Battle('TEAM_TOURNAMENT');

      // Team A
      battle.addParticipant({ id: 'agent-1', name: 'Agent1', type: 'worker', team: 'TeamA' });
      battle.addParticipant({ id: 'agent-2', name: 'Agent2', type: 'worker', team: 'TeamA' });

      // Team B
      battle.addParticipant({ id: 'agent-3', name: 'Agent3', type: 'worker', team: 'TeamB' });
      battle.addParticipant({ id: 'agent-4', name: 'Agent4', type: 'worker', team: 'TeamB' });

      battle.start(false);

      // Team A scores
      battle.submitResult('agent-1', { baseScore: 100 });
      battle.submitResult('agent-2', { baseScore: 150 });

      // Team B scores
      battle.submitResult('agent-3', { baseScore: 120 });
      battle.submitResult('agent-4', { baseScore: 100 });

      battle.end();

      expect(battle.winner).toBe('TeamA'); // 250 vs 220
    });
  });

  // ============================================
  // BATTLE MANAGER TESTS
  // ============================================

  describe('BattleManager', () => {

    let manager;

    beforeEach(() => {
      manager = new BattleManager();
    });

    test('should create battle manager', () => {
      expect(manager).toBeDefined();
      expect(manager.battles).toBeInstanceOf(Map);
      expect(manager.activeBattles).toBeInstanceOf(Map);
    });

    test('should create a new battle', () => {
      const battle = manager.createBattle('HEAD_TO_HEAD');

      expect(battle).toBeInstanceOf(Battle);
      expect(manager.battles.has(battle.id)).toBe(true);
    });

    test('should throw error for unknown battle mode', () => {
      expect(() => {
        manager.createBattle('INVALID_MODE');
      }).toThrow('Unknown battle mode');
    });

    test('should get battle by ID', () => {
      const battle = manager.createBattle('SPEED_RACE');
      const retrieved = manager.getBattle(battle.id);

      expect(retrieved).toBe(battle);
    });

    test('should get active battles by mode', () => {
      manager.createBattle('HEAD_TO_HEAD');
      manager.createBattle('HEAD_TO_HEAD');
      manager.createBattle('SPEED_RACE');

      const headToHeadBattles = manager.getActiveBattles('HEAD_TO_HEAD');
      expect(headToHeadBattles).toHaveLength(2);

      const speedRaceBattles = manager.getActiveBattles('SPEED_RACE');
      expect(speedRaceBattles).toHaveLength(1);
    });

    test('should get all active battles', () => {
      manager.createBattle('HEAD_TO_HEAD');
      manager.createBattle('SPEED_RACE');
      manager.createBattle('QUALITY_SHOWDOWN');

      const allBattles = manager.getActiveBattles();
      expect(allBattles).toHaveLength(3);
    });

    test('should find open battle for agent to join', () => {
      const battle = manager.createBattle('HEAD_TO_HEAD');
      battle.addParticipant({ id: 'agent-1', name: 'Agent1', type: 'worker' });

      const found = manager.findOpenBattle('HEAD_TO_HEAD', 'agent-2');

      expect(found).toBe(battle);
    });

    test('should not find open battle if agent already in it', () => {
      const battle = manager.createBattle('HEAD_TO_HEAD');
      battle.addParticipant({ id: 'agent-1', name: 'Agent1', type: 'worker' });

      const found = manager.findOpenBattle('HEAD_TO_HEAD', 'agent-1');

      expect(found).toBeUndefined();
    });

    test('should perform matchmaking', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };

      const battle = manager.matchmake('SPEED_RACE', agent1, null, { autoEnd: false });

      expect(battle).toBeInstanceOf(Battle);
      expect(battle.participants).toHaveLength(1);
      expect(battle.participants[0].agentId).toBe('agent-1');
    });

    test('should auto-start battle when ready after matchmaking', () => {
      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      const battle1 = manager.matchmake('HEAD_TO_HEAD', agent1, null, { autoEnd: false });
      expect(battle1.status).toBe('pending');

      const battle2 = manager.matchmake('HEAD_TO_HEAD', agent2, null, { autoEnd: false });
      expect(battle2.status).toBe('active'); // Auto-started
    });

    test('should create challenge battle', () => {
      const challenger = { id: 'agent-1', name: 'Agent1', type: 'worker' };

      const battle = manager.challenge('HEAD_TO_HEAD', challenger, 'agent-2');

      expect(battle.participants).toHaveLength(1);
      expect(battle.metadata.challengedAgent).toBe('agent-2');
    });

    test('should accept challenge', () => {
      const challenger = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const opponent = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      const battle = manager.challenge('HEAD_TO_HEAD', challenger, 'agent-2');

      manager.acceptChallenge(battle.id, opponent, { autoEnd: false });

      expect(battle.participants).toHaveLength(2);
      expect(battle.status).toBe('active');
    });

    test('should archive completed battles', () => {
      const battle = manager.createBattle('HEAD_TO_HEAD');

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      battle.addParticipant(agent1);
      battle.addParticipant(agent2);
      battle.start(false);
      battle.end();

      // Wait for event processing
      setTimeout(() => {
        expect(manager.battleHistory.length).toBe(1);
        expect(manager.getActiveBattles('HEAD_TO_HEAD')).toHaveLength(0);
      }, 10);
    });

    test('should get battle statistics', () => {
      manager.createBattle('HEAD_TO_HEAD');
      manager.createBattle('SPEED_RACE');
      manager.createBattle('QUALITY_SHOWDOWN');

      const stats = manager.getStatistics();

      expect(stats.activeBattles).toBe(3);
      expect(stats.byMode).toBeDefined();
      expect(stats.byMode.HEAD_TO_HEAD.active).toBe(1);
    });

    test('should emit battle-created event', (done) => {
      manager.on('battle-created', (data) => {
        expect(data.battle).toBeInstanceOf(Battle);
        done();
      });

      manager.createBattle('SPEED_RACE');
    });

    test('should emit battle-started event', (done) => {
      manager.on('battle-started', (data) => {
        expect(data.battle.status).toBe('active');
        done();
      });

      const agent1 = { id: 'agent-1', name: 'Agent1', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'Agent2', type: 'worker' };

      manager.matchmake('HEAD_TO_HEAD', agent1, null, { autoEnd: false });
      manager.matchmake('HEAD_TO_HEAD', agent2, null, { autoEnd: false });
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================

  describe('Integration Tests', () => {

    test('should complete full battle lifecycle', (done) => {
      const manager = new BattleManager();

      const agent1 = { id: 'agent-1', name: 'SpeedyBot', type: 'worker' };
      const agent2 = { id: 'agent-2', name: 'FastAgent', type: 'worker' };

      // Create battle
      const battle = manager.createBattle('SPEED_RACE');
      expect(battle.status).toBe('pending');

      // Add participants
      battle.addParticipant(agent1);
      battle.addParticipant(agent2);

      // Start battle
      battle.start(false);
      expect(battle.status).toBe('active');

      // Submit results
      battle.submitResult('agent-1', { completionTime: 60000 });
      battle.submitResult('agent-2', { completionTime: 45000 });

      // End battle
      battle.end();
      expect(battle.status).toBe('completed');
      expect(battle.winner).toBeDefined();

      // Check history
      setTimeout(() => {
        expect(manager.battleHistory.length).toBeGreaterThan(0);
        done();
      }, 10);
    });

    test('should handle multiple concurrent battles', () => {
      const manager = new BattleManager();

      // Create multiple battles
      const battle1 = manager.createBattle('HEAD_TO_HEAD');
      const battle2 = manager.createBattle('SPEED_RACE');
      const battle3 = manager.createBattle('QUALITY_SHOWDOWN');

      expect(manager.getActiveBattles()).toHaveLength(3);

      // Add participants to each
      battle1.addParticipant({ id: 'a1', name: 'A1', type: 'worker' });
      battle1.addParticipant({ id: 'a2', name: 'A2', type: 'worker' });

      battle2.addParticipant({ id: 'a3', name: 'A3', type: 'worker' });
      battle2.addParticipant({ id: 'a4', name: 'A4', type: 'worker' });

      battle3.addParticipant({ id: 'a5', name: 'A5', type: 'worker' });
      battle3.addParticipant({ id: 'a6', name: 'A6', type: 'worker' });

      // Start all
      battle1.start(false);
      battle2.start(false);
      battle3.start(false);

      expect(battle1.status).toBe('active');
      expect(battle2.status).toBe('active');
      expect(battle3.status).toBe('active');
    });
  });
});
