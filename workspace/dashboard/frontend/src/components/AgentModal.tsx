import { motion, AnimatePresence } from 'framer-motion';
import type { Agent } from '../types';
import { StatusIndicator } from './StatusIndicator';

interface AgentColors {
  border: string;
  bg: string;
  text: string;
  icon: string;
  role: string;
}

interface AgentModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
  colors: AgentColors;
}

// Format relative time
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return then.toLocaleDateString();
}

export function AgentModal({ agent, isOpen, onClose, colors }: AgentModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`p-6 border-b border-slate-700 ${colors.bg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <StatusIndicator status={agent.status} size="lg" />
                    <div>
                      <h2 className={`text-2xl font-bold flex items-center gap-2 ${colors.text}`}>
                        {colors.icon} {agent.name}
                      </h2>
                      <p className="text-slate-400 text-sm">{colors.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Status Badge */}
                <div className="flex justify-center">
                  <motion.div
                    className={`px-6 py-3 rounded-full text-lg font-bold ${
                      agent.status === 'green'
                        ? 'bg-green-500/20 text-green-400 shadow-lg shadow-green-500/20'
                        : 'bg-red-500/20 text-red-400 shadow-lg shadow-red-500/20'
                    }`}
                    animate={{
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  >
                    {agent.status === 'green' ? '🟢 AVAILABLE' : '🔴 BUSY'}
                  </motion.div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-900 rounded-lg p-4">
                    <p className="text-slate-500 text-xs mb-1">Agent ID</p>
                    <p className="text-slate-200 font-mono text-sm break-all">{agent.id}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4">
                    <p className="text-slate-500 text-xs mb-1">Window ID</p>
                    <p className="text-slate-200 font-mono text-sm">{agent.windowId || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4">
                    <p className="text-slate-500 text-xs mb-1">Role</p>
                    <p className="text-slate-200 text-sm capitalize">{agent.role}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4">
                    <p className="text-slate-500 text-xs mb-1">Last Update</p>
                    <p className="text-slate-200 text-sm">{getRelativeTime(agent.lastUpdate)}</p>
                  </div>
                </div>

                {/* Full Timestamp */}
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-500 text-xs mb-1">Last Update (Full)</p>
                  <p className="text-slate-200 font-mono text-sm">
                    {new Date(agent.lastUpdate).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
