/**
 * Comprehensive Validation System Tests
 *
 * Tests for schemas, validators, sanitizers, and middleware
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  agentCreationSchema,
  taskSubmissionSchema,
  votingSessionCreationSchema,
  validateByType,
  getSchema
} from '../../../src/validation/schemas/index.js';

import { MessageValidator } from '../../../src/validation/validators/message-validator.js';
import { PayloadValidator } from '../../../src/validation/validators/payload-validator.js';
import { Sanitizer, sanitize } from '../../../src/validation/sanitizers/sanitizer.js';
import { ValidationMiddleware } from '../../../src/validation/middleware/validation-middleware.js';
import {
  MockDataGenerators,
  MaliciousInputs,
  ValidationTestHelper
} from '../../../src/validation/utils/validation-helpers.js';

describe('Validation System Tests', () => {
  let messageValidator;
  let payloadValidator;
  let sanitizer;
  let middleware;

  beforeEach(() => {
    messageValidator = new MessageValidator();
    payloadValidator = new PayloadValidator();
    sanitizer = new Sanitizer();
    middleware = new ValidationMiddleware();
  });

  afterEach(() => {
    messageValidator.resetStats();
    middleware.resetStats();
  });

  describe('Schema Validation', () => {
    describe('Agent Schema', () => {
      test('should validate valid agent data', () => {
        const validAgent = MockDataGenerators.generateAgent();
        const result = agentCreationSchema.validate(validAgent);

        expect(result.error).toBeUndefined();
        expect(result.value).toBeDefined();
        expect(result.value.name).toBe(validAgent.name);
      });

      test('should reject invalid agent role', () => {
        const invalidAgent = MockDataGenerators.generateAgent({
          role: 'hacker'
        });
        const result = agentCreationSchema.validate(invalidAgent);

        expect(result.error).toBeDefined();
        expect(result.error.details[0].type).toBe('any.only');
      });

      test('should reject agent without required fields', () => {
        const invalidAgent = { role: 'worker' }; // Missing name
        const result = agentCreationSchema.validate(invalidAgent);

        expect(result.error).toBeDefined();
        expect(result.error.details[0].path).toContain('name');
      });

      test('should apply default values', () => {
        const minimalAgent = {
          name: 'TestAgent',
          role: 'worker'
        };
        const result = agentCreationSchema.validate(minimalAgent);

        expect(result.error).toBeUndefined();
        expect(result.value.capabilities).toEqual(['compute', 'analyze']);
        expect(result.value.config.autoStart).toBe(true);
      });
    });

    describe('Task Schema', () => {
      test('should validate valid task data', () => {
        const validTask = MockDataGenerators.generateTask();
        const result = taskSubmissionSchema.validate(validTask);

        expect(result.error).toBeUndefined();
        expect(result.value.title).toBe(validTask.title);
      });

      test('should reject task with invalid priority', () => {
        const invalidTask = MockDataGenerators.generateTask({
          priority: 'super-urgent'
        });
        const result = taskSubmissionSchema.validate(invalidTask);

        expect(result.error).toBeDefined();
        expect(result.error.details[0].path).toContain('priority');
      });

      test('should validate deadline constraints', () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const pastDate = new Date(Date.now() - 86400000).toISOString();

        const validTask = MockDataGenerators.generateTask({
          scheduling: {
            deadline: futureDate
          }
        });
        const result = taskSubmissionSchema.validate(validTask);
        expect(result.error).toBeUndefined();

        const invalidTask = MockDataGenerators.generateTask({
          scheduling: {
            deadline: pastDate
          }
        });
        const result2 = taskSubmissionSchema.validate(invalidTask);
        expect(result2.error).toBeDefined();
      });
    });

    describe('Voting Schema', () => {
      test('should validate valid voting session', () => {
        const validSession = MockDataGenerators.generateVotingSession();
        const result = votingSessionCreationSchema.validate(validSession);

        expect(result.error).toBeUndefined();
        expect(result.value.options).toHaveLength(3);
      });

      test('should reject voting with too few options', () => {
        const invalidSession = MockDataGenerators.generateVotingSession({
          options: [{ id: 'opt1', label: 'Only option' }]
        });
        const result = votingSessionCreationSchema.validate(invalidSession);

        expect(result.error).toBeDefined();
        expect(result.error.details[0].path).toContain('options');
      });

      test('should validate algorithm-specific config', () => {
        const quadraticSession = MockDataGenerators.generateVotingSession({
          algorithm: 'quadratic',
          algorithmConfig: {
            tokensPerAgent: 100
          }
        });
        const result = votingSessionCreationSchema.validate(quadraticSession);

        expect(result.error).toBeUndefined();
        expect(result.value.algorithmConfig.tokensPerAgent).toBe(100);
      });
    });
  });

  describe('Message Validator', () => {
    test('should validate brainstorm message', async () => {
      const message = MockDataGenerators.generateBrainstormMessage();
      const result = await messageValidator.validate(message);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('message.brainstorm');
    });

    test('should identify message type automatically', async () => {
      const taskMessage = {
        type: 'task',
        title: 'Test Task',
        priority: 'normal'
      };

      const result = await messageValidator.validate(taskMessage);
      expect(result.type).toBe('task.submit');
    });

    test('should reject unknown message type', async () => {
      const unknownMessage = {
        type: 'unknown',
        data: 'test'
      };

      const result = await messageValidator.validate(unknownMessage);
      expect(result.valid).toBe(false);
      expect(result.error.code).toBeDefined();
    });

    test('should track validation statistics', async () => {
      const validMessage = MockDataGenerators.generateBrainstormMessage();
      const invalidMessage = { type: 'invalid' };

      await messageValidator.validate(validMessage);
      await messageValidator.validate(invalidMessage);

      const stats = messageValidator.getStats();
      expect(stats.validated).toBe(2);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBeCloseTo(50);
    });
  });

  describe('Payload Validator', () => {
    test('should validate payload size', async () => {
      const smallPayload = { data: 'small' };
      const result = await payloadValidator.validate(smallPayload);
      expect(result.valid).toBe(true);

      // Create large payload
      const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) };
      const result2 = await payloadValidator.validate(largePayload);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('exceeds maximum');
    });

    test('should validate object depth', async () => {
      // Create deeply nested object
      let deepObject = { level: 1 };
      let current = deepObject;
      for (let i = 2; i <= 15; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const result = await payloadValidator.validate(deepObject);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('depth exceeds maximum');
    });

    test('should run custom validators', async () => {
      const taskPayload = {
        priority: 'urgent',
        scheduling: {
          deadline: new Date(Date.now() + 48 * 3600000).toISOString()
        }
      };

      const result = await payloadValidator.validateType('task', taskPayload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Urgent tasks cannot have deadlines more than 24 hours');
    });

    test('should validate quadratic voting tokens', async () => {
      const votingPayload = {
        vote: {
          type: 'quadratic',
          allocation: {
            option1: 10, // 100 tokens
            option2: 5   // 25 tokens, total 125 > 100
          }
        },
        maxTokens: 100
      };

      const result = await payloadValidator.validate(votingPayload, {
        validators: ['quadratic.tokens']
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });
  });

  describe('Sanitizer', () => {
    test('should sanitize SQL injection attempts', () => {
      MaliciousInputs.sqlInjection.forEach(injection => {
        const sanitized = sanitizer.sanitizeString(injection);
        expect(sanitized).not.toContain('DROP');
        expect(sanitized).not.toContain('DELETE');
      });
    });

    test('should sanitize XSS attempts', () => {
      MaliciousInputs.xssAttacks.forEach(xss => {
        const sanitized = sanitizer.sanitizeString(xss);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
      });
    });

    test('should sanitize command injection attempts', () => {
      MaliciousInputs.commandInjection.forEach(command => {
        const sanitized = sanitizer.sanitizeString(command);
        expect(sanitized).not.toContain('rm -rf');
        expect(sanitized).not.toContain('shutdown');
      });
    });

    test('should sanitize path traversal attempts', () => {
      MaliciousInputs.pathTraversal.forEach(path => {
        const sanitized = sanitizer.sanitizePath(path);
        expect(sanitized).toBe(null); // Path traversal should be rejected
      });
    });

    test('should sanitize object with dangerous keys', () => {
      const dangerous = {
        '__proto__': 'hacked',
        'normal': 'value',
        '$where': 'malicious'
      };

      const sanitized = sanitizer.sanitizeObject(dangerous);
      expect(sanitized.__proto__).toBeUndefined();
      expect(sanitized.$where).toBeUndefined();
      expect(sanitized.normal).toBe('value');
    });

    test('should encode HTML entities', () => {
      const html = '<div onclick="alert(\'xss\')">Test & "safe"</div>';
      const encoded = sanitizer.encodeHtmlEntities(html);

      expect(encoded).toContain('&lt;');
      expect(encoded).toContain('&gt;');
      expect(encoded).toContain('&quot;');
      expect(encoded).toContain('&#x27;');
      expect(encoded).toContain('&amp;');
    });

    test('should log detections', () => {
      const malicious = "'; DROP TABLE users; --";
      sanitizer.sanitizeString(malicious);

      const log = sanitizer.getDetectionLog();
      expect(log).toHaveLength(1);
      expect(log[0].detections).toContain('SQL');
    });
  });

  describe('Validation Middleware', () => {
    test('should validate incoming messages', async () => {
      const validMessage = Buffer.from(JSON.stringify(
        MockDataGenerators.generateBrainstormMessage()
      ));

      const msg = {
        content: validMessage,
        fields: {},
        properties: {}
      };

      const channel = {
        ack: jest.fn(),
        reject: jest.fn()
      };

      let processedMsg = null;
      const next = (m) => { processedMsg = m; };

      const middlewareFn = middleware.createConsumerMiddleware();
      await middlewareFn(msg, channel, next);

      expect(processedMsg).toBeDefined();
      expect(processedMsg.validation.validated).toBe(true);
    });

    test('should reject invalid messages', async () => {
      const invalidMessage = Buffer.from(JSON.stringify({
        type: 'invalid_type'
      }));

      const msg = {
        content: invalidMessage,
        fields: {},
        properties: {}
      };

      const channel = {
        ack: jest.fn(),
        reject: jest.fn()
      };

      const next = jest.fn();

      const middlewareFn = middleware.createConsumerMiddleware();
      await middlewareFn(msg, channel, next);

      expect(channel.reject).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle retry logic', async () => {
      middleware.options.maxRetries = 2;

      const invalidMessage = Buffer.from(JSON.stringify({
        type: 'invalid_type'
      }));

      const msg = {
        content: invalidMessage,
        fields: { exchange: 'test', routingKey: 'test.key' },
        properties: { headers: { 'x-retry-count': 1 } }
      };

      const channel = {
        ack: jest.fn(),
        reject: jest.fn(),
        publish: jest.fn()
      };

      const next = jest.fn();

      const middlewareFn = middleware.createConsumerMiddleware();
      await middlewareFn(msg, channel, next);

      // Should retry since count < maxRetries
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(channel.publish).toHaveBeenCalled();
    });

    test('should track middleware statistics', async () => {
      const validMessage = Buffer.from(JSON.stringify(
        MockDataGenerators.generateBrainstormMessage()
      ));

      const msg = {
        content: validMessage,
        fields: {},
        properties: {}
      };

      const channel = {
        ack: jest.fn(),
        reject: jest.fn()
      };

      const middlewareFn = middleware.createConsumerMiddleware();
      await middlewareFn(msg, channel, () => {});

      const stats = middleware.getStats();
      expect(stats.processed).toBe(1);
      expect(stats.valid).toBe(1);
      expect(stats.sanitized).toBe(1);
    });
  });

  describe('Validation Helpers', () => {
    test('should generate valid test data', () => {
      const agent = MockDataGenerators.generateAgent();
      const task = MockDataGenerators.generateTask();
      const voting = MockDataGenerators.generateVotingSession();

      expect(agentCreationSchema.validate(agent).error).toBeUndefined();
      expect(taskSubmissionSchema.validate(task).error).toBeUndefined();
      expect(votingSessionCreationSchema.validate(voting).error).toBeUndefined();
    });

    test('should test security validation', async () => {
      const baseData = MockDataGenerators.generateAgent();
      const results = await ValidationTestHelper.testSecurityValidation(
        agentCreationSchema,
        baseData,
        'name'
      );

      const sqlResults = results.filter(r => r.type === 'SQL Injection');
      const xssResults = results.filter(r => r.type === 'XSS');

      expect(sqlResults.length).toBeGreaterThan(0);
      expect(xssResults.length).toBeGreaterThan(0);
    });

    test('should generate test cases for schema', () => {
      const validData = MockDataGenerators.generateAgent();
      const testCases = ValidationTestHelper.generateTestCases(
        agentCreationSchema,
        validData
      );

      expect(testCases.length).toBeGreaterThan(0);

      // Test generated cases
      testCases.forEach(testCase => {
        if (testCase.expectedError) {
          const result = agentCreationSchema.validate(testCase.data);
          expect(result.error).toBeDefined();
        }
      });
    });

    test('should benchmark validation performance', async () => {
      const data = MockDataGenerators.generateTask();
      const benchmark = await ValidationTestHelper.benchmarkValidation(
        taskSubmissionSchema,
        data,
        100
      );

      expect(benchmark.iterations).toBe(100);
      expect(benchmark.duration).toBeGreaterThan(0);
      expect(benchmark.opsPerSecond).toBeGreaterThan(0);
      expect(benchmark.valid).toBe(100); // All should be valid
    });
  });

  describe('Integration Tests', () => {
    test('should validate complete message flow', async () => {
      // 1. Create message
      const originalMessage = MockDataGenerators.generateBrainstormMessage();

      // 2. Sanitize
      const sanitized = await sanitize(originalMessage);

      // 3. Validate
      const validation = await messageValidator.validate(sanitized);
      expect(validation.valid).toBe(true);

      // 4. Process through middleware
      const msg = {
        content: Buffer.from(JSON.stringify(sanitized)),
        fields: {},
        properties: {}
      };

      const channel = {
        ack: jest.fn(),
        reject: jest.fn()
      };

      let processedMsg = null;
      const middlewareFn = middleware.createConsumerMiddleware();
      await middlewareFn(msg, channel, (m) => { processedMsg = m; });

      expect(processedMsg).toBeDefined();
      expect(processedMsg.validation.validated).toBe(true);
    });

    test('should block malicious message flow', async () => {
      // Create malicious message
      const maliciousMessage = {
        type: 'brainstorm',
        from: "agent'; DROP TABLE messages; --",
        payload: {
          sessionId: '../../../etc/passwd',
          action: '<script>alert("XSS")</script>'
        }
      };

      // Sanitize should remove malicious content
      const sanitized = await sanitize(maliciousMessage);
      expect(sanitized.from).not.toContain('DROP TABLE');
      expect(sanitized.payload.action).not.toContain('<script>');

      // Validation should still fail due to missing required fields
      const validation = await messageValidator.validate(sanitized);
      expect(validation.valid).toBe(false);
    });
  });
});

describe('Performance Tests', () => {
  test('should handle high-volume validation', async () => {
    const validator = new MessageValidator();
    const messages = Array(1000).fill(null).map(() =>
      MockDataGenerators.generateBrainstormMessage()
    );

    const start = Date.now();
    const results = await Promise.all(
      messages.map(msg => validator.validate(msg))
    );
    const duration = Date.now() - start;

    const validCount = results.filter(r => r.valid).length;
    expect(validCount).toBe(1000);
    expect(duration).toBeLessThan(5000); // Should process 1000 messages in < 5 seconds

    console.log(`Validated 1000 messages in ${duration}ms (${1000/duration*1000} msgs/sec)`);
  });

  test('should cache schemas efficiently', async () => {
    const validator = new MessageValidator();

    // First validation (cold cache)
    const start1 = Date.now();
    await validator.validate(MockDataGenerators.generateBrainstormMessage());
    const duration1 = Date.now() - start1;

    // Second validation (warm cache)
    const start2 = Date.now();
    await validator.validate(MockDataGenerators.generateBrainstormMessage());
    const duration2 = Date.now() - start2;

    // Cached should be faster
    expect(duration2).toBeLessThanOrEqual(duration1);
  });
});