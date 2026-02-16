/**
 * Logging Types
 * Type definitions for logging, structured logging, and log management
 */

/**
 * Log level
 */
export type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'debug'
  | 'verbose'
  | 'silly';

/**
 * Log severity
 */
export type LogSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Log entry
 */
export interface ILogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  module?: string;
  service?: string;
  hostname?: string;
  pid?: number;
  nodeVersion?: string;
  requestId?: string;
  userId?: string;
  agentId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  meta?: Record<string, unknown>;
  stack?: string;
  context?: ILogContext;
  error?: {
    code: string;
    message: string;
    stack?: string;
    details?: unknown;
  };
}

/**
 * Log context for structured logging
 */
export interface ILogContext {
  userId?: string;
  agentId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Log metadata
 */
export interface ILogMeta {
  [key: string]: unknown;
  module?: string;
  operation?: string;
  duration?: number;
  count?: number;
  size?: number;
  rate?: number;
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, meta?: ILogMeta): void;
  info(message: string, meta?: ILogMeta): void;
  warn(message: string, meta?: ILogMeta): void;
  error(message: string, error?: Error | unknown, meta?: ILogMeta): void;
  http(message: string, meta?: ILogMeta): void;
  verbose(message: string, meta?: ILogMeta): void;
  silly(message: string, meta?: ILogMeta): void;

  // Convenience methods
  debugAsync(message: string, meta?: ILogMeta): Promise<void>;
  infoAsync(message: string, meta?: ILogMeta): Promise<void>;
  warnAsync(message: string, meta?: ILogMeta): Promise<void>;
  errorAsync(message: string, error?: Error, meta?: ILogMeta): Promise<void>;

  // Context-aware logging
  child(metadata: Record<string, unknown>): ILogger;
  withContext(context: ILogContext): ILogger;

  // Shutdown
  shutdown(): Promise<void>;
}

/**
 * Child logger with context
 */
export interface IChildLogger extends ILogger {
  parentLogger: ILogger;
  metadata: Record<string, unknown>;
}

/**
 * Log transport
 */
export interface ILogTransport {
  name: string;
  log(entry: ILogEntry): void | Promise<void>;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

/**
 * File transport options
 */
export interface IFileTransportOptions {
  filename: string;
  maxSize?: string;
  maxFiles?: string;
  zippedArchive?: boolean;
  datePattern?: string;
}

/**
 * Console transport options
 */
export interface IConsoleTransportOptions {
  colorize?: boolean;
  timestamp?: boolean;
  prettyPrint?: boolean;
}

/**
 * Log formatter
 */
export interface ILogFormatter {
  format(entry: ILogEntry): string;
  name: string;
}

/**
 * Structured logging configuration
 */
export interface IStructuredLoggingConfig {
  enabled: boolean;
  outputFormat: 'JSON' | 'TEXT' | 'STRUCTURED';
  includeRequestContext: boolean;
  includeMetadata: boolean;
  includeStackTrace: boolean;
  maxDepth: number;
  redactPatterns?: RegExp[];
}

/**
 * Performance logging
 */
export interface IPerformanceLog {
  operation: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  status: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

/**
 * Audit logging
 */
export interface IAuditLog {
  id: string;
  action: string;
  userId: string;
  agentId?: string;
  timestamp: Date;
  resource: string;
  operation: string;
  changes?: {
    before: unknown;
    after: unknown;
  };
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}

/**
 * Security log
 */
export interface ISecurityLog {
  id: string;
  eventType: string;
  severity: LogSeverity;
  timestamp: Date;
  userId?: string;
  agentId?: string;
  resource: string;
  action: string;
  result: 'success' | 'failure' | 'blocked';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

/**
 * Database query log
 */
export interface IDatabaseQueryLog {
  id: string;
  query: string;
  duration: number;
  timestamp: Date;
  status: 'success' | 'failure' | 'timeout';
  affectedRows?: number;
  error?: {
    code: string;
    message: string;
  };
  context?: ILogContext;
}

/**
 * HTTP request log
 */
export interface IHTTPRequestLog {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  requestSize: number;
  responseSize: number;
  ip: string;
  userAgent: string;
  userId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Log aggregation config
 */
export interface ILogAggregationConfig {
  enabled: boolean;
  service: 'SPLUNK' | 'DATADOG' | 'ELK' | 'CLOUDWATCH' | 'STACKDRIVER';
  endpoint: string;
  apiKey: string;
  batchSize: number;
  flushInterval: number;
  retryPolicy?: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
}

/**
 * Log filtering
 */
export interface ILogFilter {
  apply(entry: ILogEntry): boolean;
  name: string;
}

/**
 * Log rotation config
 */
export interface ILogRotationConfig {
  enabled: boolean;
  maxSize: string;
  maxFiles: string;
  datePattern: string;
  zippedArchive: boolean;
  directory: string;
}

/**
 * Log statistics
 */
export interface ILogStatistics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  errorsInLastHour: number;
  warningsInLastHour: number;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: Date;
  }>;
  averageLogSize: number;
  diskUsageMB: number;
}

/**
 * Context manager interface
 */
export interface IContextManager {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  getAll(): Record<string, unknown>;
  clear(): void;
  clearKey(key: string): void;
  run<T>(callback: () => T): T;
}

/**
 * Log redaction config
 */
export interface ILogRedactionConfig {
  enabled: boolean;
  patterns: Array<{
    pattern: RegExp;
    replacement: string;
  }>;
  fields: string[];
  maskValue?: string;
}

/**
 * Winston logger config (if using Winston)
 */
export interface IWinstonConfig {
  level: LogLevel;
  format: string;
  transports: Array<{
    type: string;
    filename?: string;
    options?: Record<string, unknown>;
  }>;
  defaultMeta: Record<string, unknown>;
  exitOnError: boolean;
  silent: boolean;
}

/**
 * Log streaming interface
 */
export interface ILogStream {
  subscribe(callback: (entry: ILogEntry) => void): void;
  unsubscribe(callback: (entry: ILogEntry) => void): void;
  stream(): AsyncIterable<ILogEntry>;
}

/**
 * Log query interface
 */
export interface ILogQuery {
  level?: LogLevel[];
  module?: string[];
  userId?: string;
  agentId?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  message?: string;
  limit?: number;
}

/**
 * Log search result
 */
export interface ILogSearchResult {
  entries: ILogEntry[];
  total: number;
  limit: number;
  offset: number;
  searchTime: number;
}
