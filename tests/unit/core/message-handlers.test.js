/**
 * Unit Tests for Message Handlers
 * Tests message validation, routing, acknowledgment, retry logic, and dead letter handling
 */

import { jest } from '@jest/globals';

/**
 * Message Validator
 * Validates message structure and content
 */
export class MessageValidator {
  static validate(message) {
    if (!message) {
      throw new Error('Message is null or undefined');
    }

    if (!message.id) {
      throw new Error('Message must have an id');
    }

    if (!message.type) {
      throw new Error('Message must have a type');
    }

    if (!message.from) {
      throw new Error('Message must have a from field');
    }

    if (!message.timestamp) {
      throw new Error('Message must have a timestamp');
    }

    return true;
  }

  static validateTask(message) {
    this.validate(message);

    if (message.type !== 'task') {
      throw new Error('Message type must be "task"');
    }

    if (!message.task) {
      throw new Error('Task message must have a task field');
    }

    if (!message.task.title) {
      throw new Error('Task must have a title');
    }

    return true;
  }

  static validateResult(message) {
    this.validate(message);

    if (message.type !== 'result') {
      throw new Error('Message type must be "result"');
    }

    if (!message.result) {
      throw new Error('Result message must have a result field');
    }

    return true;
  }

  static validateBrainstorm(message) {
    this.validate(message);

    if (message.type !== 'brainstorm') {
      throw new Error('Message type must be "brainstorm"');
    }

    if (!message.message) {
      throw new Error('Brainstorm message must have a message field');
    }

    return true;
  }
}

/**
 * Message Router
 * Routes messages to appropriate handlers
 */
export class MessageRouter {
  constructor() {
    this.handlers = new Map();
  }

  register(messageType, handler) {
    if (!messageType || typeof messageType !== 'string') {
      throw new Error('Message type must be a non-empty string');
    }

    if (!handler || typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    this.handlers.set(messageType, handler);
  }

  async route(message) {
    MessageValidator.validate(message);

    const handler = this.handlers.get(message.type);

    if (!handler) {
      throw new Error(`No handler registered for message type: ${message.type}`);
    }

    return await handler(message);
  }

  hasHandler(messageType) {
    return this.handlers.has(messageType);
  }

  removeHandler(messageType) {
    return this.handlers.delete(messageType);
  }
}

/**
 * Acknowledgment Handler
 * Manages message acknowledgments with retry logic
 */
export class AcknowledgmentHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.deadLetterQueue = options.deadLetterQueue || 'dead-letter';
  }

  async handleMessage(message, processor, actions) {
    const { ack, nack, reject } = actions;

    try {
      await processor(message);
      ack();
      return { status: 'ack', message };
    } catch (error) {
      return await this.handleError(message, error, { ack, nack, reject });
    }
  }

  async handleError(message, error, actions) {
    const { nack, reject } = actions;
    const retryCount = message.retryCount || 0;

    if (retryCount < this.maxRetries) {
      // Requeue with incremented retry count
      message.retryCount = retryCount + 1;
      nack(true); // Requeue
      return { status: 'nack', requeue: true, retryCount: message.retryCount, error };
    } else {
      // Send to dead letter queue
      reject();
      return { status: 'reject', deadLetter: true, error };
    }
  }

  shouldRetry(message) {
    const retryCount = message.retryCount || 0;
    return retryCount < this.maxRetries;
  }
}

/**
 * Dead Letter Handler
 * Manages messages that failed processing
 */
export class DeadLetterHandler {
  constructor() {
    this.deadLetters = [];
  }

  add(message, error, metadata = {}) {
    const deadLetter = {
      message,
      error: {
        message: error.message,
        stack: error.stack,
      },
      metadata: {
        ...metadata,
        deadLetteredAt: Date.now(),
      },
    };

    this.deadLetters.push(deadLetter);
    return deadLetter;
  }

  getAll() {
    return this.deadLetters;
  }

  getByMessageId(messageId) {
    return this.deadLetters.filter(dl => dl.message.id === messageId);
  }

  count() {
    return this.deadLetters.length;
  }

  clear() {
    this.deadLetters = [];
  }
}

