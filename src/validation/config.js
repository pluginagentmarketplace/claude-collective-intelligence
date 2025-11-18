/**
 * Validation Configuration
 *
 * Centralized configuration for all validation systems
 * Includes defaults, environment-based settings, and customization options
 *
 * Usage:
 * import { getValidationConfig, createValidator } from './config.js';
 * const config = getValidationConfig('production');
 * const validator = createValidator(config);
 */

/**
 * Default configuration for all environments
 */
export const DEFAULT_CONFIG = {
  // General settings
  enabled: true,
  environment: process.env.NODE_ENV || 'development',

  // Validation options
  validation: {
    sanitize: true,
    validateSchema: true,
    validatePayload: true,
    validateSecurity: true,
    throwOnError: false,
    cacheSchemas: true,
    enableMetrics: true,
    maxValidationTime: 5000, // 5 seconds
    abortEarly: false,
    stripUnknown: true
  },

  // Sanitization options
  sanitization: {
    stripHtml: true,
    encodeEntities: false,
    removeScripts: true,
    detectPatterns: true,
    throwOnDetection: false,
    maxLength: 50000
  },

  // Payload validation options
  payload: {
    maxPayloadSize: 10 * 1024 * 1024, // 10MB
    maxArrayLength: 1000,
    maxObjectDepth: 10,
    strictMode: false
  },

  // Security options
  security: {
    enableSQLInjectionCheck: true,
    enableXSSCheck: true,
    enableCommandInjectionCheck: true,
    enablePathTraversalCheck: true,
    blockOnDetection: false,
    logSecurityEvents: true
  },

  // Error handling
  error: {
    includeStackTrace: false,
    includeContext: true,
    userFriendlyMessages: true,
    maxDetailLength: 200,
    locale: 'en'
  },

  // RabbitMQ middleware options
  rabbitmq: {
    enabled: true,
    sanitize: true,
    strict: false,
    logErrors: true,
    rejectInvalid: true,
    deadLetterInvalid: false,
    maxRetries: 3,
    retryDelay: 1000
  },

  // Express middleware options
  express: {
    enabled: true,
    validateQuery: false,
    validateParams: false,
    returnValidated: true,
    enableStats: true,
    enableErrorHandler: true
  },

  // Monitoring and metrics
  monitoring: {
    enableMetrics: true,
    metricsInterval: 60000, // 1 minute
    trackValidationTime: true,
    trackErrorPatterns: true,
    maxErrorHistory: 100
  },

  // Logging
  logging: {
    enabled: true,
    logValidationFailures: true,
    logSecurityEvents: true,
    logMetrics: true,
    logLevel: 'info'
  },

  // Caching
  caching: {
    enabled: true,
    schemaCacheTTL: null, // No expiration
    schemaCacheSize: 100
  }
};

/**
 * Environment-specific configurations
 */
export const ENV_CONFIGS = {
  development: {
    validation: {
      throwOnError: false,
      cacheSchemas: false // Reload schemas on each validation in dev
    },
    error: {
      includeStackTrace: true,
      userFriendlyMessages: true
    },
    security: {
      blockOnDetection: false
    },
    logging: {
      logValidationFailures: true,
      logLevel: 'debug'
    }
  },

  production: {
    validation: {
      throwOnError: false,
      cacheSchemas: true
    },
    error: {
      includeStackTrace: false,
      userFriendlyMessages: true
    },
    security: {
      blockOnDetection: true,
      logSecurityEvents: true
    },
    logging: {
      logValidationFailures: true,
      logLevel: 'warn'
    },
    rabbitmq: {
      rejectInvalid: true,
      deadLetterInvalid: true
    }
  },

  staging: {
    validation: {
      throwOnError: false,
      cacheSchemas: true
    },
    error: {
      includeStackTrace: true,
      userFriendlyMessages: true
    },
    security: {
      blockOnDetection: false
    },
    logging: {
      logValidationFailures: true,
      logLevel: 'info'
    }
  },

  test: {
    validation: {
      sanitize: true,
      validateSchema: true,
      throwOnError: false
    },
    error: {
      includeStackTrace: true,
      userFriendlyMessages: false
    },
    security: {
      blockOnDetection: false
    },
    logging: {
      enabled: false
    }
  }
};

/**
 * Get configuration for an environment
 * @param {string} env - Environment name
 * @returns {Object} Merged configuration
 */
export function getValidationConfig(env = process.env.NODE_ENV || 'development') {
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep copy
  const envConfig = ENV_CONFIGS[env] || {};

  return deepMerge(config, envConfig);
}

