/**
 * Message Validation Schemas
 *
 * Comprehensive validation for all message types in the system
 * including brainstorming, status updates, and inter-agent communication
 */

import Joi from 'joi';

// ============== CONSTANTS ==============
const MESSAGE_TYPES = [
  'task', 'brainstorm', 'voting', 'status', 'result',
  'heartbeat', 'command', 'notification', 'achievement', 'battle'
];

const MESSAGE_PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'];
const STATUS_EVENT_TYPES = [
  'agent.connected', 'agent.disconnected', 'agent.error',
  'task.started', 'task.completed', 'task.failed',
  'brainstorm.initiated', 'brainstorm.completed',
  'voting.started', 'voting.completed',
  'achievement.unlocked', 'battle.started', 'battle.completed'
];

// ============== BASE MESSAGE SCHEMA ==============

/**
 * Base message schema with common fields
 */
const baseMessageSchema = Joi.object({
  messageId: Joi.string().uuid().default(() => require('uuid').v4()),

  type: Joi.string()
    .valid(...MESSAGE_TYPES)
    .required()
    .description('Message type'),

  from: Joi.string()
    .required()
    .description('Sender identifier'),

  to: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string()).min(1)
  ).description('Recipient(s)'),

  timestamp: Joi.date().iso().default(Date.now),

  version: Joi.string()
    .pattern(/^\d+\.\d+\.\d+$/)
    .default('1.0.0')
    .description('Message format version'),

  correlationId: Joi.string()
    .uuid()
    .description('For tracking related messages'),

  replyTo: Joi.string()
    .description('Queue/exchange for replies'),

  priority: Joi.string()
    .valid(...MESSAGE_PRIORITIES)
    .default('normal'),

  ttl: Joi.number()
    .integer()
    .min(0)
    .max(3600000)
    .description('Time to live in milliseconds'),

  headers: Joi.object()
    .pattern(Joi.string(), Joi.any())
    .description('Additional headers')
});

// ============== BRAINSTORM MESSAGE SCHEMA ==============

/**
 * Schema for brainstorm messages
 */
export const brainstormMessageSchema = baseMessageSchema.keys({
  type: Joi.string().valid('brainstorm').required(),

  payload: Joi.object({
    sessionId: Joi.string().uuid().required(),

    action: Joi.string()
      .valid('initiate', 'respond', 'update', 'complete', 'cancel')
      .required(),

    // For initiate action
    initiation: Joi.when('action', {
      is: 'initiate',
      then: Joi.object({
        topic: Joi.string().min(5).max(500).required(),
        question: Joi.string().min(10).max(1000).required(),
        context: Joi.string().max(5000),
        requiredAgents: Joi.array().items(Joi.string()),
        minResponses: Joi.number().integer().min(1).default(2),
        maxResponses: Joi.number().integer().min(1).default(100),
        timeout: Joi.number().integer().min(1000).max(300000).default(60000),
        allowLateJoin: Joi.boolean().default(true)
      }).required(),
      otherwise: Joi.forbidden()
    }),

    // For respond action
    response: Joi.when('action', {
      is: 'respond',
      then: Joi.object({
        suggestion: Joi.string().min(10).max(5000).required(),
        confidence: Joi.number().min(0).max(1).default(1),
        reasoning: Joi.string().max(2000),
        references: Joi.array().items(Joi.string().uri()),
        supportingData: Joi.object(),
        alternatives: Joi.array().items(Joi.string().max(1000)).max(5)
      }).required(),
      otherwise: Joi.forbidden()
    }),

    // For update action
    update: Joi.when('action', {
      is: 'update',
      then: Joi.object({
        status: Joi.string().valid('active', 'paused', 'resuming'),
        participantCount: Joi.number().integer().min(0),
        responseCount: Joi.number().integer().min(0),
        timeRemaining: Joi.number().integer().min(0)
      }).required(),
      otherwise: Joi.forbidden()
    }),

    // For complete action
    completion: Joi.when('action', {
      is: 'complete',
      then: Joi.object({
        summary: Joi.string().max(5000).required(),
        consensus: Joi.string().max(2000),
        topSuggestions: Joi.array().items(Joi.object({
          suggestion: Joi.string().required(),
          supportCount: Joi.number().integer().min(0),
          averageConfidence: Joi.number().min(0).max(1)
        })).max(10),
        participantCount: Joi.number().integer().min(0).required(),
        duration: Joi.number().integer().min(0).required()
      }).required(),
      otherwise: Joi.forbidden()
    })
  }).required()

}).description('Brainstorm message schema');