describe('MessageValidator', () => {
  describe('validate()', () => {
    test('should validate correct message', () => {
      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      expect(MessageValidator.validate(message)).toBe(true);
    });

    test('should throw error for null message', () => {
      expect(() => MessageValidator.validate(null)).toThrow('Message is null or undefined');
    });

    test('should throw error for missing id', () => {
      const message = {
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow('Message must have an id');
    });

    test('should throw error for missing type', () => {
      const message = {
        id: '123',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow('Message must have a type');
    });

    test('should throw error for missing from field', () => {
      const message = {
        id: '123',
        type: 'task',
        timestamp: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow('Message must have a from field');
    });

    test('should throw error for missing timestamp', () => {
      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
      };

      expect(() => MessageValidator.validate(message)).toThrow('Message must have a timestamp');
    });
  });

  describe('validateTask()', () => {
    test('should validate correct task message', () => {
      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
        task: {
          title: 'Test Task',
        },
      };

      expect(MessageValidator.validateTask(message)).toBe(true);
    });

    test('should throw error for wrong type', () => {
      const message = {
        id: '123',
        type: 'result',
        from: 'agent-1',
        timestamp: Date.now(),
        task: {
          title: 'Test Task',
        },
      };

      expect(() => MessageValidator.validateTask(message)).toThrow('Message type must be "task"');
    });

    test('should throw error for missing task field', () => {
      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      expect(() => MessageValidator.validateTask(message)).toThrow('Task message must have a task field');
    });

    test('should throw error for missing task title', () => {
      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
        task: {},
      };

      expect(() => MessageValidator.validateTask(message)).toThrow('Task must have a title');
    });
  });

  describe('validateResult()', () => {
    test('should validate correct result message', () => {
      const message = {
        id: '123',
        type: 'result',
        from: 'agent-1',
        timestamp: Date.now(),
        result: {
          status: 'completed',
        },
      };

      expect(MessageValidator.validateResult(message)).toBe(true);
    });

    test('should throw error for wrong type', () => {
      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
        result: {},
      };

      expect(() => MessageValidator.validateResult(message)).toThrow('Message type must be "result"');
    });

    test('should throw error for missing result field', () => {
      const message = {
        id: '123',
        type: 'result',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      expect(() => MessageValidator.validateResult(message)).toThrow('Result message must have a result field');
    });
  });

  describe('validateBrainstorm()', () => {
    test('should validate correct brainstorm message', () => {
      const message = {
        id: '123',
        type: 'brainstorm',
        from: 'agent-1',
        timestamp: Date.now(),
        message: {
          topic: 'Test',
        },
      };

      expect(MessageValidator.validateBrainstorm(message)).toBe(true);
    });

    test('should throw error for wrong type', () => {
      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
        message: {},
      };

      expect(() => MessageValidator.validateBrainstorm(message)).toThrow('Message type must be "brainstorm"');
    });

    test('should throw error for missing message field', () => {
      const message = {
        id: '123',
        type: 'brainstorm',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      expect(() => MessageValidator.validateBrainstorm(message)).toThrow('Brainstorm message must have a message field');
    });
  });
});

describe('MessageRouter', () => {
  let router;

  beforeEach(() => {
    router = new MessageRouter();
  });

  describe('register()', () => {
    test('should register handler for message type', () => {
      const handler = jest.fn();
      router.register('task', handler);

      expect(router.hasHandler('task')).toBe(true);
    });

    test('should throw error for invalid message type', () => {
      const handler = jest.fn();

      expect(() => router.register('', handler)).toThrow('Message type must be a non-empty string');
      expect(() => router.register(null, handler)).toThrow('Message type must be a non-empty string');
    });

    test('should throw error for invalid handler', () => {
      expect(() => router.register('task', null)).toThrow('Handler must be a function');
      expect(() => router.register('task', 'not a function')).toThrow('Handler must be a function');
    });
  });

  describe('route()', () => {
    test('should route message to correct handler', async () => {
      const handler = jest.fn().mockResolvedValue({ processed: true });
      router.register('task', handler);

      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      const result = await router.route(message);

      expect(handler).toHaveBeenCalledWith(message);
      expect(result).toEqual({ processed: true });
    });

    test('should throw error for invalid message', async () => {
      const handler = jest.fn();
      router.register('task', handler);

      await expect(router.route(null)).rejects.toThrow('Message is null or undefined');
    });

    test('should throw error for unregistered message type', async () => {
      const message = {
        id: '123',
        type: 'unknown',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      await expect(router.route(message)).rejects.toThrow('No handler registered for message type: unknown');
    });

    test('should handle async handlers', async () => {
      const handler = jest.fn().mockImplementation(async (msg) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id: msg.id, processed: true };
      });

      router.register('task', handler);

      const message = {
        id: '123',
        type: 'task',
        from: 'agent-1',
        timestamp: Date.now(),
      };

      const result = await router.route(message);

      expect(result).toEqual({ id: '123', processed: true });
    });
  });

  describe('hasHandler()', () => {
    test('should return true for registered handler', () => {
      router.register('task', jest.fn());
      expect(router.hasHandler('task')).toBe(true);
    });

    test('should return false for unregistered handler', () => {
      expect(router.hasHandler('task')).toBe(false);
    });
  });

  describe('removeHandler()', () => {
    test('should remove registered handler', () => {
      router.register('task', jest.fn());
      expect(router.hasHandler('task')).toBe(true);

      router.removeHandler('task');
      expect(router.hasHandler('task')).toBe(false);
    });

    test('should return true when handler was removed', () => {
      router.register('task', jest.fn());
      expect(router.removeHandler('task')).toBe(true);
    });

    test('should return false when handler does not exist', () => {
      expect(router.removeHandler('task')).toBe(false);
    });
  });
});

