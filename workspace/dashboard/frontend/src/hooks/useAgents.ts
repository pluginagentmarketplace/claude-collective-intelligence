import { useState, useEffect, useCallback } from 'react';
import type { Agent, Session, Message } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UseDashboardDataReturn {
  agents: Agent[];
  sessions: Session[];
  messages: Message[];
  currentSession: Session | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardData(): UseDashboardDataReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch agents, all sessions, and current session in parallel
      const [agentsRes, sessionsRes, currentRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/agents`),
        fetch(`${API_BASE}/api/v1/sessions`),
        fetch(`${API_BASE}/api/v1/sessions/current`),
      ]);

      if (!agentsRes.ok || !sessionsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [agentsData, sessionsData, currentData] = await Promise.all([
        agentsRes.json(),
        sessionsRes.json(),
        currentRes.ok ? currentRes.json() : null,
      ]);

      // Extract arrays from wrapped API responses
      const agentsList = agentsData.agents || agentsData || [];
      const sessionsList = sessionsData.sessions || sessionsData || [];

      setAgents(agentsList);
      setSessions(sessionsList);

      // Current session from /sessions/current endpoint (includes closed sessions!)
      // This fixes the "No active session" bug when session is closed
      setCurrentSession(currentData);

      // If we have current session with participants, fetch messages
      const recentSession = currentData;
      if (recentSession && recentSession.participants?.length > 0) {
        try {
          const messagesRes = await fetch(
            `${API_BASE}/api/v1/messages/${recentSession.participants[0]}`
          );
          if (messagesRes.ok) {
            const messagesData = await messagesRes.json();
            // Extract messages array from API response wrapper
            const messagesList = messagesData.messages || messagesData || [];
            setMessages(messagesList);
          }
        } catch {
          // Messages fetch is optional
        }
      }
    } catch (e) {
      console.error('[API] Fetch error:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Poll every 2 seconds as fallback
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // currentSession is now fetched from /sessions/current endpoint (includes closed!)

  return {
    agents,
    sessions,
    messages,
    currentSession,
    loading,
    error,
    refetch: fetchData,
  };
}

// Update functions for WebSocket events
export function updateAgentInList(agents: Agent[], updated: Agent): Agent[] {
  const index = agents.findIndex((a) => a.id === updated.id);
  if (index >= 0) {
    const newAgents = [...agents];
    newAgents[index] = updated;
    return newAgents;
  }
  return [...agents, updated];
}

export function updateSessionInList(sessions: Session[], updated: Session): Session[] {
  const index = sessions.findIndex((s) => s.id === updated.id);
  if (index >= 0) {
    const newSessions = [...sessions];
    newSessions[index] = updated;
    return newSessions;
  }
  return [...sessions, updated];
}

export function addMessageToList(messages: Message[], newMsg: Message): Message[] {
  if (messages.some((m) => m.id === newMsg.id)) {
    return messages;
  }
  return [...messages, newMsg];
}
