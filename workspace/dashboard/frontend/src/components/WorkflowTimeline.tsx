import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { WorkflowStep } from '../types';

const defaultSteps: WorkflowStep[] = [
  { step: 0, icon: '📡', label: 'RabbitMQ Connected', completed: false },
  { step: 1, icon: '📋', label: 'Session Created', completed: false },
  { step: 2, icon: '🤝', label: 'Workers Joined', completed: false },
  { step: 3, icon: '📤', label: 'Tasks Assigned', completed: false },
  { step: 4, icon: '⚙️', label: 'Processing', completed: false },
  { step: 5, icon: '📥', label: 'Results Received', completed: false },
  { step: 6, icon: '✅', label: 'Complete', completed: false },
];

interface WorkflowTimelineProps {
  currentStep?: number;
  steps?: WorkflowStep[];
  startTime?: string;
}

// Format elapsed time
function formatElapsedTime(startTime: string): string {
  const now = new Date();
  const start = new Date(startTime);
  const diffMs = now.getTime() - start.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  const hours = diffHour;
  const mins = diffMin % 60;
  const secs = diffSec % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function WorkflowTimeline({
  currentStep = 0,
  steps = defaultSteps,
  startTime
}: WorkflowTimelineProps) {
  const [elapsedTime, setElapsedTime] = useState('0s');
  const [internalStartTime] = useState(() => startTime || new Date().toISOString());

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(internalStartTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [internalStartTime]);

  const progressPercent = (currentStep / (steps.length - 1)) * 100;
  const isComplete = currentStep >= steps.length - 1;

  return (
    <motion.div
      className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Header with Timer */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🔄 Workflow Progress
          <span className={`text-xs px-2 py-1 rounded-full ${
            isComplete
              ? 'bg-green-500/20 text-green-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            Step {currentStep + 1} of {steps.length}
          </span>
        </h2>
        <div className="flex items-center gap-3">
          {/* Elapsed Time */}
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 font-mono text-sm"
            animate={!isComplete ? { opacity: [1, 0.7, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ⏱️ {elapsedTime}
          </motion.div>
          {/* Progress Percentage */}
          <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${
            isComplete
              ? 'bg-green-500/20 text-green-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}>
            {Math.round(progressPercent)}%
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center relative">
        {/* Progress Line Background */}
        <div className="absolute top-6 left-8 right-8 h-1.5 bg-slate-700 rounded-full">
          {/* Active Progress */}
          <motion.div
            className={`h-full rounded-full ${
              isComplete
                ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                : 'bg-gradient-to-r from-blue-500 to-cyan-400'
            }`}
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {/* Animated Pulse on Current Progress */}
          {!isComplete && (
            <motion.div
              className="absolute top-0 h-full bg-cyan-400 rounded-full opacity-50"
              initial={{ width: '0%' }}
              animate={{
                width: `${progressPercent}%`,
                opacity: [0.5, 0.2, 0.5]
              }}
              transition={{
                width: { duration: 0.5, ease: 'easeOut' },
                opacity: { duration: 1.5, repeat: Infinity }
              }}
            />
          )}
        </div>

        {/* Step Icons */}
        {steps.map((step, index) => {
          const isPast = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <motion.div
              key={step.label}
              className="flex flex-col items-center relative z-10"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                delay: index * 0.15,
                type: 'spring',
                stiffness: 200,
              }}
            >
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl relative ${
                  isPast
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/30'
                    : isCurrent
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/40'
                      : 'bg-slate-700'
                }`}
                animate={isCurrent ? {
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(59, 130, 246, 0)',
                    '0 0 30px 10px rgba(59, 130, 246, 0.4)',
                    '0 0 0 0 rgba(59, 130, 246, 0)',
                  ],
                } : {}}
                transition={{
                  duration: 2,
                  repeat: isCurrent ? Infinity : 0,
                }}
              >
                {step.icon}

                {/* Current Step Ring */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-cyan-400"
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [1, 0, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  />
                )}

                {/* Completed Checkmark */}
                {isPast && (
                  <motion.div
                    className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    ✓
                  </motion.div>
                )}
              </motion.div>

              {/* Step Label */}
              <span className={`text-xs mt-2 text-center max-w-16 font-medium ${
                isPast
                  ? 'text-green-400'
                  : isCurrent
                    ? 'text-cyan-400'
                    : 'text-slate-500'
              }`}>
                {step.label}
              </span>

              {/* Step Number Badge */}
              <span className={`text-xs mt-1 px-1.5 py-0.5 rounded ${
                isPast
                  ? 'bg-green-500/20 text-green-400'
                  : isCurrent
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-slate-700 text-slate-500'
              }`}>
                {index + 1}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Current Step Description */}
      <motion.div
        className="mt-6 p-4 rounded-lg bg-slate-900 border border-slate-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-3">
          <motion.span
            className="text-3xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {steps[currentStep]?.icon}
          </motion.span>
          <div>
            <p className="text-white font-medium">
              {isComplete ? '🎉 Workflow Complete!' : `Current: ${steps[currentStep]?.label}`}
            </p>
            <p className="text-slate-400 text-sm">
              {isComplete
                ? `Completed in ${elapsedTime}`
                : `Running for ${elapsedTime}...`
              }
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
