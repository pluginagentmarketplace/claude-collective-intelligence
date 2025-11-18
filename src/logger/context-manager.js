/**
 * Context Manager for Logging
 * Manages contextual information across async operations
 */

import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './winston-config.js';

/**
 * AsyncLocalStorage for maintaining context across async boundaries
 */
const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Context Manager Class
 */
class ContextManager {
  constructor() {
    this.storage = asyncLocalStorage;
    this.globalContext = {};
  }

  /**
   * Initialize a new context for an operation
   */
  createContext(initialContext = {}) {
    const context = {
      correlationId: initialContext.correlationId || uuidv4(),
      requestId: initialContext.requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      ...initialContext
    };

    return context;
  }

  /**
   * Run a function with a specific context
   */
  runWithContext(context, callback) {
    const fullContext = {
      ...this.globalContext,
      ...context
    };

    return this.storage.run(fullContext, callback);
  }

  /**
   * Get the current context
   */
  getContext() {
    return this.storage.getStore() || {};
  }

  /**
   * Add data to the current context
   */
  addToContext(data) {
    const currentContext = this.getContext();
    const updatedContext = {
      ...currentContext,
      ...data
    };

    // Update the context in place if we're in an async context
    if (this.storage.getStore()) {
      Object.assign(this.storage.getStore(), data);
    }

    return updatedContext;
  }

  /**
   * Set global context that applies to all operations
   */
  setGlobalContext(context) {
    this.globalContext = {
      ...this.globalContext,
      ...context
    };
  }

  /**
   * Clear global context
   */
  clearGlobalContext() {
    this.globalContext = {};
  }

  /**
   * Create a logger with current context
   */
  getContextualLogger(module) {
    const context = this.getContext();
    return logger.child({
      module,
      ...context
    });
  }

  /**
   * Express middleware for request context
   */
  expressMiddleware() {
    return (req, res, next) => {
      const context = this.createContext({
        requestId: req.headers['x-request-id'] || uuidv4(),
        correlationId: req.headers['x-correlation-id'] || uuidv4(),
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
        sessionId: req.session?.id
      });

      // Add context to request object
      req.context = context;

      // Log request start
      const requestLogger = logger.child({ module: 'http', ...context });
      requestLogger.info('Request started', {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers)
      });

      // Track request timing
      const startTime = Date.now();

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - startTime;

        requestLogger.info('Request completed', {
          statusCode: res.statusCode,
          duration,
          responseHeaders: res.getHeaders()
        });

        // Log slow requests
        if (duration > 1000) {
          requestLogger.warn('Slow request detected', {
            duration,
            threshold: 1000
          });
        }

        originalEnd.apply(res, args);
      };

