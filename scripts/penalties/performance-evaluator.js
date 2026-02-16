/**
 * Performance Evaluator - Fair Evaluation Engine with 7 Safeguards
 *
 * Implements 7 fairness safeguards:
 * 1. Context Analysis - Environmental factors, system conditions, task difficulty
 * 2. Minimum Samples - Require >= 10 tasks before penalty
 * 3. Anomaly Detection - Statistical outlier detection and peer comparison
 * 4. Graduated Penalties - Start with warnings, escalate slowly
 * 5. Appeal Process - All penalties appealable
 * 6. Minimum Guarantees - Never reduce resources below minimum
 * 7. Transparency & Logging - All penalties logged with reasoning
 *
 * Evaluates 5 performance triggers:
 * 1. Error rate > 10%
 * 2. Timeout frequency > 20%
 * 3. Quality score drop > 15%
 * 4. Collaboration failures > 30%
 * 5. Resource abuse > 150%
 */

export class PerformanceEvaluator {
  constructor() {
    // Performance trigger thresholds
    this.triggers = {
      errorRate: {
        threshold: 0.10,
        minSamples: 10,
        severityLevels: [
          { max: 0.15, level: 1 },
          { max: 0.25, level: 2 },
          { max: 0.40, level: 3 },
          { max: Infinity, level: 4 }
        ]
      },
      timeoutFrequency: {
        threshold: 0.20,
        minSamples: 10,
        severityLevels: [
          { max: 0.30, level: 1 },
          { max: 0.45, level: 2 },
          { max: 0.60, level: 3 },
          { max: Infinity, level: 4 }
        ]
      },
      qualityDrop: {
        threshold: 0.15,
        minSamples: 5,
        severityLevels: [
          { max: 0.20, level: 1 },
          { max: 0.30, level: 2 },
          { max: 0.45, level: 3 },
          { max: Infinity, level: 4 }
        ]
      },
      collaborationFailure: {
        threshold: 0.30,
        minSamples: 5,
        severityLevels: [
          { max: 0.40, level: 1 },
          { max: 0.55, level: 2 },
          { max: 0.70, level: 3 },
          { max: Infinity, level: 4 }
        ]
      },
      resourceAbuse: {
        threshold: 1.5,
        minSamples: 3,
        severityLevels: [
          { max: 1.7, level: 2 },
          { max: 2.0, level: 3 },
          { max: 3.0, level: 4 },
          { max: Infinity, level: 5 }
        ]
      }
    };

    // Minimum guaranteed resources (safeguard #6)
    this.minimumResources = {
      cpu: 0.1,
      memory: 0.2,
      network: 0.3,
      taskRate: 0.1
    };

    // Anomaly detection thresholds (safeguard #3)
    this.anomalyThresholds = {
      zScoreThreshold: 2.0,
      autoReviewScore: 0.7,
      suddenDropThreshold: 0.30
    };
  }

  /**
   * SAFEGUARD #1: Context Analysis
   * Analyze context to determine if penalty is fair
   */
  async analyzeContext(agentId, metrics) {
    return {
      // Task difficulty
      taskDifficulty: {
        averageDifficulty: this.getAverageDifficulty(metrics),
        wasAssignedHarderTasks: false
      },

      // System conditions
      systemConditions: {
        systemLoad: this.getSystemLoad(),
        queueBacklog: this.getQueueBacklog(),
        networkLatency: this.getNetworkLatency(),
        highLatency: false
      },

      // Agent state
      agentState: {
        recentlyRestarted: false,
        underResourcePressure: false,
        recentlyUpdated: false,
        historicalPerformance: metrics.successRate || 0.90
      },

      // External factors
      externalFactors: {
        rabbitmqIssues: false,
        networkIssues: false,
        dependencyFailures: false,
        hadNetworkIssues: false
      }
    };
  }