/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = deepMerge(target[key] || {}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/**
 * Custom configuration builder
 */
export class ConfigBuilder {
  constructor(baseConfig = DEFAULT_CONFIG) {
    this.config = JSON.parse(JSON.stringify(baseConfig));
  }

  /**
   * Set validation options
   */
  setValidation(options) {
    this.config.validation = { ...this.config.validation, ...options };
    return this;
  }

  /**
   * Set sanitization options
   */
  setSanitization(options) {
    this.config.sanitization = { ...this.config.sanitization, ...options };
    return this;
  }

  /**
   * Set security options
   */
  setSecurity(options) {
    this.config.security = { ...this.config.security, ...options };
    return this;
  }

  /**
   * Set error handling options
   */
  setErrorHandling(options) {
    this.config.error = { ...this.config.error, ...options };
    return this;
  }

  /**
   * Set RabbitMQ options
   */
  setRabbitMQ(options) {
    this.config.rabbitmq = { ...this.config.rabbitmq, ...options };
    return this;
  }

  /**
   * Set Express options
   */
  setExpress(options) {
    this.config.express = { ...this.config.express, ...options };
    return this;
  }

  /**
   * Get built configuration
   */
  build() {
    return this.config;
  }

  /**
   * Get specific section
   */
  get(section) {
    return this.config[section];
  }
}

/**
 * Preset configurations for common use cases
 */
export const PRESETS = {
  /**
   * Strict validation - blocks everything suspicious
   */
  strict: {
    ...DEFAULT_CONFIG,
    validation: {
      ...DEFAULT_CONFIG.validation,
      validateSchema: true,
      validatePayload: true,
      validateSecurity: true
    },
    sanitization: {
      ...DEFAULT_CONFIG.sanitization,
      detectPatterns: true
    },
    security: {
      ...DEFAULT_CONFIG.security,
      blockOnDetection: true
    }
  },

  /**
   * Permissive validation - log but allow
   */
  permissive: {
    ...DEFAULT_CONFIG,
    validation: {
      ...DEFAULT_CONFIG.validation,
      validateSecurity: false
    },
    security: {
      ...DEFAULT_CONFIG.security,
      blockOnDetection: false
    }
  },

  /**
   * Performance-optimized - minimal overhead
   */
  performance: {
    ...DEFAULT_CONFIG,
    validation: {
      ...DEFAULT_CONFIG.validation,
      cacheSchemas: true,
      validatePayload: false
    },
    sanitization: {
      ...DEFAULT_CONFIG.sanitization,
      detectPatterns: false
    },
    monitoring: {
      ...DEFAULT_CONFIG.monitoring,
      enableMetrics: false
    }
  },

  /**
   * Security-focused - maximum checks
   */
  security: {
    ...DEFAULT_CONFIG,
    validation: {
      ...DEFAULT_CONFIG.validation,
      validateSecurity: true
    },
    sanitization: {
      ...DEFAULT_CONFIG.sanitization,
      detectPatterns: true,
      stripHtml: true
    },
    security: {
      ...DEFAULT_CONFIG.security,
      enableSQLInjectionCheck: true,
      enableXSSCheck: true,
      enableCommandInjectionCheck: true,
      enablePathTraversalCheck: true,
      blockOnDetection: true,
      logSecurityEvents: true
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      logSecurityEvents: true
    }
  }
};

/**
 * Load configuration from environment variables
 */
export function loadFromEnv() {
  const config = getValidationConfig();

  // Override from environment variables
  if (process.env.VALIDATION_SANITIZE !== undefined) {
    config.validation.sanitize = process.env.VALIDATION_SANITIZE === 'true';
  }

  if (process.env.VALIDATION_STRICT !== undefined) {
    config.validation.validatePayload = process.env.VALIDATION_STRICT === 'true';
  }

  if (process.env.VALIDATION_SECURITY !== undefined) {
    config.security.blockOnDetection = process.env.VALIDATION_SECURITY === 'true';
  }

  if (process.env.VALIDATION_MAX_SIZE) {
    config.payload.maxPayloadSize = parseInt(process.env.VALIDATION_MAX_SIZE);
  }

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config) {
  const errors = [];

  if (typeof config.validation?.sanitize !== 'boolean') {
    errors.push('validation.sanitize must be a boolean');
  }

  if (typeof config.payload?.maxPayloadSize !== 'number') {
    errors.push('payload.maxPayloadSize must be a number');
  }

  if (config.payload?.maxPayloadSize <= 0) {
    errors.push('payload.maxPayloadSize must be greater than 0');
  }

  if (!['development', 'staging', 'production', 'test'].includes(config.environment)) {
    errors.push(`environment must be one of: development, staging, production, test`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get summary of current configuration
 */
export function getConfigSummary(config = getValidationConfig()) {
  return {
    environment: config.environment,
    validation: {
      schema: config.validation.validateSchema,
      payload: config.validation.validatePayload,
      security: config.validation.validateSecurity,
      caching: config.validation.cacheSchemas
    },
    sanitization: {
      enabled: config.sanitization.stripHtml,
      patternDetection: config.sanitization.detectPatterns
    },
    security: {
      blockingEnabled: config.security.blockOnDetection,
      sqlInjectionCheck: config.security.enableSQLInjectionCheck,
      xssCheck: config.security.enableXSSCheck
    },
    logging: {
      enabled: config.logging.enabled,
      level: config.logging.logLevel
    }
  };
}

/**
 * Export default configuration
 */
export default getValidationConfig();
