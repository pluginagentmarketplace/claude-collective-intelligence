/**
 * Security Logger
 * Enterprise-grade security event logging for compliance and audit trails
 */

import { createChildLogger } from './winston-config.js';
import { getContext } from './context-manager.js';
import crypto from 'crypto';

/**
 * Security Logger Class
 */
class SecurityLogger {
  constructor() {
    this.logger = createChildLogger('security');
    this.securityEvents = [];
    this.eventCache = new Map();
  }

  /**
   * Log authentication events
   */
  logAuthentication(event) {
    const {
      userId,
      username,
      method = 'password',
      success = false,
      ip,
      userAgent,
      reason = null,
      mfaUsed = false,
      sessionId = null
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'AUTHENTICATION',
      userId,
      username,
      method,
      success,
      ip: this.maskIp(ip),
      userAgent,
      reason,
      mfaUsed,
      sessionId,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    const level = success ? 'info' : 'warn';
    this.logger[level]('Authentication event', logData);

    // Track failed attempts
    if (!success) {
      this.trackFailedAttempt(userId || username, ip);
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log authorization events
   */
  logAuthorization(event) {
    const {
      userId,
      resource,
      action,
      allowed = false,
      requiredRole,
      userRole,
      ip,
      reason = null
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'AUTHORIZATION',
      userId,
      resource,
      action,
      allowed,
      requiredRole,
      userRole,
      ip: this.maskIp(ip),
      reason,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    const level = allowed ? 'debug' : 'warn';
    this.logger[level]('Authorization event', logData);

    // Alert on unusual denied access
    if (!allowed && reason === 'insufficient_privileges') {
      this.logger.warn('Privilege escalation attempt detected', {
        userId,
        resource,
        requiredRole,
        userRole
      });
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log data access events
   */
  logDataAccess(event) {
    const {
      userId,
      dataType,
      recordCount,
      operation = 'read',
      filters = null,
      ip,
      success = true,
      reason = null
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'DATA_ACCESS',
      userId,
      dataType,
      recordCount,
      operation,
      filters,
      ip: this.maskIp(ip),
      success,
      reason,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    const level = success ? 'info' : 'warn';
    this.logger[level]('Data access event', logData);

    // Alert on bulk data export
    if (operation === 'export' && recordCount > 1000) {
      this.logger.warn('Bulk data export detected', {
        userId,
        dataType,
        recordCount
      });
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log configuration changes
   */
  logConfigurationChange(event) {
    const {
      userId,
      component,
      setting,
      oldValue,
      newValue,
      reason = null,
      ip
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'CONFIGURATION_CHANGE',
      userId,
      component,
      setting,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue),
      reason,
      ip: this.maskIp(ip),
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    this.logger.warn('Configuration changed', logData);

    // Alert on critical changes
    const criticalSettings = ['jwt_secret', 'api_key', 'encryption_key', 'database_url'];
    if (criticalSettings.includes(setting.toLowerCase())) {
      this.logger.error('CRITICAL: Security setting changed', {
        ...logData,
        alert: true
      });
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log security policy violations
   */
  logPolicyViolation(event) {
    const {
      userId,
      policy,
      violation,
      severity = 'medium',
      details = null,
      ip
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'POLICY_VIOLATION',
      userId,
      policy,
      violation,
      severity,
      details,
      ip: this.maskIp(ip),
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    this.logger[level]('Security policy violation', logData);

    // Alert on critical violations
    if (severity === 'critical') {
      this.alertSecurityTeam('CRITICAL_VIOLATION', logData);
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log access control violations
   */
  logAccessControlViolation(event) {
    const {
      userId,
      resource,
      action,
      ip,
      reason = 'unauthorized_access',
      attemptCount = 1
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'ACCESS_CONTROL_VIOLATION',
      userId,
      resource,
      action,
      ip: this.maskIp(ip),
      reason,
      attemptCount,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    this.logger.warn('Access control violation', logData);

    // Alert on repeated violations from same IP
    if (attemptCount > 3) {
      this.logger.error('Multiple access control violations detected', {
        ...logData,
        alert: true,
        action: 'rate_limit'
      });
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(event) {
    const {
      userId,
      activityType,
      description,
      riskScore = 0.5,
      details = null,
      ip,
      action = 'monitor'
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'SUSPICIOUS_ACTIVITY',
      userId,
      activityType,
      description,
      riskScore,
      details,
      ip: this.maskIp(ip),
      action,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    const level = riskScore > 0.8 ? 'error' : riskScore > 0.5 ? 'warn' : 'info';
    this.logger[level]('Suspicious activity detected', logData);

    // Alert on high-risk activity
    if (riskScore > 0.8) {
      this.alertSecurityTeam('HIGH_RISK_ACTIVITY', logData);
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log rate limit events
   */
  logRateLimit(event) {
    const {
      userId,
      endpoint,
      requestCount,
      limit,
      window = 60,
      ip,
      action = 'block'
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'RATE_LIMIT',
      userId,
      endpoint,
      requestCount,
      limit,
      window,
      ip: this.maskIp(ip),
      action,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    this.logger.warn('Rate limit exceeded', logData);

    // Alert on DDoS-like pattern
    if (requestCount > limit * 10) {
      this.logger.error('Possible DDoS attack detected', {
        ...logData,
        alert: true
      });
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log encryption/decryption events
   */
  logEncryption(event) {
    const {
      operation = 'encrypt',
      dataType,
      size,
      algorithm,
      success = true,
      reason = null,
      userId
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'ENCRYPTION',
      operation,
      dataType,
      size,
      algorithm,
      success,
      reason,
      userId,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    const level = success ? 'debug' : 'warn';
    this.logger[level]('Encryption event', logData);

    this.addSecurityEvent(logData);
  }

  /**
   * Log certificate/key events
   */
  logCertificateEvent(event) {
    const {
      eventType = 'renewal',
      certificate,
      issuer,
      expiresIn,
      status = 'success',
      reason = null,
      userId
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'CERTIFICATE_EVENT',
      event: eventType,
      certificate,
      issuer,
      expiresIn,
      status,
      reason,
      userId,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId
    };

    const level = status === 'success' ? 'info' : 'warn';
    this.logger[level]('Certificate event', logData);

    // Alert on upcoming expiration
    if (eventType === 'check' && expiresIn < 30) {
      this.logger.warn('Certificate expiring soon', {
        ...logData,
        alert: true,
        daysUntilExpiry: expiresIn
      });
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Log compliance audit events
   */
  logComplianceAudit(event) {
    const {
      auditType,
      standard = null,
      status = 'pass',
      findings = [],
      timestamp = new Date().toISOString(),
      auditedBy
    } = event;

    const context = getContext();
    const logData = {
      eventType: 'COMPLIANCE_AUDIT',
      auditType,
      standard,
      status,
      findingsCount: findings.length,
      findings: findings.map(f => ({
        code: f.code,
        severity: f.severity,
        description: f.description
      })),
      timestamp,
      auditedBy,
      correlationId: context.correlationId
    };

    const level = status === 'pass' ? 'info' : 'warn';
    this.logger[level]('Compliance audit', logData);

    // Alert on failed audits
    if (status === 'fail') {
      this.alertSecurityTeam('COMPLIANCE_FAILURE', logData);
    }

    this.addSecurityEvent(logData);
  }

  /**
   * Generate security report
   */
  generateSecurityReport(timeRange = 'daily') {
    const report = {
      timeRange,
      generatedAt: new Date().toISOString(),
      events: {
        total: this.securityEvents.length,
        authentication: this.countEventsByType('AUTHENTICATION'),
        authorization: this.countEventsByType('AUTHORIZATION'),
        accessControl: this.countEventsByType('ACCESS_CONTROL_VIOLATION'),
        suspiciousActivity: this.countEventsByType('SUSPICIOUS_ACTIVITY'),
        policyViolations: this.countEventsByType('POLICY_VIOLATION'),
        configurationChanges: this.countEventsByType('CONFIGURATION_CHANGE')
      },
      failedAuthAttempts: Array.from(this.eventCache.entries())
        .filter(([key]) => key.startsWith('failed_'))
        .map(([key, value]) => ({
          identifier: key.replace('failed_', ''),
          attempts: value.count,
          lastAttempt: value.lastTime
        }))
    };

    this.logger.info('Security report generated', report);
    return report;
  }

  /**
   * Clear old security events
   */
  clearOldEvents(retentionDays = 30) {
    const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const initialCount = this.securityEvents.length;

    this.securityEvents = this.securityEvents.filter(
      event => new Date(event.timestamp) > cutoffTime
    );

    const removedCount = initialCount - this.securityEvents.length;
    if (removedCount > 0) {
      this.logger.info('Old security events cleared', {
        removed: removedCount,
        remaining: this.securityEvents.length,
        retentionDays
      });
    }
  }

  /**
   * Helper: Track failed authentication attempts
   */
  trackFailedAttempt(identifier, ip) {
    const key = `failed_${identifier}_${this.maskIp(ip)}`;

    if (this.eventCache.has(key)) {
      const data = this.eventCache.get(key);
      data.count++;
      data.lastTime = new Date().toISOString();
    } else {
      this.eventCache.set(key, {
        count: 1,
        lastTime: new Date().toISOString()
      });
    }

    // Alert if too many failed attempts
    const data = this.eventCache.get(key);
    if (data.count >= 5) {
      this.logger.error('Multiple failed authentication attempts', {
        identifier,
        ip,
        attempts: data.count,
        action: 'account_lockout'
      });
    }
  }

  /**
   * Helper: Mask IP address
   */
  maskIp(ip) {
    if (!ip || typeof ip !== 'string') return 'unknown';
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
    }
    return ip;
  }

  /**
   * Helper: Sanitize sensitive values
   */
  sanitizeValue(value) {
    if (typeof value === 'string') {
      if (value.length > 50) {
        return value.substring(0, 50) + '...';
      }
      // Check if looks like a secret
      if (['secret', 'key', 'token', 'password'].some(word =>
        value.toLowerCase().includes(word))) {
        return '[REDACTED]';
      }
    }
    return value;
  }

  /**
   * Helper: Add security event to cache
   */
  addSecurityEvent(eventData) {
    this.securityEvents.push(eventData);

    // Keep only last 1000 events in memory
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }
  }

  /**
   * Helper: Count events by type
   */
  countEventsByType(type) {
    return this.securityEvents.filter(e => e.eventType === type).length;
  }

  /**
   * Helper: Alert security team
   */
  alertSecurityTeam(alertType, data) {
    this.logger.error('SECURITY_ALERT', {
      alertType,
      data,
      action: 'notify_security_team',
      timestamp: new Date().toISOString()
    });

    // In production, integrate with alerting system
    // e.g., Slack, PagerDuty, email notification
  }
}

// Export singleton instance
const securityLogger = new SecurityLogger();

export { securityLogger };
export const logAuthentication = (...args) => securityLogger.logAuthentication(...args);
export const logAuthorization = (...args) => securityLogger.logAuthorization(...args);
export const logDataAccess = (...args) => securityLogger.logDataAccess(...args);
export const logConfigurationChange = (...args) => securityLogger.logConfigurationChange(...args);
export const logPolicyViolation = (...args) => securityLogger.logPolicyViolation(...args);
export const logAccessControlViolation = (...args) => securityLogger.logAccessControlViolation(...args);
export const logSuspiciousActivity = (...args) => securityLogger.logSuspiciousActivity(...args);
export const logRateLimit = (...args) => securityLogger.logRateLimit(...args);
export const logEncryption = (...args) => securityLogger.logEncryption(...args);
export const logCertificateEvent = (...args) => securityLogger.logCertificateEvent(...args);
export const logComplianceAudit = (...args) => securityLogger.logComplianceAudit(...args);
export const generateSecurityReport = (...args) => securityLogger.generateSecurityReport(...args);
