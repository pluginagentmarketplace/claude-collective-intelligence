/**
 * Agents Manager - Handle all agent-related operations
 */

import { Agent, AgentCreateParams, PaginatedResponse } from '../types/index.js';
import { AgentClient } from './AgentClient.js';

/**
 * Agents Manager
 */
export class AgentsManager {
  constructor(private client: AgentClient) {}

  /**
   * Create a new agent
   */
  async create(params: AgentCreateParams): Promise<Agent> {
    return this.client.request<Agent>('POST', '/agents', params);
  }

  /**
   * Get agent by ID
   */
  async get(agentId: string): Promise<Agent> {
    return this.client.request<Agent>('GET', `/agents/${agentId}`);
  }

  /**
   * List all agents
   */
  async list(options?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  }): Promise<PaginatedResponse<Agent>> {
    const query = new URLSearchParams();
    if (options?.page) query.append('page', String(options.page));
    if (options?.limit) query.append('limit', String(options.limit));
    if (options?.type) query.append('type', options.type);
    if (options?.status) query.append('status', options.status);

    const queryString = query.toString();
    const path = `/agents${queryString ? '?' + queryString : ''}`;

    return this.client.request<PaginatedResponse<Agent>>('GET', path);
  }

  /**
   * Update agent
   */
  async update(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    return this.client.request<Agent>('PUT', `/agents/${agentId}`, updates);
  }

  /**
   * Delete agent
   */
  async delete(agentId: string): Promise<void> {
    await this.client.request<void>('DELETE', `/agents/${agentId}`);
  }

  /**
   * Get agent status
   */
  async getStatus(agentId: string): Promise<string> {
    const agent = await this.get(agentId);
    return agent.status;
  }

  /**
   * Get agent capabilities
   */
  async getCapabilities(agentId: string): Promise<string[]> {
    const agent = await this.get(agentId);
    return agent.capabilities;
  }

  /**
   * Check if agent has capability
   */
  async hasCapability(agentId: string, capability: string): Promise<boolean> {
    const agent = await this.get(agentId);
    return agent.capabilities.includes(capability);
  }
}