// ============== STATUS MESSAGE SCHEMA ==============

/**
 * Schema for status messages
 */
export const statusMessageSchema = baseMessageSchema.keys({
  type: Joi.string().valid('status').required(),

  payload: Joi.object({
    event: Joi.string()
      .valid(...STATUS_EVENT_TYPES)
      .required()
      .description('Status event type'),

    source: Joi.string()
      .required()
      .description('Event source'),

    // Agent status
    agentStatus: Joi.when('event', {
      is: Joi.string().pattern(/^agent\./),
      then: Joi.object({
        agentId: Joi.string().required(),
        state: Joi.string().required(),
        health: Joi.string().valid('healthy', 'degraded', 'unhealthy'),
        resources: Joi.object({
          cpu: Joi.number().min(0).max(100),
          memory: Joi.number().min(0).max(100),
          activeTasks: Joi.number().integer().min(0)
        }),
        error: Joi.object({
          code: Joi.string(),
          message: Joi.string(),
          recoverable: Joi.boolean()
        })
      }),
      otherwise: Joi.forbidden()
    }),

    // Task status
    taskStatus: Joi.when('event', {
      is: Joi.string().pattern(/^task\./),
      then: Joi.object({
        taskId: Joi.string().required(),
        title: Joi.string(),
        progress: Joi.number().min(0).max(100),
        agentId: Joi.string(),
        duration: Joi.number().integer().min(0),
        error: Joi.object({
          code: Joi.string(),
          message: Joi.string(),
          stack: Joi.string()
        })
      }),
      otherwise: Joi.forbidden()
    }),

    // Achievement status
    achievementStatus: Joi.when('event', {
      is: 'achievement.unlocked',
      then: Joi.object({
        agentId: Joi.string().required(),
        achievementId: Joi.string().required(),
        name: Joi.string().required(),
        category: Joi.string(),
        points: Joi.number().integer().min(0),
        tier: Joi.string().valid('bronze', 'silver', 'gold', 'platinum', 'diamond')
      }),
      otherwise: Joi.forbidden()
    }),

    metadata: Joi.object()
      .pattern(Joi.string(), Joi.any())
      .description('Additional event metadata')

  }).required()

}).description('Status message schema');

// ============== RESULT MESSAGE SCHEMA ==============

/**
 * Schema for result messages
 */
export const resultMessageSchema = baseMessageSchema.keys({
  type: Joi.string().valid('result').required(),

  payload: Joi.object({
    taskId: Joi.string().required(),

    status: Joi.string()
      .valid('completed', 'failed', 'partial')
      .required(),

    output: Joi.alternatives().try(
      Joi.object(),
      Joi.array(),
      Joi.string(),
      Joi.number(),
      Joi.boolean()
    ),

    execution: Joi.object({
      startTime: Joi.date().iso().required(),
      endTime: Joi.date().iso().required(),
      duration: Joi.number().integer().min(0).required(),
      processedBy: Joi.string().required()
    }).required(),

    quality: Joi.object({
      score: Joi.number().min(0).max(100),
      validated: Joi.boolean(),
      validator: Joi.string()
    }),

    error: Joi.when('status', {
      is: 'failed',
      then: Joi.object({
        code: Joi.string().required(),
        message: Joi.string().required(),
        details: Joi.object(),
        recoverable: Joi.boolean()
      }),
      otherwise: Joi.forbidden()
    })

  }).required()

}).description('Result message schema');

// ============== COMMAND MESSAGE SCHEMA ==============

/**
 * Schema for command messages
 */
