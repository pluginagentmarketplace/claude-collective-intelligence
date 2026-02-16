import { motion } from 'framer-motion';
import type { Session } from '../types';

interface SessionPanelProps {
  session: Session | null;
}

const stateColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/50',
  closed: 'bg-purple-500/20 text-purple-400 border-purple-500/50',  // Purple for COMPLETED!
  initializing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
};

const stateIcons: Record<string, string> = {
  active: '🟢',
  closed: '✅',  // Checkmark for COMPLETED!
  initializing: '🟡',
};

// Display labels for session states
const stateLabels: Record<string, string> = {
  active: 'ACTIVE',
  closed: 'COMPLETED',  // Show "COMPLETED" instead of "CLOSED"
  initializing: 'INITIALIZING',
};

export function SessionPanel({ session }: SessionPanelProps) {
  if (!session) {
    return (
      <motion.div
        className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          📋 Current Session
        </h2>
        <div className="text-center text-slate-500 py-4">
          <span className="text-4xl">🔍</span>
          <p className="mt-2">No active session</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          📋 Current Session
        </h2>
        <motion.span
          className={`px-3 py-1 rounded-full text-xs font-medium border ${
            stateColors[session.state] || stateColors.initializing
          }`}
          animate={{
            scale: session.state === 'active' ? [1, 1.05, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: session.state === 'active' ? Infinity : 0,
          }}
        >
          {stateIcons[session.state]} {stateLabels[session.state] || session.state.toUpperCase()}
        </motion.span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Session Name</label>
          <p className="text-white font-medium">{session.name}</p>
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Session ID</label>
          <p className="text-slate-300 font-mono text-sm truncate">{session.id}</p>
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Created</label>
          <p className="text-slate-300 text-sm">
            {new Date(session.createdAt).toLocaleString()}
          </p>
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">
            Participants ({session.participants.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {session.participants.map((participant) => (
              <motion.span
                key={participant}
                className="px-2 py-1 bg-slate-700 rounded-md text-xs text-slate-300"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring' }}
              >
                {participant}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
