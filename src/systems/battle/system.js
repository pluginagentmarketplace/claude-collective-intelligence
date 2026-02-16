/**
 * ⚔️ BATTLE SYSTEM
 * Agent 13 - Battle Modes & Competition Engine
 *
 * Implements 8 battle modes for AI agent competition:
 * 1. 1v1 Head-to-Head
 * 2. Speed Race
 * 3. Quality Showdown
 * 4. Team Tournament
 * 5. King of Hill
 * 6. Boss Raid
 * 7. Time Attack
 * 8. Survival Mode
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// ============================================
// BATTLE CONFIGURATION
// ============================================

const BATTLE_MODES = {
  HEAD_TO_HEAD: {
    id: 'head-to-head',
    name: '1v1 Head-to-Head Duel',
    description: 'Direct competition on identical task',
    participants: 2,
    duration: 300000, // 5 minutes
    format: 'same-task',
    scoring: 'comparative'
  },

  SPEED_RACE: {
    id: 'speed-race',
    name: 'Speed Race',
    description: 'Fastest completion wins',
    participants: 2,
    duration: 180000, // 3 minutes
    format: 'parallel-tasks',
    scoring: 'completion-time'
  },

  QUALITY_SHOWDOWN: {
    id: 'quality-showdown',
    name: 'Quality Showdown',
    description: 'Highest quality output wins',
    participants: 2,
    duration: 600000, // 10 minutes
    format: 'same-task',
    scoring: 'quality-based'
  },

  TEAM_TOURNAMENT: {
    id: 'team-tournament',
    name: 'Team Tournament',
    description: 'Team collaboration battle',
    participants: 8, // 2 teams of 4
    duration: 1800000, // 30 minutes
    format: 'team-collaborative',
    scoring: 'team-aggregate'
  },

  KING_OF_HILL: {
    id: 'king-of-hill',
    name: 'King of the Hill',
    description: 'Defend your position against challengers',
    participants: -1, // Unlimited
    duration: 3600000, // 1 hour
    format: 'continuous',
    scoring: 'time-on-top'
  },

  BOSS_RAID: {
    id: 'boss-raid',
    name: 'Boss Raid',
    description: 'All agents vs. ultra-difficult challenge',
    participants: -1, // Unlimited
    duration: 3600000, // 1 hour
    format: 'cooperative',
    scoring: 'contribution-based'
  },

  TIME_ATTACK: {
    id: 'time-attack',
    name: 'Time Attack',
    description: 'Beat the clock for bonus points',
    participants: -1, // Unlimited
    duration: 900000, // 15 minutes
    format: 'timed-challenge',
    scoring: 'time-bonus'
  },

  SURVIVAL: {
    id: 'survival',
    name: 'Survival Mode',
    description: 'Last agent standing wins',
    participants: -1, // Unlimited (min 4)
    duration: 1200000, // 20 minutes
    format: 'elimination',
    scoring: 'survival-rank'
  }
};

// ============================================
// BATTLE CLASS
// ============================================

class Battle extends EventEmitter {
  constructor(mode, config = {}) {
    super();

    this.id = uuidv4();
    this.mode = mode;
    this.config = BATTLE_MODES[mode.toUpperCase()];
    this.status = 'pending'; // pending, active, completed, cancelled

    this.createdAt = Date.now();
    this.startTime = null;
    this.endTime = null;

    this.participants = [];
    this.teams = config.teams || [];
    this.tasks = [];
    this.results = [];

    this.winner = null;
    this.topPerformers = [];
    this.kingOfHill = null; // For King of Hill mode
    this.eliminated = []; // For Survival mode

    this.metadata = {
      challengerId: config.challengerId,
      minParticipants: config.minParticipants || 2,
      maxParticipants: config.maxParticipants || this.config.participants,
      entryFee: config.entryFee || 0,
      prizePool: 0
    };
  }

  /**
   * Add participant to battle
   */
  addParticipant(agent) {
    if (this.status !== 'pending') {
      throw new Error('Cannot join battle that has already started');
    }

    const participant = {
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.type,
      team: agent.team || null,
      status: 'ready',
      score: 0,
      results: [],
      joinedAt: Date.now(),
      eliminatedAt: null
    };

    this.participants.push(participant);
    this.emit('participant-joined', { battle: this, participant });

    return participant;
  }

  /**
   * Check if battle is ready to start
   */
  isReady() {
    const minMet = this.participants.length >= this.metadata.minParticipants;
    const maxNotExceeded = this.metadata.maxParticipants === -1 ||
                          this.participants.length <= this.metadata.maxParticipants;

    return minMet && maxNotExceeded;
  }

  /**
   * Start the battle
   */
  start(autoEnd = true) {
    if (!this.isReady()) {
      throw new Error('Battle not ready to start');
    }

    this.status = 'active';
    this.startTime = Date.now();
    this.endTime = this.startTime + this.config.duration;

    this.emit('battle-started', { battle: this });

    // Schedule auto-end (optional for testing)
    if (autoEnd) {
      this.autoEndTimeout = setTimeout(() => {
        if (this.status === 'active') {
          this.end();
        }
      }, this.config.duration);
    }

    return this;
  }

  /**
   * Submit result for participant
   */
  submitResult(agentId, result) {
    const participant = this.participants.find(p => p.agentId === agentId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    const scoredResult = {
      agentId,
      result,
      score: this.calculateScore(result),
      submittedAt: Date.now()
    };

    participant.results.push(scoredResult);
    participant.score += scoredResult.score;
    this.results.push(scoredResult);

    this.emit('result-submitted', { battle: this, scoredResult });

    // Mode-specific handling
    this.handleModeSpecificResult(agentId, scoredResult);

    return scoredResult;
  }

  /**
   * Calculate score based on battle mode
   */
  calculateScore(result) {
    const scoring = this.config.scoring;

    switch (scoring) {
      case 'completion-time':
        // Faster = higher score
        const timeTaken = result.completionTime || this.config.duration;
        const timeRemaining = this.config.duration - timeTaken;
        return Math.max(0, Math.round(timeRemaining / 1000));

      case 'quality-based':
        // Quality metrics
        return this.calculateQualityScore(result);

      case 'comparative':
        // Base score, compared during end()
        return result.baseScore || 100;

      case 'team-aggregate':
        // Team total score
        return result.teamScore || 0;

      case 'time-on-top':
        // Duration as king
        return result.timeAsKing || 0;

      case 'contribution-based':
        // Contribution to boss defeat
        return result.contribution || 0;

      case 'time-bonus':
        // Time bonus multiplier
        const bonus = Math.max(0, (this.config.duration - result.completionTime) / 1000);
        return Math.round(result.baseScore * (1 + bonus / 100));

      case 'survival-rank':
        // Survival time
        return result.survivalTime || 0;

      default:
        return result.score || 0;
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(result) {
    const weights = {
      accuracy: 0.30,
      completeness: 0.25,
      codeQuality: 0.20,
      documentation: 0.15,
      testCoverage: 0.10
    };

    let score = 0;
    for (const [metric, weight] of Object.entries(weights)) {
      score += (result[metric] || 0) * weight * 100;
    }

    return Math.round(score);
  }

  /**
   * Handle mode-specific result processing
   */
  handleModeSpecificResult(agentId, result) {
    switch (this.mode.toUpperCase()) {
      case 'KING_OF_HILL':
        this.updateKingOfHill(agentId, result);
        break;

      case 'SURVIVAL':
        this.checkElimination(agentId, result);
        break;

      case 'BOSS_RAID':
        this.updateBossHealth(result);
        break;

      default:
        // No special handling needed
        break;
    }
  }

  /**
   * Update King of Hill champion
   */
  updateKingOfHill(agentId, result) {
    if (!this.kingOfHill || result.score > this.getParticipantScore(this.kingOfHill)) {
      const previousKing = this.kingOfHill;
      this.kingOfHill = agentId;

      this.emit('new-king', {
        battle: this,
        newKing: agentId,
        previousKing
      });
    }
  }

  /**
   * Check if agent should be eliminated (Survival mode)
   */
  checkElimination(agentId, result) {
    const participant = this.participants.find(p => p.agentId === agentId);

    // Eliminate if score falls below threshold
    const avgScore = this.getAverageScore();
    const threshold = avgScore * 0.5; // 50% of average

    if (participant.score < threshold && !this.eliminated.includes(agentId)) {
      participant.status = 'eliminated';
      participant.eliminatedAt = Date.now();
      this.eliminated.push(agentId);

      this.emit('agent-eliminated', { battle: this, agentId });

      // Check if only one agent remains
      const active = this.participants.filter(p => p.status !== 'eliminated');
      if (active.length === 1) {
        this.winner = active[0].agentId;
        this.end();
      }
    }
  }

  /**
   * Update boss health (Boss Raid mode)
   */
  updateBossHealth(result) {
    if (!this.metadata.bossHealth) {
      this.metadata.bossHealth = 10000;
    }

    this.metadata.bossHealth -= result.damage || result.contribution || 0;

    if (this.metadata.bossHealth <= 0) {
      this.emit('boss-defeated', { battle: this });
      this.end();
    }
  }

  /**
   * Get participant's current score
   */
  getParticipantScore(agentId) {
    const participant = this.participants.find(p => p.agentId === agentId);
    return participant ? participant.score : 0;
  }

  /**
   * Get average score across all participants
   */
  getAverageScore() {
    if (this.participants.length === 0) return 0;

    const totalScore = this.participants.reduce((sum, p) => sum + p.score, 0);
    return totalScore / this.participants.length;
  }

  /**
   * End the battle and determine winner(s)
   */
  end() {
    if (this.status !== 'active') {
      return this;
    }

    this.status = 'completed';
    this.endTime = Date.now();

    // Clear auto-end timeout if it exists
    if (this.autoEndTimeout) {
      clearTimeout(this.autoEndTimeout);
      this.autoEndTimeout = null;
    }

    // Determine winner(s) based on mode
    this.determineWinner();

    this.emit('battle-ended', { battle: this, winner: this.winner });

    return this;
  }

  /**
   * Determine battle winner
   */
  determineWinner() {
    // Sort participants by score
    const sorted = [...this.participants]
      .filter(p => p.status !== 'eliminated')
      .sort((a, b) => b.score - a.score);

    if (sorted.length === 0) {
      this.winner = null;
      return;
    }

    // Mode-specific winner determination
    switch (this.mode.toUpperCase()) {
      case 'TEAM_TOURNAMENT':
        this.winner = this.determineTeamWinner();
        break;

      case 'KING_OF_HILL':
        this.winner = this.kingOfHill;
        break;

      case 'SURVIVAL':
        // Winner already set when last elimination occurred
        if (!this.winner) {
          this.winner = sorted[0].agentId;
        }
        break;

      case 'BOSS_RAID':
        // All participants win if boss defeated
        if (this.metadata.bossHealth <= 0) {
          this.winner = 'all-participants';
          this.topPerformers = sorted.slice(0, 3).map(p => p.agentId);
        } else {
          this.winner = null; // Boss survived
        }
        break;

      default:
        // Standard 1v1 or free-for-all
        this.winner = sorted[0].agentId;
        this.topPerformers = sorted.slice(0, 3).map(p => p.agentId);
        break;
    }
  }

  /**
   * Determine team tournament winner
   */
  determineTeamWinner() {
    const teamScores = new Map();

    for (const participant of this.participants) {
      const team = participant.team || 'none';
      const current = teamScores.get(team) || 0;
      teamScores.set(team, current + participant.score);
    }

    let winningTeam = null;
    let highestScore = -1;

    for (const [team, score] of teamScores.entries()) {
      if (score > highestScore) {
        highestScore = score;
        winningTeam = team;
      }
    }

    return winningTeam;
  }

  /**
   * Cancel the battle
   */
  cancel(reason = 'Cancelled by admin') {
    if (this.status === 'completed') {
      throw new Error('Cannot cancel completed battle');
    }

    this.status = 'cancelled';
    this.metadata.cancellationReason = reason;

    this.emit('battle-cancelled', { battle: this, reason });

    return this;
  }

  /**
   * Get battle summary
   */
  getSummary() {
    return {
      id: this.id,
      mode: this.mode,
      name: this.config.name,
      status: this.status,
      participants: this.participants.length,
      winner: this.winner,
      topPerformers: this.topPerformers,
      duration: this.endTime ? this.endTime - this.startTime : null,
      results: this.results.length,
      createdAt: this.createdAt,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
}

// ============================================
// BATTLE MANAGER
// ============================================

class BattleManager extends EventEmitter {
  constructor() {
    super();

    this.battles = new Map(); // battleId -> Battle
    this.activeBattles = new Map(); // mode -> Battle[]
    this.battleHistory = [];

    // Initialize active battles tracking
    for (const mode of Object.keys(BATTLE_MODES)) {
      this.activeBattles.set(mode, []);
    }
  }

  /**
   * Create a new battle
   */
  createBattle(mode, config = {}) {
    const modeKey = mode.toUpperCase();

    if (!BATTLE_MODES[modeKey]) {
      throw new Error(`Unknown battle mode: ${mode}`);
    }

    const battle = new Battle(modeKey, config);

    this.battles.set(battle.id, battle);
    this.activeBattles.get(modeKey).push(battle);

    // Setup battle event listeners
    this.setupBattleListeners(battle);

    this.emit('battle-created', { battle });

    return battle;
  }

  /**
   * Setup event listeners for a battle
   */
  setupBattleListeners(battle) {
    battle.on('battle-started', (data) => {
      this.emit('battle-started', data);
    });

    battle.on('battle-ended', (data) => {
      this.handleBattleEnd(data.battle);
      this.emit('battle-ended', data);
    });

    battle.on('battle-cancelled', (data) => {
      this.handleBattleEnd(data.battle);
      this.emit('battle-cancelled', data);
    });

    battle.on('result-submitted', (data) => {
      this.emit('result-submitted', data);
    });

    battle.on('new-king', (data) => {
      this.emit('new-king', data);
    });

    battle.on('agent-eliminated', (data) => {
      this.emit('agent-eliminated', data);
    });

    battle.on('boss-defeated', (data) => {
      this.emit('boss-defeated', data);
    });
  }

  /**
   * Handle battle completion
   */
  handleBattleEnd(battle) {
    // Remove from active battles
    const modeBattles = this.activeBattles.get(battle.mode);
    const index = modeBattles.findIndex(b => b.id === battle.id);
    if (index !== -1) {
      modeBattles.splice(index, 1);
    }

    // Archive to history
    this.battleHistory.push({
      ...battle.getSummary(),
      participants: battle.participants,
      archivedAt: Date.now()
    });

    // Clean up old history (keep last 1000)
    if (this.battleHistory.length > 1000) {
      this.battleHistory = this.battleHistory.slice(-1000);
    }
  }

  /**
   * Get battle by ID
   */
  getBattle(battleId) {
    return this.battles.get(battleId);
  }

  /**
   * Get active battles by mode
   */
  getActiveBattles(mode = null) {
    if (mode) {
      return this.activeBattles.get(mode.toUpperCase()) || [];
    }

    // Return all active battles
    const all = [];
    for (const battles of this.activeBattles.values()) {
      all.push(...battles);
    }
    return all;
  }

  /**
   * Find open battle for agent to join
   */
  findOpenBattle(mode, agentId) {
    const modeBattles = this.activeBattles.get(mode.toUpperCase()) || [];

    return modeBattles.find(battle => {
      return battle.status === 'pending' &&
             !battle.participants.some(p => p.agentId === agentId) &&
             (battle.metadata.maxParticipants === -1 ||
              battle.participants.length < battle.metadata.maxParticipants);
    });
  }

  /**
   * Matchmaking: Find or create battle for agent
   */
  matchmake(mode, agent, preferredOpponent = null, options = {}) {
    // Try to find existing open battle
    let battle = this.findOpenBattle(mode, agent.id);

    // Create new battle if none found
    if (!battle) {
      battle = this.createBattle(mode, {
        challengerId: agent.id,
        preferredOpponent
      });
    }

    // Add agent as participant
    battle.addParticipant(agent);

    // Auto-start if ready
    if (battle.isReady()) {
      battle.start(options.autoEnd !== false); // Default true
    }

    return battle;
  }

  /**
   * Challenge specific agent to battle
   */
  challenge(mode, challenger, opponentId) {
    const battle = this.createBattle(mode, {
      challengerId: challenger.id,
      maxParticipants: 2
    });

    battle.addParticipant(challenger);
    battle.metadata.challengedAgent = opponentId;

    return battle;
  }

  /**
   * Accept battle challenge
   */
  acceptChallenge(battleId, agent, options = {}) {
    const battle = this.getBattle(battleId);

    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.metadata.challengedAgent !== agent.id) {
      throw new Error('You are not challenged to this battle');
    }

    battle.addParticipant(agent);

    if (battle.isReady()) {
      battle.start(options.autoEnd !== false); // Default true
    }

    return battle;
  }

  /**
   * Get battle statistics
   */
  getStatistics() {
    const stats = {
      totalBattles: this.battleHistory.length + this.battles.size,
      activeBattles: this.battles.size,
      completedBattles: this.battleHistory.length,
      byMode: {},
      avgDuration: 0,
      totalParticipants: 0
    };

    // Mode breakdown
    for (const mode of Object.keys(BATTLE_MODES)) {
      const modeBattles = this.battleHistory.filter(b => b.mode === mode);
      stats.byMode[mode] = {
        total: modeBattles.length,
        active: this.activeBattles.get(mode).length
      };
    }

    // Calculate averages
    if (this.battleHistory.length > 0) {
      const totalDuration = this.battleHistory
        .filter(b => b.duration)
        .reduce((sum, b) => sum + b.duration, 0);

      stats.avgDuration = Math.round(totalDuration / this.battleHistory.length);

      stats.totalParticipants = this.battleHistory
        .reduce((sum, b) => sum + b.participants.length, 0);
    }

    return stats;
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  Battle,
  BattleManager,
  BATTLE_MODES
};