describe('AcknowledgmentHandler', () => {
  let ackHandler;
  let ack, nack, reject;

  beforeEach(() => {
    ackHandler = new AcknowledgmentHandler({
      maxRetries: 3,
      retryDelay: 100,
    });

    ack = jest.fn();
    nack = jest.fn();
    reject = jest.fn();
  });

  describe('handleMessage()', () => {
    test('should ack message on successful processing', async () => {
      const message = { id: '123', type: 'task' };
      const processor = jest.fn().mockResolvedValue(undefined);

      const result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });

      expect(processor).toHaveBeenCalledWith(message);
      expect(ack).toHaveBeenCalled();
      expect(result.status).toBe('ack');
    });

    test('should nack and requeue on first failure', async () => {
      const message = { id: '123', type: 'task' };
      const processor = jest.fn().mockRejectedValue(new Error('Processing failed'));

      const result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });

      expect(nack).toHaveBeenCalledWith(true);
      expect(result.status).toBe('nack');
      expect(result.requeue).toBe(true);
      expect(result.retryCount).toBe(1);
    });

    test('should reject after max retries', async () => {
      const message = { id: '123', type: 'task', retryCount: 3 };
      const processor = jest.fn().mockRejectedValue(new Error('Processing failed'));

      const result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });

      expect(reject).toHaveBeenCalled();
      expect(result.status).toBe('reject');
      expect(result.deadLetter).toBe(true);
    });

    test('should include error in result', async () => {
      const message = { id: '123', type: 'task' };
      const error = new Error('Processing failed');
      const processor = jest.fn().mockRejectedValue(error);

      const result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });

      expect(result.error).toBe(error);
    });
  });

  describe('shouldRetry()', () => {
    test('should return true when retry count is below max', () => {
      const message = { retryCount: 2 };
      expect(ackHandler.shouldRetry(message)).toBe(true);
    });

    test('should return false when retry count equals max', () => {
      const message = { retryCount: 3 };
      expect(ackHandler.shouldRetry(message)).toBe(false);
    });

    test('should return true for message with no retry count', () => {
      const message = {};
      expect(ackHandler.shouldRetry(message)).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should use default configuration', () => {
      const defaultHandler = new AcknowledgmentHandler();
      expect(defaultHandler.maxRetries).toBe(3);
      expect(defaultHandler.retryDelay).toBe(1000);
      expect(defaultHandler.deadLetterQueue).toBe('dead-letter');
    });

    test('should use custom configuration', () => {
      const customHandler = new AcknowledgmentHandler({
        maxRetries: 5,
        retryDelay: 2000,
        deadLetterQueue: 'custom-dlq',
      });

      expect(customHandler.maxRetries).toBe(5);
      expect(customHandler.retryDelay).toBe(2000);
      expect(customHandler.deadLetterQueue).toBe('custom-dlq');
    });
  });
});

