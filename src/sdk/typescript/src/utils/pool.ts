/**
 * Connection pool for managing HTTP connections
 */

import axios, { AxiosInstance } from 'axios';

export interface PoolConfig {
  maxConnections: number;
  maxIdleTime: number;
}

/**
 * Connection pool entry
 */
interface PoolEntry {
  client: AxiosInstance;
  lastUsed: number;
  inUse: boolean;
}

/**
 * Connection pool
 */
export class ConnectionPool {
  private pool: PoolEntry[] = [];
  private config: PoolConfig;
  private baseUrl: string;
  private headers: Record<string, string>;
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor(
    baseUrl: string,
    headers: Record<string, string>,
    config: PoolConfig
  ) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.config = config;
    this.startCleanup();
  }

  /**
   * Get a connection from the pool
   */
  async acquire(): Promise<AxiosInstance> {
    // Try to find an idle connection
    const idleConnection = this.pool.find(entry => !entry.inUse);

    if (idleConnection) {
      idleConnection.inUse = true;
      idleConnection.lastUsed = Date.now();
      return idleConnection.client;
    }

    // Create new connection if under limit
    if (this.pool.length < this.config.maxConnections) {
      const client = this.createClient();
      const entry: PoolEntry = {
        client,
        lastUsed: Date.now(),
        inUse: true
      };
      this.pool.push(entry);
      return client;
    }

    // Wait for a connection to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const available = this.pool.find(entry => !entry.inUse);
        if (available) {
          clearInterval(checkInterval);
          available.inUse = true;
          available.lastUsed = Date.now();
          resolve(available.client);
        }
      }, 10);
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(client: AxiosInstance): void {
    const entry = this.pool.find(entry => entry.client === client);
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Create a new axios client
   */
  private createClient(): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      headers: this.headers,
      timeout: 30000,
      validateStatus: () => true // Don't throw on any status
    });
  }

  /**
   * Start cleanup interval to remove idle connections
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.pool = this.pool.filter(entry => {
        if (entry.inUse) return true;
        if (now - entry.lastUsed > this.config.maxIdleTime) {
          return false; // Remove idle connection
        }
        return true;
      });
    }, this.config.maxIdleTime);
  }

  /**
   * Drain the pool and cleanup resources
   */
  async drain(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.pool.forEach(entry => {
      try {
        entry.client.defaults.timeout = 0;
      } catch {
        // Ignore cleanup errors
      }
    });

    this.pool = [];
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; inUse: number; idle: number } {
    const inUse = this.pool.filter(e => e.inUse).length;
    return {
      total: this.pool.length,
      inUse,
      idle: this.pool.length - inUse
    };
  }
}