  /**
   * Evaluate performance triggers
   */
  async evaluateTriggers(metrics, context) {
    const triggers = [];

    // SAFEGUARD #2: Minimum samples - require enough data
    if (metrics.taskCount < this.triggers.errorRate.minSamples) {
      return []; // Not enough samples
    }

    // 1. Error Rate Trigger
    if (metrics.errorRate > this.triggers.errorRate.threshold) {
      const severity = this.calculateSeverity(
        metrics.errorRate,
        this.triggers.errorRate.severityLevels
      );

      triggers.push({
        type: 'error_rate',
        value: metrics.errorRate,
        threshold: this.triggers.errorRate.threshold,
        severity
      });
    }

    // 2. Timeout Frequency Trigger
    if (metrics.timeoutRate > this.triggers.timeoutFrequency.threshold) {
      // Exclude if system-wide issue (SAFEGUARD #1)
      if (!context.systemConditions.highLatency) {
        const severity = this.calculateSeverity(
          metrics.timeoutRate,
          this.triggers.timeoutFrequency.severityLevels
        );

        triggers.push({
          type: 'timeout_frequency',
          value: metrics.timeoutRate,
          threshold: this.triggers.timeoutFrequency.threshold,
          severity
        });
      }
    }

    // 3. Quality Score Drop Trigger
    const qualityDrop = (metrics.baselineQuality - metrics.currentQuality) / metrics.baselineQuality;
    if (qualityDrop > this.triggers.qualityDrop.threshold) {
      const severity = this.calculateSeverity(
        qualityDrop,
        this.triggers.qualityDrop.severityLevels
      );

      triggers.push({
        type: 'quality_drop',
        value: qualityDrop,
        threshold: this.triggers.qualityDrop.threshold,
        severity
      });
    }

    // 4. Collaboration Failure Trigger
    if (metrics.collaborationFailureRate > this.triggers.collaborationFailure.threshold) {
      const severity = this.calculateSeverity(
        metrics.collaborationFailureRate,
        this.triggers.collaborationFailure.severityLevels
      );

      triggers.push({
        type: 'collaboration_failure',
        value: metrics.collaborationFailureRate,
        threshold: this.triggers.collaborationFailure.threshold,
        severity
      });
    }

    // 5. Resource Abuse Trigger
    const maxResourceUsage = Math.max(
      metrics.resourceUsage.cpu,
      metrics.resourceUsage.memory
    );

    if (maxResourceUsage > this.triggers.resourceAbuse.threshold) {
      const severity = this.calculateSeverity(
        maxResourceUsage,
        this.triggers.resourceAbuse.severityLevels
      );

      triggers.push({
        type: 'resource_abuse',
        value: maxResourceUsage,
        threshold: this.triggers.resourceAbuse.threshold,
        severity
      });
    }

    return triggers;
  }

  /**
   * Calculate severity level based on value and severity levels
   */
  calculateSeverity(value, severityLevels) {
    for (const level of severityLevels) {
      if (value <= level.max) {
        return level.level;
      }
    }

    return severityLevels[severityLevels.length - 1].level;
  }

  /**
   * SAFEGUARD #4: Graduated Penalties
   * Determine penalty level based on triggers and context
   */
  determinePenaltyLevel(triggers, context) {
    if (triggers.length === 0) return 0;

    // Calculate base severity
    const maxSeverity = Math.max(...triggers.map(t => t.severity));
    const avgSeverity = triggers.reduce((sum, t) => sum + t.severity, 0) / triggers.length;

    let level = Math.round(avgSeverity);

    // Context adjustments (SAFEGUARD #1)
    if (context.systemConditions.systemLoad > 0.8) {
      level = Math.max(1, level - 1); // Reduce severity if system stressed
    }

    if (context.agentState.historicalPerformance > 0.90) {
      level = Math.max(1, level - 1); // Reduce for good historical performance
    }

    if (context.externalFactors.hadNetworkIssues) {
      level = Math.max(1, level - 1); // Reduce if network issues
    }

    // Cap at appropriate level
    return Math.min(6, Math.max(1, level));
  }