      // Run the rest of the middleware with context
      this.runWithContext(context, () => next());
    };
  }

  /**
   * RabbitMQ context wrapper
   */
  rabbitMqContext(message, callback) {
    const context = this.createContext({
      messageId: message.properties.messageId || uuidv4(),
      correlationId: message.properties.correlationId || uuidv4(),
      replyTo: message.properties.replyTo,
      exchange: message.fields.exchange,
      routingKey: message.fields.routingKey,
      queue: message.fields.queue,
      deliveryTag: message.fields.deliveryTag,
      redelivered: message.fields.redelivered
    });

    const mqLogger = logger.child({ module: 'rabbitmq', ...context });
    mqLogger.debug('Processing message', {
      content: message.content.toString().substring(0, 200)
    });

    return this.runWithContext(context, () => callback(message, context));
  }

  /**
   * Agent context wrapper
   */
  agentContext(agentId, taskId, callback) {
    const context = this.createContext({
      agentId,
      taskId: taskId || uuidv4(),
      agentType: this.getAgentType(agentId),
      timestamp: new Date().toISOString()
    });

    const agentLogger = logger.child({ module: 'agent', ...context });
    agentLogger.info('Agent task started', {
      agentId,
      taskId
    });

    const startTime = Date.now();

    return this.runWithContext(context, async () => {
      try {
        const result = await callback(context);
        const duration = Date.now() - startTime;

        agentLogger.info('Agent task completed', {
          duration,
          success: true
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        agentLogger.error('Agent task failed', {
          duration,
          error: error.message,
          stack: error.stack
        });

        throw error;
      }
    });
  }

  /**
   * Voting session context
   */
  votingContext(sessionId, participants, callback) {
    const context = this.createContext({
      sessionId: sessionId || uuidv4(),
      participantCount: participants.length,
      participants: participants.map(p => p.id || p),
      votingType: 'consensus',
      timestamp: new Date().toISOString()
    });

    const votingLogger = logger.child({ module: 'voting', ...context });
    votingLogger.info('Voting session started', {
      sessionId: context.sessionId,
      participants: context.participantCount
    });

    return this.runWithContext(context, callback);
  }

  /**
   * Performance monitoring context
   */
  performanceContext(operation, callback) {
    const context = this.createContext({
      operation,
      performanceId: uuidv4(),
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      startCpu: process.cpuUsage()
    });

    const perfLogger = logger.child({ module: 'performance', ...context });

    return this.runWithContext(context, async () => {
      const startTime = Date.now();

      try {
        const result = await callback(context);
        const duration = Date.now() - startTime;

        const endMemory = process.memoryUsage();
        const endCpu = process.cpuUsage(context.startCpu);

        perfLogger.info('Performance metrics', {
          operation,
          duration,
          memoryDelta: {
            rss: endMemory.rss - context.startMemory.rss,
            heapUsed: endMemory.heapUsed - context.startMemory.heapUsed
          },
          cpuUsage: {
            user: endCpu.user / 1000,
            system: endCpu.system / 1000
          }
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        perfLogger.error('Operation failed', {
          operation,
          duration,
          error: error.message
        });

        throw error;
      }
    });
  }

  /**
   * Batch operation context
   */
  batchContext(batchId, items, callback) {
    const context = this.createContext({
      batchId: batchId || uuidv4(),
      batchSize: items.length,
      batchType: 'parallel',
      timestamp: new Date().toISOString()
    });

    const batchLogger = logger.child({ module: 'batch', ...context });
    batchLogger.info('Batch operation started', {
      batchId: context.batchId,
      itemCount: items.length
    });

    let processed = 0;
    let failed = 0;

    const processBatch = async () => {
      const startTime = Date.now();
      const results = [];

      for (const item of items) {
        try {
          const result = await callback(item, context);
          processed++;
          results.push({ success: true, result });
        } catch (error) {
          failed++;
          results.push({ success: false, error: error.message });
          batchLogger.error('Batch item failed', {
            item,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      batchLogger.info('Batch operation completed', {
        duration,
        processed,
        failed,
        successRate: (processed / items.length) * 100
      });

      return results;
    };

    return this.runWithContext(context, processBatch);
  }

  /**
   * Transaction context for database operations
   */
  transactionContext(transactionId, callback) {
    const context = this.createContext({
      transactionId: transactionId || uuidv4(),
      transactionType: 'database',
      isolation: 'read-committed',
      timestamp: new Date().toISOString()
    });

    const txLogger = logger.child({ module: 'transaction', ...context });
    txLogger.debug('Transaction started', {
      transactionId: context.transactionId
    });

    return this.runWithContext(context, async () => {
      const startTime = Date.now();

      try {
        const result = await callback(context);
        const duration = Date.now() - startTime;

        txLogger.info('Transaction committed', {
          duration,
          success: true
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        txLogger.error('Transaction rolled back', {
          duration,
          error: error.message,
          stack: error.stack
        });

        throw error;
      }
    });
  }

  /**
   * Sanitize headers for logging
   */
  sanitizeHeaders(headers) {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Get agent type from agent ID
   */
  getAgentType(agentId) {
    // Extract type from agent ID pattern (e.g., "research-agent-1" -> "research")
    const match = agentId.match(/^([^-]+)-agent/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Create a trace span
   */
  createSpan(name, parentSpanId = null) {
    const spanId = uuidv4();
    const context = this.getContext();

    const span = {
      spanId,
      parentSpanId,
      traceId: context.correlationId || uuidv4(),
      name,
      startTime: Date.now(),
      tags: {},
      logs: []
    };

    return {
      ...span,
      addTag: (key, value) => {
        span.tags[key] = value;
      },
      log: (message, data = {}) => {
        span.logs.push({
          timestamp: Date.now(),
          message,
          data
        });
      },
      finish: () => {
        const duration = Date.now() - span.startTime;
        const spanLogger = logger.child({ module: 'tracing', ...context });

        spanLogger.debug('Span completed', {
          spanId: span.spanId,
          name: span.name,
          duration,
          tags: span.tags,
          logs: span.logs
        });

        return duration;
      }
    };
  }
}

// Export singleton instance
const contextManager = new ContextManager();

export { contextManager };
export const createContext = (...args) => contextManager.createContext(...args);
export const runWithContext = (...args) => contextManager.runWithContext(...args);
export const getContext = () => contextManager.getContext();
export const addToContext = (...args) => contextManager.addToContext(...args);
export const getContextualLogger = (...args) => contextManager.getContextualLogger(...args);
export const expressMiddleware = () => contextManager.expressMiddleware();
export const rabbitMqContext = (...args) => contextManager.rabbitMqContext(...args);
export const agentContext = (...args) => contextManager.agentContext(...args);
export const votingContext = (...args) => contextManager.votingContext(...args);
export const performanceContext = (...args) => contextManager.performanceContext(...args);
export const batchContext = (...args) => contextManager.batchContext(...args);
export const transactionContext = (...args) => contextManager.transactionContext(...args);
export const createSpan = (...args) => contextManager.createSpan(...args);