/**
 * RAMAS Dashboard - Agent Color Coding System
 *
 * Brainstorm Result: 2026-01-09
 * Participants: Team Leader, Worker-001, Worker-002, Mission Control
 *
 * Purpose: Visual differentiation of agents and message priorities
 * Accessibility: Icon + Color combination for color-blind users
 */

export interface AgentColorScheme {
  primary: string;      // Tailwind color class (e.g., 'blue-500')
  bg: string;           // Background with transparency
  border: string;       // Left border accent
  text: string;         // Text color for headers
  icon: string;         // Emoji icon for quick identification
  role: string;         // Human-readable role name
}

/**
 * Agent Color Mapping
 *
 * Design Principles:
 * - Team Leader: Blue (authority, trust, leadership)
 * - Workers: Warm colors (emerald, amber) for approachability
 * - Mission Control: Violet (oversight, wisdom)
 * - Default: Slate (neutral for unknown agents)
 */
export const AGENT_COLORS: Record<string, AgentColorScheme> = {
  'team-leader': {
    primary: 'blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-l-blue-500',
    text: 'text-blue-400',
    icon: '👑',
    role: 'Team Leader'
  },
  'worker-001': {
    primary: 'emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-l-emerald-500',
    text: 'text-emerald-400',
    icon: '⚙️',
    role: 'Backend Developer'
  },
  'worker-002': {
    primary: 'amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
    text: 'text-amber-400',
    icon: '🎨',
    role: 'Frontend Developer'
  },
  'worker-003': {
    primary: 'purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-l-purple-500',
    text: 'text-purple-400',
    icon: '🔧',
    role: 'Worker'
  },
  'mission-control': {
    primary: 'violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-l-violet-500',
    text: 'text-violet-400',
    icon: '👁️',
    role: 'Monitor'
  },
  'default': {
    primary: 'slate-500',
    bg: 'bg-slate-500/10',
    border: 'border-l-slate-500',
    text: 'text-slate-400',
    icon: '🤖',
    role: 'Agent'
  }
};

/**
 * Get color scheme for an agent by ID
 * Handles partial matches (e.g., "team-leader-xxx" matches "team-leader")
 */
export function getAgentColor(agentId: string): AgentColorScheme {
  // Direct match first
  if (AGENT_COLORS[agentId]) {
    return AGENT_COLORS[agentId];
  }

  // Partial match for role-based identification
  const id = agentId.toLowerCase();
  if (id.includes('leader')) return AGENT_COLORS['team-leader'];
  if (id === 'worker-001' || id.includes('worker-001')) return AGENT_COLORS['worker-001'];
  if (id === 'worker-002' || id.includes('worker-002')) return AGENT_COLORS['worker-002'];
  if (id.includes('worker-003') || id.includes('worker-3')) return AGENT_COLORS['worker-003'];
  if (id.includes('mission') || id.includes('monitor') || id.includes('control')) {
    return AGENT_COLORS['mission-control'];
  }

  // Default for unknown agents
  return AGENT_COLORS['default'];
}

/**
 * Message Priority Styling
 */
export const MESSAGE_PRIORITY = {
  urgent: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/10',
    animation: 'animate-pulse',
    shadow: 'shadow-lg shadow-red-500/20',
    icon: '🚨'
  },
  normal: {
    border: '', // Uses agent color
    bg: '',     // Uses agent color
    animation: '',
    shadow: '',
    icon: ''
  },
  system: {
    border: 'border-l-slate-600',
    bg: 'bg-slate-600/10',
    animation: '',
    shadow: '',
    icon: '⚙️'
  }
};

/**
 * Get combined styles for a message
 */
export function getMessageStyles(senderId: string, priority: 'urgent' | 'normal' | 'system' = 'normal'): string {
  const agentColor = getAgentColor(senderId);
  const priorityStyle = MESSAGE_PRIORITY[priority];

  if (priority === 'urgent') {
    return `${priorityStyle.border} ${priorityStyle.bg} ${priorityStyle.animation} ${priorityStyle.shadow}`;
  }

  return `${agentColor.border} ${agentColor.bg}`;
}

/**
 * Color Palette Reference (for documentation)
 *
 * | Role           | Color      | Hex     | Icon |
 * |----------------|------------|---------|------|
 * | Team Leader    | blue-500   | #3B82F6 | 👑   |
 * | Worker-001     | emerald-500| #10B981 | ⚙️   |
 * | Worker-002     | amber-500  | #F59E0B | 🎨   |
 * | Worker-003+    | purple-500 | #8B5CF6 | 🔧   |
 * | Mission Control| violet-500 | #8B5CF6 | 👁️   |
 * | Default        | slate-500  | #64748B | 🤖   |
 * | URGENT         | red-500    | #EF4444 | 🚨   |
 */
