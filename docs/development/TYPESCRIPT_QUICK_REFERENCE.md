# TypeScript Migration - Quick Reference

One-page quick reference for the TypeScript migration project.

## Key Files Location

```
/home/user/plugin-ai-agent-rabbitmq/

📄 Configuration
├── tsconfig.json              ← TypeScript compiler config (strict mode)
├── jest.config.ts             ← Jest testing configuration
└── build/build.ts             ← Build script

📁 Type Definitions
└── src/types/
    ├── index.ts               ← Barrel export (import from here)
    ├── common.types.ts        ← Base types
    ├── error.types.ts         ← Error types
    ├── auth.types.ts          ← Auth & JWT types
    ├── agent.types.ts         ← Agent types
    ├── task.types.ts          ← Task types
    ├── logging.types.ts       ← Logging types
    ├── monitoring.types.ts    ← Monitoring types
    └── database.types.ts      ← Database types

📚 Documentation
├── TYPESCRIPT_MIGRATION_GUIDE.md           ← Main guide (35+ pages)
├── TYPESCRIPT_SETUP_GUIDE.md               ← Setup & troubleshooting
├── TYPESCRIPT_STYLE_GUIDE.md               ← Code standards
├── TYPESCRIPT_PACKAGE_JSON_SCRIPTS.md      ← Scripts reference
├── TYPESCRIPT_MIGRATION_DELIVERABLES.md   ← Deliverables checklist
└── TYPESCRIPT_QUICK_REFERENCE.md           ← This file
```

---

## Essential Commands

```bash
# Build
npm run build                  # Compile TypeScript to JavaScript
npm run build:watch           # Watch mode (auto-recompile)

# Type Checking
npm run type-check            # Check for type errors (no compilation)

# Testing
npm test                       # Run all tests
npm run test:watch            # Watch mode
npm run test:coverage         # Coverage report

# Code Quality
npm run lint                   # Check code quality
npm run lint:fix              # Auto-fix issues
npm run format                # Format code

# Cleanup
npm run clean                 # Remove dist/, coverage/, node_modules/
npm run clean:dist            # Remove dist/ only
```

---

## Import Types

```typescript
// Import from barrel export
import type { IAgent, ITask, ILogger } from '@/types';

// Or import specific module types
import type { IAgent, AgentStatus } from '@/types/agent.types';
import type { ITask, TaskStatus } from '@/types/task.types';
import type { ILogger, LogLevel } from '@/types/logging.types';

// Use path aliases (configured in tsconfig.json)
import type { IAgent } from '@types/agent.types';  // ✓
import type { IAgent } from '../../types/agent.types';  // ✗ Avoid
```

---

## Type Definition Quick Map

| Type | File | Key Types |
|------|------|-----------|
| Agents | `agent.types.ts` | IAgent, AgentType, AgentStatus |
| Tasks | `task.types.ts` | ITask, TaskStatus, TaskPriority |
| Errors | `error.types.ts` | IBaseError, ErrorSeverity, IValidationError |
| Auth | `auth.types.ts` | IUser, ITokenPayload, ITokenPair, UserRole |
| Logging | `logging.types.ts` | ILogger, ILogEntry, LogLevel |
| Monitoring | `monitoring.types.ts` | IMetric, IHealthCheck, IAlert |
| Database | `database.types.ts` | IRepository, IConnection, ITransaction |
| Common | `common.types.ts` | IEntity, IResponse, IPaginatedResponse |

---

## Migration Phases Timeline

**Week 1:** Setup (tsconfig, jest, types) ✅ COMPLETE
**Weeks 2-3:** Core modules (errors, auth, db)
**Weeks 4-5:** Business logic (validation, logging, monitoring)
**Week 6:** Integration & testing
**Week 7:** Polish & production

---

## Code Patterns

### Function Signature
```typescript
async function processAgent(
  agentId: string,
  options?: { timeout?: number }
): Promise<IAgent> {
  // Implementation
}
```

### Error Handling
```typescript
try {
  const agent = await getAgent(id);
} catch (error) {
  if (error instanceof AgentNotFoundError) {
    // Handle not found
  } else {
    logger.error('Unexpected error', error);
    throw error;
  }
}
```

### Generic Repository
```typescript
class Repository<T extends IEntity> implements IRepository<T> {
  async find(id: string): Promise<T | null> {
    // Implementation
  }
}
```

