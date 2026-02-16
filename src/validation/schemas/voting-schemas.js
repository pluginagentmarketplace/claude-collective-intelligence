/**
 * Voting System Validation Schemas
 *
 * Comprehensive validation for democratic decision-making
 * Supporting multiple voting algorithms and security features
 */

import Joi from 'joi';

// ============== CONSTANTS ==============
const VOTING_ALGORITHMS = [
  'simple_majority',
  'confidence_weighted',
  'quadratic',
  'consensus',
  'ranked_choice'
];

const VOTE_TYPES = ['single', 'multiple', 'ranked', 'weighted', 'quadratic'];
const SESSION_STATES = ['open', 'closed', 'calculating', 'completed', 'cancelled'];

// ============== BASE SCHEMAS ==============

/**
 * Session ID schema
 */
const sessionIdSchema = Joi.string()
  .uuid()
  .description('Voting session identifier');

/**
 * Agent vote weight schema with constraints
 */
const voteWeightSchema = Joi.number()
  .min(0)
  .max(1000)
  .precision(2)
  .description('Vote weight or tokens');

// ============== VOTING SESSION CREATION ==============

/**
 * Schema for creating a voting session
 */
export const votingSessionCreationSchema = Joi.object({
  // Basic information
  topic: Joi.string()
    .min(5)
    .max(500)
    .required()
    .description('Voting topic'),

  question: Joi.string()
    .min(10)
    .max(1000)
    .required()
    .description('Question to vote on'),

  description: Joi.string()
    .max(5000)
    .description('Detailed description'),

  // Options configuration
  options: Joi.array()
    .items(Joi.object({
      id: Joi.string().required(),
      label: Joi.string().required(),
      description: Joi.string().max(500),
      metadata: Joi.object()
    }))
    .min(2)
    .max(100)
    .unique('id')
    .required()
    .description('Voting options'),

  // Algorithm configuration
  algorithm: Joi.string()
    .valid(...VOTING_ALGORITHMS)
    .default('simple_majority')
    .description('Voting algorithm'),

  // Algorithm-specific parameters
  algorithmConfig: Joi.object({
    // For consensus voting
    consensusThreshold: Joi.when('$algorithm', {
      is: 'consensus',
      then: Joi.number().min(0.5).max(1).default(0.75),
      otherwise: Joi.forbidden()
    }),

    // For quadratic voting
    tokensPerAgent: Joi.when('$algorithm', {
      is: 'quadratic',
      then: Joi.number().integer().min(1).max(10000).default(100),
      otherwise: Joi.forbidden()
    }),

    // For ranked choice
    eliminationThreshold: Joi.when('$algorithm', {
      is: 'ranked_choice',
      then: Joi.number().min(0).max(0.5).default(0.1),
      otherwise: Joi.forbidden()
    }),

    // For weighted voting
    defaultWeight: Joi.number().min(0).max(100).default(1)
  }).default({}),

  // Quorum requirements
  quorum: Joi.object({
    minParticipation: Joi.number()
      .min(0)
      .max(1)
      .default(0.5)
      .description('Minimum participation rate'),

    minAgents: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .description('Minimum number of agents'),

    minConfidence: Joi.number()
      .min(0)
      .max(1)
      .default(0)
      .description('Minimum average confidence'),

    expertRequired: Joi.boolean()
      .default(false)
      .description('Require expert participation')
  }).default({}),

  // Timing configuration
  timing: Joi.object({
    startTime: Joi.date().iso().min('now').default(Date.now),
    deadline: Joi.date().iso().min(Joi.ref('startTime')).required(),
    extendable: Joi.boolean().default(false),
    maxExtensions: Joi.number().integer().min(0).max(5).default(0),
    extensionDuration: Joi.number().integer().min(60000).max(3600000)
  }).required(),

  // Security settings
  security: Joi.object({
    anonymousVoting: Joi.boolean().default(false),
    encryptVotes: Joi.boolean().default(false),
    requireSignature: Joi.boolean().default(false),
    preventDuplicates: Joi.boolean().default(true),
    auditTrail: Joi.boolean().default(true),
    ipRestriction: Joi.array().items(
      Joi.string().ip({ version: ['ipv4', 'ipv6'] })
    )
  }).default({}),

  // Participant configuration
  participants: Joi.object({
    allowList: Joi.array().items(Joi.string()),
    denyList: Joi.array().items(Joi.string()),
    requiredCapabilities: Joi.array().items(Joi.string()),
    minReputation: Joi.number().min(0),
    roles: Joi.array().items(Joi.string())
  }),

  // Metadata
  metadata: Joi.object({
    initiatedBy: Joi.string().required(),
    category: Joi.string().max(100),
    tags: Joi.array().items(Joi.string().max(30)).max(20),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
    relatedSessions: Joi.array().items(sessionIdSchema),
    externalRef: Joi.string()
  }).default({}),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Voting session creation schema');

// ============== INDIVIDUAL VOTE SCHEMA ==============

/**
 * Schema for submitting a vote
 */
export const voteSubmissionSchema = Joi.object({
  sessionId: sessionIdSchema.required(),
  agentId: Joi.string().required(),

  // Vote based on algorithm type
  vote: Joi.alternatives().try(
    // Simple vote
    Joi.object({
      type: Joi.string().valid('single').required(),
      choice: Joi.string().required()
    }),

    // Multiple choice vote
    Joi.object({
      type: Joi.string().valid('multiple').required(),
      choices: Joi.array().items(Joi.string()).min(1).required()
    }),

    // Ranked choice vote
    Joi.object({
      type: Joi.string().valid('ranked').required(),
      ranking: Joi.array()
        .items(Joi.string())
        .min(2)
        .unique()
        .required()
    }),

    // Weighted vote
    Joi.object({
      type: Joi.string().valid('weighted').required(),
      weights: Joi.object()
        .pattern(Joi.string(), voteWeightSchema)
        .required()
    }),

    // Quadratic vote
    Joi.object({
      type: Joi.string().valid('quadratic').required(),
      allocation: Joi.object()
        .pattern(Joi.string(), Joi.number().integer().min(0))
        .custom((value, helpers) => {
          const total = Object.values(value).reduce((sum, votes) => {
            return sum + (votes * votes);
          }, 0);
          const maxTokens = helpers.state.ancestors[0].maxTokens || 100;
          if (total > maxTokens) {
            return helpers.error('quadratic.exceeds_tokens');
          }
          return value;
        })
        .required()
    })
  ).required(),

  // Vote metadata
  confidence: Joi.number()
    .min(0)
    .max(1)
    .default(1)
    .description('Confidence level'),

  reasoning: Joi.string()
    .max(1000)
    .description('Vote reasoning'),

  expertise: Joi.object({
    level: Joi.string().valid('novice', 'intermediate', 'expert'),
    domain: Joi.string().max(100),
    yearsExperience: Joi.number().min(0).max(100)
  }),

  signature: Joi.string()
    .when('$requireSignature', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Vote submission schema')
  .messages({
    'quadratic.exceeds_tokens': 'Quadratic vote allocation exceeds available tokens'
  });

// ============== VOTE UPDATE SCHEMA ==============

/**
 * Schema for updating a vote
 */
export const voteUpdateSchema = Joi.object({
  sessionId: sessionIdSchema.required(),
  agentId: Joi.string().required(),

  updates: Joi.object({
    vote: Joi.alternatives().try(
      Joi.object({
        type: Joi.string().valid('single'),
        choice: Joi.string()
      }),
      Joi.object({
        type: Joi.string().valid('multiple'),
        choices: Joi.array().items(Joi.string()).min(1)
      }),
      Joi.object({
        type: Joi.string().valid('ranked'),
        ranking: Joi.array().items(Joi.string()).min(2).unique()
      })
    ),
    confidence: Joi.number().min(0).max(1),
    reasoning: Joi.string().max(1000)
  }).min(1).required(),

  updateReason: Joi.string().max(500).required(),
  previousVoteId: Joi.string().uuid(),
  timestamp: Joi.date().iso().default(Date.now)

}).description('Vote update schema');

// ============== VOTING SESSION STATUS ==============

/**
 * Schema for voting session status
 */
export const votingSessionStatusSchema = Joi.object({
  sessionId: sessionIdSchema.required(),
  state: Joi.string().valid(...SESSION_STATES).required(),

  participation: Joi.object({
    totalEligible: Joi.number().integer().min(0).required(),
    voted: Joi.number().integer().min(0).required(),
    abstained: Joi.number().integer().min(0).required(),
    participation_rate: Joi.number().min(0).max(1).required()
  }).required(),

  progress: Joi.object({
    startTime: Joi.date().iso().required(),
    deadline: Joi.date().iso().required(),
    timeRemaining: Joi.number().integer().min(0),
    extended: Joi.boolean().default(false),
    extensions: Joi.number().integer().min(0).default(0)
  }).required(),

  quorum: Joi.object({
    met: Joi.boolean().required(),
    requirements: Joi.object({
      minParticipation: Joi.object({
        required: Joi.number(),
        current: Joi.number(),
        met: Joi.boolean()
      }),
      minAgents: Joi.object({
        required: Joi.number(),
        current: Joi.number(),
        met: Joi.boolean()
      })
    })
  }).required(),

  currentLeader: Joi.object({
    optionId: Joi.string(),
    votes: Joi.number(),
    percentage: Joi.number().min(0).max(1)
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Voting session status schema');

// ============== VOTING RESULTS SCHEMA ==============

/**
 * Schema for voting results
 */
export const votingResultsSchema = Joi.object({
  sessionId: sessionIdSchema.required(),

  summary: Joi.object({
    winner: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).required(),
    algorithm: Joi.string().valid(...VOTING_ALGORITHMS).required(),
    totalVotes: Joi.number().integer().min(0).required(),
    validVotes: Joi.number().integer().min(0).required(),
    invalidVotes: Joi.number().integer().min(0).required(),
    participationRate: Joi.number().min(0).max(1).required()
  }).required(),

  results: Joi.object({
    options: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      label: Joi.string().required(),
      votes: Joi.number().required(),
      percentage: Joi.number().min(0).max(1).required(),
      weightedScore: Joi.number(),
      rank: Joi.number().integer().min(1)
    })).required(),

    rounds: Joi.array().items(Joi.object({
      round: Joi.number().integer().min(1),
      eliminated: Joi.array().items(Joi.string()),
      redistributed: Joi.number(),
      leader: Joi.string()
    })),

    confidence: Joi.object({
      average: Joi.number().min(0).max(1),
      distribution: Joi.object()
    })
  }).required(),

  quorum: Joi.object({
    met: Joi.boolean().required(),
    details: Joi.object()
  }).required(),

  validation: Joi.object({
    verified: Joi.boolean().default(false),
    verifiedBy: Joi.string(),
    verificationMethod: Joi.string(),
    checksum: Joi.string().pattern(/^[a-f0-9]{64}$/)
  }),

  audit: Joi.object({
    trail: Joi.array().items(Joi.object({
      agentId: Joi.string(),
      voteHash: Joi.string(),
      timestamp: Joi.date().iso()
    })),
    anomalies: Joi.array().items(Joi.object({
      type: Joi.string(),
      description: Joi.string(),
      severity: Joi.string().valid('low', 'medium', 'high')
    }))
  }),

  metadata: Joi.object({
    calculatedBy: Joi.string().required(),
    calculationTime: Joi.number().integer().min(0),
    version: Joi.string()
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Voting results schema');

// ============== VOTE VERIFICATION SCHEMA ==============

/**
 * Schema for vote verification request
 */
export const voteVerificationSchema = Joi.object({
  sessionId: sessionIdSchema.required(),
  agentId: Joi.string().required(),

  verification: Joi.object({
    voteHash: Joi.string().pattern(/^[a-f0-9]{64}$/).required(),
    signature: Joi.string(),
    timestamp: Joi.date().iso()
  }).required(),

  requestedBy: Joi.string().required(),
  reason: Joi.string().max(500),
  timestamp: Joi.date().iso().default(Date.now)

}).description('Vote verification schema');

// ============== VALIDATION HELPERS ==============

/**
 * Validate voting eligibility
 */
export const validateVotingEligibility = (agent, session) => {
  const schema = Joi.object({
    agent: Joi.object({
      id: Joi.string().required(),
      capabilities: Joi.array().items(Joi.string()),
      reputation: Joi.number().min(0),
      role: Joi.string()
    }).required(),
    session: Joi.object({
      participants: Joi.object({
        allowList: Joi.array().items(Joi.string()),
        denyList: Joi.array().items(Joi.string()),
        requiredCapabilities: Joi.array().items(Joi.string()),
        minReputation: Joi.number()
      })
    }).required()
  });

  return schema.validate({ agent, session });
};

/**
 * Validate vote integrity
 */
export const validateVoteIntegrity = (vote) => {
  const schema = Joi.object({
    sessionId: sessionIdSchema.required(),
    agentId: Joi.string().required(),
    voteHash: Joi.string().pattern(/^[a-f0-9]{64}$/).required(),
    signature: Joi.string().when('$requireSignature', {
      is: true,
      then: Joi.required()
    })
  });

  return schema.validate(vote);
};

/**
 * Export all schemas
 */
export default {
  votingSessionCreationSchema,
  voteSubmissionSchema,
  voteUpdateSchema,
  votingSessionStatusSchema,
  votingResultsSchema,
  voteVerificationSchema,
  validateVotingEligibility,
  validateVoteIntegrity
};