/**
 * Achievement & Gamification Validation Schemas
 *
 * Validation for achievement claims, points transactions, battles, and leaderboards
 */

import Joi from 'joi';

// ============== CONSTANTS ==============
const ACHIEVEMENT_CATEGORIES = [
  'speed', 'quality', 'collaboration', 'endurance',
  'innovation', 'leadership', 'special', 'legendary'
];

const ACHIEVEMENT_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legendary'];

const BATTLE_MOVES = [
  'attack', 'defend', 'special', 'heal', 'boost',
  'debuff', 'counter', 'ultimate'
];

const POINT_TRANSACTION_TYPES = [
  'task_completion', 'achievement_unlock', 'bonus',
  'penalty', 'transfer', 'battle_reward', 'daily_reward'
];

// ============== ACHIEVEMENT CLAIM SCHEMA ==============

/**
 * Schema for claiming an achievement
 */
export const achievementClaimSchema = Joi.object({
  agentId: Joi.string().required(),

  achievementId: Joi.string()
    .required()
    .description('Achievement identifier'),

  evidence: Joi.object({
    // For speed achievements
    taskCompletionTimes: Joi.array().items(Joi.object({
      taskId: Joi.string().required(),
      duration: Joi.number().integer().min(0).required(),
      timestamp: Joi.date().iso()
    })),

    // For quality achievements
    qualityScores: Joi.array().items(Joi.object({
      taskId: Joi.string().required(),
      score: Joi.number().min(0).max(100).required(),
      validatorId: Joi.string()
    })),

    // For collaboration achievements
    collaborations: Joi.array().items(Joi.object({
      sessionId: Joi.string().required(),
      role: Joi.string(),
      contribution: Joi.number().min(0).max(100)
    })),

    // For endurance achievements
    continuousOperation: Joi.object({
      startTime: Joi.date().iso().required(),
      endTime: Joi.date().iso().required(),
      tasksCompleted: Joi.number().integer().min(0),
      uptimePercentage: Joi.number().min(0).max(100)
    }),

    // Generic metrics
    metrics: Joi.object()
      .pattern(Joi.string(), Joi.any())

  }).required()
    .description('Evidence supporting the achievement claim'),

  metadata: Joi.object({
    claimTime: Joi.date().iso().default(Date.now),
    autoDetected: Joi.boolean().default(false),
    validator: Joi.string(),
    confidence: Joi.number().min(0).max(1)
  }),

  signature: Joi.string()
    .description('Digital signature for verification')

}).description('Achievement claim schema');

// ============== ACHIEVEMENT VERIFICATION SCHEMA ==============

/**
 * Schema for achievement verification response
 */
export const achievementVerificationSchema = Joi.object({
  claimId: Joi.string().uuid().required(),
  agentId: Joi.string().required(),
  achievementId: Joi.string().required(),

  verification: Joi.object({
    status: Joi.string()
      .valid('approved', 'rejected', 'pending', 'insufficient_evidence')
      .required(),

    criteria: Joi.array().items(Joi.object({
      criterion: Joi.string().required(),
      required: Joi.any().required(),
      provided: Joi.any().required(),
      met: Joi.boolean().required()
    })).required(),

    score: Joi.number()
      .min(0)
      .max(100)
      .description('Verification score percentage'),

    notes: Joi.string().max(1000)
  }).required(),

  reward: Joi.when('verification.status', {
    is: 'approved',
    then: Joi.object({
      points: Joi.number().integer().min(0).required(),
      badge: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        tier: Joi.string().valid(...ACHIEVEMENT_TIERS).required(),
        icon: Joi.string()
      }),
      multiplier: Joi.number().min(1).max(10).default(1),
      bonuses: Joi.array().items(Joi.string())
    }).required(),
    otherwise: Joi.forbidden()
  }),

  verifiedBy: Joi.string().required(),
  verifiedAt: Joi.date().iso().default(Date.now)

}).description('Achievement verification schema');

// ============== POINTS TRANSACTION SCHEMA ==============

/**
 * Schema for points transactions
 */
