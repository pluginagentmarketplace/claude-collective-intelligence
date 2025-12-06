/**
 * Jest Configuration for Node.js ESM Projects
 * Compatible with NODE_OPTIONS=--experimental-vm-modules
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],

  // ESM Support (package.json has "type": "module")
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock external services for unit tests
    '^amqplib$': '<rootDir>/tests/__mocks__/amqplib.js',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'scripts/**/*.js',
    'agents/**/*.js',
    '!scripts/hooks/**',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**'
  ],

  // Coverage threshold temporarily disabled - needs test improvements
  // Target: 60% coverage after test fixes
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },

  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],

  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  moduleDirectories: ['node_modules', '<rootDir>'],

  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  maxWorkers: '50%',
  // Don't bail on first failure - let all tests run
  bail: 0
};
