/**
 * Unit Tests for Utility Functions
 * Tests statistics calculations, consensus building, result aggregation, and error formatting
 */

import { jest } from '@jest/globals';

/**
 * Statistics Calculator
 * Calculates various statistics for agent performance
 */
export class StatisticsCalculator {
  static calculateAverage(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  static calculateMedian(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  static calculatePercentile(values, percentile) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }

    if (percentile < 0 || percentile > 100) {
      throw new Error('Percentile must be between 0 and 100');
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  static calculateSuccessRate(completed, failed) {
    const total = completed + failed;
    if (total === 0) {
      return 0;
    }

    return (completed / total) * 100;
  }

  static calculateThroughput(taskCount, durationMs) {
    if (durationMs <= 0) {
      return 0;
    }

    // Tasks per second
    return (taskCount / durationMs) * 1000;
  }

  static aggregateStats(agentStats) {
    if (!Array.isArray(agentStats) || agentStats.length === 0) {
      return {
        totalTasks: 0,
        totalCompleted: 0,
        totalFailed: 0,
        averageSuccessRate: 0,
        agentCount: 0,
      };
    }

    const totals = agentStats.reduce(
      (acc, stats) => ({
        tasks: acc.tasks + (stats.tasksReceived || 0),
        completed: acc.completed + (stats.tasksCompleted || 0),
        failed: acc.failed + (stats.tasksFailed || 0),
      }),
      { tasks: 0, completed: 0, failed: 0 }
    );

    const successRates = agentStats.map(stats =>
      this.calculateSuccessRate(
        stats.tasksCompleted || 0,
        stats.tasksFailed || 0
      )
    );

    return {
      totalTasks: totals.tasks,
      totalCompleted: totals.completed,
      totalFailed: totals.failed,
      averageSuccessRate: this.calculateAverage(successRates),
      agentCount: agentStats.length,
    };
  }
}

/**
 * Consensus Builder
 * Builds consensus from multiple agent responses
 */
export class ConsensusBuilder {
  static buildConsensus(responses, options = {}) {
    if (!Array.isArray(responses) || responses.length === 0) {
      return null;
    }

    const threshold = options.threshold || 0.5; // 50% agreement
    const method = options.method || 'majority';

    switch (method) {
      case 'majority':
        return this.majorityConsensus(responses, threshold);
      case 'unanimous':
        return this.unanimousConsensus(responses);
      case 'weighted':
        return this.weightedConsensus(responses, options.weights);
      default:
        throw new Error(`Unknown consensus method: ${method}`);
    }
  }

  static majorityConsensus(responses, threshold) {
    const counts = new Map();

    responses.forEach(response => {
      const key = JSON.stringify(response);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    let maxCount = 0;
    let consensus = null;

    for (const [key, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        consensus = JSON.parse(key);
      }
    }

    const agreementRatio = maxCount / responses.length;

    if (agreementRatio >= threshold) {
      return {
        consensus,
        agreement: agreementRatio,
        count: maxCount,
        total: responses.length,
      };
    }

    return null;
  }

  static unanimousConsensus(responses) {
    const first = JSON.stringify(responses[0]);
    const allSame = responses.every(r => JSON.stringify(r) === first);

    if (allSame) {
      return {
        consensus: responses[0],
        agreement: 1.0,
        count: responses.length,
        total: responses.length,
      };
    }

    return null;
  }

  static weightedConsensus(responses, weights) {
    if (!weights || weights.length !== responses.length) {
      throw new Error('Weights must be provided and match responses length');
    }

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) {
      throw new Error('Total weight cannot be zero');
    }

    const weightedCounts = new Map();

    responses.forEach((response, index) => {
      const key = JSON.stringify(response);
      const currentWeight = weightedCounts.get(key) || 0;
      weightedCounts.set(key, currentWeight + weights[index]);
    });

    let maxWeight = 0;
    let consensus = null;

    for (const [key, weight] of weightedCounts) {
      if (weight > maxWeight) {
        maxWeight = weight;
        consensus = JSON.parse(key);
      }
    }

    return {
      consensus,
      agreement: maxWeight / totalWeight,
      weight: maxWeight,
      totalWeight,
    };
  }
}

/**
 * Result Aggregator
 * Aggregates results from multiple agents
 */
export class ResultAggregator {
  static aggregate(results, strategy = 'merge') {
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'merge':
        return this.mergeResults(results);
      case 'first':
        return results[0];
      case 'last':
        return results[results.length - 1];
      case 'best':
        return this.selectBestResult(results);
      default:
        throw new Error(`Unknown aggregation strategy: ${strategy}`);
    }
  }

  static mergeResults(results) {
    const merged = {
      outputs: [],
      metadata: {
        agentCount: results.length,
        aggregatedAt: Date.now(),
      },
    };

    results.forEach(result => {
      if (result.output) {
        merged.outputs.push(result.output);
      }

      if (result.data) {
        if (!merged.data) {
          merged.data = {};
        }
        Object.assign(merged.data, result.data);
      }
    });

    return merged;
  }

  static selectBestResult(results) {
    if (results.length === 0) {
      return null;
    }

    // Select based on score, duration, or other metrics
    return results.reduce((best, current) => {
      const bestScore = best.score || 0;
      const currentScore = current.score || 0;

      if (currentScore > bestScore) {
        return current;
      }

      // If scores are equal, prefer faster completion
      if (currentScore === bestScore) {
        const bestDuration = best.duration || Infinity;
        const currentDuration = current.duration || Infinity;
        return currentDuration < bestDuration ? current : best;
      }

      return best;
    });
  }

  static combineScores(results, method = 'average') {
    const scores = results.map(r => r.score || 0);

    switch (method) {
      case 'average':
        return StatisticsCalculator.calculateAverage(scores);
      case 'max':
        return Math.max(...scores);
      case 'min':
        return Math.min(...scores);
      default:
        throw new Error(`Unknown score combination method: ${method}`);
    }
  }
}

/**
 * Error Formatter
 * Formats errors for consistent logging and debugging
 */
export class ErrorFormatter {
  static format(error, context = {}) {
    if (!error) {
      return null;
    }

    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      context,
      timestamp: Date.now(),
    };
  }

  static formatBatch(errors) {
    if (!Array.isArray(errors)) {
      return [];
    }

    return errors.map((error, index) =>
      this.format(error, { index, batchSize: errors.length })
    );
  }

  static summarize(error) {
    if (!error) {
      return 'Unknown error';
    }

    let summary = `${error.name || 'Error'}: ${error.message || 'No message'}`;

    if (error.code) {
      summary += ` (code: ${error.code})`;
    }

    return summary;
  }

  static extractStackTrace(error, maxLines = 10) {
    if (!error || !error.stack) {
      return [];
    }

    const lines = error.stack.split('\n');
    return lines.slice(0, maxLines);
  }
}

describe('StatisticsCalculator', () => {
  describe('calculateAverage()', () => {
    test('should calculate average of numbers', () => {
      expect(StatisticsCalculator.calculateAverage([1, 2, 3, 4, 5])).toBe(3);
      expect(StatisticsCalculator.calculateAverage([10, 20, 30])).toBe(20);
    });

    test('should return 0 for empty array', () => {
      expect(StatisticsCalculator.calculateAverage([])).toBe(0);
    });

    test('should return 0 for non-array input', () => {
      expect(StatisticsCalculator.calculateAverage(null)).toBe(0);
      expect(StatisticsCalculator.calculateAverage(undefined)).toBe(0);
    });

    test('should handle single value', () => {
      expect(StatisticsCalculator.calculateAverage([42])).toBe(42);
    });

    test('should handle decimal values', () => {
      expect(StatisticsCalculator.calculateAverage([1.5, 2.5, 3.5])).toBe(2.5);
    });
  });

  describe('calculateMedian()', () => {
    test('should calculate median for odd number of values', () => {
      expect(StatisticsCalculator.calculateMedian([1, 2, 3, 4, 5])).toBe(3);
    });

    test('should calculate median for even number of values', () => {
      expect(StatisticsCalculator.calculateMedian([1, 2, 3, 4])).toBe(2.5);
    });

    test('should return 0 for empty array', () => {
      expect(StatisticsCalculator.calculateMedian([])).toBe(0);
    });

    test('should handle unsorted array', () => {
      expect(StatisticsCalculator.calculateMedian([5, 1, 3, 2, 4])).toBe(3);
    });

    test('should handle single value', () => {
      expect(StatisticsCalculator.calculateMedian([42])).toBe(42);
    });
  });

  describe('calculatePercentile()', () => {
    test('should calculate 50th percentile (median)', () => {
      const values = [1, 2, 3, 4, 5];
      expect(StatisticsCalculator.calculatePercentile(values, 50)).toBe(3);
    });

    test('should calculate 95th percentile', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p95 = StatisticsCalculator.calculatePercentile(values, 95);
      expect(p95).toBeCloseTo(9.55, 2);
    });

    test('should throw error for invalid percentile', () => {
      expect(() => StatisticsCalculator.calculatePercentile([1, 2, 3], -1)).toThrow(
        'Percentile must be between 0 and 100'
      );
      expect(() => StatisticsCalculator.calculatePercentile([1, 2, 3], 101)).toThrow(
        'Percentile must be between 0 and 100'
      );
    });

    test('should return 0 for empty array', () => {
      expect(StatisticsCalculator.calculatePercentile([], 50)).toBe(0);
    });
  });

  describe('calculateSuccessRate()', () => {
    test('should calculate success rate', () => {
      expect(StatisticsCalculator.calculateSuccessRate(8, 2)).toBe(80);
      expect(StatisticsCalculator.calculateSuccessRate(10, 0)).toBe(100);
    });

    test('should return 0 when total is 0', () => {
      expect(StatisticsCalculator.calculateSuccessRate(0, 0)).toBe(0);
    });

    test('should handle all failures', () => {
      expect(StatisticsCalculator.calculateSuccessRate(0, 10)).toBe(0);
    });
  });

  describe('calculateThroughput()', () => {
    test('should calculate tasks per second', () => {
      expect(StatisticsCalculator.calculateThroughput(100, 10000)).toBe(10); // 100 tasks in 10 seconds = 10 tps
      expect(StatisticsCalculator.calculateThroughput(50, 5000)).toBe(10);
    });

    test('should return 0 for zero or negative duration', () => {
      expect(StatisticsCalculator.calculateThroughput(100, 0)).toBe(0);
      expect(StatisticsCalculator.calculateThroughput(100, -1000)).toBe(0);
    });

    test('should handle fractional throughput', () => {
      const throughput = StatisticsCalculator.calculateThroughput(1, 1000);
      expect(throughput).toBeCloseTo(1, 2);
    });
  });

  describe('aggregateStats()', () => {
    test('should aggregate stats from multiple agents', () => {
      const agentStats = [
        { tasksReceived: 10, tasksCompleted: 8, tasksFailed: 2 },
        { tasksReceived: 15, tasksCompleted: 12, tasksFailed: 3 },
        { tasksReceived: 5, tasksCompleted: 5, tasksFailed: 0 },
      ];

      const result = StatisticsCalculator.aggregateStats(agentStats);

      expect(result.totalTasks).toBe(30);
      expect(result.totalCompleted).toBe(25);
      expect(result.totalFailed).toBe(5);
      expect(result.agentCount).toBe(3);
      expect(result.averageSuccessRate).toBeCloseTo(86.67, 1);
    });

    test('should return zero stats for empty array', () => {
      const result = StatisticsCalculator.aggregateStats([]);

      expect(result.totalTasks).toBe(0);
      expect(result.totalCompleted).toBe(0);
      expect(result.totalFailed).toBe(0);
      expect(result.agentCount).toBe(0);
    });
  });
});

