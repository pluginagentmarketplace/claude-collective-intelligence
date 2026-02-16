/**
 * Retry logic with exponential backoff
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

/**
 * Calculate delay for retry attempt
 */
export function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? config.maxRetries;
  const initialDelay = options?.initialDelay ?? config.initialDelay;
  const maxDelay = options?.maxDelay ?? config.maxDelay;
  const backoffMultiplier = options?.backoffMultiplier ?? config.backoffMultiplier;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = calculateDelay(
        attempt + 1,
        initialDelay,
        maxDelay,
        backoffMultiplier
      );

      options?.onRetry?.(attempt + 1, delay, lastError);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Network errors are retryable
  if (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound') ||
    message.includes('network error')
  ) {
    return true;
  }

  // 5xx errors are retryable
  if (message.includes('5') || message.includes('server error')) {
    return true;
  }

  // 429 (rate limit) is retryable
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }

  // 503 (service unavailable) is retryable
  if (message.includes('503') || message.includes('service unavailable')) {
    return true;
  }

  return false;
}

/**
 * Create a retry configuration preset
 */
export const RetryPresets = {
  aggressive: {
    maxRetries: 5,
    initialDelay: 50,
    maxDelay: 5000,
    backoffMultiplier: 2
  } as RetryConfig,

  moderate: {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 10000,
    backoffMultiplier: 2
  } as RetryConfig,

  conservative: {
    maxRetries: 1,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2
  } as RetryConfig,

  none: {
    maxRetries: 0,
    initialDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1
  } as RetryConfig
};
