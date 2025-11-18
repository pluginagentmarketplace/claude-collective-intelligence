/**
 * Central Schema Registry
 *
 * Exports all validation schemas and helpers for easy access
 * Provides schema versioning and compatibility management
 */

import agentSchemas from './agent-schemas.js';
import taskSchemas from './task-schemas.js';
import votingSchemas from './voting-schemas.js';
import messageSchemas from './message-schemas.js';
import achievementSchemas from './achievement-schemas.js';

// Re-export all schemas for convenience
export * from './agent-schemas.js';
export * from './task-schemas.js';
export * from './voting-schemas.js';
export * from './message-schemas.js';
export * from './achievement-schemas.js';

/**
 * Schema version registry for backward compatibility
 */
export const SCHEMA_VERSIONS = {
  current: '1.0.0',
  supported: ['1.0.0', '0.9.0'],
  deprecated: ['0.8.0'],

  changes: {
    '1.0.0': 'Initial production release with comprehensive validation',
    '0.9.0': 'Beta version with basic validation',
    '0.8.0': 'Alpha version - deprecated'
  }
};

/**
 * Master schema registry
 * Maps message types to their validation schemas
 */
export const SCHEMA_REGISTRY = {
  // Agent schemas
  'agent.create': agentSchemas.agentCreationSchema,
  'agent.update': agentSchemas.agentUpdateSchema,
  'agent.status': agentSchemas.agentStatusSchema,
  'agent.auth': agentSchemas.agentAuthSchema,
  'agent.communication': agentSchemas.agentCommunicationSchema,
  'agent.heartbeat': agentSchemas.agentHeartbeatSchema,

  // Task schemas
  'task.submit': taskSchemas.taskSubmissionSchema,
  'task.update': taskSchemas.taskUpdateSchema,
  'task.result': taskSchemas.taskResultSchema,
  'task.assign': taskSchemas.taskAssignmentSchema,
  'task.cancel': taskSchemas.taskCancellationSchema,
  'task.batch': taskSchemas.batchTaskSchema,

  // Voting schemas
  'voting.create': votingSchemas.votingSessionCreationSchema,
  'voting.submit': votingSchemas.voteSubmissionSchema,
  'voting.update': votingSchemas.voteUpdateSchema,
  'voting.status': votingSchemas.votingSessionStatusSchema,
  'voting.results': votingSchemas.votingResultsSchema,
  'voting.verify': votingSchemas.voteVerificationSchema,

  // Message schemas
  'message.brainstorm': messageSchemas.brainstormMessageSchema,
  'message.status': messageSchemas.statusMessageSchema,
  'message.result': messageSchemas.resultMessageSchema,
  'message.command': messageSchemas.commandMessageSchema,
  'message.heartbeat': messageSchemas.heartbeatMessageSchema,
  'message.notification': messageSchemas.notificationMessageSchema,

  // Achievement schemas
  'achievement.claim': achievementSchemas.achievementClaimSchema,
  'achievement.verify': achievementSchemas.achievementVerificationSchema,
  'points.transaction': achievementSchemas.pointsTransactionSchema,
  'battle.action': achievementSchemas.battleActionSchema,
  'leaderboard.update': achievementSchemas.leaderboardUpdateSchema,
  'reputation.update': achievementSchemas.reputationUpdateSchema,
  'tier.progression': achievementSchemas.tierProgressionSchema
};

/**
 * Get schema by type
 * @param {string} type - The message/operation type
 * @param {string} version - Schema version (optional)
 * @returns {Object} The corresponding Joi schema
 */
export function getSchema(type, version = SCHEMA_VERSIONS.current) {
  // Check version compatibility
  if (!SCHEMA_VERSIONS.supported.includes(version)) {
    throw new Error(`Schema version ${version} is not supported`);
  }

  const schema = SCHEMA_REGISTRY[type];
  if (!schema) {
    throw new Error(`No schema found for type: ${type}`);
  }

  return schema;
}

/**
 * Validate data against a schema type
 * @param {string} type - The message/operation type
 * @param {Object} data - Data to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateByType(type, data, options = {}) {
  const schema = getSchema(type, options.version);

  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true,
    presence: 'required',
    ...options
  };

  return schema.validate(data, defaultOptions);
}

/**
 * Batch validate multiple items
 * @param {Array} items - Array of { type, data } objects
 * @param {Object} options - Validation options
 * @returns {Array} Array of validation results
 */
export function batchValidate(items, options = {}) {
  return items.map(item => ({
    ...item,
    validation: validateByType(item.type, item.data, options)
  }));
}

/**
 * Check if a type has a registered schema
 * @param {string} type - The message/operation type
 * @returns {boolean} True if schema exists
 */
export function hasSchema(type) {
  return type in SCHEMA_REGISTRY;
}

/**
 * Get all registered schema types
 * @returns {Array<string>} List of schema types
 */
export function getSchemaTypes() {
  return Object.keys(SCHEMA_REGISTRY);
}

/**
 * Get schema documentation
 * @param {string} type - The message/operation type
 * @returns {Object} Schema documentation
 */
export function getSchemaDoc(type) {
  const schema = getSchema(type);
  return schema.describe();
}

/**
 * Validation helpers re-export
 */
export const ValidationHelpers = {
  // Agent helpers
  validateAgentReadiness: agentSchemas.validateAgentReadiness,
  validateAgentBatch: agentSchemas.validateAgentBatch,

  // Task helpers
  validateTaskReadiness: taskSchemas.validateTaskReadiness,
  validateTaskCompletion: taskSchemas.validateTaskCompletion,

  // Voting helpers
  validateVotingEligibility: votingSchemas.validateVotingEligibility,
  validateVoteIntegrity: votingSchemas.validateVoteIntegrity,

  // Message helpers
  validateMessage: messageSchemas.validateMessage,
  validateMessageBatch: messageSchemas.validateMessageBatch,
  validateMessageRouting: messageSchemas.validateMessageRouting,

  // Achievement helpers
  validateAchievementEligibility: achievementSchemas.validateAchievementEligibility,
  validateBattleMove: achievementSchemas.validateBattleMove
};

/**
 * Common validation patterns for reuse
 */
export const CommonPatterns = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  SEMVER: /^\d+\.\d+\.\d+$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  IPV6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/,
  SHA256: /^[a-f0-9]{64}$/,
  CRON: /^[\d\s\*\/\-,]+$/
};

/**
 * Default export
 */
export default {
  SCHEMA_VERSIONS,
  SCHEMA_REGISTRY,
  getSchema,
  validateByType,
  batchValidate,
  hasSchema,
  getSchemaTypes,
  getSchemaDoc,
  ValidationHelpers,
  CommonPatterns,

  // Individual schema collections
  agentSchemas,
  taskSchemas,
  votingSchemas,
  messageSchemas,
  achievementSchemas
};