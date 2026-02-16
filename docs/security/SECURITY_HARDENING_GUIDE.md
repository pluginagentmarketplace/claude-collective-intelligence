# Enterprise Security Hardening Guide
## RabbitMQ Multi-Agent Orchestration System

**Version:** 1.0.0
**Last Updated:** 2024-11-18
**Classification:** Internal - Security Documentation

---

## Executive Summary

This document provides comprehensive security hardening guidelines for the RabbitMQ Multi-Agent Orchestration System. It covers defense-in-depth strategies, implementation best practices, and operational security measures for enterprise-grade deployments.

---

## Table of Contents

1. [Network Security](#network-security)
2. [Application Security](#application-security)
3. [Data Security](#data-security)
4. [Authentication & Authorization](#authentication--authorization)
5. [Infrastructure Hardening](#infrastructure-hardening)
6. [Monitoring & Detection](#monitoring--detection)
7. [Incident Response](#incident-response)
8. [Compliance & Audit](#compliance--audit)

---

## Network Security

### 1. HTTPS/TLS Configuration

#### Implementation Requirements

```javascript
// src/server/https-config.js
const https = require('https');
const fs = require('fs');

const httpsOptions = {
  key: fs.readFileSync(process.env.TLS_KEY_PATH),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  ca: fs.readFileSync(process.env.TLS_CA_PATH),
  ciphers: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384',
  minVersion: 'TLSv1.2',
  ecdhCurve: 'secp384r1',
  honorCipherOrder: true,
  sessionTimeout: 86400
};

https.createServer(httpsOptions, app).listen(443);
```

#### Certificate Management

- Use certificates signed by trusted Certificate Authority
- Minimum key length: 2048 bits (RSA) or 256 bits (ECDSA)
- Certificate validity: max 1 year
- Implement certificate pinning for critical connections
- Automate certificate renewal (e.g., Let's Encrypt)

#### TLS Protocol Versions

- **Supported:** TLS 1.2, TLS 1.3
- **Deprecated:** SSL 3.0, TLS 1.0, TLS 1.1
- **Minimum Default:** TLS 1.2

#### Cipher Suites

Recommended modern ciphers:
```
ECDHE-ECDSA-AES256-GCM-SHA384
ECDHE-RSA-AES256-GCM-SHA384
ECDHE-ECDSA-CHACHA20-POLY1305
ECDHE-RSA-CHACHA20-POLY1305
ECDHE-ECDSA-AES128-GCM-SHA256
ECDHE-RSA-AES128-GCM-SHA256
```

### 2. CORS Restrictions

```javascript
// src/middleware/cors.js
const cors = require('cors');

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400
};

app.use(cors(corsOptions));
```

**CORS Best Practices:**
- Whitelist specific origins (never use wildcard *)
- Require credentials explicitly
- Limit allowed methods and headers
- Set appropriate max-age
- Implement preflight caching

### 3. API Gateway Configuration

```javascript
// src/gateway/security-headers.js
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()'
};

app.use((req, res, next) => {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
});
```

---

## Application Security

### 1. Input Sanitization

```javascript
// src/security/input-sanitization.js
const xss = require('xss');
const validator = require('validator');

function sanitizeInput(input, options = {}) {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove XSS vectors
  let sanitized = xss(input, {
    whiteList: {},
    stripIgnoredTag: true,
    stripLeadingAndTrailingWhitespace: true
  });

  // Trim whitespace
  sanitized = sanitized.trim();

  // Validate length
  const maxLength = options.maxLength || 1000;
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength}`);
  }

  return sanitized;
}

function validateEmail(email) {
  const sanitized = sanitizeInput(email);
  if (!validator.isEmail(sanitized)) {
    throw new Error('Invalid email format');
  }
  return sanitized;
}

function validateJSON(input) {
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error('Invalid JSON input');
  }
}

module.exports = {
  sanitizeInput,
  validateEmail,
  validateJSON
};
```

### 2. Output Encoding

```javascript
// src/security/output-encoding.js

function encodeForHTML(text) {
  const map = {
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;'
  };

  return text.replace(/[<>"'&]/g, char => map[char]);
}

function encodeForJavaScript(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function encodeForURL(text) {
  return encodeURIComponent(text);
}

module.exports = {
  encodeForHTML,
  encodeForJavaScript,
  encodeForURL
};
```

### 3. Command Injection Prevention

```javascript
// src/security/command-execution.js
const { execFile } = require('child_process');

function executeCommand(command, args) {
  // Use execFile instead of shell
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      shell: false, // CRITICAL: Disable shell
      timeout: 30000,
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// Whitelist allowed commands
const ALLOWED_COMMANDS = [
  'list-agents',
  'create-task',
  'get-status',
  'export-logs'
];

function validateCommand(command) {
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`Command '${command}' not allowed`);
  }
}

module.exports = {
  executeCommand,
  validateCommand
};
```

### 4. SQL Injection Prevention

```javascript
// src/security/database-queries.js
const db = require('./db');

// CORRECT: Parameterized queries
function getAgentById(id) {
  return db.query(
    'SELECT * FROM agents WHERE id = $1',
    [id]
  );
}

// WRONG: String concatenation (NEVER DO THIS)
function getAgentByIdWrong(id) {
  return db.query(`SELECT * FROM agents WHERE id = '${id}'`);
}

// Validation for additional protection
function validateAgentId(id) {
  if (!/^[a-zA-Z0-9\-]{36}$/.test(id)) {
    throw new Error('Invalid agent ID format');
  }
  return id;
}

module.exports = {
  getAgentById,
  validateAgentId
};
```

---

## Data Security

### 1. Encryption at Rest

```javascript
// src/security/encryption.js
const crypto = require('crypto');

class EncryptionManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyPath = process.env.ENCRYPTION_KEY_PATH;
  }

  encrypt(plaintext) {
    const key = crypto.scryptSync(process.env.MASTER_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const key = crypto.scryptSync(process.env.MASTER_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

module.exports = new EncryptionManager();
```

### 2. Secrets Management

```javascript
// .env.example (version control safe)
# JWT Configuration
JWT_ACCESS_SECRET=GENERATE_ME_SECURELY
JWT_REFRESH_SECRET=GENERATE_ME_SECURELY
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Database
DB_PASSWORD=GENERATE_ME_SECURELY

# Master Encryption Key
MASTER_KEY=GENERATE_ME_SECURELY

# RabbitMQ
RABBITMQ_USERNAME=rabbitmq_user
RABBITMQ_PASSWORD=GENERATE_ME_SECURELY
```

**Secrets Generation:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Data Minimization

- Only store necessary data
- Implement data retention policies
- Encrypt sensitive fields (PII, credentials)
- Use field-level encryption for highly sensitive data

---

## Authentication & Authorization

### 1. Strong Password Policy

```javascript
// src/auth/password-policy.js

const PASSWORD_POLICY = {
  minLength: 14,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventReuse: 5, // Last N passwords
  expiryDays: 90,
  lockoutAttempts: 5,
  lockoutDuration: 900000 // 15 minutes
};

function validatePassword(password) {
  const errors = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letters');
  }

  if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain numbers');
  }

  if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain special characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  PASSWORD_POLICY,
  validatePassword
};
```

### 2. Multi-Factor Authentication (MFA)

```javascript
// src/auth/mfa.js
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class MFAManager {
  setupTOTP(agentId) {
    const secret = speakeasy.generateSecret({
      name: `RabbitMQ Orchestrator (${agentId})`,
      issuer: 'RabbitMQ'
    });

    return {
      secret: secret.base32,
      qrCode: QRCode.toDataURL(secret.otpauth_url)
    };
  }

  verifyTOTP(agentId, token, secret) {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });

    return verified;
  }
}

module.exports = new MFAManager();
```

### 3. JWT Token Security

```javascript
// src/auth/jwt-config.js

const JWT_CONFIG = {
  algorithm: 'HS256',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'rabbitmq-orchestrator',
  audience: 'agent-network',
  notBeforeTime: 0,
  clockTolerance: 5 // seconds
};

const JWT_BEST_PRACTICES = [
  'Store tokens in httpOnly cookies',
  'Use Secure flag for HTTPS',
  'Use SameSite=Strict',
  'Implement token rotation',
  'Revoke tokens on logout',
  'Validate issuer and audience',
  'Use symmetric encryption for HS256',
  'Store secrets in environment variables'
];

module.exports = {
  JWT_CONFIG,
  JWT_BEST_PRACTICES
};
```

---

## Infrastructure Hardening

### 1. Docker Security

```dockerfile
# Dockerfile.secure
FROM node:18-alpine

# Run as non-root user
RUN addgroup -g 1001 appgroup && adduser -D -u 1001 -G appgroup appuser

# Install security tools
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy application files
COPY --chown=appuser:appgroup . .

# Install dependencies
RUN npm ci --only=production

# Remove unnecessary files
RUN rm -rf .git .gitignore

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "scripts/orchestrator.js"]
```

### 2. Kubernetes Security Policies

```yaml
# security-policy.yaml
apiVersion: policy/v1
kind: PodSecurityPolicy
metadata:
  name: rabbitmq-hardened
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  allowedCapabilities: []
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'MustRunAs'
    seLinuxOptions:
      level: "s0:c123,c456"
  readOnlyRootFilesystem: true
```

### 3. Network Segmentation

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: rabbitmq-network-policy
spec:
  podSelector:
    matchLabels:
      app: rabbitmq-agent
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: authorized-client
      ports:
        - protocol: TCP
          port: 5672
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 53  # DNS
```

---

## Monitoring & Detection

### 1. Security Event Logging

```javascript
// src/logger/security-logger.js
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'logs/security-events.log',
      level: 'warn'
    }),
    new winston.transports.File({
      filename: 'logs/audit-trail.log',
      level: 'info'
    })
  ]
});

// Log authentication events
function logAuthEvent(agentId, event, success, details = {}) {
  securityLogger.info({
    timestamp: new Date().toISOString(),
    agentId,
    event,
    success,
    details,
    metadata: {
      ip: details.ip,
      userAgent: details.userAgent
    }
  });
}

// Log authorization failures
function logAuthorizationFailure(agentId, resource, permission, reason) {
  securityLogger.warn({
    timestamp: new Date().toISOString(),
    agentId,
    resource,
    permission,
    reason,
    severity: 'HIGH'
  });
}

module.exports = {
  securityLogger,
  logAuthEvent,
  logAuthorizationFailure
};
```

### 2. Intrusion Detection

```javascript
// src/security/intrusion-detection.js

class IntrusionDetectionSystem {
  constructor() {
    this.failedAttempts = new Map();
    this.threshold = 5;
    this.windowTime = 3600000; // 1 hour
  }

  trackFailedAttempt(agentId) {
    if (!this.failedAttempts.has(agentId)) {
      this.failedAttempts.set(agentId, []);
    }

    const attempts = this.failedAttempts.get(agentId);
    const now = Date.now();

    // Remove old attempts
    const recent = attempts.filter(t => now - t < this.windowTime);
    this.failedAttempts.set(agentId, recent);

    recent.push(now);

    if (recent.length >= this.threshold) {
      this.triggerAlert(agentId, 'Excessive failed login attempts');
      return true;
    }

    return false;
  }

  triggerAlert(agentId, reason) {
    console.error(`SECURITY ALERT: Agent ${agentId} - ${reason}`);
    // Send to SIEM
  }
}

module.exports = new IntrusionDetectionSystem();
```

### 3. Vulnerability Scanning

```bash
#!/bin/bash
# scripts/security-scan.sh

echo "Running security scans..."

# NPM audit
echo "Running npm audit..."
npm audit --audit-level=moderate

# OWASP Dependency Check
echo "Running OWASP Dependency Check..."
dependency-check --project "RabbitMQ Agent" --scan . --format JSON --out report.json

# SonarQube (if available)
if command -v sonar-scanner &> /dev/null; then
  echo "Running SonarQube..."
  sonar-scanner
fi

echo "Security scans complete!"
```

---

## Incident Response

### 1. Breach Response Procedure

```javascript
// src/security/incident-response.js

class IncidentResponseManager {
  async handleBreach(severity, details) {
    // 1. Contain the breach
    await this.isolateAffectedSystems(details);

    // 2. Log the incident
    await this.logIncident(severity, details);

    // 3. Notify stakeholders
    await this.notifySecurityTeam(details);

    // 4. Begin investigation
    await this.beginInvestigation(details);
  }

  async isolateAffectedSystems(details) {
    // Revoke tokens
    // Disable accounts
    // Block IPs
  }

  async logIncident(severity, details) {
    // Log to centralized system
    // Preserve evidence
  }

  async notifySecurityTeam(details) {
    // Send alerts
    // Create incident tickets
  }

  async beginInvestigation(details) {
    // Analyze logs
    // Interview users
    // Determine scope
  }
}

module.exports = new IncidentResponseManager();
```

---

## Compliance & Audit

### 1. Audit Trail

```javascript
// src/audit/audit-trail.js

class AuditTrail {
  logAction(userId, action, resource, result, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      resource,
      result,
      details,
      ipAddress: details.ip,
      userAgent: details.userAgent
    };

    // Store in database
    // Send to audit service
    return entry;
  }

  query(criteria) {
    // Query audit logs
    // Apply retention policies
  }

  export(format = 'json') {
    // Export audit trail
    // For compliance reporting
  }
}

module.exports = new AuditTrail();
```

### 2. Security Checklist

```markdown
## Pre-Deployment Security Checklist

- [ ] All secrets in environment variables
- [ ] TLS/HTTPS enabled with modern ciphers
- [ ] Input validation implemented
- [ ] Output encoding applied
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] CSRF tokens implemented
- [ ] Authentication enforced
- [ ] Authorization checks in place
- [ ] Audit logging active
- [ ] Security headers set
- [ ] Dependencies updated
- [ ] npm audit passing
- [ ] No hardcoded secrets
- [ ] Database connections encrypted
- [ ] API keys rotated
- [ ] Backup encryption verified
- [ ] Disaster recovery tested
- [ ] Incident response plan in place
- [ ] Security team trained
```

---

## Security Contact Information

**Report Security Issues:** security@rabbitmq-orchestrator.io
**Response Time:** 24 hours
**Disclosure Policy:** Coordinated Vulnerability Disclosure (90 days)

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/nodejs-security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework/)

---

**Document Version:** 1.0
**Last Reviewed:** 2024-11-18
**Next Review:** 2025-05-18