### Type Guards
```typescript
function processData(data: unknown): void {
  if (typeof data === 'string') {
    // data is string
  } else if (typeof data === 'object' && data !== null) {
    // data is object
  }
}
```

---

## Common Mistakes to Avoid

```typescript
// ✗ Avoid: Using any
function process(data: any) {}

// ✓ Use: Unknown with type guards
function process(data: unknown) {
  if (typeof data === 'object') {
    // ...
  }
}

// ✗ Avoid: Missing type annotations
function getAgent(id) { return agent; }

// ✓ Use: Explicit types
function getAgent(id: string): Promise<IAgent> {
  return repository.findById(id);
}

// ✗ Avoid: Ignoring errors
try {
  await process();
} catch { }

// ✓ Use: Handle or log errors
try {
  await process();
} catch (error) {
  logger.error('Process failed', error);
  throw error;
}
```

---

## Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Interfaces | `I<Name>` | `IAgent`, `ITask` |
| Classes | `PascalCase` | `AgentService`, `TaskRepository` |
| Functions | `camelCase` | `processAgent`, `calculateScore` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Variables | `camelCase` | `agentId`, `taskList` |
| Enums | `PascalCase` | `AgentStatus`, `TaskPriority` |
| Boolean | `is<Name>`, `has<Name>`, `can<Name>` | `isReady`, `hasPermission` |

---

## File Organization

```typescript
// 1. Type imports (at top)
import type { IAgent, ITask } from '@/types';

// 2. Regular imports
import { AgentService } from '@/services';
import { logger } from '@/logger';

// 3. Constants
const MAX_AGENTS = 100;

// 4. Interfaces (if local)
interface ILocalConfig {}

// 5. Main code
class Controller {
  // Properties
  // Constructor
  // Public methods
  // Protected methods
  // Private methods
}

// 6. Export
export { Controller };
```

---

## Type Definitions by Use Case

### API Request/Response
```typescript
import type { IResponse, IErrorResponse } from '@/types';

const response: IResponse<IAgent> = {
  success: true,
  data: agent,
  timestamp: new Date().toISOString()
};
```

### Entity with Timestamps
```typescript
import type { IEntity } from '@/types';

interface ICustomEntity extends IEntity {
  name: string;
  metadata: Record<string, unknown>;
}
```

### Async Function with Error Handling
```typescript
import type { IBaseError } from '@/types';

async function process(): Promise<void> {
  try {
    // Process
  } catch (error) {
    const baseError = error as IBaseError;
    console.log(baseError.code);
  }
}
```

### Repository Pattern
```typescript
import type { IRepository, IEntity } from '@/types';

class Repository<T extends IEntity> implements IRepository<T> {
  async create(data: Partial<T>): Promise<T> {
    // Implementation
  }
}
```

---

## Testing with TypeScript

```typescript
import type { IAgent } from '@/types';
import { AgentService } from '@/services';

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService();
  });

  it('should return agent when found', async () => {
    const result: IAgent = await service.getAgent('123');
    expect(result).toBeDefined();
  });
});
```

---

## IDE Configuration (VS Code)

Create `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  }
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Check import path, verify re-exports in index.ts |
| "Type not assignable" | Review interface definitions, check property types |
| "Property doesn't exist" | Add property to interface or use optional property `?` |
| "Slow IDE" | Run `npm run type-check -- --listFilesOnly` to check for circular dependencies |
| "Build fails" | Run `npm run clean` then `npm run build` |

---

## Resources

- **Main Guide:** TYPESCRIPT_MIGRATION_GUIDE.md
- **Setup:** TYPESCRIPT_SETUP_GUIDE.md
- **Code Standards:** TYPESCRIPT_STYLE_GUIDE.md
- **Scripts:** TYPESCRIPT_PACKAGE_JSON_SCRIPTS.md
- **Deliverables:** TYPESCRIPT_MIGRATION_DELIVERABLES.md
- **Official Docs:** https://www.typescriptlang.org/docs/

---

## Team Contact

- **TypeScript Lead:** [Your Team]
- **Questions?** Check the main migration guide first
- **Issues?** Create GitHub issue with details
- **Training?** Schedule session with team lead

---

## Progress Tracking

- [x] Week 1: Setup (COMPLETE ✓)
- [ ] Weeks 2-3: Core modules
- [ ] Weeks 4-5: Business logic
- [ ] Week 6: Integration & testing
- [ ] Week 7: Production

---

**Last Updated:** 2025-11-18
**Version:** 1.0
**Status:** Ready for Implementation
