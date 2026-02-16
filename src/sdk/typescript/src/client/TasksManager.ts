/**
 * Tasks Manager - Handle all task-related operations
 */

import { Task, TaskSubmitParams, TaskStatus, PaginatedResponse } from '../types/index.js';
import { AgentClient } from './AgentClient.js';
import { TimeoutError } from '../errors/AgentClientError.js';

/**
 * Tasks Manager
 */
export class TasksManager {
  private pollInterval = 1000; // 1 second
  private maxPollWait = 3600000; // 1 hour

  constructor(private client: AgentClient) {}

  /**
   * Submit a task
   */
  async submit(params: TaskSubmitParams): Promise<Task> {
    return this.client.request<Task>('POST', '/tasks', params);
  }

  /**
   * Get task by ID
   */
  async get(taskId: string): Promise<Task> {
    return this.client.request<Task>('GET', `/tasks/${taskId}`);
  }

  /**
   * List tasks
   */
  async list(options?: {
    page?: number;
    limit?: number;
    status?: string;
    agentId?: string;
  }): Promise<PaginatedResponse<Task>> {
    const query = new URLSearchParams();
    if (options?.page) query.append('page', String(options.page));
    if (options?.limit) query.append('limit', String(options.limit));
    if (options?.status) query.append('status', options.status);
    if (options?.agentId) query.append('agentId', options.agentId);

    const queryString = query.toString();
    const path = `/tasks${queryString ? '?' + queryString : ''}`;

    return this.client.request<PaginatedResponse<Task>>('GET', path);
  }

  /**
   * Get task status
   */
  async getStatus(taskId: string): Promise<TaskStatus> {
    const task = await this.get(taskId);
    return task.status;
  }

  /**
   * Wait for task completion
   */
  async waitForCompletion(
    taskId: string,
    timeout?: number
  ): Promise<Task> {
    const startTime = Date.now();
    const effectiveTimeout = timeout || this.maxPollWait;

    while (true) {
      const task = await this.get(taskId);

      // Task completed or failed
      if (
        task.status === 'COMPLETED' ||
        task.status === 'FAILED' ||
        task.status === 'CANCELLED' ||
        task.status === 'TIMED_OUT'
      ) {
        return task;
      }

      // Check timeout
      if (Date.now() - startTime > effectiveTimeout) {
        throw new TimeoutError(
          `Task ${taskId} did not complete within ${effectiveTimeout}ms`,
          effectiveTimeout
        );
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * Cancel a task
   */
  async cancel(taskId: string, reason?: string): Promise<Task> {
    return this.client.request<Task>('POST', `/tasks/${taskId}/cancel`, {
      reason: reason || 'Cancelled by client'
    });
  }

  /**
   * Retry a task
   */
  async retry(taskId: string): Promise<Task> {
    return this.client.request<Task>('POST', `/tasks/${taskId}/retry`);
  }

  /**
   * Get task result
   */
  async getResult(taskId: string) {
    const task = await this.get(taskId);
    return task.result;
  }

  /**
   * Get task error
   */
  async getError(taskId: string) {
    const task = await this.get(taskId);
    return task.error;
  }

  /**
   * Submit multiple tasks
   */
  async submitBatch(taskParams: TaskSubmitParams[]): Promise<Task[]> {
    return Promise.all(taskParams.map(params => this.submit(params)));
  }

  /**
   * Wait for multiple tasks
   */
  async waitForAll(taskIds: string[], timeout?: number): Promise<Task[]> {
    return Promise.all(
      taskIds.map(id => this.waitForCompletion(id, timeout))
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
