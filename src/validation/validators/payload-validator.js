/**
 * Payload Validator
 *
 * Validates specific payload types with custom logic,
 * cross-field validation, and business rule enforcement
 */

import Joi from 'joi';
import { ValidationHelpers } from '../schemas/index.js';

/**
 * Payload Validator Class
 */
export class PayloadValidator {
  constructor(options = {}) {
    this.options = {
      maxPayloadSize: 10 * 1024 * 1024, // 10MB default
      maxArrayLength: 1000,
      maxObjectDepth: 10,
      strictMode: false,
      ...options
    };

    this.customValidators = new Map();
    this.registerDefaultValidators();
  }

  /**
   * Register default custom validators
   */
  registerDefaultValidators() {
    // Task deadline validator
    this.registerValidator('task.deadline', (payload) => {
      if (payload.scheduling?.deadline) {
        const deadline = new Date(payload.scheduling.deadline);
        const now = new Date();
        const minDeadline = new Date(now.getTime() + 60000); // Min 1 minute

        if (deadline < minDeadline) {
          return {
            valid: false,
            error: 'Deadline must be at least 1 minute in the future'
          };
        }

        if (payload.priority === 'urgent' && deadline > new Date(now.getTime() + 86400000)) {
          return {
            valid: false,
            error: 'Urgent tasks cannot have deadlines more than 24 hours away'
          };
        }
      }
      return { valid: true };
    });

    // Voting quorum validator
    this.registerValidator('voting.quorum', (payload) => {
      if (payload.quorum) {
        const { minParticipation, minAgents, totalAgents } = payload.quorum;

        if (minAgents && totalAgents && minAgents > totalAgents) {
          return {
            valid: false,
            error: 'Minimum agents cannot exceed total agents'
          };
        }

        if (minParticipation > 1 || minParticipation < 0) {
          return {
            valid: false,
            error: 'Minimum participation must be between 0 and 1'
          };
        }
      }
      return { valid: true };
    });

    // Agent capability validator
    this.registerValidator('agent.capabilities', (payload) => {
      const validCapabilities = [
        'compute', 'analyze', 'generate', 'review', 'coordinate',
        'monitor', 'report', 'validate', 'transform', 'aggregate'
      ];

      if (payload.capabilities) {
        const invalid = payload.capabilities.filter(cap => !validCapabilities.includes(cap));
        if (invalid.length > 0) {
          return {
            valid: false,
            error: `Invalid capabilities: ${invalid.join(', ')}`
          };
        }

        // Check for capability conflicts
        if (payload.capabilities.includes('coordinate') && payload.role === 'worker') {
          return {
            valid: false,
            error: 'Worker role cannot have coordinate capability'
          };
        }
      }
      return { valid: true };
    });

    // Resource allocation validator
    this.registerValidator('resource.allocation', (payload) => {
      if (payload.resources) {
        const { cpu, memory } = payload.resources;

        if (cpu && memory) {
          // Check for unrealistic allocations
          if (cpu > 80 && memory > 80) {
            return {
              valid: false,
              error: 'Cannot allocate more than 80% of both CPU and memory'
            };
          }
        }

        // Check min/max relationships
        if (payload.requirements?.resources) {
          const req = payload.requirements.resources;
          if (req.cpu?.min > req.cpu?.max) {
            return {
              valid: false,
              error: 'CPU minimum cannot exceed maximum'
            };
          }
          if (req.memory?.min > req.memory?.max) {
            return {
              valid: false,
              error: 'Memory minimum cannot exceed maximum'
            };
          }
        }
      }
      return { valid: true };
    });

    // Quadratic voting token validator
    this.registerValidator('quadratic.tokens', (payload) => {
      if (payload.vote?.type === 'quadratic' && payload.vote.allocation) {
        const totalUsed = Object.values(payload.vote.allocation).reduce((sum, votes) => {
          return sum + (votes * votes);
        }, 0);

        const maxTokens = payload.maxTokens || 100;

        if (totalUsed > maxTokens) {
          return {
            valid: false,
            error: `Token usage (${totalUsed}) exceeds maximum (${maxTokens})`
          };
        }
      }
      return { valid: true };
    });

    // Achievement evidence validator
    this.registerValidator('achievement.evidence', (payload) => {
      if (payload.achievementId && payload.evidence) {
        // Check evidence completeness based on achievement type
        const speedAchievements = ['speed-demon', 'lightning-fast', 'speed-of-light'];
        const qualityAchievements = ['quality-master', 'perfection', 'flawless'];

        if (speedAchievements.includes(payload.achievementId)) {
          if (!payload.evidence.taskCompletionTimes || payload.evidence.taskCompletionTimes.length === 0) {
            return {
              valid: false,
              error: 'Speed achievements require task completion time evidence'
            };
          }
        }

        if (qualityAchievements.includes(payload.achievementId)) {
          if (!payload.evidence.qualityScores || payload.evidence.qualityScores.length === 0) {
            return {
              valid: false,
              error: 'Quality achievements require quality score evidence'
            };
          }
        }
      }
      return { valid: true };
    });
  }

  /**
   * Register custom validator
   * @param {string} name - Validator name
   * @param {Function} validator - Validator function
   */
  registerValidator(name, validator) {
    if (typeof validator !== 'function') {
      throw new TypeError('Validator must be a function');
    }
    this.customValidators.set(name, validator);
  }

  /**
   * Validate payload size
   * @param {Object} payload - Payload to validate
   * @returns {Object} Validation result
   */
  validateSize(payload) {
    const size = JSON.stringify(payload).length;

    if (size > this.options.maxPayloadSize) {
      return {
        valid: false,
        error: `Payload size (${size} bytes) exceeds maximum (${this.options.maxPayloadSize} bytes)`
      };
    }

    return { valid: true };
  }

