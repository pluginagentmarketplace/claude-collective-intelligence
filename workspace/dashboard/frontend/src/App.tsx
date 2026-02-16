import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentCard } from './components/AgentCard';
import { WorkflowTimeline } from './components/WorkflowTimeline';
import { MessageFeed } from './components/MessageFeed';
import { SessionPanel } from './components/SessionPanel';
import { useDashboardData, updateAgentInList, updateSessionInList, addMessageToList } from './hooks/useAgents';
import { useWebSocket } from './hooks/useWebSocket';
import type { Agent, Session, Message } from './types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/realtime';

function App() {
  const { agents: initialAgents, currentSession: initialSession, messages: initialMessages, loading, error } = useDashboardData();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { lastMessage, isConnected, reconnecting, retryCount } = useWebSocket({ url: WS_URL });

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync initial data
  useEffect(() => {
    if (initialAgents.length > 0) setAgents(initialAgents);
  }, [initialAgents]);

  useEffect(() => {
    if (initialSession) setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    if (initialMessages.length > 0) setMessages(initialMessages);
  }, [initialMessages]);

  // Handle WebSocket updates
  useEffect(() => {
    if (!lastMessage) return;

    const { entity, data } = lastMessage;

    if (entity === 'agent' && data) {
      setAgents((prev) => updateAgentInList(prev, data as Agent));
    } else if (entity === 'session' && data) {
      setSession(data as Session);
      setAgents((prev) => updateSessionInList(prev as unknown as Session[], data as Session) as unknown as Agent[]);
    } else if (entity === 'message' && data) {
      setMessages((prev) => addMessageToList(prev, data as Message));
      // Advance workflow on certain message types
      if ((data as Message).type === 'announcement') {
        setWorkflowStep((prev) => Math.min(prev + 1, 6));
      }
    }
  }, [lastMessage]);

  // Calculate workflow step from session state
  useEffect(() => {
    if (!session) {
      setWorkflowStep(0);
      return;
    }

    const greenAgents = agents.filter((a) => a.status === 'green').length;

    if (session.state === 'closed') {
      setWorkflowStep(6);
    } else if (messages.length > 5) {
      setWorkflowStep(5);
    } else if (messages.length > 0) {
      setWorkflowStep(4);
    } else if (greenAgents >= 2) {
      setWorkflowStep(3);
    } else if (session.participants.length > 0) {
      setWorkflowStep(2);
    } else if (session.state === 'active') {
      setWorkflowStep(1);
    }
  }, [session, agents, messages]);

  // Determine connection status
  const connectionStatus = isConnected
    ? 'connected'
    : reconnecting
      ? 'reconnecting'
      : 'disconnected';

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Disconnect Banner - Full Width */}
      <AnimatePresence>
        {connectionStatus === 'disconnected' && (
          <motion.div
            className="sticky top-0 z-50 bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-3 shadow-lg"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.span
                  className="text-2xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ⚠️
                </motion.span>
                <div>
                  <p className="font-bold">WebSocket Disconnected</p>
                  <p className="text-sm text-red-100">
                    Using REST polling fallback • Data may be delayed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm bg-red-700 px-3 py-1 rounded">
                  Retries: {retryCount}/3
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconnecting Banner */}
      <AnimatePresence>
        {connectionStatus === 'reconnecting' && (
          <motion.div
            className="sticky top-0 z-50 bg-gradient-to-r from-yellow-600 to-amber-500 text-white px-4 py-3 shadow-lg"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="container mx-auto flex items-center gap-3">
              <motion.span
                className="text-2xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                🔄
              </motion.span>
              <div>
                <p className="font-bold">Reconnecting to WebSocket...</p>
                <p className="text-sm text-yellow-100">
                  Attempt {retryCount + 1} of 3 • Please wait
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6">
        {/* Header */}
        <motion.header
          className="mb-6 flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
              🐰 RAMAS Dashboard
            </h1>
            <p className="text-slate-400 text-sm">Multi-Agent Orchestration Monitor</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Enhanced Connection Status */}
            <motion.div
              className={`flex items-center gap-3 px-5 py-2.5 rounded-full font-medium shadow-lg ${
                connectionStatus === 'connected'
                  ? 'bg-green-500/20 text-green-400 shadow-green-500/20'
                  : connectionStatus === 'reconnecting'
                    ? 'bg-yellow-500/20 text-yellow-400 shadow-yellow-500/20'
                    : 'bg-red-500/20 text-red-400 shadow-red-500/20'
              }`}
              animate={connectionStatus !== 'connected' ? {
                scale: [1, 1.05, 1],
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <motion.div
                className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : connectionStatus === 'reconnecting'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [1, 0.7, 1]
                }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="font-semibold">
                {connectionStatus === 'connected'
                  ? '🟢 Connected'
                  : connectionStatus === 'reconnecting'
                    ? '🟡 Reconnecting...'
                    : '🔴 Disconnected'
                }
              </span>
              {connectionStatus === 'connected' && (
                <span className="text-xs bg-green-500/30 px-2 py-0.5 rounded">
                  WS
                </span>
              )}
              {connectionStatus === 'disconnected' && (
                <span className="text-xs bg-red-500/30 px-2 py-0.5 rounded">
                  REST
                </span>
              )}
            </motion.div>

            {/* Current Time */}
            <div className="text-slate-300 text-sm font-mono bg-slate-800 px-4 py-2 rounded-lg">
              🕐 {currentTime.toLocaleTimeString()}
            </div>
          </div>
        </motion.header>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-6xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                🐰
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Banner (API Error) */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              ⚠️ API Error: {error} - Using cached data
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Agents */}
          <div className="col-span-3 space-y-4">
            <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
              👥 Agents
              <span className="text-xs bg-slate-700 px-2 py-1 rounded-full text-slate-400">
                {agents.length}
              </span>
            </h2>
            {agents.length > 0 ? (
              agents.map((agent, index) => (
                <AgentCard key={agent.id} agent={agent} index={index} />
              ))
            ) : (
              <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-500">
                <span className="text-4xl">🔍</span>
                <p className="mt-2">No agents detected</p>
              </div>
            )}
          </div>

          {/* Center Column - Workflow + Session */}
          <div className="col-span-6 space-y-6">
            <WorkflowTimeline currentStep={workflowStep} />
            <SessionPanel session={session} />
          </div>

          {/* Right Column - Messages */}
          <div className="col-span-3">
            <MessageFeed messages={messages} maxMessages={50} pageSize={10} />
          </div>
        </div>

        {/* Footer */}
        <motion.footer
          className="mt-8 text-center text-slate-500 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          RAMAS v1.1 • PATTERN-C-003 v6 • Built with React 19 + Framer Motion • Dashboard Improvement Sprint
        </motion.footer>
      </div>
    </div>
  );
}

export default App;
