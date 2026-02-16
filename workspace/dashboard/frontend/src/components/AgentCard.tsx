import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Agent } from '../types';
import { StatusIndicator } from './StatusIndicator';
import { getAgentColor } from '../constants/colors';
import { AgentModal } from './AgentModal';

interface AgentCardProps {
  agent: Agent;
  index: number;
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

export function AgentCard({ agent, index }: AgentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Get role-based colors from centralized color system
  const colors = getAgentColor(agent.id);
  const roleIcon = colors.icon;
  const roleLabel = colors.role;

  return (
    <>
      <motion.div
        className={`rounded-xl p-4 shadow-xl border-l-4 ${colors.border} ${colors.bg} border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer`}
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
          delay: index * 0.1,
        }}
        whileHover={{ scale: 1.02 }}
        onClick={() => setShowModal(true)}
      >
        {/* Header - Always visible */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <StatusIndicator status={agent.status} size="lg" />
            <div>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${colors.text}`}>
                {roleIcon} {agent.name}
              </h3>
              <p className="text-slate-400 text-xs">{roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              agent.status === 'green'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {agent.status.toUpperCase()}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 rounded hover:bg-slate-700 transition-colors"
            >
              <motion.span
                className="text-slate-400 text-sm inline-block"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ▼
              </motion.span>
            </button>
          </div>
        </div>

        {/* Quick Info - Always visible */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono">{agent.id}</span>
          <span title={new Date(agent.lastUpdate).toLocaleString()}>
            🕐 {getRelativeTime(agent.lastUpdate)}
          </span>
        </div>

        {/* Expanded Details - Collapsible */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Agent ID:</span>
                  <span className="text-slate-300 font-mono text-xs">{agent.id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Window ID:</span>
                  <span className="text-slate-300 font-mono text-xs">{agent.windowId || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Role:</span>
                  <span className="text-slate-300">{agent.role}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Last Update:</span>
                  <span className="text-slate-300">
                    {new Date(agent.lastUpdate).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowModal(true);
                  }}
                  className="w-full mt-2 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors text-xs font-medium"
                >
                  🔍 View Details
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Agent Detail Modal */}
      <AgentModal
        agent={agent}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        colors={colors}
      />
    </>
  );
}
