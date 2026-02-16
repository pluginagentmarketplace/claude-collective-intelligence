import { motion } from 'framer-motion';

interface StatusIndicatorProps {
  status: 'green' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
};

export function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  return (
    <motion.div
      className={`${sizeClasses[size]} rounded-full ${
        status === 'green' ? 'bg-green-500' : 'bg-red-500'
      }`}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [1, 0.7, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        boxShadow: status === 'green'
          ? '0 0 12px rgba(34, 197, 94, 0.6)'
          : '0 0 12px rgba(239, 68, 68, 0.6)',
      }}
    />
  );
}