describe('ConsensusBuilder', () => {
  describe('majorityConsensus()', () => {
    test('should find majority consensus', () => {
      const responses = ['yes', 'yes', 'no', 'yes'];
      const result = ConsensusBuilder.majorityConsensus(responses, 0.5);

      expect(result).not.toBeNull();
      expect(result.consensus).toBe('yes');
      expect(result.agreement).toBe(0.75);
      expect(result.count).toBe(3);
    });

    test('should return null when threshold not met', () => {
      const responses = ['yes', 'no', 'maybe'];
      const result = ConsensusBuilder.majorityConsensus(responses, 0.6);

      expect(result).toBeNull();
    });

    test('should handle object responses', () => {
      const responses = [
        { action: 'approve' },
        { action: 'approve' },
        { action: 'reject' },
      ];

      const result = ConsensusBuilder.majorityConsensus(responses, 0.5);

      expect(result).not.toBeNull();
      expect(result.consensus).toEqual({ action: 'approve' });
    });
  });

  describe('unanimousConsensus()', () => {
    test('should find unanimous consensus', () => {
      const responses = ['yes', 'yes', 'yes'];
      const result = ConsensusBuilder.unanimousConsensus(responses);

      expect(result).not.toBeNull();
      expect(result.consensus).toBe('yes');
      expect(result.agreement).toBe(1.0);
    });

    test('should return null when not unanimous', () => {
      const responses = ['yes', 'yes', 'no'];
      const result = ConsensusBuilder.unanimousConsensus(responses);

      expect(result).toBeNull();
    });

    test('should handle single response', () => {
      const responses = ['yes'];
      const result = ConsensusBuilder.unanimousConsensus(responses);

      expect(result).not.toBeNull();
      expect(result.consensus).toBe('yes');
    });
  });

  describe('weightedConsensus()', () => {
    test('should find weighted consensus', () => {
      const responses = ['yes', 'no', 'yes'];
      const weights = [0.5, 0.2, 0.3]; // 'yes' has total weight of 0.8

      const result = ConsensusBuilder.weightedConsensus(responses, weights);

      expect(result).not.toBeNull();
      expect(result.consensus).toBe('yes');
      expect(result.agreement).toBeCloseTo(0.8, 2);
    });

    test('should throw error for mismatched weights', () => {
      const responses = ['yes', 'no', 'yes'];
      const weights = [0.5, 0.5]; // Wrong length

      expect(() => ConsensusBuilder.weightedConsensus(responses, weights)).toThrow(
        'Weights must be provided and match responses length'
      );
    });

    test('should throw error for zero total weight', () => {
      const responses = ['yes', 'no'];
      const weights = [0, 0];

      expect(() => ConsensusBuilder.weightedConsensus(responses, weights)).toThrow(
        'Total weight cannot be zero'
      );
    });
  });

  describe('buildConsensus()', () => {
    test('should use majority method by default', () => {
      const responses = ['yes', 'yes', 'no'];
      const result = ConsensusBuilder.buildConsensus(responses);

      expect(result).not.toBeNull();
      expect(result.consensus).toBe('yes');
    });

    test('should use specified method', () => {
      const responses = ['yes', 'yes', 'yes'];
      const result = ConsensusBuilder.buildConsensus(responses, { method: 'unanimous' });

      expect(result).not.toBeNull();
      expect(result.agreement).toBe(1.0);
    });

    test('should throw error for unknown method', () => {
      const responses = ['yes', 'no'];

      expect(() =>
        ConsensusBuilder.buildConsensus(responses, { method: 'invalid' })
      ).toThrow('Unknown consensus method: invalid');
    });

    test('should return null for empty responses', () => {
      expect(ConsensusBuilder.buildConsensus([])).toBeNull();
    });
  });
});

