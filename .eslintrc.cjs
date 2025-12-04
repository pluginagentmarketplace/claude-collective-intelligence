/**
 * ESLint Configuration for Node.js ESM Projects
 * Compatible with package.json "type": "module"
 */

module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
  ],
  rules: {
    // Error prevention
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // Allow console for Node.js apps
    'no-debugger': 'error',

    // Best practices
    'eqeqeq': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'warn',
    'prefer-arrow-callback': 'warn',

    // Style (relaxed for flexibility)
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'indent': ['warn', 2, { SwitchCase: 1 }],
    'comma-dangle': ['warn', 'always-multiline'],

    // ESM specific
    'import/extensions': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    '*.config.js',
    '*.config.cjs',
    '__mocks__/',
  ],
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
      },
      rules: {
        'no-unused-vars': 'off',
      },
    },
  ],
};
