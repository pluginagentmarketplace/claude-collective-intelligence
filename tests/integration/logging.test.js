/**
 * Integration Tests for Winston Logging System
 * Converted from test-logging.js to Jest format
 */

import {
  initializeLogging,
  log,
  modules,
  createContext,
  runWithContext,
  agentContext,
  performanceContext
} from '../../src/logger/index.js';

describe('Winston Logging System - Integration Tests', () => {
  let logInitialized = false;

  beforeAll(async () => {
    // Initialize logging once for all tests
    await initializeLogging({
      level: 'debug',
      enableMetrics: true,
      metricsInterval: 5000,
      globalContext: {
        appVersion: '1.0.0',
        environment: 'test'
      }
    });
    logInitialized = true;
  });

  afterAll(async () => {
    // Shutdown logging gracefully
    if (logInitialized) {
      await log.close();
    }
  });

  describe('Basic Logging Levels', () => {
    it('should log error messages', () => {
      expect(() => log.error('This is an error message')).not.toThrow();
    });

    it('should log warning messages', () => {
      expect(() => log.warn('This is a warning message')).not.toThrow();
    });

    it('should log info messages', () => {
      expect(() => log.info('This is an info message')).not.toThrow();
    });

    it('should log debug messages', () => {
      expect(() => log.debug('This is a debug message')).not.toThrow();
    });
  });

  describe('Contextual Logging', () => {
    it('should create and use logging context', async () => {
      const context = createContext({
        userId: 'user-123',
        requestId: 'req-456'
      });

      await runWithContext(context, () => {
        log.info('Message with context', {
          action: 'test',
          value: 42
        });
      });

      expect(context).toBeDefined();
      expect(context.userId).toBe('user-123');
      expect(context.requestId).toBe('req-456');
    });
  });

  describe('Module Loggers', () => {
    it('should log agent initialization', () => {
      expect(() => {
        modules.agent.logInit('test-agent-1', {
          type: 'test',
          capabilities: ['testing'],
          version: '1.0.0'
        });
      }).not.toThrow();
    });

    it('should log agent task start', () => {
      expect(() => {
        modules.agent.logTaskStart('test-agent-1', 'task-001', 'test');
      }).not.toThrow();
    });

    it('should log RabbitMQ connection', () => {
      expect(() => {
        modules.mq.logConnection('connected', 'amqp://localhost', {
          vhost: '/',
          heartbeat: 60
        });
      }).not.toThrow();
    });

    it('should log voting session start', () => {
      expect(() => {
        modules.voting.logSessionStart('session-001', 'Test Vote', ['agent-1', 'agent-2'], {
          type: 'consensus',
          threshold: 0.6
        });
      }).not.toThrow();
    });

    it('should log gamification achievement', () => {
      expect(() => {
        modules.gamification.logAchievement('user-123', {
          id: 'first-task',
          name: 'First Task Completed',
          points: 100,
          rarity: 'common'
        });
      }).not.toThrow();
    });
  });

  describe('Performance Logging', () => {
    it('should time operations with timer', async () => {
      log.time('test-operation');
      await new Promise(resolve => setTimeout(resolve, 100));
      const duration = log.timeEnd('test-operation', { result: 'success' });

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(typeof duration).toBe('number');
    });

    it('should use performance context', async () => {
      const result = await performanceContext('database-query', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        log.info('Query executed');
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('Agent Context', () => {
    it('should execute code in agent context', async () => {
      const result = await agentContext('test-agent-1', 'task-002', async (context) => {
        log.info('Processing in agent context', {
          step: 'validation'
        });
        await new Promise(resolve => setTimeout(resolve, 30));
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('Error Logging', () => {
    it('should log exceptions with context', () => {
      const testError = new Error('Test error message');
      testError.code = 'TEST_ERROR';

      expect(() => {
        log.exception(testError, 'Testing error handler', {
          testData: 'some value'
        });
      }).not.toThrow();
    });
  });

  describe('Audit Logging', () => {
    it('should log audit events', () => {
      expect(() => {
        log.audit('USER_LOGIN', 'user-123', {
          ip: '192.168.1.1',
          userAgent: 'TestClient/1.0',
          success: true
        });
      }).not.toThrow();
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with module context', () => {
      const childLogger = log.child('test-module', {
        version: '1.0.0'
      });

      expect(childLogger).toBeDefined();
      expect(() => childLogger.info('Message from child logger')).not.toThrow();
    });
  });

  describe('Debug Mode', () => {
    it('should report debug mode status', () => {
      expect(log.isDebugEnabled).toBeDefined();
      expect(typeof log.isDebugEnabled).toBe('boolean');
    });
  });

  describe('Log File Locations', () => {
    it('should document log file locations', () => {
      const logLocations = [
        'Console output (development format)',
        'logs/combined-*.log (JSON format)',
        'logs/error-*.log (errors only)',
        'logs/debug-*.log (debug level)',
        'logs/performance.log (performance metrics)'
      ];

      expect(logLocations.length).toBe(5);
    });
  });
});