describe('ResultAggregator', () => {
  describe('mergeResults()', () => {
    test('should merge multiple results', () => {
      const results = [
        { output: 'Result 1', data: { key1: 'value1' } },
        { output: 'Result 2', data: { key2: 'value2' } },
      ];

      const merged = ResultAggregator.mergeResults(results);

      expect(merged.outputs).toEqual(['Result 1', 'Result 2']);
      expect(merged.data).toEqual({ key1: 'value1', key2: 'value2' });
      expect(merged.metadata.agentCount).toBe(2);
    });

    test('should handle results without data', () => {
      const results = [{ output: 'Result 1' }, { output: 'Result 2' }];

      const merged = ResultAggregator.mergeResults(results);

      expect(merged.outputs).toHaveLength(2);
      expect(merged.data).toBeUndefined();
    });
  });

  describe('selectBestResult()', () => {
    test('should select result with highest score', () => {
      const results = [
        { output: 'Result 1', score: 80 },
        { output: 'Result 2', score: 95 },
        { output: 'Result 3', score: 70 },
      ];

      const best = ResultAggregator.selectBestResult(results);

      expect(best.output).toBe('Result 2');
      expect(best.score).toBe(95);
    });

    test('should prefer faster result when scores are equal', () => {
      const results = [
        { output: 'Result 1', score: 80, duration: 1000 },
        { output: 'Result 2', score: 80, duration: 500 },
      ];

      const best = ResultAggregator.selectBestResult(results);

      expect(best.output).toBe('Result 2');
    });

    test('should return null for empty results', () => {
      expect(ResultAggregator.selectBestResult([])).toBeNull();
    });
  });

  describe('aggregate()', () => {
    test('should aggregate using merge strategy', () => {
      const results = [{ output: 'A' }, { output: 'B' }];
      const aggregated = ResultAggregator.aggregate(results, 'merge');

      expect(aggregated.outputs).toHaveLength(2);
    });

    test('should aggregate using first strategy', () => {
      const results = [{ output: 'First' }, { output: 'Second' }];
      const aggregated = ResultAggregator.aggregate(results, 'first');

      expect(aggregated.output).toBe('First');
    });

    test('should aggregate using last strategy', () => {
      const results = [{ output: 'First' }, { output: 'Last' }];
      const aggregated = ResultAggregator.aggregate(results, 'last');

      expect(aggregated.output).toBe('Last');
    });

    test('should aggregate using best strategy', () => {
      const results = [
        { output: 'Low', score: 50 },
        { output: 'High', score: 90 },
      ];
      const aggregated = ResultAggregator.aggregate(results, 'best');

      expect(aggregated.output).toBe('High');
    });

    test('should throw error for unknown strategy', () => {
      const results = [{ output: 'A' }];

      expect(() => ResultAggregator.aggregate(results, 'invalid')).toThrow(
        'Unknown aggregation strategy: invalid'
      );
    });

    test('should return null for empty results', () => {
      expect(ResultAggregator.aggregate([])).toBeNull();
    });
  });

  describe('combineScores()', () => {
    test('should combine scores using average', () => {
      const results = [{ score: 80 }, { score: 90 }, { score: 70 }];
      const combined = ResultAggregator.combineScores(results, 'average');

      expect(combined).toBe(80);
    });

    test('should combine scores using max', () => {
      const results = [{ score: 80 }, { score: 90 }, { score: 70 }];
      const combined = ResultAggregator.combineScores(results, 'max');

      expect(combined).toBe(90);
    });

    test('should combine scores using min', () => {
      const results = [{ score: 80 }, { score: 90 }, { score: 70 }];
      const combined = ResultAggregator.combineScores(results, 'min');

      expect(combined).toBe(70);
    });

    test('should throw error for unknown method', () => {
      const results = [{ score: 80 }];

      expect(() => ResultAggregator.combineScores(results, 'invalid')).toThrow(
        'Unknown score combination method: invalid'
      );
    });
  });
});