describe('DeadLetterHandler', () => {
  let dlHandler;

  beforeEach(() => {
    dlHandler = new DeadLetterHandler();
  });

  describe('add()', () => {
    test('should add dead letter message', () => {
      const message = { id: '123', type: 'task' };
      const error = new Error('Processing failed');

      const deadLetter = dlHandler.add(message, error);

      expect(deadLetter.message).toBe(message);
      expect(deadLetter.error.message).toBe('Processing failed');
      expect(deadLetter.metadata.deadLetteredAt).toBeDefined();
    });

    test('should add metadata to dead letter', () => {
      const message = { id: '123', type: 'task' };
      const error = new Error('Processing failed');
      const metadata = { retryCount: 3, reason: 'max retries exceeded' };

      const deadLetter = dlHandler.add(message, error, metadata);

      expect(deadLetter.metadata.retryCount).toBe(3);
      expect(deadLetter.metadata.reason).toBe('max retries exceeded');
      expect(deadLetter.metadata.deadLetteredAt).toBeDefined();
    });

    test('should capture error stack', () => {
      const message = { id: '123', type: 'task' };
      const error = new Error('Processing failed');

      const deadLetter = dlHandler.add(message, error);

      expect(deadLetter.error.stack).toBeDefined();
    });
  });

  describe('getAll()', () => {
    test('should return all dead letters', () => {
      dlHandler.add({ id: '1' }, new Error('Error 1'));
      dlHandler.add({ id: '2' }, new Error('Error 2'));

      const all = dlHandler.getAll();

      expect(all).toHaveLength(2);
    });

    test('should return empty array when no dead letters', () => {
      expect(dlHandler.getAll()).toEqual([]);
    });
  });

  describe('getByMessageId()', () => {
    test('should return dead letters for specific message ID', () => {
      dlHandler.add({ id: '123' }, new Error('Error 1'));
      dlHandler.add({ id: '123' }, new Error('Error 2'));
      dlHandler.add({ id: '456' }, new Error('Error 3'));

      const results = dlHandler.getByMessageId('123');

      expect(results).toHaveLength(2);
      expect(results[0].message.id).toBe('123');
    });

    test('should return empty array for non-existent message ID', () => {
      const results = dlHandler.getByMessageId('999');
      expect(results).toEqual([]);
    });
  });

  describe('count()', () => {
    test('should return count of dead letters', () => {
      dlHandler.add({ id: '1' }, new Error('Error 1'));
      dlHandler.add({ id: '2' }, new Error('Error 2'));

      expect(dlHandler.count()).toBe(2);
    });

    test('should return 0 when no dead letters', () => {
      expect(dlHandler.count()).toBe(0);
    });
  });

  describe('clear()', () => {
    test('should clear all dead letters', () => {
      dlHandler.add({ id: '1' }, new Error('Error 1'));
      dlHandler.add({ id: '2' }, new Error('Error 2'));

      dlHandler.clear();

      expect(dlHandler.count()).toBe(0);
      expect(dlHandler.getAll()).toEqual([]);
    });
  });
});

describe('Integration: Message Processing Flow', () => {
  let router;
  let ackHandler;
  let dlHandler;
  let ack, nack, reject;

  beforeEach(() => {
    router = new MessageRouter();
    ackHandler = new AcknowledgmentHandler({ maxRetries: 2 });
    dlHandler = new DeadLetterHandler();

    ack = jest.fn();
    nack = jest.fn();
    reject = jest.fn();
  });

  test('should process valid message successfully', async () => {
    const taskHandler = jest.fn().mockResolvedValue({ processed: true });
    router.register('task', taskHandler);

    const message = {
      id: '123',
      type: 'task',
      from: 'agent-1',
      timestamp: Date.now(),
    };

    const processor = async (msg) => {
      await router.route(msg);
    };

    const result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });

    expect(result.status).toBe('ack');
    expect(taskHandler).toHaveBeenCalled();
  });

  test('should retry failed message', async () => {
    let attemptCount = 0;
    const taskHandler = jest.fn().mockImplementation(async () => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error('Temporary failure');
      }
      return { processed: true };
    });

    router.register('task', taskHandler);

    const message = {
      id: '123',
      type: 'task',
      from: 'agent-1',
      timestamp: Date.now(),
    };

    const processor = async (msg) => {
      await router.route(msg);
    };

    // First attempt - fails
    let result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });
    expect(result.status).toBe('nack');
    expect(result.retryCount).toBe(1);

    // Second attempt - fails
    result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });
    expect(result.status).toBe('nack');
    expect(result.retryCount).toBe(2);

    // Third attempt - exceeds max retries
    result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });
    expect(result.status).toBe('reject');
    expect(result.deadLetter).toBe(true);
  });

  test('should add to dead letter queue after max retries', async () => {
    const taskHandler = jest.fn().mockRejectedValue(new Error('Permanent failure'));
    router.register('task', taskHandler);

    const message = {
      id: '123',
      type: 'task',
      from: 'agent-1',
      timestamp: Date.now(),
      retryCount: 2,
    };

    const processor = async (msg) => {
      await router.route(msg);
    };

    const result = await ackHandler.handleMessage(message, processor, { ack, nack, reject });

    if (result.status === 'reject') {
      dlHandler.add(message, result.error, { retryCount: message.retryCount });
    }

    expect(dlHandler.count()).toBe(1);
    expect(dlHandler.getByMessageId('123')).toHaveLength(1);
  });
});
