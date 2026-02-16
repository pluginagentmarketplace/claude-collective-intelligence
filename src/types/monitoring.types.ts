/**
 * Monitoring Types
 * Type definitions for metrics, health checks, and monitoring
 */

/**
 * Metric types
 */
export type MetricType = 'COUNTER' | 'GAUGE' | 'HISTOGRAM' | 'SUMMARY';

/**
 * Metric interface
 */
export interface IMetric {
  name: string;
  type: MetricType;
  value: number;
  unit?: string;
  timestamp: Date;
  tags?: Record<string, string>;
  labels?: Record<string, string>;
}

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void;

  incrementCounter(
    name: string,
    value?: number,
    tags?: Record<string, string>
  ): void;

  recordGauge(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void;

  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void;

  recordSummary(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void;

  getMetrics(): IMetric[];
  getMetric(name: string): IMetric | null;
  getMetricsByTag(tag: string, value: string): IMetric[];
  clearMetrics(): void;
  resetMetric(name: string): void;
}

/**
 * Metrics snapshot
 */
export interface IMetricsSnapshot {
  timestamp: Date;
  metrics: IMetric[];
  duration: number;
}

/**
 * Health check interface
 */
export interface IHealthCheck {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  checks: Record<string, IHealthCheckResult>;
  dependencies?: Record<string, HealthStatus>;
}

/**
 * Health status
 */
export type HealthStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';

/**
 * Health check result
 */
export interface IHealthCheckResult {
  status: HealthStatus;
  responseTime?: number;
  details?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Health checker interface
 */
export interface IHealthChecker {
  check(component: string): Promise<IHealthCheckResult>;
  checkAll(): Promise<IHealthCheck>;
  isHealthy(component: string): Promise<boolean>;
  getStatus(component: string): Promise<HealthStatus>;
  registerCheck(
    name: string,
    checker: () => Promise<IHealthCheckResult>
  ): void;
  registerDependency(name: string, checker: () => Promise<HealthStatus>): void;
}

/**
 * Alert severity
 */
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

/**
 * Alert interface
 */
export interface IAlert {
  id: string;
  name: string;
  severity: AlertSeverity;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  message: string;
  timestamp: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  metadata?: Record<string, unknown>;
  source?: string;
  actions?: IAlertAction[];
}

/**
 * Alert action
 */
export interface IAlertAction {
  type: 'NOTIFY' | 'ESCALATE' | 'EXECUTE' | 'LOG';
  target?: string;
  message?: string;
  actionTime: Date;
  result?: 'SUCCESS' | 'FAILURE';
}

/**
 * Alert rule
 */
export interface IAlertRule {
  id: string;
  name: string;
  description?: string;
  condition: string;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  action?: string;
  notificationChannels?: string[];
  cooldownPeriod?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Alerts manager interface
 */
export interface IAlertsManager {
  createAlert(rule: IAlertRule): Promise<void>;
  deleteAlert(alertId: string): Promise<void>;
  updateAlert(alertId: string, updates: Partial<IAlertRule>): Promise<void>;
  getAlert(alertId: string): Promise<IAlert | null>;
  listAlerts(filter?: Record<string, unknown>): Promise<IAlert[]>;
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void>;
  resolveAlert(alertId: string): Promise<void>;
  checkAndTrigger(metricName: string, value: number): Promise<void>;
}

/**
 * Performance metrics
 */
export interface IPerformanceMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  responseTime: {
    min: number;
    max: number;
    average: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  requestCount: number;
  activeConnections: number;
  queueSize: number;
}

/**
 * System metrics
 */
export interface ISystemMetrics {
  timestamp: Date;
  cpuCount: number;
  cpuUsagePercent: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryAvailable: number;
  memoryPercent: number;
  diskTotal: number;
  diskUsed: number;
  diskAvailable: number;
  diskPercent: number;
  networkIn: number;
  networkOut: number;
  processCount: number;
  loadAverage: number[];
}

/**
 * Application metrics
 */
export interface IApplicationMetrics {
  timestamp: Date;
  requestsPerSecond: number;
  errorsPerSecond: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeRequests: number;
  queuedRequests: number;
  cacheHitRate: number;
  databaseQueryTime: number;
  externalApiCalls: number;
  externalApiErrors: number;
}

/**
 * Service level indicator (SLI)
 */
export interface ISLI {
  name: string;
  metric: string;
  threshold: number;
  window: number; // milliseconds
  currentValue: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
}

/**
 * Service level objective (SLO)
 */
export interface ISLO {
  name: string;
  sluis: ISLI[];
  targetPercentage: number;
  evaluationWindow: number;
  currentPercentage: number;
  errorBudget: number;
}

/**
 * Trace interface (for distributed tracing)
 */
export interface ITrace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'SUCCESS' | 'ERROR';
  tags?: Record<string, unknown>;
  logs?: Array<{
    timestamp: Date;
    message: string;
    level: string;
  }>;
  error?: {
    kind: string;
    message: string;
    stack?: string;
  };
}

/**
 * Span (smaller unit of trace)
 */
export interface ISpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  tags: Record<string, unknown>;
  logs: Array<{
    timestamp: Date;
    event: string;
    message?: string;
    payload?: unknown;
  }>;
  status: 'SUCCESS' | 'ERROR' | 'DEADLINE_EXCEEDED';
  error?: {
    kind: string;
    message: string;
  };
}

/**
 * Tracer interface
 */
export interface ITracer {
  startSpan(
    operationName: string,
    parentSpan?: ISpan
  ): ISpan;

  finishSpan(span: ISpan): void;

  addTagToSpan(span: ISpan, key: string, value: unknown): void;

  addLogToSpan(
    span: ISpan,
    message: string,
    level?: string
  ): void;

  recordError(span: ISpan, error: Error): void;
}

/**
 * Dashboard widget data
 */
export interface IDashboardWidget {
  id: string;
  type: 'METRIC' | 'CHART' | 'GAUGE' | 'TABLE' | 'LOG' | 'ALERT';
  title: string;
  metrics: IMetric[];
  refreshInterval: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Dashboard configuration
 */
export interface IDashboardConfig {
  id: string;
  name: string;
  description?: string;
  widgets: IDashboardWidget[];
  refreshInterval: number;
  autoRefresh: boolean;
  tags?: string[];
}

/**
 * Monitoring configuration
 */
export interface IMonitoringConfig {
  metricsEnabled: boolean;
  healthCheckEnabled: boolean;
  alertsEnabled: boolean;
  tracingEnabled: boolean;
  loggingEnabled: boolean;
  metricsInterval: number;
  healthCheckInterval: number;
  retentionPeriod: number;
  maxMetricsPerSecond: number;
  samplingRate: number;
}

/**
 * Anomaly detection
 */
export interface IAnomaly {
  id: string;
  metricName: string;
  anomalyType: 'SPIKE' | 'DROP' | 'TREND' | 'PATTERN';
  severity: AlertSeverity;
  detectedAt: Date;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  confidence: number;
  details?: unknown;
}

/**
 * Anomaly detector interface
 */
export interface IAnomalyDetector {
  detect(metrics: IMetric[]): Promise<IAnomaly[]>;
  train(historicalMetrics: IMetric[]): Promise<void>;
  getModel(metricName: string): unknown;
}
