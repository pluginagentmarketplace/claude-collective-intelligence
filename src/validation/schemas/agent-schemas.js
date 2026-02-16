/**
 * Agent Validation Schemas
 *
 * Comprehensive validation schemas for all agent-related operations
 * including creation, updates, status changes, and authentication
 */

import Joi from 'joi';

// ============== CONSTANTS ==============
const AGENT_ROLES = ['leader', 'worker', 'observer', 'coordinator', 'analyzer'];
const AGENT_STATES = ['idle', 'busy', 'offline', 'error', 'maintenance'];
const AGENT_CAPABILITIES = [
  'compute', 'analyze', 'generate', 'review', 'coordinate',
  'monitor', 'report', 'validate', 'transform', 'aggregate'
];

// ============== BASE SCHEMAS ==============

/**
 * Base agent identifier schema
 */
const agentIdSchema = Joi.string()
  .pattern(/^agent-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)
  .description('Agent unique identifier');

/**
 * Agent name schema with strict rules
 */
const agentNameSchema = Joi.string()
  .min(3)
  .max(50)
  .pattern(/^[a-zA-Z0-9][-_a-zA-Z0-9]*$/)
  .message('Agent name must start with alphanumeric and contain only letters, numbers, hyphens, and underscores')
  .description('Agent display name');

/**
 * Resource allocation schema
 */
const resourceSchema = Joi.object({
  cpu: Joi.number().min(0).max(100).description('CPU allocation percentage'),
  memory: Joi.number().min(0).max(100).description('Memory allocation percentage'),
  network: Joi.number().min(0).max(1000).description('Network bandwidth in Mbps'),
  storage: Joi.number().min(0).max(10000).description('Storage allocation in MB')
}).description('Resource allocation configuration');

// ============== AGENT CREATION SCHEMA ==============

/**
 * Schema for agent creation request
 */
export const agentCreationSchema = Joi.object({
  // Required fields
  name: agentNameSchema.required(),

  role: Joi.string()
    .valid(...AGENT_ROLES)
    .required()
    .description('Agent role in the system'),

  // Optional fields with defaults
  capabilities: Joi.array()
    .items(Joi.string().valid(...AGENT_CAPABILITIES))
    .min(1)
    .max(10)
    .unique()
    .default(['compute', 'analyze'])
    .description('Agent capabilities'),

  resources: resourceSchema.default({
    cpu: 10,
    memory: 10,
    network: 100,
    storage: 100
  }),

  metadata: Joi.object({
    description: Joi.string().max(500).description('Agent description'),
    tags: Joi.array().items(Joi.string().max(30)).max(10).description('Agent tags'),
    owner: Joi.string().email().description('Owner email'),
    team: Joi.string().max(50).description('Team assignment'),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).description('Agent version')
  }).default({}),

  config: Joi.object({
    autoStart: Joi.boolean().default(true),
    maxConcurrentTasks: Joi.number().integer().min(1).max(100).default(5),
    taskTimeout: Joi.number().integer().min(1000).max(3600000).default(60000),
    retryPolicy: Joi.object({
      maxRetries: Joi.number().integer().min(0).max(10).default(3),
      retryDelay: Joi.number().integer().min(100).max(60000).default(1000),
      backoffMultiplier: Joi.number().min(1).max(5).default(2)
    }).default(),
    heartbeatInterval: Joi.number().integer().min(1000).max(60000).default(5000)
  }).default(),

  security: Joi.object({
    requireAuth: Joi.boolean().default(true),
    allowedIPs: Joi.array().items(
      Joi.string().ip({ version: ['ipv4', 'ipv6'] })
    ).default([]),
    permissions: Joi.array().items(Joi.string()).default(['read', 'write']),
    apiKey: Joi.string().min(32).max(128).description('API key for authentication')
  }).default()

}).description('Agent creation request schema');

// ============== AGENT UPDATE SCHEMA ==============

/**
 * Schema for agent update request
 */
export const agentUpdateSchema = Joi.object({
  agentId: agentIdSchema.required(),

  updates: Joi.object({
    name: agentNameSchema,
    role: Joi.string().valid(...AGENT_ROLES),
    state: Joi.string().valid(...AGENT_STATES),
    capabilities: Joi.array().items(Joi.string().valid(...AGENT_CAPABILITIES)).min(1).unique(),
    resources: resourceSchema,
    metadata: Joi.object({
      description: Joi.string().max(500),
      tags: Joi.array().items(Joi.string().max(30)).max(10),
      owner: Joi.string().email(),
      team: Joi.string().max(50),
      version: Joi.string().pattern(/^\d+\.\d+\.\d+$/)
    }),
    config: Joi.object({
      autoStart: Joi.boolean(),
      maxConcurrentTasks: Joi.number().integer().min(1).max(100),
      taskTimeout: Joi.number().integer().min(1000).max(3600000),
      retryPolicy: Joi.object({
        maxRetries: Joi.number().integer().min(0).max(10),
        retryDelay: Joi.number().integer().min(100).max(60000),
        backoffMultiplier: Joi.number().min(1).max(5)
      }),
      heartbeatInterval: Joi.number().integer().min(1000).max(60000)
    })
  }).min(1).required(),

  reason: Joi.string().max(500).description('Reason for update'),
  updatedBy: Joi.string().required().description('User or system making the update'),
  timestamp: Joi.date().iso().default(Date.now)

}).description('Agent update request schema');