export const commandMessageSchema = baseMessageSchema.keys({
  type: Joi.string().valid('command').required(),

  payload: Joi.object({
    command: Joi.string()
      .valid('start', 'stop', 'pause', 'resume', 'restart', 'configure', 'diagnose', 'migrate')
      .required(),

    target: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string()).min(1)
    ).required(),

    parameters: Joi.object()
      .pattern(Joi.string(), Joi.any()),

    options: Joi.object({
      force: Joi.boolean().default(false),
      graceful: Joi.boolean().default(true),
      timeout: Joi.number().integer().min(0),
      validateOnly: Joi.boolean().default(false),
      async: Joi.boolean().default(false)
    }),

    authorization: Joi.object({
      user: Joi.string().required(),
      role: Joi.string(),
      token: Joi.string(),
      signature: Joi.string()
    })

  }).required(),

  requiresAck: Joi.boolean().default(true)

}).description('Command message schema');

// ============== HEARTBEAT MESSAGE SCHEMA ==============

/**
 * Schema for heartbeat messages
 */
export const heartbeatMessageSchema = Joi.object({
  messageId: Joi.string().uuid().default(() => require('uuid').v4()),
  type: Joi.string().valid('heartbeat').required(),
  from: Joi.string().required(),

  payload: Joi.object({
    sequence: Joi.number().integer().min(0).required(),
    uptime: Joi.number().integer().min(0).required(),

    status: Joi.object({
      state: Joi.string().required(),
      health: Joi.string().valid('healthy', 'degraded', 'unhealthy').required()
    }).required(),

    metrics: Joi.object({
      activeTasks: Joi.number().integer().min(0),
      queueSize: Joi.number().integer().min(0),
      cpuUsage: Joi.number().min(0).max(100),
      memoryUsage: Joi.number().min(0).max(100),
      lastActivity: Joi.date().iso()
    })
  }).required(),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Heartbeat message schema');

// ============== NOTIFICATION MESSAGE SCHEMA ==============

/**
 * Schema for notification messages
 */
export const notificationMessageSchema = baseMessageSchema.keys({
  type: Joi.string().valid('notification').required(),

  payload: Joi.object({
    level: Joi.string()
      .valid('info', 'warning', 'error', 'critical')
      .required(),

    category: Joi.string()
      .valid('system', 'task', 'agent', 'security', 'performance', 'achievement')
      .required(),

    title: Joi.string()
      .max(200)
      .required(),

    message: Joi.string()
      .max(5000)
      .required(),

    details: Joi.object(),

    actions: Joi.array().items(Joi.object({
      label: Joi.string().required(),
      action: Joi.string().required(),
      parameters: Joi.object()
    })),

    persistent: Joi.boolean().default(false),

    dismissible: Joi.boolean().default(true),

    expiresAt: Joi.date().iso()

  }).required()

}).description('Notification message schema');

// ============== MESSAGE VALIDATION HELPERS ==============

/**
 * Validate message routing
 */
export const validateMessageRouting = (message) => {
  const schema = Joi.object({
    exchange: Joi.string().max(255).required(),
    routingKey: Joi.string().max(255).required(),
    queue: Joi.string().max(255),
    mandatory: Joi.boolean().default(false),
    persistent: Joi.boolean().default(true),
    expiration: Joi.number().integer().min(0)
  });

  return schema.validate(message);
};

/**
 * Validate message batch
 */
export const validateMessageBatch = (messages) => {
  const schema = Joi.array()
    .items(
      brainstormMessageSchema,
      statusMessageSchema,
      resultMessageSchema,
      commandMessageSchema,
      heartbeatMessageSchema,
      notificationMessageSchema
    )
    .min(1)
    .max(1000);

  return schema.validate(messages);
};

/**
 * Generic message validator
 */
export const validateMessage = (message) => {
  // Determine message type and validate accordingly
  const messageType = message.type;

  const schemas = {
    'brainstorm': brainstormMessageSchema,
    'status': statusMessageSchema,
    'result': resultMessageSchema,
    'command': commandMessageSchema,
    'heartbeat': heartbeatMessageSchema,
    'notification': notificationMessageSchema
  };

  const schema = schemas[messageType];
  if (!schema) {
    return {
      error: {
        message: `Unknown message type: ${messageType}`,
        type: 'validation_error'
      }
    };
  }

  return schema.validate(message, {
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Export all schemas
 */
export default {
  baseMessageSchema,
  brainstormMessageSchema,
  statusMessageSchema,
  resultMessageSchema,
  commandMessageSchema,
  heartbeatMessageSchema,
  notificationMessageSchema,
  validateMessageRouting,
  validateMessageBatch,
  validateMessage
};