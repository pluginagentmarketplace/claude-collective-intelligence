# Package.json Scripts Configuration

Scripts to add to package.json for TypeScript support.

## Recommended Scripts

Add these scripts to the `scripts` section of `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "build:prod": "tsc --declaration --sourceMap --skipLibCheck",
    "build:clean": "rm -rf dist && tsc",
    "build:types": "tsc --declaration --emitDeclarationOnly",
    "build:debug": "tsc --sourceMap --mapRoot https://example.com/",

    "type-check": "tsc --noEmit",
    "type-check:verbose": "tsc --noEmit --listFiles",
    "type-check:watch": "tsc --noEmit --watch",

    "dev": "ts-node --esm src/scripts/orchestrator.ts",
    "dev:watch": "tsc-watch --onSuccess \"node dist/scripts/orchestrator.js\"",

    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\"",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:ci": "jest --ci --coverage --maxWorkers=2",

    "clean": "rm -rf dist coverage node_modules",
    "clean:dist": "rm -rf dist",
    "clean:coverage": "rm -rf coverage"
  }
}
```

## Script Groups

### Build Scripts

```json
{
  "build": "tsc",
  "build:watch": "tsc --watch",
  "build:prod": "tsc --declaration --sourceMap",
  "build:clean": "rm -rf dist && tsc",
  "build:types": "tsc --declaration --emitDeclarationOnly"
}
```

**Usage:**
```bash
npm run build              # One-time build
npm run build:watch       # Watch mode development
npm run build:prod        # Production build with declarations
npm run build:clean       # Clean build from scratch
npm run build:types       # Generate type definitions only
```

### Type Checking

```json
{
  "type-check": "tsc --noEmit",
  "type-check:verbose": "tsc --noEmit --listFiles",
  "type-check:watch": "tsc --noEmit --watch"
}
```

**Usage:**
```bash
npm run type-check        # Check types without generating code
npm run type-check:verbose # Show all files being checked
npm run type-check:watch  # Watch mode type checking
```

### Development Scripts

```json
{
  "dev": "ts-node --esm src/scripts/orchestrator.ts",
  "dev:watch": "tsc-watch --onSuccess \"node dist/scripts/orchestrator.js\""
}
```

**Usage:**
```bash
npm run dev               # Run directly from TypeScript
npm run dev:watch        # Run with auto-restart on changes
```

### Linting & Formatting

```json
{
  "lint": "eslint src --ext .ts,.tsx",
  "lint:fix": "eslint src --ext .ts,.tsx --fix",
  "format": "prettier --write \"src/**/*.ts\"",
  "format:check": "prettier --check \"src/**/*.ts\""
}
```

**Usage:**
```bash
npm run lint              # Check code quality
npm run lint:fix          # Auto-fix issues
npm run format            # Format code
npm run format:check      # Check formatting
```

