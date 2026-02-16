# TypeScript Setup Guide

Quick reference guide for TypeScript development environment setup.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- TypeScript >= 5.2.0

## Initial Setup

### 1. Install Dependencies

```bash
# Install TypeScript and tooling
npm install -D typescript@latest
npm install -D @types/node @types/jest @types/express
npm install -D ts-node ts-jest ts-loader
npm install -D tsc-watch
```

### 2. Verify Configuration Files

```bash
# Check tsconfig.json exists and is valid
npm run type-check

# Verify jest.config.ts exists
ls -la jest.config.ts
```

### 3. Build Project

```bash
# Clean build
npm run build

# Watch mode development
npm run build:watch

# Type checking only
npm run type-check
```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test tests/unit/errors.test.ts
```

### Building for Production

```bash
# Full build with optimization
npm run build:prod

# With source maps
npm run build:debug

# Verify output
ls -lh dist/
```

### Type Checking

```bash
# Check for type errors
npm run type-check

# Check with verbose output
npm run type-check:verbose

# Generate type definitions
npm run build:types
```

### Linting & Formatting

```bash
# Check code quality
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## IDE Configuration

### VS Code Setup

Create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true
    }
  },
  "editor.rulers": [100],
  "editor.wordWrap": "on",
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "orta.vscode-jest",
    "formulahendry.code-runner"
  ]
}
```

### IntelliJ IDEA / WebStorm

1. Go to Settings > Languages & Frameworks > TypeScript
2. Select TypeScript version: `./node_modules/typescript/lib`
3. Enable ESLint
4. Enable Prettier

## Type Definitions Guide

### Using Types

```typescript
import type { IAgent, ITask, ILogEntry } from '@/types';

// Use types for variables
const agent: IAgent = {
  id: '123',
  name: 'Worker',
  type: 'WORKER',
  status: 'READY',
  // ... other properties
};

// Use types for function parameters
function processTask(task: ITask): Promise<void> {
  // Implementation
}

// Use types for return values
function getAgent(id: string): Promise<IAgent | null> {
  // Implementation
}
```

### Creating New Types

1. Create files in `src/types/` directory
2. Follow naming convention: `module.types.ts`
3. Export interfaces/types from `index.ts`
4. Document with JSDoc comments

Example:

```typescript
// src/types/custom.types.ts

/**
 * Custom type definition
 * Describe the purpose and usage here
 */
export interface ICustomType {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

// Export from index.ts
// export * from './custom.types';
```

### Type Safety Best Practices

1. **Avoid `any`** - Use `unknown` with type guards
2. **Use `readonly`** - For immutable data
3. **Use `strict` mode** - All settings enabled
4. **Use discriminated unions** - For complex types
5. **Document types** - Add JSDoc comments

```typescript
// Good: Type guards with unknown
function processUnknown(data: unknown): void {
  if (typeof data === 'string') {
    // data is string here
  } else if (typeof data === 'object' && data !== null) {
    // data is object here
  }
}

// Good: Discriminated union
type Result =
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: Error };

// Good: Readonly
const config: readonly string[] = ['a', 'b'];

// Bad: Using any
function badFunction(data: any): void {
  // Type safety is lost
}
```

## Migration from JavaScript

### Step-by-Step Process

1. **Create corresponding `.ts` file**
   ```bash
   # Before
   src/module.js

   # After
   src/module.ts
   ```

2. **Add type annotations**
   ```typescript
   // Before (JavaScript)
   class Agent {
     constructor(name, type) {
       this.name = name;
       this.type = type;
     }
   }

   // After (TypeScript)
   class Agent {
     constructor(name: string, type: AgentType) {
       this.name = name;
       this.type = type;
     }
   }
   ```

3. **Add interfaces**
   ```typescript
   interface IAgent {
     name: string;
     type: AgentType;
   }

   class Agent implements IAgent {
     // Implementation
   }
   ```

4. **Test thoroughly**
   ```bash
   npm run type-check
   npm test
   ```

5. **Remove old `.js` file**
   ```bash
   git rm src/module.js
   ```

### Using JSDoc Comments for Quick Migration

If full migration takes time, use JSDoc:

```typescript
/**
 * @typedef {Object} IAgent
 * @property {string} id
 * @property {string} name
 * @property {AgentType} type
 */

/**
 * Create a new agent
 * @param {string} name
 * @param {AgentType} type
 * @returns {IAgent}
 */
function createAgent(name, type) {
  return { id: uuid(), name, type };
}
```

## Common Issues & Solutions

### Issue: Type not found

```
error TS2307: Cannot find module or its declarations
```

**Solution:**
- Check import path is correct
- Ensure type file exports the type
- Check `tsconfig.json` paths configuration

### Issue: Type not assignable

```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Solution:**
- Review type definitions
- Use type assertion sparingly: `as Type`
- Check for type mismatch in properties

### Issue: Property doesn't exist on type

```
error TS2339: Property 'x' does not exist on type 'Y'
```

**Solution:**
- Add property to interface
- Use optional property: `property?: type`
- Check property name spelling

## Advanced Topics

### Generic Types

```typescript
// Generic interface
interface IRepository<T> {
  find(id: string): Promise<T>;
  save(item: T): Promise<void>;
}

// Generic class
class Repository<T> implements IRepository<T> {
  async find(id: string): Promise<T> {
    // Implementation
  }

  async save(item: T): Promise<void> {
    // Implementation
  }
}
```

### Conditional Types

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<'hello'>; // true
type B = IsString<123>; // false
```

### Utility Types

```typescript
// Partial - all properties optional
type PartialAgent = Partial<IAgent>;

// Required - all properties required
type RequiredAgent = Required<IAgent>;

// Readonly - all properties readonly
type ReadonlyAgent = Readonly<IAgent>;

// Pick - select specific properties
type AgentPreview = Pick<IAgent, 'id' | 'name'>;

// Omit - exclude specific properties
type AgentWithoutMetadata = Omit<IAgent, 'metadata'>;

// Record - create object type with specific keys
type RolePermissions = Record<UserRole, Permission[]>;
```

## Troubleshooting

### Build fails with module errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Type checking is slow

```bash
# Use skipLibCheck in tsconfig.json
# Increase maxNodeModuleJsDepth if needed

# Check for circular dependencies
npm run type-check -- --listFilesOnly
```

### Hot reload not working in watch mode

```bash
# Kill the process and restart
npm run build:watch

# Or use tsc-watch
npx tsc-watch --onSuccess "echo Compilation successful"
```

## Resources

- [TypeScript Official Documentation](https://www.typescriptlang.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

## Getting Help

1. Check the project's TYPESCRIPT_MIGRATION_GUIDE.md
2. Review type definitions in `src/types/`
3. Check existing code examples
4. Ask in team Slack/Discord channel
5. Create an issue on GitHub

---

Last updated: 2025-11-18
