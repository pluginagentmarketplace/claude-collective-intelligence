import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message } from '../types';
import { getAgentColor, MESSAGE_PRIORITY } from '../constants/colors';

interface MessageFeedProps {
  messages: Message[];
  maxMessages?: number;
  pageSize?: number;
}

// Type icons (kept for message type indication)
const typeIcons: Record<string, string> = {
  announcement: '📢',
  status: '📊',
  chat: '💬',
  task: '📋',
  result: '✅',
};

// Check if message content indicates URGENT priority
function isUrgentMessage(content: string): boolean {
  const urgentKeywords = ['URGENT', '🚨', 'CRITICAL', 'EMERGENCY', 'HEMEN', 'ACİL'];
  return urgentKeywords.some(keyword => content.toUpperCase().includes(keyword));
}

// Try to detect and parse JSON in message content
function tryParseJSON(content: string): { isJSON: boolean; parsed: unknown; raw: string } {
  // Check if content looks like JSON
  const trimmed = content.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return { isJSON: true, parsed, raw: content };
    } catch {
      return { isJSON: false, parsed: null, raw: content };
    }
  }
  return { isJSON: false, parsed: null, raw: content };
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

export function MessageFeed({ messages, maxMessages = 50, pageSize = 10 }: MessageFeedProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);

  // Slice and reverse messages for display
  const allMessages = useMemo(() =>
    messages.slice(-maxMessages).reverse(),
    [messages, maxMessages]
  );

  // Calculate pagination
  const totalPages = Math.ceil(allMessages.length / pageSize);
  const displayMessages = allMessages.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <motion.div
      className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 h-full flex flex-col"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          💬 Message Feed
          <span className="text-xs bg-slate-700 px-2 py-1 rounded-full text-slate-400">
            {messages.length} total
          </span>
        </h2>

        {/* Expand/Collapse All Button */}
        {displayMessages.length > 0 && (
          <button
            onClick={() => {
              if (expandedIds.size > 0) {
                setExpandedIds(new Set());
              } else {
                setExpandedIds(new Set(displayMessages.map(m => m.id)));
              }
            }}
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
          >
            {expandedIds.size > 0 ? '🔼 Collapse All' : '🔽 Expand All'}
          </button>
        )}
      </div>

      {/* Pagination Controls (Top) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-3 text-xs">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400"
          >
            ← Newer
          </button>
          <span className="text-slate-500">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400"
          >
            Older →
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        <AnimatePresence mode="popLayout">
          {displayMessages.map((message) => {
            // Get sender-based colors
            const senderColors = getAgentColor(message.senderId);
            const isUrgent = isUrgentMessage(message.content);
            const isExpanded = expandedIds.has(message.id);
            const jsonResult = tryParseJSON(message.content);
            const urgentStyles = isUrgent
              ? `${MESSAGE_PRIORITY.urgent.border} ${MESSAGE_PRIORITY.urgent.bg} ${MESSAGE_PRIORITY.urgent.animation} ${MESSAGE_PRIORITY.urgent.shadow}`
              : '';

            return (
              <motion.div
                key={message.id}
                className={`border-l-4 rounded-r-lg p-3 cursor-pointer transition-all ${
                  isUrgent ? urgentStyles : `${senderColors.border} ${senderColors.bg}`
                } ${isExpanded ? 'ring-2 ring-blue-500/50' : ''}`}
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.8 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                }}
                layout
                onClick={() => toggleExpand(message.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium flex items-center gap-2 ${senderColors.text}`}>
                    {senderColors.icon} {typeIcons[message.type] || ''} {message.senderId}
                  </span>
                  <div className="flex items-center gap-2">
                    {jsonResult.isJSON && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                        JSON
                      </span>
                    )}
                    <span className="text-xs text-slate-500" title={new Date(message.timestamp).toLocaleString()}>
                      {getRelativeTime(message.timestamp)}
                    </span>
                    <motion.span
                      className="text-slate-500 text-xs"
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                    >
                      ▼
                    </motion.span>
                  </div>
                </div>

                {/* Message Content */}
                <AnimatePresence mode="wait">
                  {isExpanded ? (
                    <motion.div
                      key="expanded"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      {jsonResult.isJSON ? (
                        <pre className="text-xs text-slate-300 bg-slate-900 p-2 rounded mt-2 overflow-x-auto font-mono">
                          {JSON.stringify(jsonResult.parsed, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-sm text-slate-300 whitespace-pre-wrap mt-1">
                          {isUrgent && <span className="text-red-400 font-bold">🚨 </span>}
                          {message.content}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span>ID: {message.id.slice(0, 8)}...</span>
                        <span>•</span>
                        <span>Type: {message.type}</span>
                        <span>•</span>
                        <span>{new Date(message.timestamp).toLocaleString()}</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="collapsed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-slate-300 line-clamp-2"
                    >
                      {isUrgent && <span className="text-red-400 font-bold">🚨 </span>}
                      {message.content.length > 100
                        ? `${message.content.substring(0, 100)}...`
                        : message.content}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <span className="text-4xl">📭</span>
            <p className="mt-2">No messages yet</p>
          </div>
        )}
      </div>

      {/* Pagination Controls (Bottom) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-700">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = currentPage < 3
              ? i
              : currentPage > totalPages - 4
                ? totalPages - 5 + i
                : currentPage - 2 + i;
            if (pageNum < 0 || pageNum >= totalPages) return null;
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded text-xs ${
                  pageNum === currentPage
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {pageNum + 1}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
