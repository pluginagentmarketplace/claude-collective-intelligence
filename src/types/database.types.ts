/**
 * Database Types
 * Type definitions for database layer, connections, and repositories
 */

import { IEntity } from './common.types';

/**
 * Database connection options
 */
export interface IDatabaseConnectionOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  poolStrategy?: 'FIFO' | 'LIFO';
}

/**
 * Query result
 */
export interface IQueryResult<T> {
  rows: T[];
  rowCount: number;
  command?: string;
  oid?: number;
}

/**
 * Query options
 */
export interface IQueryOptions {
  timeout?: number;
  poolSize?: number;
  retryOnError?: boolean;
  retryCount?: number;
  cacheResult?: boolean;
  cacheTTL?: number;
}

/**
 * Database connection interface
 */
export interface IConnection {
  query<T = unknown>(
    sql: string,
    params?: unknown[],
    options?: IQueryOptions
  ): Promise<IQueryResult<T>>;

  queryOne<T = unknown>(
    sql: string,
    params?: unknown[],
    options?: IQueryOptions
  ): Promise<T | null>;

  execute(sql: string, params?: unknown[]): Promise<IQueryResult<unknown>>;

  transaction<T>(callback: (conn: IConnection) => Promise<T>): Promise<T>;

  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;

  close(): Promise<void>;
  isConnected(): boolean;
  getConnectionInfo(): unknown;
}

/**
 * Connection pool interface
 */
export interface IConnectionPool {
  getConnection(): Promise<IConnection>;
  releaseConnection(connection: IConnection): Promise<void>;
  close(): Promise<void>;
  getStatus(): IPoolStatus;
  query<T>(sql: string, params?: unknown[]): Promise<IQueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<IQueryResult<unknown>>;
}

/**
 * Pool status
 */
export interface IPoolStatus {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  waitingRequests: number;
  averageWaitTime: number;
}

/**
 * Repository interface (generic)
 */
export interface IRepository<T extends IEntity, ID = string> {
  create(data: Partial<T>): Promise<T>;
  findById(id: ID): Promise<T | null>;
  findAll(options?: IRepositoryOptions): Promise<T[]>;
  findOne(filter: Record<string, unknown>): Promise<T | null>;
  findMany(
    filter: Record<string, unknown>,
    options?: IRepositoryOptions
  ): Promise<T[]>;
  update(id: ID, data: Partial<T>): Promise<T>;
  updateMany(
    filter: Record<string, unknown>,
    data: Partial<T>
  ): Promise<number>;
  delete(id: ID): Promise<boolean>;
  deleteMany(filter: Record<string, unknown>): Promise<number>;
  exists(filter: Record<string, unknown>): Promise<boolean>;
  count(filter?: Record<string, unknown>): Promise<number>;
  aggregate(
    pipeline: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]>;
}

/**
 * Repository options
 */
export interface IRepositoryOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, 'ASC' | 'DESC'>;
  select?: string[];
  relations?: string[];
  cache?: boolean;
  cacheTTL?: number;
}

/**
 * Transaction interface
 */
export interface ITransaction {
  id: string;
  startTime: Date;
  isolationLevel: IsolationLevel;
  status: 'PENDING' | 'COMMITTED' | 'ROLLED_BACK';
  operations: ITransactionOperation[];

  addOperation(operation: ITransactionOperation): void;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  status(): string;
}

/**
 * Isolation level
 */
export type IsolationLevel =
  | 'READ_UNCOMMITTED'
  | 'READ_COMMITTED'
  | 'REPEATABLE_READ'
  | 'SERIALIZABLE';

/**
 * Transaction operation
 */