  /**
   * SAFEGUARD #3: Anomaly Detection
   * Detect anomalies that may indicate unfair penalty
   */
  async detectAnomalies(penalty, context) {
    const anomalies = {
      // Is penalty disproportionate?
      disproportionatePenalty: this.checkProportionality(penalty),

      // Were environmental factors unusual?
      environmentalAnomaly: this.detectEnvironmentalAnomaly(context),

      // Was system under stress?
      systemStress: context.systemConditions.systemLoad > 0.8,

      // Has agent shown sudden drop (may indicate external issue)?
      suddenPerformanceDrop: this.detectSuddenDrop(penalty.metricsAtStart)
    };

    // Calculate anomaly score
    const anomalyScore = this.calculateAnomalyScore(anomalies);

    // Auto-trigger review if anomalies detected
    const autoReviewTriggered = anomalyScore > this.anomalyThresholds.autoReviewScore;

    return {
      anomalies,
      anomalyScore,
      autoReviewTriggered,
      recommendation: this.getRecommendation(anomalies)
    };
  }

  /**
   * Check if penalty is proportionate to offense
   */
  checkProportionality(penalty) {
    // Level 5 or 6 should only be for severe or repeated issues
    if (penalty.level >= 5) {
      const triggerCount = penalty.triggeredBy.length;
      const maxSeverity = Math.max(
        ...penalty.triggeredBy.map(type => {
          const trigger = penalty.triggeredBy.find(t => t === type);
          return trigger ? 3 : 1;
        })
      );

      // Disproportionate if high penalty but low severity triggers
      return penalty.level > maxSeverity + 2;
    }

    return false;
  }

  /**
   * Detect environmental anomalies
   */
  detectEnvironmentalAnomaly(context) {
    const factors = [
      context.systemConditions.systemLoad > 0.8,
      context.externalFactors.networkIssues,
      context.externalFactors.rabbitmqIssues,
      context.externalFactors.dependencyFailures
    ];

    return factors.filter(f => f).length >= 2;
  }

  /**
   * Detect sudden performance drop
   */
  detectSuddenDrop(metrics) {
    const drop = (metrics.baselineQuality - metrics.currentQuality) / metrics.baselineQuality;
    return drop > this.anomalyThresholds.suddenDropThreshold;
  }

  /**
   * Calculate overall anomaly score
   */
  calculateAnomalyScore(anomalies) {
    const weights = {
      disproportionatePenalty: 0.3,
      environmentalAnomaly: 0.25,
      systemStress: 0.2,
      suddenPerformanceDrop: 0.25
    };

    let score = 0;
    for (const [key, value] of Object.entries(anomalies)) {
      if (value && weights[key]) {
        score += weights[key];
      }
    }

    return score;
  }

  /**
   * Get recommendation based on anomalies
   */
  getRecommendation(anomalies) {
    const recommendations = [];

    if (anomalies.disproportionatePenalty) {
      recommendations.push('Penalty may be disproportionate - consider reducing level');
    }

    if (anomalies.environmentalAnomaly) {
      recommendations.push('Environmental factors detected - may not be agent fault');
    }

    if (anomalies.systemStress) {
      recommendations.push('System under stress - performance degradation expected');
    }

    if (anomalies.suddenPerformanceDrop) {
      recommendations.push('Sudden drop detected - investigate for external causes');
    }

    return recommendations.length > 0
      ? recommendations.join('; ')
      : 'No anomalies detected';
  }

  /**
   * Statistical outlier detection using z-score
   */
  isOutlier(value, population) {
    if (population.length < 2) return false;

    const mean = this.mean(population);
    const stdDev = this.standardDeviation(population);

    if (stdDev === 0) return false;

    const zScore = Math.abs((value - mean) / stdDev);

    // Consider outlier if more than 2 standard deviations
    return zScore > this.anomalyThresholds.zScoreThreshold;
  }

