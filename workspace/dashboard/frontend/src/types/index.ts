// TypeScript Interfaces - AGREED CONTRACT
// RAMAS Dashboard v1.0.0

export interface Agent {
  id: string;
  name: string;
  status: 'green' | 'red';
  role: 'team-leader' | 'worker';
  windowId: string;
  lastUpdate: string; // ISO8601
}

export interface Session {
  id: string;
  name: string;
  state: 'active' | 'closed' | 'initializing';
  participants: string[];
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  type: string;
  content: string;
  timestamp: string;
}

export interface WorkflowStep {
  step: number;
  icon: string;
  label: string;
  completed: boolean;
  timestamp?: string;
}

export interface WsMessage {
  type: 'update' | 'ping';
  entity?: 'agent' | 'session' | 'message';
  action?: 'create' | 'update' | 'delete';
  data?: Agent | Session | Message;
  timestamp: string;
}

export interface HealthCheck {
  status: 'ok' | 'error';
  uptime?: number;
  version?: string;
}
