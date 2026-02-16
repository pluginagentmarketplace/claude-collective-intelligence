/**
 * AI Agent SDK - Main export
 */

// Client
export { AgentClient } from './client/AgentClient.js';
export { AgentsManager } from './client/AgentsManager.js';
export { TasksManager } from './client/TasksManager.js';

// Types
export * from './types/index.js';

// Errors
export {
  AgentClientError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  TimeoutError,
  RateLimitError,
  ServerError,
  NetworkError,
  ConnectionError,
  StreamError
} from './errors/AgentClientError.js';

// Utils
export { retry, RetryPresets } from './utils/retry.js';
export { ConnectionPool } from './utils/pool.js';