export const pointsTransactionSchema = Joi.object({
  transactionId: Joi.string().uuid().default(() => require('uuid').v4()),

  type: Joi.string()
    .valid(...POINT_TRANSACTION_TYPES)
    .required()
    .description('Transaction type'),

  // Participants
  from: Joi.when('type', {
    is: 'transfer',
    then: Joi.string().required(),
    otherwise: Joi.string().valid('system').default('system')
  }),

  to: Joi.string().required()
    .description('Recipient agent ID'),

  amount: Joi.number()
    .integer()
    .min(-10000)
    .max(10000)
    .not(0)
    .required()
    .description('Points amount (negative for penalties)'),

  details: Joi.object({
    // For task completion
    taskId: Joi.when('$type', {
      is: 'task_completion',
      then: Joi.string().required()
    }),

    // For achievement unlock
    achievementId: Joi.when('$type', {
      is: 'achievement_unlock',
      then: Joi.string().required()
    }),

    // For battle reward
    battleId: Joi.when('$type', {
      is: 'battle_reward',
      then: Joi.string().required()
    }),

    reason: Joi.string().max(500),

    multiplier: Joi.number()
      .min(0.1)
      .max(10)
      .default(1)
      .description('Points multiplier'),

    bonuses: Joi.array().items(Joi.object({
      type: Joi.string().required(),
      amount: Joi.number().integer().required(),
      reason: Joi.string()
    }))
  }),

  balance: Joi.object({
    before: Joi.number().integer().required(),
    after: Joi.number().integer().required()
  }),

  metadata: Joi.object({
    processedBy: Joi.string(),
    batchId: Joi.string().uuid(),
    reversible: Joi.boolean().default(false),
    reversed: Joi.boolean().default(false),
    originalTransactionId: Joi.string().uuid()
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Points transaction schema');

// ============== BATTLE ACTION SCHEMA ==============

/**
 * Schema for battle system actions
 */
export const battleActionSchema = Joi.object({
  battleId: Joi.string().uuid().required(),
  agentId: Joi.string().required(),

  action: Joi.object({
    type: Joi.string()
      .valid(...BATTLE_MOVES)
      .required()
      .description('Battle move type'),

    target: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string()).min(1)
    ).description('Target agent(s)'),

    power: Joi.number()
      .min(0)
      .max(100)
      .description('Move power level'),

    cost: Joi.object({
      energy: Joi.number().min(0).max(100),
      cooldown: Joi.number().integer().min(0),
      resources: Joi.object()
    }),

    effects: Joi.array().items(Joi.object({
      type: Joi.string().required(),
      duration: Joi.number().integer().min(0),
      magnitude: Joi.number(),
      stackable: Joi.boolean().default(false)
    }))
  }).required(),

  validation: Joi.object({
    isValid: Joi.boolean().required(),
    canAfford: Joi.boolean().required(),
    inRange: Joi.boolean().required(),
    targetValid: Joi.boolean().required(),
    errors: Joi.array().items(Joi.string())
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Battle action schema');

// ============== LEADERBOARD UPDATE SCHEMA ==============

/**
 * Schema for leaderboard updates
 */
export const leaderboardUpdateSchema = Joi.object({
  leaderboardId: Joi.string()
    .valid('points', 'achievements', 'tasks', 'battles', 'efficiency', 'collaboration')
    .required(),

  period: Joi.string()
    .valid('daily', 'weekly', 'monthly', 'alltime')
    .required(),

  entries: Joi.array()
    .items(Joi.object({
      rank: Joi.number().integer().min(1).required(),
      agentId: Joi.string().required(),
      agentName: Joi.string(),
      score: Joi.number().required(),
      change: Joi.number().integer().description('Rank change from last update'),

      stats: Joi.object({
        primary: Joi.number().required(),
        secondary: Joi.object(),
        trend: Joi.string().valid('up', 'down', 'stable'),
        percentile: Joi.number().min(0).max(100)
      }),

      badges: Joi.array().items(Joi.string()),
      tier: Joi.string().valid(...ACHIEVEMENT_TIERS)
    }))
    .min(1)
    .max(1000)
    .required(),

  metadata: Joi.object({
    totalParticipants: Joi.number().integer().min(0).required(),
    updateTime: Joi.date().iso().default(Date.now),
    nextUpdate: Joi.date().iso(),
    calculationMethod: Joi.string(),
    version: Joi.string()
  }),

  changes: Joi.object({
    newEntries: Joi.array().items(Joi.string()),
    removedEntries: Joi.array().items(Joi.string()),
    significantMoves: Joi.array().items(Joi.object({
      agentId: Joi.string().required(),
      from: Joi.number().integer().min(1),
      to: Joi.number().integer().min(1),
      change: Joi.number().integer()
    }))
  })

}).description('Leaderboard update schema');

// ============== REPUTATION UPDATE SCHEMA ==============

/**
 * Schema for reputation system updates
 */
export const reputationUpdateSchema = Joi.object({
  agentId: Joi.string().required(),

  update: Joi.object({
    type: Joi.string()
      .valid('peer_rating', 'task_performance', 'collaboration', 'violation', 'bonus')
      .required(),

    value: Joi.number()
      .min(-100)
      .max(100)
      .required()
      .description('Reputation change value'),

    source: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string()).min(1)
    ).description('Source of reputation update'),

    evidence: Joi.object({
      taskId: Joi.string(),
      sessionId: Joi.string(),
      rating: Joi.number().min(1).max(5),
      feedback: Joi.string().max(1000),
      metrics: Joi.object()
    }),

    weight: Joi.number()
      .min(0)
      .max(1)
      .default(1)
      .description('Update weight factor')
  }).required(),

  reputation: Joi.object({
    before: Joi.number().required(),
    after: Joi.number().required(),
    level: Joi.string().required(),
    percentile: Joi.number().min(0).max(100)
  }).required(),

  consequences: Joi.object({
    privilegesGained: Joi.array().items(Joi.string()),
    privilegesLost: Joi.array().items(Joi.string()),
    tierChange: Joi.object({
      from: Joi.string(),
      to: Joi.string()
    }),
    notifications: Joi.array().items(Joi.string())
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Reputation update schema');

// ============== TIER PROGRESSION SCHEMA ==============

/**
 * Schema for tier progression events
 */
export const tierProgressionSchema = Joi.object({
  agentId: Joi.string().required(),

  progression: Joi.object({
    category: Joi.string()
      .valid('overall', ...ACHIEVEMENT_CATEGORIES)
      .required(),

    previousTier: Joi.object({
      name: Joi.string().valid(...ACHIEVEMENT_TIERS).required(),
      points: Joi.number().integer().min(0).required(),
      achievedAt: Joi.date().iso()
    }).required(),

    newTier: Joi.object({
      name: Joi.string().valid(...ACHIEVEMENT_TIERS).required(),
      points: Joi.number().integer().min(0).required(),
      threshold: Joi.number().integer().min(0).required()
    }).required(),

    progress: Joi.object({
      toNextTier: Joi.number().min(0).max(100),
      pointsNeeded: Joi.number().integer().min(0),
      estimatedTime: Joi.number().integer().min(0)
    })
  }).required(),

  rewards: Joi.object({
    points: Joi.number().integer().min(0),
    badges: Joi.array().items(Joi.string()),
    perks: Joi.array().items(Joi.string()),
    multipliers: Joi.object()
  }),

  celebration: Joi.object({
    message: Joi.string().max(500),
    broadcast: Joi.boolean().default(true),
    effects: Joi.array().items(Joi.string())
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Tier progression schema');

// ============== VALIDATION HELPERS ==============

/**
 * Validate achievement eligibility
 */
export const validateAchievementEligibility = (agent, achievement) => {
  const schema = Joi.object({
    agent: Joi.object({
      id: Joi.string().required(),
      stats: Joi.object().required(),
      achievements: Joi.array().items(Joi.string())
    }).required(),
    achievement: Joi.object({
      id: Joi.string().required(),
      criteria: Joi.object().required(),
      prerequisites: Joi.array().items(Joi.string())
    }).required()
  });

  return schema.validate({ agent, achievement });
};

/**
 * Validate battle move legality
 */
export const validateBattleMove = (move, battleState) => {
  const schema = Joi.object({
    move: battleActionSchema.required(),
    battleState: Joi.object({
      turn: Joi.number().integer().min(0),
      activeAgents: Joi.array().items(Joi.string()),
      cooldowns: Joi.object(),
      effects: Joi.array()
    }).required()
  });

  return schema.validate({ move, battleState });
};

/**
 * Export all schemas
 */
export default {
  achievementClaimSchema,
  achievementVerificationSchema,
  pointsTransactionSchema,
  battleActionSchema,
  leaderboardUpdateSchema,
  reputationUpdateSchema,
  tierProgressionSchema,
  validateAchievementEligibility,
  validateBattleMove
};