### Testing Scripts

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
  "test:ci": "jest --ci --coverage --maxWorkers=2"
}
```

**Usage:**
```bash
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
npm run test:debug       # Debug tests
npm run test:ci          # CI environment
```

### Cleanup Scripts

```json
{
  "clean": "rm -rf dist coverage node_modules",
  "clean:dist": "rm -rf dist",
  "clean:coverage": "rm -rf coverage"
}
```

**Usage:**
```bash
npm run clean            # Full cleanup
npm run clean:dist       # Remove dist only
npm run clean:coverage   # Remove coverage only
```

## Platform-Specific Scripts

### macOS/Linux

```json
{
  "build:clean": "rm -rf dist && tsc",
  "clean": "rm -rf dist coverage node_modules"
}
```

### Windows (cmd)

```json
{
  "build:clean": "rmdir /s /q dist && tsc",
  "clean": "rmdir /s /q dist coverage node_modules"
}
```

### Cross-Platform Solution

Use `rimraf` package:

```bash
npm install -D rimraf
```

```json
{
  "build:clean": "rimraf dist && tsc",
  "clean": "rimraf dist coverage node_modules"
}
```

## Pre/Post Hooks

```json
{
  "prebuild": "npm run type-check",
  "build": "tsc",
  "postbuild": "node scripts/verify-build.js",

  "pretest": "npm run lint",
  "test": "jest",

  "prepush": "npm run type-check && npm test"
}
```

**Note:** Pre/post hooks run automatically:
- `npm run build` will run `prebuild` first, then `postbuild` after

## Package Scripts by Phase

### Phase 1: Setup

```json
{
  "type-check": "tsc --noEmit",
  "build": "tsc"
}
```

### Phase 2-3: Development

```json
{
  "build": "tsc",
  "build:watch": "tsc --watch",
  "type-check": "tsc --noEmit",
  "test": "jest",
  "test:watch": "jest --watch"
}
```

### Phase 4-5: Production

```json
{
  "build": "tsc",
  "build:prod": "tsc --declaration --sourceMap",
  "build:watch": "tsc --watch",
  "type-check": "tsc --noEmit",
  "lint": "eslint src --ext .ts",
  "test": "jest",
  "test:coverage": "jest --coverage",
  "test:ci": "jest --ci --coverage",
  "clean": "rimraf dist coverage"
}
```

## Example Full Package.json

```json
{
  "name": "ai-agent-orchestrator-rabbitmq",
  "version": "1.0.0",
  "description": "Ultra-advanced multi-agent orchestration system using RabbitMQ",
  "main": "dist/scripts/orchestrator.js",
  "type": "module",

  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "build:prod": "tsc --declaration --sourceMap --skipLibCheck",
    "build:clean": "rimraf dist && tsc",
    "build:types": "tsc --declaration --emitDeclarationOnly",

    "type-check": "tsc --noEmit",
    "type-check:verbose": "tsc --noEmit --listFiles",
    "type-check:watch": "tsc --noEmit --watch",

    "dev": "ts-node --esm src/scripts/orchestrator.ts",
    "dev:watch": "tsc-watch --onSuccess \"node dist/scripts/orchestrator.js\"",

    "start": "node dist/scripts/orchestrator.js",
    "monitor": "node dist/scripts/monitor.js",
    "setup": "node dist/scripts/setup-rabbitmq.js",

    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\"",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:ci": "jest --ci --coverage --maxWorkers=2",

    "clean": "rimraf dist coverage",
    "clean:dist": "rimraf dist",
    "clean:coverage": "rimraf coverage"
  },

  "dependencies": {
    "amqplib": "^0.10.3",
    "bcryptjs": "^3.0.3",
    "chalk": "^5.6.2",
    "crypto-js": "^4.2.0",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^8.2.1",
    "ioredis": "^5.3.2",
    "joi": "^17.11.0",
    "jsonwebtoken": "^9.0.2",
    "lru-cache": "^10.1.0",
    "node-pg-migrate": "^6.2.2",
    "ora": "^7.0.1",
    "pg": "^8.11.3",
    "pg-pool": "^3.6.1",
    "redis": "^4.6.11",
    "uuid": "^9.0.1",
    "winston": "^3.18.3",
    "winston-daily-rotate-file": "^5.0.0",
    "xss": "^1.0.14"
  },

  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "jest": "^29.7.0",
    "jest-environment-node": "^29.7.0",
    "jest-junit": "^16.0.0",
    "prettier": "^3.0.0",
    "rimraf": "^5.0.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "tsc-watch": "^6.0.0",
    "typescript": "^5.2.0"
  },

  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

## Installation Commands

```bash
# Install TypeScript and build tools
npm install -D typescript ts-node tsc-watch ts-jest

# Install type definitions
npm install -D @types/node @types/jest

# Install linting and formatting
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D prettier

# Install utilities
npm install -D rimraf

# Install testing
npm install -D jest @jest/globals jest-junit
```

## Verification

After updating scripts, verify they work:

```bash
npm run type-check      # Should pass
npm run build           # Should create dist/
npm run lint            # Should check code
npm test                # Should run tests
npm run clean           # Should clean up

ls dist/                # Should have .js files
```

## CI/CD Integration

For GitHub Actions:

```yaml
name: TypeScript Build & Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run type-check
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

---

Last updated: 2025-11-18
