/**
 * Main Sanitizer Module
 *
 * Provides comprehensive input sanitization for security
 * Prevents XSS, SQL Injection, Command Injection, and Path Traversal attacks
 */

import xss from 'xss';

/**
 * Security patterns for detection
 */
const SECURITY_PATTERNS = {
  // SQL Injection patterns
  SQL: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE|JOIN|ORDER\s+BY|GROUP\s+BY|HAVING)\b)/gi,
    /(\'|\"|;|--|\*|\/\*|\*\/|xp_|sp_|0x[0-9a-f]+)/gi,
    /(\b(AND|OR)\b\s*\d+\s*=\s*\d+)/gi,
    /(\b(WAITFOR|DELAY|BENCHMARK|SLEEP)\b)/gi
  ],

  // NoSQL Injection patterns
  NOSQL: [
    /(\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex|\$exists|\$type)/g,
    /(\{[^}]*\$[^}]*\})/g,
    /(javascript:|function\s*\(|=>)/gi
  ],

  // Command Injection patterns
  COMMAND: [
    /([;&|`$(){}[\]<>])/g,
    /(\b(rm|dd|chmod|chown|kill|shutdown|reboot|format|mkfs|passwd|shadow|sudoers)\b)/gi,
    /(\/etc\/passwd|\/etc\/shadow|\/dev\/null|\/dev\/zero)/gi,
    /(\|\||&&|>>|<<|2>&1)/g
  ],

  // Path Traversal patterns
  PATH: [
    /(\.\.\/|\.\.\\)/g,
    /(^\/|^\\|^~)/,
    /([<>:"|?*])/g,
    /(\/\.\.|\.\.\/)/g,
    /%2e%2e/gi,
    /\x00/g
  ],

  // LDAP Injection patterns
  LDAP: [
    /([*()\\|&])/g,
    /(\(|\)|\||&|\*|\\)/g
  ],

  // XML Injection patterns
  XML: [
    /<!DOCTYPE[^>]*>/gi,
    /<!ENTITY[^>]*>/gi,
    /<!\[CDATA\[/gi,
    /SYSTEM/gi
  ],

  // Script injection patterns
  SCRIPT: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /new\s+Function/gi
  ]
};

/**
 * HTML entity encoding map
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Main Sanitizer Class
 */
export class Sanitizer {
  constructor(options = {}) {
    this.options = {
      stripHtml: true,
      encodeEntities: true,
      removeScripts: true,
      detectPatterns: true,
      throwOnDetection: false,
      maxLength: 50000,
      allowedTags: [],
      allowedAttributes: {},
      ...options
    };

    this.detectionLog = [];

    // Configure XSS filter
    this.xssOptions = {
      whiteList: this.options.allowedTags.reduce((acc, tag) => {
        acc[tag] = this.options.allowedAttributes[tag] || [];
        return acc;
      }, {}),
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    };
  }

  /**
   * Main sanitization method
   * @param {any} input - Input to sanitize
   * @returns {any} Sanitized input
   */
  sanitize(input) {
    if (input === null || input === undefined) {
      return input;
    }

    // Handle different input types
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    } else if (Array.isArray(input)) {
      return this.sanitizeArray(input);
    } else if (typeof input === 'object') {
      return this.sanitizeObject(input);
    }

    // Primitives pass through
    return input;
  }

  /**
   * Sanitize string input
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }

    // Length check
    if (str.length > this.options.maxLength) {
      str = str.substring(0, this.options.maxLength);
    }

    // Pattern detection
    if (this.options.detectPatterns) {
      const detections = this.detectMaliciousPatterns(str);
      if (detections.length > 0) {
        this.logDetection('string', str, detections);

        if (this.options.throwOnDetection) {
          throw new SecurityError(`Malicious pattern detected: ${detections.join(', ')}`);
        }

        // Remove detected patterns
        str = this.removePatterns(str, detections);
      }
    }

    // HTML/Script sanitization
    if (this.options.stripHtml) {
      str = xss(str, this.xssOptions);
    }

    // Entity encoding
    if (this.options.encodeEntities) {
      str = this.encodeHtmlEntities(str);
    }

    // Remove null bytes
    str = str.replace(/\x00/g, '');

    // Normalize whitespace
    str = str.replace(/[\r\n\t]+/g, ' ').trim();

    return str;
  }

  /**
   * Sanitize array input
   * @param {Array} arr - Array to sanitize
   * @returns {Array} Sanitized array
   */
  sanitizeArray(arr) {
    return arr.map(item => this.sanitize(item));
  }

  /**
   * Sanitize object input
   * @param {Object} obj - Object to sanitize
   * @returns {Object} Sanitized object
   */
  sanitizeObject(obj) {
    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const sanitizedKey = this.sanitizeKey(key);

      // Skip if key is malicious and removed
      if (!sanitizedKey) continue;

      // Sanitize value
      sanitized[sanitizedKey] = this.sanitize(value);
    }

    return sanitized;
  }

  /**
   * Sanitize object keys
   * @param {string} key - Key to sanitize
   * @returns {string|null} Sanitized key or null if should be removed
   */
  sanitizeKey(key) {
    if (typeof key !== 'string') {
      return String(key);
    }

    // Check for dangerous keys
    const dangerousKeys = [
      '__proto__', 'constructor', 'prototype',
      '$where', '$regex', '$ne', '$gt', '$lt'
    ];

    if (dangerousKeys.includes(key.toLowerCase())) {
      this.logDetection('key', key, ['dangerous_key']);
      return null;
    }

    // Remove special characters from keys
    return key.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  /**
   * Detect malicious patterns
   * @param {string} str - String to check
   * @returns {Array} Detected pattern types
   */
  detectMaliciousPatterns(str) {
    const detected = [];

    for (const [type, patterns] of Object.entries(SECURITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(str)) {
          detected.push(type);
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Remove detected patterns from string
   * @param {string} str - String to clean
   * @param {Array} detections - Detected pattern types
   * @returns {string} Cleaned string
   */
  removePatterns(str, detections) {
    let cleaned = str;

    for (const detection of detections) {
      const patterns = SECURITY_PATTERNS[detection];
      if (patterns) {
        for (const pattern of patterns) {
          cleaned = cleaned.replace(pattern, '');
        }
      }
    }

    return cleaned;
  }

  /**
   * Encode HTML entities
   * @param {string} str - String to encode
   * @returns {string} Encoded string
   */
  encodeHtmlEntities(str) {
    return str.replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char] || char);
  }

  /**
   * Log detection for audit
   * @param {string} type - Input type
   * @param {any} input - Original input
   * @param {Array} detections - Detected patterns
   */
  logDetection(type, input, detections) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      detections,
      sample: typeof input === 'string' ? input.substring(0, 100) : JSON.stringify(input).substring(0, 100)
    };

    this.detectionLog.push(entry);

    // Keep only last 100 entries
    if (this.detectionLog.length > 100) {
      this.detectionLog.shift();
    }
  }

  /**
   * Get detection log
   * @returns {Array} Detection log entries
   */
  getDetectionLog() {
    return [...this.detectionLog];
  }

  /**
   * Clear detection log
   */
  clearDetectionLog() {
    this.detectionLog = [];
  }

  /**
   * Validate and sanitize file path
   * @param {string} path - File path to validate
   * @returns {string|null} Sanitized path or null if invalid
   */
  sanitizePath(path) {
    if (typeof path !== 'string') {
      return null;
    }

    // Remove null bytes
    path = path.replace(/\x00/g, '');

    // Check for path traversal
    if (SECURITY_PATTERNS.PATH.some(pattern => pattern.test(path))) {
      this.logDetection('path', path, ['path_traversal']);
      return null;
    }

    // Remove dangerous characters
    path = path.replace(/[<>:"|?*]/g, '');

    // Normalize path separators
    path = path.replace(/\\/g, '/');

    // Remove multiple slashes
    path = path.replace(/\/+/g, '/');

    return path;
  }

  /**
   * Sanitize URL
   * @param {string} url - URL to sanitize
   * @returns {string|null} Sanitized URL or null if invalid
   */
  sanitizeUrl(url) {
    if (typeof url !== 'string') {
      return null;
    }

    // Check for javascript: and data: protocols
    if (/^(javascript|data|vbscript):/i.test(url)) {
      this.logDetection('url', url, ['dangerous_protocol']);
      return null;
    }

    // Basic URL validation
    try {
      const parsed = new URL(url);

      // Only allow http(s) and ftp
      if (!['http:', 'https:', 'ftp:'].includes(parsed.protocol)) {
        return null;
      }

      return parsed.toString();
    } catch (e) {
      return null;
    }
  }
}

/**
 * Security Error Class
 */
export class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Create singleton instance
 */
const defaultSanitizer = new Sanitizer();

/**
 * Convenience functions
 */
export function sanitize(input, options = {}) {
  const sanitizer = new Sanitizer(options);
  return sanitizer.sanitize(input);
}

export function sanitizeString(str, options = {}) {
  const sanitizer = new Sanitizer(options);
  return sanitizer.sanitizeString(str);
}

export function sanitizeObject(obj, options = {}) {
  const sanitizer = new Sanitizer(options);
  return sanitizer.sanitizeObject(obj);
}

export function sanitizePath(path, options = {}) {
  const sanitizer = new Sanitizer(options);
  return sanitizer.sanitizePath(path);
}

export function sanitizeUrl(url, options = {}) {
  const sanitizer = new Sanitizer(options);
  return sanitizer.sanitizeUrl(url);
}

/**
 * Sanitize message for RabbitMQ
 */
export async function sanitizeMessage(message) {
  const sanitizer = new Sanitizer({
    stripHtml: true,
    encodeEntities: false, // Don't encode for internal messages
    removeScripts: true,
    detectPatterns: true,
    throwOnDetection: false
  });

  return sanitizer.sanitize(message);
}

/**
 * Export default instance and class
 */
export default defaultSanitizer;
export { Sanitizer as SanitizerClass };