  /**
   * Calculate mean of array
   */
  mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  standardDeviation(values) {
    if (values.length === 0) return 0;

    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);

    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Get average task difficulty
   */
  getAverageDifficulty(metrics) {
    // Simplified - in production would analyze actual task complexity
    return 0.5;
  }

  /**
   * Get current system load
   */
  getSystemLoad() {
    // Simplified - in production would query actual system metrics
    return 0.5;
  }

  /**
   * Get queue backlog size
   */
  getQueueBacklog() {
    // Simplified - in production would query RabbitMQ
    return 0;
  }

  /**
   * Get network latency
   */
  getNetworkLatency() {
    // Simplified - in production would measure actual latency
    return 50;
  }

  /**
   * Bias detection - check if penalties are applied fairly across agent types
   */
  async detectBias(allPenalties) {
    // Group penalties by agent type
    const penaltiesByType = {};

    for (const penalty of allPenalties) {
      const type = penalty.agentType || 'unknown';
      if (!penaltiesByType[type]) {
        penaltiesByType[type] = [];
      }
      penaltiesByType[type].push(penalty);
    }

    // Calculate penalty rates
    const penaltyRates = {};
    for (const [type, penalties] of Object.entries(penaltiesByType)) {
      penaltyRates[type] = penalties.length;
    }

    // Calculate disparate impact (80% rule)
    const disparateImpactRatio = this.calculateDisparateImpact(penaltyRates);

    return {
      penaltyRates,
      disparateImpactRatio,
      hasBias: disparateImpactRatio < 0.8,
      recommendation: disparateImpactRatio < 0.8
        ? 'Review penalty criteria for potential bias'
        : 'No significant bias detected'
    };
  }

  /**
   * Calculate disparate impact (statistical measure of bias)
   */
  calculateDisparateImpact(rates) {
    const values = Object.values(rates);
    if (values.length === 0) return 1.0;

    const min = Math.min(...values);
    const max = Math.max(...values);

    return max === 0 ? 1.0 : min / max;
  }

  /**
   * Validate minimum resource guarantees (SAFEGUARD #6)
   */
  validateMinimumResources(resourceAllocation) {
    return {
      cpu: Math.max(resourceAllocation.cpu, this.minimumResources.cpu),
      memory: Math.max(resourceAllocation.memory, this.minimumResources.memory),
      network: Math.max(resourceAllocation.network, this.minimumResources.network),
      taskRate: Math.max(resourceAllocation.taskRate, this.minimumResources.taskRate)
    };
  }

  /**
   * Get fairness metrics for monitoring
   */
  getFairnessMetrics(penalties, appeals) {
    const totalPenalties = penalties.length;
    const totalAppeals = appeals.length;
    const approvedAppeals = appeals.filter(a => a.review.status === 'approved').length;

    const falsePositiveRate = totalPenalties > 0
      ? approvedAppeals / totalPenalties
      : 0;

    const appealSuccessRate = totalAppeals > 0
      ? approvedAppeals / totalAppeals
      : 0;

    // Fairness score (0-100)
    let fairnessScore = 100;

    // Deduct points for high false positive rate
    if (falsePositiveRate > 0.10) {
      fairnessScore -= (falsePositiveRate - 0.10) * 200;
    }

    // Deduct points for very high appeal success rate (suggests unfair penalties)
    if (appealSuccessRate > 0.40) {
      fairnessScore -= (appealSuccessRate - 0.40) * 100;
    }

    fairnessScore = Math.max(0, Math.min(100, fairnessScore));

    return {
      totalPenalties,
      totalAppeals,
      approvedAppeals,
      falsePositiveRate,
      appealSuccessRate,
      fairnessScore
    };
  }
}

export default PerformanceEvaluator;