describe('ErrorFormatter', () => {
  describe('format()', () => {
    test('should format error with all fields', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';

      const formatted = ErrorFormatter.format(error, { userId: '123' });

      expect(formatted.message).toBe('Test error');
      expect(formatted.name).toBe('Error');
      expect(formatted.stack).toBeDefined();
      expect(formatted.code).toBe('TEST_ERROR');
      expect(formatted.context.userId).toBe('123');
      expect(formatted.timestamp).toBeDefined();
    });

    test('should return null for null error', () => {
      expect(ErrorFormatter.format(null)).toBeNull();
    });

    test('should format error without context', () => {
      const error = new Error('Test error');
      const formatted = ErrorFormatter.format(error);

      expect(formatted.context).toEqual({});
    });
  });

  describe('formatBatch()', () => {
    test('should format multiple errors', () => {
      const errors = [new Error('Error 1'), new Error('Error 2')];
      const formatted = ErrorFormatter.formatBatch(errors);

      expect(formatted).toHaveLength(2);
      expect(formatted[0].message).toBe('Error 1');
      expect(formatted[1].message).toBe('Error 2');
      expect(formatted[0].context.index).toBe(0);
      expect(formatted[1].context.index).toBe(1);
    });

    test('should return empty array for non-array input', () => {
      expect(ErrorFormatter.formatBatch(null)).toEqual([]);
    });
  });

  describe('summarize()', () => {
    test('should create error summary', () => {
      const error = new Error('Test error');
      const summary = ErrorFormatter.summarize(error);

      expect(summary).toBe('Error: Test error');
    });

    test('should include error code in summary', () => {
      const error = new Error('Test error');
      error.code = 'ERR_TEST';

      const summary = ErrorFormatter.summarize(error);

      expect(summary).toBe('Error: Test error (code: ERR_TEST)');
    });

    test('should handle null error', () => {
      expect(ErrorFormatter.summarize(null)).toBe('Unknown error');
    });

    test('should handle error without message', () => {
      const error = new Error();
      const summary = ErrorFormatter.summarize(error);

      expect(summary).toBe('Error: No message');
    });
  });

  describe('extractStackTrace()', () => {
    test('should extract stack trace lines', () => {
      const error = new Error('Test error');
      const stack = ErrorFormatter.extractStackTrace(error, 5);

      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBeLessThanOrEqual(5);
    });

    test('should return empty array for null error', () => {
      expect(ErrorFormatter.extractStackTrace(null)).toEqual([]);
    });

    test('should return empty array for error without stack', () => {
      const error = { message: 'No stack' };
      expect(ErrorFormatter.extractStackTrace(error)).toEqual([]);
    });

    test('should limit stack trace lines', () => {
      const error = new Error('Test error');
      const stack = ErrorFormatter.extractStackTrace(error, 2);

      expect(stack.length).toBeLessThanOrEqual(2);
    });
  });
});