// ============== AGENT STATUS SCHEMA ==============

/**
 * Schema for agent status message
 */
export const agentStatusSchema = Joi.object({
  agentId: agentIdSchema.required(),
  state: Joi.string().valid(...AGENT_STATES).required(),

  health: Joi.object({
    status: Joi.string().valid('healthy', 'degraded', 'unhealthy').required(),
    checks: Joi.object({
      cpu: Joi.boolean().required(),
      memory: Joi.boolean().required(),
      network: Joi.boolean().required(),
      heartbeat: Joi.boolean().required()
    }).required(),
    lastCheck: Joi.date().iso().required()
  }).required(),

  metrics: Joi.object({
    cpuUsage: Joi.number().min(0).max(100).required(),
    memoryUsage: Joi.number().min(0).max(100).required(),
    activeTasks: Joi.number().integer().min(0).required(),
    completedTasks: Joi.number().integer().min(0).required(),
    failedTasks: Joi.number().integer().min(0).required(),
    uptime: Joi.number().integer().min(0).description('Uptime in seconds'),
    lastActivity: Joi.date().iso()
  }).required(),

  location: Joi.object({
    hostname: Joi.string().hostname(),
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }),
    region: Joi.string(),
    zone: Joi.string()
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Agent status message schema');

// ============== AGENT AUTHENTICATION SCHEMA ==============

/**
 * Schema for agent authentication request
 */
export const agentAuthSchema = Joi.object({
  agentId: agentIdSchema.required(),

  credentials: Joi.alternatives().try(
    // API Key authentication
    Joi.object({
      type: Joi.string().valid('apiKey').required(),
      apiKey: Joi.string().min(32).max(128).required()
    }),

    // Token authentication
    Joi.object({
      type: Joi.string().valid('token').required(),
      token: Joi.string().min(50).max(500).required()
    }),

    // Certificate authentication
    Joi.object({
      type: Joi.string().valid('certificate').required(),
      certificate: Joi.string().required(),
      privateKey: Joi.string()
    })
  ).required(),

  metadata: Joi.object({
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }),
    userAgent: Joi.string().max(500),
    requestId: Joi.string().uuid()
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Agent authentication request schema');

// ============== AGENT COMMUNICATION SCHEMA ==============

/**
 * Schema for inter-agent communication
 */
export const agentCommunicationSchema = Joi.object({
  from: agentIdSchema.required(),
  to: Joi.alternatives().try(
    agentIdSchema,
    Joi.array().items(agentIdSchema).min(1).max(100)
  ).required(),

  message: Joi.object({
    type: Joi.string()
      .valid('request', 'response', 'notification', 'broadcast', 'command')
      .required(),

    action: Joi.string().max(100).required(),

    payload: Joi.alternatives().try(
      Joi.object(),
      Joi.array(),
      Joi.string(),
      Joi.number(),
      Joi.boolean()
    ).required(),

    priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),

    ttl: Joi.number().integer().min(0).max(3600000).description('Time to live in ms'),

    requiresAck: Joi.boolean().default(false),

    correlationId: Joi.string().uuid(),

    replyTo: Joi.string().description('Reply queue or exchange')
  }).required(),

  routing: Joi.object({
    exchange: Joi.string().max(100),
    routingKey: Joi.string().max(100),
    queue: Joi.string().max(100)
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Inter-agent communication schema');

// ============== AGENT HEARTBEAT SCHEMA ==============

/**
 * Schema for agent heartbeat message
 */
export const agentHeartbeatSchema = Joi.object({
  agentId: agentIdSchema.required(),

  sequence: Joi.number().integer().min(0).required(),

  status: Joi.object({
    state: Joi.string().valid(...AGENT_STATES).required(),
    activeTasks: Joi.number().integer().min(0).required(),
    queueSize: Joi.number().integer().min(0).required()
  }).required(),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Agent heartbeat message schema');

// ============== VALIDATION HELPERS ==============

/**
 * Custom validator for agent readiness
 */
export const validateAgentReadiness = (agent) => {
  const schema = Joi.object({
    agentId: agentIdSchema.required(),
    state: Joi.string().valid('idle', 'busy').required(),
    health: Joi.object({
      status: Joi.string().valid('healthy').required()
    }).required(),
    metrics: Joi.object({
      activeTasks: Joi.number().integer().max(10).required()
    }).required()
  });

  return schema.validate(agent);
};

/**
 * Batch validation for multiple agents
 */
export const validateAgentBatch = (agents) => {
  const schema = Joi.array()
    .items(agentCreationSchema)
    .min(1)
    .max(100)
    .unique('name');

  return schema.validate(agents);
};

/**
 * Export all schemas
 */
export default {
  agentCreationSchema,
  agentUpdateSchema,
  agentStatusSchema,
  agentAuthSchema,
  agentCommunicationSchema,
  agentHeartbeatSchema,
  validateAgentReadiness,
  validateAgentBatch
};