/**
 * Main Agent Client
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  ClientConfig,
  Agent,
  AgentCreateParams,
  Task,
  TaskSubmitParams,
  ApiResponse,
  HealthStatus,
  ClientMetrics
} from '../types/index.js';
import {
  AgentClientError,
  TimeoutError,
  ValidationError,
  NotFoundError
} from '../errors/AgentClientError.js';
import { ConnectionPool } from '../utils/pool.js';
import { retry, RetryPresets } from '../utils/retry.js';
import { AgentsManager } from './AgentsManager.js';
import { TasksManager } from './TasksManager.js';

/**
 * Main Agent Client
 */
export class AgentClient {
  private config: ClientConfig;
  private pool: ConnectionPool;
  private client: AxiosInstance;
  private agents: AgentsManager;
  private tasks: TasksManager;
  private metrics: ClientMetrics;
  private requestId = 0;

  constructor(config: ClientConfig) {
    this.config = this.validateConfig(config);
    this.client = this.createClient();
    this.pool = new ConnectionPool(
      this.config.apiUrl,
      this.getHeaders(),
      this.config.poolConfig || {
        maxConnections: 10,
        maxIdleTime: 60000
      }
    );

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalErrors: 0,
      averageLatency: 0,
      successRate: 0,
      errorRate: 0
    };

    this.agents = new AgentsManager(this);
    this.tasks = new TasksManager(this);
  }

  /**
   * Validate client configuration
   */
  private validateConfig(config: ClientConfig): ClientConfig {
    if (!config.apiUrl) {
      throw new ValidationError('apiUrl is required');
    }
    if (!config.apiKey) {
      throw new ValidationError('apiKey is required');
    }

    return {
      timeout: 30000,
      maxRetries: 3,
      retryConfig: {
        initialDelay: 100,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      poolConfig: {
        maxConnections: 10,
        maxIdleTime: 60000
      },
      ...config
    };
  }

  /**
   * Create axios client
   */
  private createClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.apiUrl,
      headers: this.getHeaders(),
      timeout: this.config.timeout,
      validateStatus: () => true // Don't throw on any status
    });

    // Add request interceptors
    client.interceptors.request.use(
      async config => {
        if (this.config.requestInterceptors) {
          let modifiedConfig = config;
          for (const interceptor of this.config.requestInterceptors) {
            modifiedConfig = await interceptor({
              method: config.method as any,
              path: config.url || '',
              headers: config.headers as Record<string, string>
            }) as any;
          }
          return modifiedConfig;
        }
        return config;
      },
      error => Promise.reject(error)
    );

    // Add response interceptors
    client.interceptors.response.use(
      async response => {
        if (this.config.responseInterceptors) {
          let modifiedResponse = response;
          for (const interceptor of this.config.responseInterceptors) {
            modifiedResponse = await interceptor({
              status: response.status,
              headers: response.headers as Record<string, string>,
              data: response.data
            }) as any;
          }
          return modifiedResponse;
        }
        return response;
      },
      error => Promise.reject(error)
    );

    return client;
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': 'ai-agent-sdk/1.0.0'
    };
  }

  /**
   * Make HTTP request
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    data?: unknown,
    options?: { timeout?: number; retries?: number }
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const makeRequest = async (): Promise<T> => {
      try {
        const response = await this.client({
          method,
          url: path,
          data,
          timeout: options?.timeout || this.config.timeout
        });

        if (response.status >= 400) {
          this.handleErrorResponse(response);
        }

        const result = response.data as ApiResponse<T>;
        if (!result.success && result.error) {
          throw new AgentClientError(
            result.error.message,
            result.error.code,
            response.status,
            result.error.details
          );
        }

        return result.data as T;
      } catch (error) {
        if (error instanceof AgentClientError) {
          throw error;
        }

        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED') {
            throw new TimeoutError('Request timeout', options?.timeout);
          }
          throw new AgentClientError(
            error.message,
            'HTTP_ERROR',
            error.response?.status
          );
        }

        throw error;
      }
    };

    try {
      const result = await retry(
        makeRequest,
        RetryPresets.moderate,
        {
          maxRetries: options?.retries ?? this.config.maxRetries
        }
      );

      this.updateMetrics(true, Date.now() - startTime);
      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Handle error responses
   */
  private handleErrorResponse(response: any): void {
    const status = response.status;
    const data = response.data;

    if (status === 400) {
      throw new ValidationError(data.error?.message || 'Bad request', data.error?.details);
    }

    if (status === 401) {
      throw new AgentClientError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    if (status === 403) {
      throw new AgentClientError('Forbidden', 'FORBIDDEN', 403);
    }

    if (status === 404) {
      throw new NotFoundError(data.error?.message || 'Not found');
    }

    if (status === 429) {
      throw new AgentClientError('Rate limit exceeded', 'RATE_LIMIT', 429);
    }

    if (status >= 500) {
      throw new AgentClientError(
        data.error?.message || 'Server error',
        'SERVER_ERROR',
        status
      );
    }

    throw new AgentClientError(
      data.error?.message || 'Unknown error',
      data.error?.code || 'UNKNOWN',
      status
    );
  }

  /**
   * Update request metrics
   */
  private updateMetrics(success: boolean, latency: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.metrics.totalErrors++;
    }

    const avgLatency = this.metrics.averageLatency;
    this.metrics.averageLatency =
      (avgLatency * (this.metrics.totalRequests - 1) + latency) /
      this.metrics.totalRequests;

    this.metrics.successRate =
      (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
    this.metrics.errorRate =
      (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `${++this.requestId}-${uuidv4()}`;
  }

  /**
   * Get health status
   */
  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>('GET', '/health');
  }

  /**
   * Get client metrics
   */
  getMetrics(): ClientMetrics {
    return { ...this.metrics };
  }

  /**
   * Get agents manager
   */
  get agentsManager(): AgentsManager {
    return this.agents;
  }

  /**
   * Get tasks manager
   */
  get tasksManager(): TasksManager {
    return this.tasks;
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    await this.pool.drain();
  }
}

// Export managers with convenience property names
Object.defineProperty(AgentClient.prototype, 'agents', {
  get(this: AgentClient) {
    return this.agentsManager;
  }
});

Object.defineProperty(AgentClient.prototype, 'tasks', {
  get(this: AgentClient) {
    return this.tasksManager;
  }
});
