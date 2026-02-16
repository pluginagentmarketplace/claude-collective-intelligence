/**
 * Task Validation Schemas
 *
 * Comprehensive validation schemas for task management including
 * submission, updates, assignments, and results
 */

import Joi from 'joi';

// ============== CONSTANTS ==============
const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'];
const TASK_STATES = ['pending', 'queued', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled'];
const TASK_TYPES = [
  'compute', 'analyze', 'generate', 'transform',
  'validate', 'aggregate', 'report', 'monitor'
];
const TASK_CATEGORIES = [
  'data_processing', 'machine_learning', 'optimization',
  'simulation', 'reporting', 'maintenance', 'testing'
];

// ============== BASE SCHEMAS ==============

/**
 * Task ID schema
 */
const taskIdSchema = Joi.string()
  .pattern(/^task-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)
  .description('Task unique identifier');

/**
 * Task title schema
 */
const taskTitleSchema = Joi.string()
  .min(5)
  .max(200)
  .pattern(/^[a-zA-Z0-9][\w\s\-.,!?]*$/)
  .message('Task title must start with alphanumeric character')
  .description('Task title');

/**
 * Resource requirements schema
 */
const resourceRequirementsSchema = Joi.object({
  cpu: Joi.object({
    min: Joi.number().min(0).max(100),
    preferred: Joi.number().min(0).max(100),
    max: Joi.number().min(0).max(100)
  }).custom((value, helpers) => {
    if (value.min > value.preferred || value.preferred > value.max) {
      return helpers.error('resources.invalid_range');
    }
    return value;
  }),
  memory: Joi.object({
    min: Joi.number().integer().min(0),
    preferred: Joi.number().integer().min(0),
    max: Joi.number().integer().min(0)
  }),
  gpu: Joi.boolean().default(false),
  network: Joi.number().min(0).max(10000),
  storage: Joi.number().min(0)
}).description('Resource requirements');

// ============== TASK SUBMISSION SCHEMA ==============

/**
 * Schema for task submission
 */
export const taskSubmissionSchema = Joi.object({
  // Required fields
  title: taskTitleSchema.required(),

  type: Joi.string()
    .valid(...TASK_TYPES)
    .required()
    .description('Task type'),

  priority: Joi.string()
    .valid(...TASK_PRIORITIES)
    .default('normal')
    .description('Task priority'),

  // Task details
  description: Joi.string()
    .max(2000)
    .required()
    .description('Detailed task description'),

  category: Joi.string()
    .valid(...TASK_CATEGORIES)
    .description('Task category'),

  // Input data
  input: Joi.alternatives().try(
    Joi.object(),
    Joi.array(),
    Joi.string()
  ).description('Task input data'),

  // Configuration
  config: Joi.object({
    timeout: Joi.number()
      .integer()
      .min(1000)
      .max(3600000)
      .default(300000)
      .description('Task timeout in milliseconds'),

    retryCount: Joi.number()
      .integer()
      .min(0)
      .max(10)
      .default(3)
      .description('Number of retry attempts'),

    retryDelay: Joi.number()
      .integer()
      .min(100)
      .max(60000)
      .default(5000)
      .description('Delay between retries'),

    parallelizable: Joi.boolean()
      .default(false)
      .description('Can be split for parallel processing'),

    checkpointable: Joi.boolean()
      .default(false)
      .description('Supports checkpointing'),

    preemptible: Joi.boolean()
      .default(true)
      .description('Can be preempted by higher priority tasks')
  }).default(),

  // Requirements
  requirements: Joi.object({
    resources: resourceRequirementsSchema,

    agents: Joi.object({
      min: Joi.number().integer().min(1).default(1),
      max: Joi.number().integer().min(1).default(10),
      preferred: Joi.array().items(Joi.string()),
      capabilities: Joi.array().items(Joi.string())
    }),

    dependencies: Joi.array()
      .items(taskIdSchema)
      .description('Task dependencies'),

    environment: Joi.object()
      .pattern(Joi.string(), Joi.string())
      .description('Environment variables')
  }).default(),

  // Scheduling
  scheduling: Joi.object({
    startAfter: Joi.date().iso().min('now'),
    deadline: Joi.date().iso().min(Joi.ref('startAfter')),
    estimatedDuration: Joi.number().integer().min(0),
    cron: Joi.string().pattern(/^[\d\s\*\/\-,]+$/),
    timezone: Joi.string().default('UTC')
  }),

  // Collaboration
  collaboration: Joi.object({
    required: Joi.boolean().default(false),
    topic: Joi.string().max(200),
    question: Joi.string().max(500),
    minParticipants: Joi.number().integer().min(2).default(2),
    maxParticipants: Joi.number().integer().min(2).default(10),
    timeout: Joi.number().integer().min(1000).max(300000).default(60000)
  }),

  // Metadata
  metadata: Joi.object({
    tags: Joi.array().items(Joi.string().max(30)).max(20),
    labels: Joi.object().pattern(Joi.string(), Joi.string()),
    submittedBy: Joi.string().required(),
    project: Joi.string().max(100),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/),
    tracking: Joi.object({
      jiraId: Joi.string(),
      githubIssue: Joi.string(),
      customId: Joi.string()
    })
  }).default(),

  // Output configuration
  output: Joi.object({
    format: Joi.string().valid('json', 'xml', 'csv', 'binary', 'text').default('json'),
    compression: Joi.string().valid('none', 'gzip', 'zip', 'brotli').default('none'),
    encryption: Joi.boolean().default(false),
    destination: Joi.string().uri()
  }),

  // Notification settings
  notifications: Joi.object({
    onStart: Joi.array().items(Joi.string().email()),
    onComplete: Joi.array().items(Joi.string().email()),
    onFailure: Joi.array().items(Joi.string().email()),
    webhooks: Joi.array().items(Joi.string().uri())
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Task submission schema');

// ============== TASK UPDATE SCHEMA ==============

/**
 * Schema for task updates
 */
export const taskUpdateSchema = Joi.object({
  taskId: taskIdSchema.required(),

  updates: Joi.object({
    state: Joi.string().valid(...TASK_STATES),
    priority: Joi.string().valid(...TASK_PRIORITIES),
    progress: Joi.number().min(0).max(100),

    assignedTo: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ),

    config: Joi.object({
      timeout: Joi.number().integer().min(1000).max(3600000),
      retryCount: Joi.number().integer().min(0).max(10),
      parallelizable: Joi.boolean(),
      preemptible: Joi.boolean()
    }),

    scheduling: Joi.object({
      startAfter: Joi.date().iso(),
      deadline: Joi.date().iso(),
      estimatedDuration: Joi.number().integer().min(0)
    }),

    metadata: Joi.object({
      tags: Joi.array().items(Joi.string().max(30)).max(20),
      labels: Joi.object().pattern(Joi.string(), Joi.string()),
      notes: Joi.string().max(1000)
    }),

    checkpoint: Joi.object({
      state: Joi.any(),
      progress: Joi.number().min(0).max(100),
      timestamp: Joi.date().iso()
    })
  }).min(1).required(),

  reason: Joi.string().max(500).required(),
  updatedBy: Joi.string().required(),
  timestamp: Joi.date().iso().default(Date.now)

}).description('Task update schema');

// ============== TASK RESULT SCHEMA ==============

/**
 * Schema for task results
 */
export const taskResultSchema = Joi.object({
  taskId: taskIdSchema.required(),

  status: Joi.string()
    .valid('completed', 'failed', 'partial')
    .required(),

  result: Joi.object({
    output: Joi.alternatives().try(
      Joi.object(),
      Joi.array(),
      Joi.string(),
      Joi.binary()
    ),

    format: Joi.string()
      .valid('json', 'xml', 'csv', 'binary', 'text')
      .required(),

    size: Joi.number()
      .integer()
      .min(0)
      .description('Output size in bytes'),

    checksum: Joi.string()
      .pattern(/^[a-f0-9]{64}$/)
      .description('SHA256 checksum'),

    location: Joi.string()
      .uri()
      .description('Storage location for large outputs')
  }).required(),

  execution: Joi.object({
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required(),
    duration: Joi.number().integer().min(0).required(),
    attempts: Joi.number().integer().min(1).required(),

    resources: Joi.object({
      cpuTime: Joi.number().min(0),
      memoryPeak: Joi.number().integer().min(0),
      networkIn: Joi.number().integer().min(0),
      networkOut: Joi.number().integer().min(0)
    }),

    agents: Joi.array().items(Joi.object({
      agentId: Joi.string().required(),
      role: Joi.string(),
      contribution: Joi.number().min(0).max(100)
    }))
  }).required(),

  quality: Joi.object({
    score: Joi.number().min(0).max(100),
    confidence: Joi.number().min(0).max(1),
    validated: Joi.boolean().default(false),
    validator: Joi.string()
  }),

  errors: Joi.array().items(Joi.object({
    code: Joi.string().required(),
    message: Joi.string().required(),
    details: Joi.object(),
    timestamp: Joi.date().iso(),
    recoverable: Joi.boolean()
  })),

  artifacts: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    type: Joi.string().required(),
    size: Joi.number().integer().min(0),
    location: Joi.string().uri(),
    checksum: Joi.string()
  })),

  metadata: Joi.object({
    processedBy: Joi.string().required(),
    version: Joi.string(),
    notes: Joi.string().max(1000),
    tags: Joi.array().items(Joi.string())
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Task result schema');

// ============== TASK ASSIGNMENT SCHEMA ==============

/**
 * Schema for task assignment
 */
export const taskAssignmentSchema = Joi.object({
  taskId: taskIdSchema.required(),

  assignment: Joi.object({
    agentId: Joi.alternatives().try(
      Joi.string().required(),
      Joi.array().items(Joi.string()).min(1).required()
    ),

    strategy: Joi.string()
      .valid('round_robin', 'least_loaded', 'capability_match', 'priority_based', 'manual')
      .default('capability_match'),

    constraints: Joi.object({
      maxExecutionTime: Joi.number().integer().min(1000),
      requiredCapabilities: Joi.array().items(Joi.string()),
      preferredAgents: Joi.array().items(Joi.string()),
      excludeAgents: Joi.array().items(Joi.string()),
      location: Joi.string()
    }),

    priority: Joi.number().integer().min(0).max(1000).default(500),

    queuePosition: Joi.number().integer().min(0)
  }).required(),

  assignedBy: Joi.string().required(),
  reason: Joi.string().max(500),
  timestamp: Joi.date().iso().default(Date.now)

}).description('Task assignment schema');

// ============== TASK CANCELLATION SCHEMA ==============

/**
 * Schema for task cancellation
 */
export const taskCancellationSchema = Joi.object({
  taskId: taskIdSchema.required(),

  cancellation: Joi.object({
    reason: Joi.string()
      .valid('user_request', 'timeout', 'resource_limit', 'dependency_failed', 'system_shutdown', 'other')
      .required(),

    details: Joi.string().max(1000),

    graceful: Joi.boolean().default(true),

    saveCheckpoint: Joi.boolean().default(true),

    notifyAgents: Joi.boolean().default(true)
  }).required(),

  cancelledBy: Joi.string().required(),
  timestamp: Joi.date().iso().default(Date.now)

}).description('Task cancellation schema');

// ============== BATCH OPERATIONS SCHEMA ==============

/**
 * Schema for batch task operations
 */
export const batchTaskSchema = Joi.object({
  operation: Joi.string()
    .valid('submit', 'update', 'cancel', 'query')
    .required(),

  tasks: Joi.array()
    .items(Joi.alternatives().try(
      taskSubmissionSchema,
      taskUpdateSchema,
      taskIdSchema
    ))
    .min(1)
    .max(1000)
    .required(),

  options: Joi.object({
    parallel: Joi.boolean().default(true),
    stopOnError: Joi.boolean().default(false),
    validateOnly: Joi.boolean().default(false),
    dryRun: Joi.boolean().default(false)
  }),

  metadata: Joi.object({
    batchId: Joi.string().uuid(),
    source: Joi.string(),
    user: Joi.string().required()
  }),

  timestamp: Joi.date().iso().default(Date.now)

}).description('Batch task operations schema');

// ============== VALIDATION HELPERS ==============

/**
 * Validate task readiness for execution
 */
export const validateTaskReadiness = (task) => {
  const schema = Joi.object({
    taskId: taskIdSchema.required(),
    state: Joi.string().valid('queued', 'assigned').required(),
    priority: Joi.string().valid(...TASK_PRIORITIES).required(),
    requirements: Joi.object({
      resources: Joi.object().required(),
      agents: Joi.object().required()
    }).required()
  });

  return schema.validate(task);
};

/**
 * Validate task completion
 */
export const validateTaskCompletion = (result) => {
  const schema = taskResultSchema.append({
    status: Joi.string().valid('completed').required(),
    result: Joi.object({
      output: Joi.required()
    }).required()
  });

  return schema.validate(result);
};

/**
 * Export all schemas
 */
export default {
  taskSubmissionSchema,
  taskUpdateSchema,
  taskResultSchema,
  taskAssignmentSchema,
  taskCancellationSchema,
  batchTaskSchema,
  validateTaskReadiness,
  validateTaskCompletion
};