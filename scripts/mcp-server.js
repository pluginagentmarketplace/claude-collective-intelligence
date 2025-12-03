#!/usr/bin/env node
/**
 * MCP Server for RabbitMQ Multi-Agent Orchestration
 *
 * This server enables Claude Code instances to communicate with each other
 * via RabbitMQ message broker. Each Claude Code terminal can:
 * - Register as an agent (leader, worker, collaborator)
 * - Send/receive tasks
 * - Participate in brainstorming sessions
 * - Vote on decisions
 * - Monitor system status
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RabbitMQClient } from './rabbitmq-client.js';
import { v4 as uuidv4 } from 'uuid';

// Global state
let client = null;
let agentRole = null;
let agentName = null;
let isInitialized = false;
const pendingTasks = [];
const receivedMessages = [];
const brainstormSessions = new Map();
const voteResults = new Map();

/**
 * Initialize RabbitMQ connection
 */
async function initializeClient(role = 'worker', name = null) {
  if (client && client.isHealthy()) {
    return { success: true, message: 'Already connected' };
  }

  try {
    client = new RabbitMQClient();
    await client.connect();

    // Setup queues and exchanges
    await client.setupTaskQueue();
    await client.setupResultQueue();
    await client.setupStatusExchange();
    const brainstorm = await client.setupBrainstormExchange();

    agentRole = role;
    agentName = name || `Claude-${role}-${client.agentId.slice(-6)}`;
    isInitialized = true;

    // Start listening based on role
    if (role === 'worker' || role === 'collaborator') {
      await setupTaskListener();
    }

    await setupBrainstormListener(brainstorm.queueName);
    await setupResultListener();

    // Announce presence
    await client.publishStatus({
      event: 'agent_joined',
      role: agentRole,
      name: agentName,
      capabilities: getRoleCapabilities(role)
    }, 'agent.status.connected');

    return {
      success: true,
      agentId: client.agentId,
      agentName,
      role: agentRole,
      message: `Connected as ${agentName} (${role})`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get role capabilities
 */
function getRoleCapabilities(role) {
  const capabilities = {
    'team-leader': ['assign_tasks', 'aggregate_results', 'initiate_brainstorm', 'create_votes'],
    'worker': ['execute_tasks', 'report_results', 'participate_brainstorm', 'cast_votes'],
    'collaborator': ['propose_ideas', 'participate_brainstorm', 'cast_votes', 'review_work'],
    'monitor': ['view_status', 'track_metrics', 'generate_reports']
  };
  return capabilities[role] || capabilities['worker'];
}

/**
 * Setup task listener
 */
async function setupTaskListener() {
  await client.consumeTasks('agent.tasks', async (msg, { ack }) => {
    pendingTasks.push({
      ...msg,
      receivedAt: Date.now()
    });
    ack();
  });
}

/**
 * Setup brainstorm listener
 */
async function setupBrainstormListener(queueName) {
  await client.listenBrainstorm(queueName, async (msg) => {
    receivedMessages.push({
      type: 'brainstorm',
      ...msg,
      receivedAt: Date.now()
    });

    // Track brainstorm sessions
    if (msg.message?.sessionId) {
      const sessionId = msg.message.sessionId;
      if (!brainstormSessions.has(sessionId)) {
        brainstormSessions.set(sessionId, {
          id: sessionId,
          topic: msg.message.topic,
          ideas: [],
          startedAt: Date.now()
        });
      }
      if (msg.message.idea) {
        brainstormSessions.get(sessionId).ideas.push({
          from: msg.from,
          idea: msg.message.idea,
          timestamp: msg.timestamp
        });
      }
    }
  });
}

/**
 * Setup result listener
 */
async function setupResultListener() {
  await client.consumeResults('agent.results', async (msg) => {
    receivedMessages.push({
      type: 'result',
      ...msg,
      receivedAt: Date.now()
    });
  });
}

// Create MCP Server
const server = new Server(
  {
    name: 'rabbitmq-orchestrator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // === Connection & Registration ===
      {
        name: 'register_agent',
        description: 'Register this Claude Code instance as an agent in the multi-agent system. Must be called first before using other tools.',
        inputSchema: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: ['team-leader', 'worker', 'collaborator', 'monitor'],
              description: 'Agent role: team-leader (coordinates), worker (executes), collaborator (brainstorms), monitor (observes)'
            },
            name: {
              type: 'string',
              description: 'Optional custom name for this agent'
            }
          },
          required: ['role']
        }
      },
      {
        name: 'get_connection_status',
        description: 'Check the current connection status and agent information',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },

      // === Task Management ===
      {
        name: 'send_task',
        description: 'Send a task to be executed by worker agents. Tasks are distributed via load balancing.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Short title for the task'
            },
            description: {
              type: 'string',
              description: 'Detailed description of what needs to be done'
            },
            priority: {
              type: 'string',
              enum: ['critical', 'high', 'normal', 'low'],
              description: 'Task priority level'
            },
            context: {
              type: 'object',
              description: 'Additional context data (files, parameters, etc.)'
            }
          },
          required: ['title', 'description']
        }
      },
      {
        name: 'get_pending_tasks',
        description: 'Get list of pending tasks assigned to this agent',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return'
            }
          }
        }
      },
      {
        name: 'complete_task',
        description: 'Mark a task as completed and publish the result',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'ID of the task to complete'
            },
            result: {
              type: 'string',
              description: 'Result/output of the task'
            },
            status: {
              type: 'string',
              enum: ['completed', 'failed', 'partial'],
              description: 'Task completion status'
            }
          },
          required: ['taskId', 'result']
        }
      },

      // === Brainstorming ===
      {
        name: 'start_brainstorm',
        description: 'Start a new brainstorming session. All connected agents will be notified.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Topic/title of the brainstorm session'
            },
            question: {
              type: 'string',
              description: 'The question or problem to brainstorm about'
            },
            duration: {
              type: 'number',
              description: 'Duration in minutes (default: 10)'
            }
          },
          required: ['topic', 'question']
        }
      },
      {
        name: 'propose_idea',
        description: 'Propose an idea in an active brainstorming session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Brainstorm session ID'
            },
            idea: {
              type: 'string',
              description: 'Your idea or suggestion'
            },
            reasoning: {
              type: 'string',
              description: 'Optional explanation for the idea'
            }
          },
          required: ['sessionId', 'idea']
        }
      },
      {
        name: 'get_brainstorm_ideas',
        description: 'Get all ideas from a brainstorming session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Brainstorm session ID (optional, gets latest if not specified)'
            }
          }
        }
      },

      // === Voting ===
      {
        name: 'create_vote',
        description: 'Create a new voting session for decision making',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question to vote on'
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of options to vote for'
            },
            votingMethod: {
              type: 'string',
              enum: ['simple_majority', 'ranked_choice', 'consensus'],
              description: 'Voting method to use'
            }
          },
          required: ['question', 'options']
        }
      },
      {
        name: 'cast_vote',
        description: 'Cast your vote in an active voting session',
        inputSchema: {
          type: 'object',
          properties: {
            voteId: {
              type: 'string',
              description: 'Vote session ID'
            },
            choice: {
              type: 'string',
              description: 'Your chosen option'
            },
            confidence: {
              type: 'number',
              description: 'Confidence level 0-100'
            }
          },
          required: ['voteId', 'choice']
        }
      },

      // === Communication ===
      {
        name: 'broadcast_message',
        description: 'Broadcast a message to all connected agents',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to broadcast'
            },
            type: {
              type: 'string',
              enum: ['info', 'warning', 'question', 'announcement'],
              description: 'Type of message'
            }
          },
          required: ['message']
        }
      },
      {
        name: 'get_messages',
        description: 'Get received messages from other agents',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['all', 'brainstorm', 'result', 'status'],
              description: 'Filter by message type'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to return'
            },
            since: {
              type: 'number',
              description: 'Get messages since this timestamp'
            }
          }
        }
      },

      // === Status & Monitoring ===
      {
        name: 'get_system_status',
        description: 'Get overall system status including connected agents and queue statistics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'publish_status',
        description: 'Publish your current status to other agents',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['available', 'busy', 'away', 'do_not_disturb'],
              description: 'Your current availability status'
            },
            activity: {
              type: 'string',
              description: 'What you are currently working on'
            }
          },
          required: ['status']
        }
      },

      // === Disconnect ===
      {
        name: 'disconnect',
        description: 'Disconnect from the multi-agent system gracefully',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // === Connection & Registration ===
      case 'register_agent': {
        const result = await initializeClient(args.role, args.name);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      case 'get_connection_status': {
        const status = {
          connected: client?.isHealthy() || false,
          agentId: client?.agentId || null,
          agentName,
          role: agentRole,
          isInitialized,
          pendingTasksCount: pendingTasks.length,
          receivedMessagesCount: receivedMessages.length,
          activeBrainstorms: brainstormSessions.size
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }]
        };
      }

      // === Task Management ===
      case 'send_task': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        const taskId = await client.publishTask({
          title: args.title,
          description: args.description,
          priority: args.priority || 'normal',
          context: args.context || {},
          assignedBy: client.agentId,
          assignedByName: agentName
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            taskId,
            message: `Task "${args.title}" sent to worker queue`
          }, null, 2) }]
        };
      }

      case 'get_pending_tasks': {
        const limit = args.limit || 10;
        const tasks = pendingTasks.slice(0, limit);
        return {
          content: [{ type: 'text', text: JSON.stringify({
            count: pendingTasks.length,
            tasks: tasks.map(t => ({
              id: t.id,
              title: t.task?.title,
              description: t.task?.description,
              priority: t.task?.priority,
              from: t.from,
              receivedAt: new Date(t.receivedAt).toISOString()
            }))
          }, null, 2) }]
        };
      }

      case 'complete_task': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        // Remove from pending
        const taskIndex = pendingTasks.findIndex(t => t.id === args.taskId);
        if (taskIndex > -1) {
          pendingTasks.splice(taskIndex, 1);
        }

        await client.publishResult({
          taskId: args.taskId,
          result: args.result,
          status: args.status || 'completed',
          completedBy: client.agentId,
          completedByName: agentName,
          completedAt: Date.now()
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            message: `Task ${args.taskId} marked as ${args.status || 'completed'}`
          }, null, 2) }]
        };
      }

      // === Brainstorming ===
      case 'start_brainstorm': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        const sessionId = uuidv4();
        const session = {
          id: sessionId,
          topic: args.topic,
          question: args.question,
          duration: args.duration || 10,
          ideas: [],
          startedAt: Date.now(),
          startedBy: client.agentId,
          startedByName: agentName
        };

        brainstormSessions.set(sessionId, session);

        await client.broadcastBrainstorm({
          sessionId,
          topic: args.topic,
          question: args.question,
          duration: args.duration || 10,
          initiatedBy: agentName
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            sessionId,
            message: `Brainstorm session started: ${args.topic}`,
            expiresAt: new Date(Date.now() + (args.duration || 10) * 60000).toISOString()
          }, null, 2) }]
        };
      }

      case 'propose_idea': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        const session = brainstormSessions.get(args.sessionId);
        if (session) {
          session.ideas.push({
            from: client.agentId,
            fromName: agentName,
            idea: args.idea,
            reasoning: args.reasoning,
            timestamp: Date.now()
          });
        }

        await client.broadcastBrainstorm({
          sessionId: args.sessionId,
          idea: args.idea,
          reasoning: args.reasoning,
          proposedBy: agentName
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            message: 'Idea proposed and broadcast to all agents'
          }, null, 2) }]
        };
      }

      case 'get_brainstorm_ideas': {
        let session;
        if (args.sessionId) {
          session = brainstormSessions.get(args.sessionId);
        } else {
          // Get most recent session
          const sessions = Array.from(brainstormSessions.values());
          session = sessions.sort((a, b) => b.startedAt - a.startedAt)[0];
        }

        if (!session) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: 'No brainstorm session found'
            }) }]
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({
            sessionId: session.id,
            topic: session.topic,
            question: session.question,
            ideasCount: session.ideas.length,
            ideas: session.ideas.map(i => ({
              from: i.fromName || i.from,
              idea: i.idea,
              reasoning: i.reasoning,
              timestamp: new Date(i.timestamp).toISOString()
            })),
            startedAt: new Date(session.startedAt).toISOString()
          }, null, 2) }]
        };
      }

      // === Voting ===
      case 'create_vote': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        const voteId = uuidv4();
        const vote = {
          id: voteId,
          question: args.question,
          options: args.options,
          method: args.votingMethod || 'simple_majority',
          votes: [],
          createdAt: Date.now(),
          createdBy: client.agentId,
          createdByName: agentName
        };

        voteResults.set(voteId, vote);

        await client.broadcastBrainstorm({
          type: 'vote_created',
          voteId,
          question: args.question,
          options: args.options,
          method: args.votingMethod || 'simple_majority',
          createdBy: agentName
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            voteId,
            message: `Vote created: ${args.question}`,
            options: args.options
          }, null, 2) }]
        };
      }

      case 'cast_vote': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        const vote = voteResults.get(args.voteId);
        if (vote) {
          vote.votes.push({
            from: client.agentId,
            fromName: agentName,
            choice: args.choice,
            confidence: args.confidence || 100,
            timestamp: Date.now()
          });
        }

        await client.broadcastBrainstorm({
          type: 'vote_cast',
          voteId: args.voteId,
          choice: args.choice,
          confidence: args.confidence || 100,
          votedBy: agentName
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            message: `Vote cast for "${args.choice}"`
          }, null, 2) }]
        };
      }

      // === Communication ===
      case 'broadcast_message': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        await client.broadcastBrainstorm({
          type: args.type || 'info',
          message: args.message,
          from: agentName
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            message: 'Message broadcast to all agents'
          }, null, 2) }]
        };
      }

      case 'get_messages': {
        let messages = [...receivedMessages];

        if (args.type && args.type !== 'all') {
          messages = messages.filter(m => m.type === args.type);
        }

        if (args.since) {
          messages = messages.filter(m => m.receivedAt > args.since);
        }

        const limit = args.limit || 20;
        messages = messages.slice(-limit);

        return {
          content: [{ type: 'text', text: JSON.stringify({
            count: messages.length,
            messages: messages.map(m => ({
              type: m.type,
              from: m.from,
              content: m.message || m.result,
              receivedAt: new Date(m.receivedAt).toISOString()
            }))
          }, null, 2) }]
        };
      }

      // === Status & Monitoring ===
      case 'get_system_status': {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            connection: {
              connected: client?.isHealthy() || false,
              agentId: client?.agentId,
              agentName,
              role: agentRole
            },
            queues: {
              pendingTasks: pendingTasks.length,
              receivedMessages: receivedMessages.length,
              activeBrainstorms: brainstormSessions.size,
              activeVotes: voteResults.size
            },
            recentActivity: receivedMessages.slice(-5).map(m => ({
              type: m.type,
              from: m.from,
              timestamp: new Date(m.receivedAt).toISOString()
            }))
          }, null, 2) }]
        };
      }

      case 'publish_status': {
        if (!isInitialized) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Not connected. Call register_agent first.' }) }]
          };
        }

        await client.publishStatus({
          status: args.status,
          activity: args.activity,
          agentName,
          role: agentRole
        }, `agent.status.${args.status}`);

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            message: `Status updated to: ${args.status}`
          }, null, 2) }]
        };
      }

      // === Disconnect ===
      case 'disconnect': {
        if (client) {
          await client.publishStatus({
            event: 'agent_leaving',
            agentName,
            role: agentRole
          }, 'agent.status.disconnected');

          await client.close();
          client = null;
          isInitialized = false;
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            message: 'Disconnected from multi-agent system'
          }, null, 2) }]
        };
      }

      default:
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }]
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: error.message,
        tool: name
      }, null, 2) }]
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RabbitMQ MCP Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