  /**
   * Validate payload structure depth
   * @param {Object} payload - Payload to validate
   * @param {number} depth - Current depth
   * @returns {Object} Validation result
   */
  validateDepth(payload, depth = 0) {
    if (depth > this.options.maxObjectDepth) {
      return {
        valid: false,
        error: `Object depth exceeds maximum (${this.options.maxObjectDepth})`
      };
    }

    for (const value of Object.values(payload)) {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          if (value.length > this.options.maxArrayLength) {
            return {
              valid: false,
              error: `Array length exceeds maximum (${this.options.maxArrayLength})`
            };
          }
          for (const item of value) {
            if (item && typeof item === 'object') {
              const result = this.validateDepth(item, depth + 1);
              if (!result.valid) return result;
            }
          }
        } else {
          const result = this.validateDepth(value, depth + 1);
          if (!result.valid) return result;
        }
      }
    }

    return { valid: true };
  }

  /**
   * Run custom validators
   * @param {Object} payload - Payload to validate
   * @param {Array} validators - List of validator names to run
   * @returns {Object} Validation result
   */
  async runCustomValidators(payload, validators = []) {
    const validatorsToRun = validators.length > 0
      ? validators
      : Array.from(this.customValidators.keys());

    for (const validatorName of validatorsToRun) {
      const validator = this.customValidators.get(validatorName);
      if (validator) {
        const result = await validator(payload);
        if (!result.valid) {
          return {
            valid: false,
            error: result.error,
            validator: validatorName
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate dependencies between fields
   * @param {Object} payload - Payload to validate
   * @returns {Object} Validation result
   */
  validateDependencies(payload) {
    // Task dependencies
    if (payload.requirements?.dependencies) {
      for (const dep of payload.requirements.dependencies) {
        if (dep === payload.taskId) {
          return {
            valid: false,
            error: 'Task cannot depend on itself'
          };
        }
      }
    }

    // Voting options dependencies
    if (payload.options && payload.algorithm === 'ranked_choice') {
      if (payload.options.length < 3) {
        return {
          valid: false,
          error: 'Ranked choice voting requires at least 3 options'
        };
      }
    }

    // Agent role dependencies
    if (payload.role === 'leader' && payload.config?.autoStart === false) {
      return {
        valid: false,
        error: 'Leader agents must have autoStart enabled'
      };
    }

    return { valid: true };
  }

  /**
   * Main validation method
   * @param {Object} payload - Payload to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validate(payload, options = {}) {
    const validationOptions = { ...this.options, ...options };

    // Size validation
    const sizeResult = this.validateSize(payload);
    if (!sizeResult.valid) return sizeResult;

    // Depth validation
    const depthResult = this.validateDepth(payload);
    if (!depthResult.valid) return depthResult;

    // Dependency validation
    const depResult = this.validateDependencies(payload);
    if (!depResult.valid) return depResult;

    // Custom validators
    const customResult = await this.runCustomValidators(
      payload,
      options.validators || []
    );
    if (!customResult.valid) return customResult;

    // Strict mode additional checks
    if (validationOptions.strictMode) {
      const strictResult = this.validateStrictMode(payload);
      if (!strictResult.valid) return strictResult;
    }

    return {
      valid: true,
      metadata: {
        size: JSON.stringify(payload).length,
        validated: new Date().toISOString(),
        strictMode: validationOptions.strictMode
      }
    };
  }

  /**
   * Strict mode validation
   * @param {Object} payload - Payload to validate
   * @returns {Object} Validation result
   */
  validateStrictMode(payload) {
    // No null values
    const hasNull = JSON.stringify(payload).includes('null');
    if (hasNull) {
      return {
        valid: false,
        error: 'Strict mode: null values are not allowed'
      };
    }

    // No empty strings
    const hasEmptyString = JSON.stringify(payload).includes('""');
    if (hasEmptyString) {
      return {
        valid: false,
        error: 'Strict mode: empty strings are not allowed'
      };
    }

    // No undefined (though JSON.stringify removes undefined)
    const checkUndefined = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) {
          return true;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (checkUndefined(value)) return true;
        }
      }
      return false;
    };

    if (checkUndefined(payload)) {
      return {
        valid: false,
        error: 'Strict mode: undefined values are not allowed'
      };
    }

    return { valid: true };
  }

  /**
   * Validate specific payload type
   * @param {string} type - Payload type
   * @param {Object} payload - Payload to validate
   * @returns {Object} Validation result
   */
  async validateType(type, payload) {
    // Run type-specific validators
    const typeValidators = {
      'task': ['task.deadline', 'resource.allocation'],
      'voting': ['voting.quorum', 'quadratic.tokens'],
      'agent': ['agent.capabilities', 'resource.allocation'],
      'achievement': ['achievement.evidence']
    };

    const validators = typeValidators[type] || [];
    return this.validate(payload, { validators });
  }
}

/**
 * Create singleton instance
 */
const defaultPayloadValidator = new PayloadValidator();

/**
 * Convenience functions
 */
export async function validatePayload(payload, options = {}) {
  const validator = new PayloadValidator(options);
  return validator.validate(payload);
}

export async function validatePayloadType(type, payload, options = {}) {
  const validator = new PayloadValidator(options);
  return validator.validateType(type, payload);
}

/**
 * Export default instance and class
 */
export default defaultPayloadValidator;
export { PayloadValidator as Validator };