export interface ITransactionOperation {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data?: unknown;
  filter?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Migration interface
 */
export interface IMigration {
  version: string;
  name: string;
  up(): Promise<void>;
  down(): Promise<void>;
  description?: string;
  timestamp: Date;
}

/**
 * Migration status
 */
export interface IMigrationStatus {
  version: string;
  name: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  appliedAt?: Date;
  executionTime?: number;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Index definition
 */
export interface IIndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  sparse?: boolean;
  type?: 'BTREE' | 'HASH' | 'FULLTEXT';
}

/**
 * Foreign key constraint
 */
export interface IForeignKeyConstraint {
  name: string;
  table: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: 'CASCADE' | 'SET_NULL' | 'RESTRICT' | 'NO_ACTION';
  onUpdate: 'CASCADE' | 'SET_NULL' | 'RESTRICT' | 'NO_ACTION';
}

/**
 * Schema information
 */
export interface ISchemaInfo {
  database: string;
  tables: ITableInfo[];
  views: IViewInfo[];
  sequences: ISequenceInfo[];
  extensions?: string[];
}

/**
 * Table information
 */
export interface ITableInfo {
  name: string;
  schema: string;
  columns: IColumnInfo[];
  primaryKey: string[];
  indexes: IIndexDefinition[];
  constraints: IForeignKeyConstraint[];
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * Column information
 */
export interface IColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  default?: unknown;
  comment?: string;
}

/**
 * View information
 */
export interface IViewInfo {
  name: string;
  schema: string;
  definition: string;
  materialized: boolean;
}

/**
 * Sequence information
 */
export interface ISequenceInfo {
  name: string;
  schema: string;
  startValue: number;
  currentValue: number;
  incrementBy: number;
  minValue: number;
  maxValue: number;
}

/**
 * Database backup info
 */
export interface IDatabaseBackup {
  id: string;
  timestamp: Date;
  size: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  location: string;
  retentionDays: number;
  encrypted: boolean;
  verified: boolean;
  error?: string;
}

/**
 * Query execution plan
 */
export interface IQueryExecutionPlan {
  plan: unknown;
  estimatedRows: number;
  estimatedCost: number;
  actualRows?: number;
  actualCost?: number;
  executionTime: number;
}

/**
 * Database statistics
 */
export interface IDatabaseStatistics {
  databaseName: string;
  totalTables: number;
  totalRows: number;
  totalSize: number;
  indexSize: number;
  tableStatistics: {
    tableName: string;
    rowCount: number;
    size: number;
    indexSize: number;
    lastAnalyzed: Date;
  }[];
}

/**
 * Connection monitor
 */
export interface IConnectionMonitor {
  getActiveConnections(): number;
  getIdleConnections(): number;
  getWaitingRequests(): number;
  getConnectionStats(): IConnectionStats;
  closeIdleConnections(maxIdleTime: number): Promise<number>;
}

/**
 * Connection stats
 */
export interface IConnectionStats {
  totalCreated: number;
  totalClosed: number;
  averageLifetime: number;
  averageIdleTime: number;
  peakConnections: number;
  peakTime: Date;
}

/**
 * Bulk operation
 */
export interface IBulkOperation<T extends IEntity> {
  inserts: Partial<T>[];
  updates: Array<{
    id: string;
    data: Partial<T>;
  }>;
  deletes: string[];
  batchSize: number;

  addInsert(data: Partial<T>): void;
  addUpdate(id: string, data: Partial<T>): void;
  addDelete(id: string): void;
  execute(): Promise<IBulkOperationResult>;
}

/**
 * Bulk operation result
 */
export interface IBulkOperationResult {
  insertedCount: number;
  updatedCount: number;
  deletedCount: number;
  errors: Array<{
    index: number;
    operation: string;
    error: string;
  }>;
  executionTime: number;
}

/**
 * Replication config
 */
export interface IReplicationConfig {
  enabled: boolean;
  mode: 'MASTER' | 'SLAVE' | 'BIDIRECTIONAL';
  replicaHosts: string[];
  syncInterval: number;
  maxLag: number;
}

/**
 * CDC (Change Data Capture) config
 */
export interface ICDCConfig {
  enabled: boolean;
  tables: string[];
  format: 'JSON' | 'AVRO' | 'PROTOBUF';
  retention: number;
  pollInterval: number;
}
