/**
 * Alerts Manager Service
 * Manages alert rules, routing, grouping, and notifications
 */

const { EventEmitter } = require('events');
const axios = require('axios');
const prometheusConfig = require('./prometheus-config');

class AlertsManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      evaluationInterval: options.evaluationInterval || 60000, // 1 minute
      alertmanagerUrl: options.alertmanagerUrl || 'http://localhost:9093',
      webhookUrl: options.webhookUrl || null,
      slackWebhook: options.slackWebhook || null,
      emailConfig: options.emailConfig || null,
      pagerDutyKey: options.pagerDutyKey || null,
      ...options
    };

    this.alerts = new Map();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.silences = new Map();
    this.inhibitRules = [];
    this.routingRules = [];
    this.evaluationInterval = null;

    // Alert states
    this.AlertState = {
      INACTIVE: 'inactive',
      PENDING: 'pending',
      FIRING: 'firing',
      RESOLVED: 'resolved'
    };

    // Alert severity levels
    this.Severity = {
      CRITICAL: 'critical',
      WARNING: 'warning',
      INFO: 'info'
    };

    this.setupDefaultAlerts();
    this.setupDefaultRouting();
  }

  /**
   * Setup default alert rules
   */
  setupDefaultAlerts() {
    // High error rate alert
    this.addAlert({
      name: 'HighErrorRate',
      expr: 'rate(errors_total[5m]) > 0.01',
      for: '5m',
      severity: this.Severity.CRITICAL,
      annotations: {
        summary: 'High error rate detected',
        description: 'Error rate is above 1% for 5 minutes',
        runbook: 'https://docs.example.com/runbooks/high-error-rate'
      },
      labels: {
        team: 'backend',
        component: 'application'
      }
    });

    // Service down alert
    this.addAlert({
      name: 'ServiceDown',
      expr: 'up == 0',
      for: '1m',
      severity: this.Severity.CRITICAL,
      annotations: {
        summary: 'Service is down',
        description: 'Service {{ $labels.instance }} is down',
        runbook: 'https://docs.example.com/runbooks/service-down'
      },
      labels: {
        team: 'ops',
        component: 'infrastructure'
      }
    });

    // Memory leak detection
    this.addAlert({
      name: 'MemoryLeak',
      expr: 'rate(memory_usage_bytes[10m]) > 10485760',
      for: '10m',
      severity: this.Severity.WARNING,
      annotations: {
        summary: 'Possible memory leak detected',
        description: 'Memory usage increasing by more than 10MB/minute for 10 minutes',
        runbook: 'https://docs.example.com/runbooks/memory-leak'
      },
      labels: {
        team: 'backend',
        component: 'application'
      }
    });

    // Queue overflow alert
    this.addAlert({
      name: 'QueueOverflow',
      expr: 'queue_size > 10000',
      for: '5m',
      severity: this.Severity.CRITICAL,
      annotations: {
        summary: 'Queue overflow detected',
        description: 'Queue {{ $labels.queue }} has more than 10000 items',
        runbook: 'https://docs.example.com/runbooks/queue-overflow'
      },
      labels: {
        team: 'backend',
        component: 'messaging'
      }
    });

    // Database connection pool exhausted
    this.addAlert({
      name: 'DatabasePoolExhausted',
      expr: 'connection_pool_active / connection_pool_size > 0.95',
      for: '2m',
      severity: this.Severity.CRITICAL,
      annotations: {
        summary: 'Database connection pool nearly exhausted',
        description: 'Connection pool usage above 95% for {{ $labels.type }}',
        runbook: 'https://docs.example.com/runbooks/db-pool-exhausted'
      },
      labels: {
        team: 'backend',
        component: 'database'
      }
    });

    // High CPU usage
    this.addAlert({
      name: 'HighCPUUsage',
      expr: 'cpu_usage_percent > 80',
      for: '5m',
      severity: this.Severity.WARNING,
      annotations: {
        summary: 'High CPU usage detected',
        description: 'CPU usage above 80% for 5 minutes',
        runbook: 'https://docs.example.com/runbooks/high-cpu'
      },
      labels: {
        team: 'ops',
        component: 'infrastructure'
      }
    });

    // Slow response time
    this.addAlert({
      name: 'SlowResponseTime',
      expr: 'histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m])) > 2',
      for: '5m',
      severity: this.Severity.WARNING,
      annotations: {
        summary: 'Slow API response time',
        description: 'P95 response time above 2 seconds',
        runbook: 'https://docs.example.com/runbooks/slow-response'
      },
      labels: {
        team: 'backend',
        component: 'api'
      }
    });

    // Agent restart detection
    this.addAlert({
      name: 'AgentRestarted',
      expr: 'changes(active_agents[5m]) > 2',
      for: '1m',
      severity: this.Severity.INFO,
      annotations: {
        summary: 'Agent restart detected',
        description: 'Agent {{ $labels.type }} has restarted',
        runbook: 'https://docs.example.com/runbooks/agent-restart'
      },
      labels: {
        team: 'backend',
        component: 'agents'
      }
    });

    // Certificate expiry warning
    this.addAlert({
      name: 'CertificateExpiringSoon',
      expr: 'cert_expiry_days < 30',
      for: '1h',
      severity: this.Severity.WARNING,
      annotations: {
        summary: 'Certificate expiring soon',
        description: 'Certificate for {{ $labels.domain }} expires in {{ $value }} days',
        runbook: 'https://docs.example.com/runbooks/cert-expiry'
      },
      labels: {
        team: 'ops',
        component: 'security'
      }
    });
  }

  /**
   * Setup default routing rules
   */
  setupDefaultRouting() {
    // Critical alerts go to PagerDuty
    this.addRoutingRule({
      match: { severity: this.Severity.CRITICAL },
      receivers: ['pagerduty', 'slack', 'email'],
      groupBy: ['alertname', 'cluster'],
      groupWait: '10s',
      groupInterval: '10s',
      repeatInterval: '1h'
    });

    // Warning alerts go to Slack and email
    this.addRoutingRule({
      match: { severity: this.Severity.WARNING },
      receivers: ['slack', 'email'],
      groupBy: ['alertname'],
      groupWait: '30s',
      groupInterval: '5m',
      repeatInterval: '12h'
    });

    // Info alerts go to Slack only
    this.addRoutingRule({
      match: { severity: this.Severity.INFO },
      receivers: ['slack'],
      groupBy: ['alertname'],
      groupWait: '1m',
      groupInterval: '10m',
      repeatInterval: '24h'
    });

    // Database alerts go to DBA team
    this.addRoutingRule({
      match: { component: 'database' },
      receivers: ['dba-team'],
      groupBy: ['alertname'],
      groupWait: '30s',
      groupInterval: '5m',
      repeatInterval: '4h'
    });
  }

  /**
   * Add an alert rule
   */
  addAlert(alert) {
    if (!alert.name) {
      throw new Error('Alert name is required');
    }

    const alertConfig = {
      name: alert.name,
      expr: alert.expr,
      for: alert.for || '1m',
      severity: alert.severity || this.Severity.WARNING,
      annotations: alert.annotations || {},
      labels: alert.labels || {},
      state: this.AlertState.INACTIVE,
      lastEvaluation: null,
      lastTransition: null,
      value: null
    };

    this.alerts.set(alert.name, alertConfig);
    this.emit('alert_added', alertConfig);
  }

  /**
   * Remove an alert rule
   */
  removeAlert(name) {
    const deleted = this.alerts.delete(name);
    if (deleted) {
      this.activeAlerts.delete(name);
      this.emit('alert_removed', { name });
    }
    return deleted;
  }

  /**
   * Add a routing rule
   */
  addRoutingRule(rule) {
    this.routingRules.push({
      match: rule.match || {},
      receivers: rule.receivers || [],
      groupBy: rule.groupBy || ['alertname'],
      groupWait: rule.groupWait || '30s',
      groupInterval: rule.groupInterval || '5m',
      repeatInterval: rule.repeatInterval || '1h',
      continue: rule.continue || false
    });
  }

  /**
   * Add an inhibit rule
   */
  addInhibitRule(rule) {
    this.inhibitRules.push({
      sourceMatch: rule.sourceMatch || {},
      targetMatch: rule.targetMatch || {},
      equal: rule.equal || ['cluster', 'alertname']
    });
  }

  /**
   * Add a silence
   */
  addSilence(silence) {
    const id = Date.now().toString();
    const silenceConfig = {
      id,
      matchers: silence.matchers || [],
      startsAt: silence.startsAt || new Date(),
      endsAt: silence.endsAt || new Date(Date.now() + 3600000), // 1 hour default
      createdBy: silence.createdBy || 'system',
      comment: silence.comment || ''
    };

    this.silences.set(id, silenceConfig);
    this.emit('silence_added', silenceConfig);
    return id;
  }

  /**
   * Remove a silence
   */
  removeSilence(id) {
    const deleted = this.silences.delete(id);
    if (deleted) {
      this.emit('silence_removed', { id });
    }
    return deleted;
  }

  /**
   * Evaluate alert rules
   */
  async evaluateAlerts() {
    for (const [name, alert] of this.alerts) {
      try {
        // This is where you would query Prometheus or evaluate metrics
        // For now, we'll use a simplified evaluation
        const result = await this.evaluateExpression(alert.expr);

        const previousState = alert.state;
        const now = new Date();

        if (result.value) {
          // Alert condition is true
          if (alert.state === this.AlertState.INACTIVE) {
            alert.state = this.AlertState.PENDING;
            alert.lastTransition = now;
          } else if (alert.state === this.AlertState.PENDING) {
            // Check if alert has been pending long enough
            const pendingDuration = now - alert.lastTransition;
            const forDuration = this.parseDuration(alert.for);

            if (pendingDuration >= forDuration) {
              alert.state = this.AlertState.FIRING;
              alert.lastTransition = now;
              this.fireAlert(alert);
            }
          }
        } else {
          // Alert condition is false
          if (alert.state === this.AlertState.FIRING || alert.state === this.AlertState.PENDING) {
            alert.state = this.AlertState.RESOLVED;
            alert.lastTransition = now;
            this.resolveAlert(alert);
          } else if (alert.state === this.AlertState.RESOLVED) {
            alert.state = this.AlertState.INACTIVE;
            alert.lastTransition = now;
          }
        }

        alert.lastEvaluation = now;
        alert.value = result.value;

        if (alert.state !== previousState) {
          this.emit('alert_state_changed', {
            name: alert.name,
            previousState,
            currentState: alert.state,
            timestamp: now
          });
        }
      } catch (error) {
        console.error(`Error evaluating alert ${name}:`, error);
        this.emit('evaluation_error', { alert: name, error });
      }
    }
  }

  /**
   * Evaluate a PromQL-like expression (simplified)
   */
  async evaluateExpression(expr) {
    // This is a simplified version - in production, you would query Prometheus
    // or evaluate against collected metrics

    // Example: Parse simple expressions
    if (expr.includes('rate(errors_total')) {
      const errorRate = Math.random() * 0.02; // Simulated error rate
      return { value: errorRate > 0.01 };
    }

    if (expr === 'up == 0') {
      return { value: false }; // Service is up
    }

    if (expr.includes('queue_size')) {
      const queueSize = Math.random() * 15000; // Simulated queue size
      return { value: queueSize > 10000 };
    }

    // Default: return false (no alert)
    return { value: false };
  }

  /**
   * Fire an alert
   */
  async fireAlert(alert) {
    const alertInstance = {
      name: alert.name,
      state: this.AlertState.FIRING,
      severity: alert.severity,
      labels: alert.labels,
      annotations: alert.annotations,
      startsAt: alert.lastTransition,
      value: alert.value,
      fingerprint: this.generateFingerprint(alert)
    };

    this.activeAlerts.set(alert.name, alertInstance);
    this.alertHistory.push({
      ...alertInstance,
      timestamp: new Date()
    });

    // Check if alert is silenced
    if (this.isAlertSilenced(alertInstance)) {
      this.emit('alert_silenced', alertInstance);
      return;
    }

    // Check inhibit rules
    if (this.isAlertInhibited(alertInstance)) {
      this.emit('alert_inhibited', alertInstance);
      return;
    }

    // Route and send notifications
    await this.routeAlert(alertInstance);

    // Record metric
    prometheusConfig.errorsTotal.inc({
      type: 'alert_fired',
      severity: alert.severity,
      component: 'alerts_manager',
      code: alert.name
    });

    this.emit('alert_fired', alertInstance);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alert) {
    const alertInstance = this.activeAlerts.get(alert.name);
    if (!alertInstance) {
      return;
    }

    alertInstance.state = this.AlertState.RESOLVED;
    alertInstance.endsAt = new Date();

    this.alertHistory.push({
      ...alertInstance,
      timestamp: new Date()
    });

    this.activeAlerts.delete(alert.name);

    // Send resolution notification
    await this.sendResolutionNotification(alertInstance);

    this.emit('alert_resolved', alertInstance);
  }

  /**
   * Route alert to appropriate receivers
   */
  async routeAlert(alert) {
    for (const rule of this.routingRules) {
      if (this.matchesRule(alert, rule.match)) {
        await this.sendToReceivers(alert, rule.receivers);

        if (!rule.continue) {
          break;
        }
      }
    }
  }

  /**
   * Check if alert matches routing rule
   */
  matchesRule(alert, match) {
    for (const [key, value] of Object.entries(match)) {
      if (alert.labels[key] !== value && alert[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Send alert to receivers
   */
  async sendToReceivers(alert, receivers) {
    const promises = [];

    for (const receiver of receivers) {
      switch (receiver) {
        case 'slack':
          promises.push(this.sendToSlack(alert));
          break;
        case 'email':
          promises.push(this.sendToEmail(alert));
          break;
        case 'pagerduty':
          promises.push(this.sendToPagerDuty(alert));
          break;
        case 'webhook':
          promises.push(this.sendToWebhook(alert));
          break;
        default:
          console.warn(`Unknown receiver: ${receiver}`);
      }
    }

    await Promise.all(promises);
  }

  /**
   * Send alert to Slack
   */
  async sendToSlack(alert) {
    if (!this.options.slackWebhook) {
      return;
    }

    const color = alert.severity === this.Severity.CRITICAL ? 'danger' :
                  alert.severity === this.Severity.WARNING ? 'warning' : 'good';

    const payload = {
      attachments: [{
        color,
        title: `🚨 ${alert.name}`,
        text: alert.annotations.summary || alert.name,
        fields: [
          {
            title: 'Severity',
            value: alert.severity,
            short: true
          },
          {
            title: 'Component',
            value: alert.labels.component || 'unknown',
            short: true
          },
          {
            title: 'Description',
            value: alert.annotations.description || 'No description',
            short: false
          }
        ],
        footer: 'Alerts Manager',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    try {
      await axios.post(this.options.slackWebhook, payload);
      this.emit('notification_sent', { receiver: 'slack', alert: alert.name });
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      this.emit('notification_error', { receiver: 'slack', alert: alert.name, error });
    }
  }

  /**
   * Send alert to email
   */
  async sendToEmail(alert) {
    // Implement email sending logic
    console.log('Email notification:', alert.name);
  }

  /**
   * Send alert to PagerDuty
   */
  async sendToPagerDuty(alert) {
    if (!this.options.pagerDutyKey) {
      return;
    }

    const payload = {
      routing_key: this.options.pagerDutyKey,
      event_action: 'trigger',
      dedup_key: alert.fingerprint,
      payload: {
        summary: alert.annotations.summary || alert.name,
        severity: alert.severity === this.Severity.CRITICAL ? 'critical' : 'warning',
        source: 'alerts-manager',
        component: alert.labels.component || 'unknown',
        custom_details: {
          description: alert.annotations.description,
          runbook: alert.annotations.runbook,
          labels: alert.labels
        }
      }
    };

    try {
      await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
      this.emit('notification_sent', { receiver: 'pagerduty', alert: alert.name });
    } catch (error) {
      console.error('Error sending PagerDuty notification:', error);
      this.emit('notification_error', { receiver: 'pagerduty', alert: alert.name, error });
    }
  }

  /**
   * Send alert to webhook
   */
  async sendToWebhook(alert) {
    if (!this.options.webhookUrl) {
      return;
    }

    try {
      await axios.post(this.options.webhookUrl, alert);
      this.emit('notification_sent', { receiver: 'webhook', alert: alert.name });
    } catch (error) {
      console.error('Error sending webhook notification:', error);
      this.emit('notification_error', { receiver: 'webhook', alert: alert.name, error });
    }
  }

  /**
   * Send resolution notification
   */
  async sendResolutionNotification(alert) {
    if (this.options.slackWebhook) {
      const payload = {
        attachments: [{
          color: 'good',
          title: `✅ ${alert.name} - Resolved`,
          text: `Alert ${alert.name} has been resolved`,
          fields: [
            {
              title: 'Duration',
              value: this.formatDuration(alert.endsAt - alert.startsAt),
              short: true
            }
          ],
          footer: 'Alerts Manager',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      try {
        await axios.post(this.options.slackWebhook, payload);
      } catch (error) {
        console.error('Error sending resolution notification:', error);
      }
    }
  }

  /**
   * Check if alert is silenced
   */
  isAlertSilenced(alert) {
    const now = new Date();

    for (const silence of this.silences.values()) {
      if (now < silence.startsAt || now > silence.endsAt) {
        continue;
      }

      let matches = true;
      for (const matcher of silence.matchers) {
        const alertValue = alert.labels[matcher.name] || alert[matcher.name];
        if (!this.matchValue(alertValue, matcher.value, matcher.isRegex)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if alert is inhibited
   */
  isAlertInhibited(alert) {
    for (const rule of this.inhibitRules) {
      // Check if there's a source alert that matches
      for (const sourceAlert of this.activeAlerts.values()) {
        if (sourceAlert.name === alert.name) {
          continue;
        }

        if (this.matchesRule(sourceAlert, rule.sourceMatch) &&
            this.matchesRule(alert, rule.targetMatch)) {
          // Check equal fields
          let allEqual = true;
          for (const field of rule.equal) {
            if (sourceAlert.labels[field] !== alert.labels[field]) {
              allEqual = false;
              break;
            }
          }

          if (allEqual) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Match value with pattern
   */
  matchValue(value, pattern, isRegex = false) {
    if (isRegex) {
      return new RegExp(pattern).test(value);
    }
    return value === pattern;
  }

  /**
   * Generate alert fingerprint
   */
  generateFingerprint(alert) {
    const labels = Object.keys(alert.labels).sort().map(k => `${k}=${alert.labels[k]}`).join(',');
    return require('crypto').createHash('md5').update(`${alert.name}:${labels}`).digest('hex');
  }

  /**
   * Parse duration string
   */
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 60000; // Default 1 minute
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60000;
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Start the alerts manager
   */
  start() {
    if (this.evaluationInterval) {
      return;
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateAlerts().catch(error => {
        console.error('Error evaluating alerts:', error);
        this.emit('evaluation_error', error);
      });
    }, this.options.evaluationInterval);

    // Initial evaluation
    this.evaluateAlerts();

    console.log('Alerts manager started');
    this.emit('started');
  }

  /**
   * Stop the alerts manager
   */
  stop() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    console.log('Alerts manager stopped');
    this.emit('stopped');
  }

  /**
   * Get current alert states
   */
  getAlertStates() {
    const states = [];

    for (const [name, alert] of this.alerts) {
      states.push({
        name,
        state: alert.state,
        severity: alert.severity,
        lastEvaluation: alert.lastEvaluation,
        lastTransition: alert.lastTransition,
        value: alert.value
      });
    }

    return states;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }
}

module.exports = AlertsManager;