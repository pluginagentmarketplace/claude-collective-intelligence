# TypeScript Style Guide

Project-wide style guide and best practices for TypeScript code.

## Table of Contents

1. [Naming Conventions](#naming-conventions)
2. [Code Organization](#code-organization)
3. [Type Definitions](#type-definitions)
4. [Functions & Methods](#functions--methods)
5. [Classes](#classes)
6. [Interfaces](#interfaces)
7. [Error Handling](#error-handling)
8. [Comments & Documentation](#comments--documentation)
9. [Imports & Exports](#imports--exports)
10. [Testing](#testing)

---

## Naming Conventions

### Files

```typescript
// Service files
agent.service.ts
task.service.ts

// Controller files
agent.controller.ts

// Type files
agent.types.ts
task.types.ts

// Test files
agent.service.test.ts
agent.service.spec.ts

// Utility files
string.utils.ts
date.utils.ts

// Constants
error-codes.constants.ts

// Config files
database.config.ts
logger.config.ts
```

### Classes

```typescript
// Use PascalCase
class AgentService {}
class TaskRepository {}
class ValidationError extends Error {}

// Use I prefix for interfaces
interface IAgent {}
interface ITask {}
interface IRepository {}

// Avoid confusion:
// ✓ Agent (class) and IAgent (interface)
// ✗ Agent (class) and AgentInterface (interface)
```

### Variables & Constants

```typescript
// Use camelCase for variables
const agentId = '123';
let currentStatus = 'READY';

// Use UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
const ERROR_CODES = {
  UNAUTHORIZED: 'AUTH_001',
  NOT_FOUND: 'NOT_FOUND'
};

// Use UPPER_CASE for enum values
enum AgentStatus {
  READY = 'READY',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE'
}
```

### Functions & Methods

```typescript
// Use camelCase
function calculateTaskDuration(): number {}
async function fetchAgent(id: string): Promise<IAgent> {}

// Use verb prefixes
function get...() {} // Fetch/retrieve
function set...() {} // Set/update
function create...() {} // Create new
function delete...() {} // Delete/remove
function validate...() {} // Check/verify
function is...() {} // Boolean check
function has...() {} // Boolean check
function can...() {} // Boolean check
```

---

## Code Organization

### File Structure

```typescript
// 1. Type definitions at top
import type { IAgent, ITask } from '@/types';

// 2. Regular imports
import { AgentService } from '@/services';
import { logger } from '@/logger';

// 3. Constants
const MAX_AGENTS = 100;

// 4. Interfaces/Types (if not in separate file)
interface ILocalService {}

// 5. Main class/function
class AgentController {
  // 5a. Private static properties
  private static instance: AgentController;

  // 5b. Public properties
  public name: string;

  // 5c. Protected properties
  protected service: AgentService;

  // 5d. Private properties
  private cache: Map<string, IAgent>;

  // 5e. Constructor
  constructor() {}

  // 5f. Public methods
  public async getAgent(id: string): Promise<IAgent> {}

  // 5g. Protected methods
  protected validateInput(data: unknown): boolean {}

  // 5h. Private methods
  private initializeCache(): void {}
}

// 6. Export
export { AgentController };
```

### Folder Structure

```
src/
├── types/                 # Type definitions
│   ├── index.ts
│   ├── agent.types.ts
│   ├── task.types.ts
│   └── ...
├── services/              # Business logic
│   ├── agent.service.ts
│   ├── task.service.ts
│   └── index.ts
├── repositories/          # Data access
│   ├── base-repository.ts
│   ├── agent-repository.ts
│   └── index.ts
├── controllers/           # HTTP handlers (if using Express)
│   ├── agent.controller.ts
│   └── index.ts
├── middleware/            # Middleware
│   ├── error-middleware.ts
│   └── index.ts
├── utils/                 # Utility functions
│   ├── string.utils.ts
│   ├── date.utils.ts
│   └── index.ts
└── config/                # Configuration
    ├── database.config.ts
    └── logger.config.ts
```

---

## Type Definitions

### Basic Types

```typescript
// ✓ Good: Clear, specific types
function processAgent(agent: IAgent): void {}

// ✗ Bad: Too generic
function processAgent(agent: any): void {}

// ✓ Good: Union types for clarity
type Status = 'PENDING' | 'ACTIVE' | 'INACTIVE';

// ✗ Bad: String without context
type Status = string;

// ✓ Good: Type aliases for complex types
type AgentFilter = {
  status?: string;
  priority?: number;
  capabilities?: string[];
};

// ✓ Good: Generics for reusable code
interface IRepository<T> {
  find(id: string): Promise<T>;
}
```

### Nullable Types

```typescript
// ✓ Good: Explicit null check (strict mode)
function getAgent(id: string): IAgent | null {
  // Implementation
}

// ✓ Good: Optional with undefined
interface IAgent {
  id: string;
  nickname?: string; // Can be undefined
}

// ✗ Bad: Silent null (non-strict)
function getAgent(id: string): IAgent {
  return null; // Unexpected!
}
```

### Generic Types

```typescript
// ✓ Good: Clear generic with constraint
function findBy<T extends IEntity>(
  repository: IRepository<T>,
  id: string
): Promise<T> {}

// ✓ Good: Multiple generics with defaults
interface ICache<K = string, V = unknown> {
  get(key: K): V | null;
  set(key: K, value: V): void;
}

// ✗ Bad: Unclear generics
function process<T, U, V>(a: T, b: U): V {}
```

---

## Functions & Methods

### Function Signature

```typescript
// ✓ Good: Clear parameters and return type
async function createTask(
  name: string,
  type: TaskType,
  priority: TaskPriority = 'NORMAL'
): Promise<ITask> {
  // Implementation
}

// ✓ Good: Object parameter for many args
async function updateTask(
  taskId: string,
  updates: Partial<ITask>
): Promise<ITask> {}

// ✓ Good: Type guards in return
function getTaskOrThrow(id: string): ITask {
  const task = cache.get(id);
  if (!task) {
    throw new Error(`Task ${id} not found`);
  }
  return task;
}

// ✗ Bad: No return type
function getTask(id: string) {}

// ✗ Bad: Many parameters
function create(a, b, c, d, e, f) {}
```

### Arrow Functions vs Declarations

```typescript
// ✓ Use arrow functions for callbacks
const agents = agentList.map((agent) => agent.id);

// ✓ Use function declarations for main logic
async function processAgents(agents: IAgent[]): Promise<void> {
  // Implementation
}

// ✗ Avoid arrow functions for complex logic
const process = async (agents: IAgent[]) => {
  // Too much logic for arrow function
};
```

### Error Handling

```typescript
// ✓ Good: Explicit error handling
async function getAgent(id: string): Promise<IAgent> {
  try {
    const agent = await repository.findById(id);
    if (!agent) {
      throw new AgentNotFoundError(`Agent ${id} not found`);
    }
    return agent;
  } catch (error) {
    logger.error('Failed to get agent', error);
    throw error;
  }
}

// ✗ Bad: Swallowing errors
async function getAgent(id: string): Promise<IAgent | null> {
  try {
    return await repository.findById(id);
  } catch {
    return null; // Error ignored!
  }
}
```

---

## Classes

### Class Declaration

```typescript
// ✓ Good: Clear class structure
class AgentService {
  constructor(private repository: IAgentRepository) {}

  async getAgent(id: string): Promise<IAgent> {
    return this.repository.findById(id);
  }

  private validateInput(data: unknown): void {
    // Validation logic
  }
}

// ✗ Bad: Too much in constructor
class AgentService {
  constructor(private repository, private logger, private cache, private config) {}
}

// ✗ Bad: Public properties (should be private/readonly)
class AgentService {
  public repository = new Repository();
}
```

### Access Modifiers

```typescript
// ✓ Use explicit access modifiers
class Service {
  public async getItem(): Promise<void> {}
  protected validateItem(): void {}
  private cacheItem(): void {}
}

// ✗ Avoid implicit public
class Service {
  async getItem() {} // Implicitly public
}

// ✓ Use readonly for immutable properties
class Config {
  readonly apiUrl: string;
  readonly timeout: number = 5000;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }
}
```

### Static vs Instance

```typescript
// ✓ Use static for factory methods
class Agent {
  static create(name: string): Agent {
    return new Agent(name);
  }
}

// ✓ Use static for constants
class ErrorCode {
  static readonly NOT_FOUND = 'NOT_FOUND';
  static readonly UNAUTHORIZED = 'UNAUTHORIZED';
}

// ✗ Avoid unnecessary static
class Service {
  static method() {} // Should be instance method?
}
```

---

## Interfaces

### Interface Design

```typescript
// ✓ Good: Single responsibility
interface IAgent {
  id: string;
  name: string;
  status: AgentStatus;
}

// ✓ Good: Extends other interfaces
interface IEnhancedAgent extends IAgent {
  capabilities: string[];
  metadata: Record<string, unknown>;
}

// ✗ Bad: Too many properties
interface IMegaInterface {
  // 50+ properties from different concerns
}

// ✓ Good: Composition over inheritance
interface IWithTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

interface IAgent extends IWithTimestamps {
  id: string;
  name: string;
}
```

### Optional Properties

```typescript
// ✓ Good: Optional properties
interface IAgent {
  id: string;
  name: string;
  nickname?: string; // Optional
}

// ✓ Good: Readonly properties
interface IConfig {
  readonly apiUrl: string;
  readonly timeout: number;
}

// ✓ Good: Discriminated unions
type Result =
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: Error };
```

---

## Error Handling

### Custom Errors

```typescript
// ✓ Good: Extend BaseError
class AgentNotFoundError extends BaseError {
  constructor(agentId: string) {
    super(
      `Agent ${agentId} not found`,
      'AGENT_NOT_FOUND',
      404,
      'MEDIUM'
    );
  }
}

// ✓ Good: Error context
throw new AgentNotFoundError(id).withContext({
  agentId: id,
  timestamp: new Date(),
  requestId: requestId
});

// ✗ Bad: Generic Error
throw new Error('Agent not found');

// ✗ Bad: Error as string
throw 'Agent not found';
```

### Try-Catch

```typescript
// ✓ Good: Specific error handling
async function processAgent(id: string): Promise<void> {
  try {
    const agent = await getAgent(id);
    await executeTask(agent);
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      // Handle not found
    } else if (error instanceof ValidationError) {
      // Handle validation
    } else {
      // Re-throw or handle unknown
      logger.error('Unexpected error', error);
      throw error;
    }
  }
}

// ✗ Bad: Catch-all without handling
try {
  // Code
} catch {
  // Silently ignore
}
```

---

## Comments & Documentation

### JSDoc Comments

```typescript
/**
 * Processes a batch of agents concurrently
 *
 * @param agents - Array of agents to process
 * @param maxConcurrency - Maximum concurrent operations (default: 5)
 * @returns Promise resolving to processed agents
 * @throws {ValidationError} If agents array is empty
 * @throws {ProcessingError} If processing fails
 *
 * @example
 * const result = await processBatch([agent1, agent2], 3);
 */
async function processBatch(
  agents: IAgent[],
  maxConcurrency: number = 5
): Promise<IAgent[]> {
  // Implementation
}

/**
 * Agent service for managing agents
 *
 * @example
 * const service = new AgentService(repository);
 * const agent = await service.getAgent('123');
 */
class AgentService {
  /**
   * Get agent by ID
   *
   * @param id - Agent ID
   * @returns Agent or null if not found
   */
  async getAgent(id: string): Promise<IAgent | null> {
    // Implementation
  }
}
```

### Inline Comments

```typescript
// ✓ Good: Explain why, not what
function calculateScore(metrics: IMetrics): number {
  // Use exponential weight for recent metrics
  const weight = Math.exp(-age / halfLife);
  return metrics.value * weight;
}

// ✗ Bad: State the obvious
function calculateScore(metrics: IMetrics): number {
  // multiply by weight (obviously!)
  const weight = age > 0 ? 1 : 0;
  return metrics.value * weight;
}

// ✓ Good: TODO comments with context
function optimizeQuery(query: string): string {
  // TODO: Implement query caching for performance
  // See: https://github.com/project/issues/123
  return query;
}
```

### Type Comments

```typescript
// ✓ Use when type is complex
const complexFilter: (agent: IAgent) => boolean = (agent) => {
  return agent.status === 'READY' && agent.capabilities.length > 0;
};

// ✗ Unnecessary - type is clear
const name: string = 'Agent';
```

---

## Imports & Exports

### Import Order

```typescript
// 1. Type imports first
import type { IAgent, ITask } from '@/types';

// 2. Third-party packages
import { promises as fs } from 'fs';
import path from 'path';

// 3. Relative imports
import { AgentService } from '@/services';
import { logger } from '@/logger';

// 4. Namespace imports last (if needed)
import * as utils from '@/utils';
```

### Import Styles

```typescript
// ✓ Good: Named imports
import { AgentService, TaskService } from '@/services';

// ✓ Good: Type imports
import type { IAgent } from '@/types';

// ✓ Good: Namespace import (use sparingly)
import * as services from '@/services';
const service = services.AgentService;

// ✗ Bad: Default exports (avoid unless single export)
// export default AgentService;
// import AgentService from '@/services'; // Unclear what exported

// ✗ Bad: Deep relative imports
import { Agent } from '../../../types';

// ✓ Good: Use path aliases
import { Agent } from '@/types';
```

### Export Styles

```typescript
// ✓ Good: Named exports
export class AgentService {}
export interface IAgent {}

// ✓ Good: Export after definition
class AgentService {}
export { AgentService };

// ✓ Good: Barrel exports for modules
// services/index.ts
export { AgentService } from './agent.service';
export { TaskService } from './task.service';

// ✗ Avoid: Default exports for classes
export default class AgentService {}

// ✗ Avoid: Mixed named and default
export class Agent {}
export default Agent; // Confusing!
```

---

## Testing

### Test File Structure

```typescript
/**
 * Agent Service Tests
 * Unit tests for AgentService class
 */

import { AgentService } from '@/services/agent.service';
import { AgentRepository } from '@/repositories/agent.repository';
import { mockAgent, mockRepository } from '@/__mocks__';

describe('AgentService', () => {
  let service: AgentService;
  let repository: AgentRepository;

  beforeEach(() => {
    repository = new AgentRepository();
    service = new AgentService(repository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAgent', () => {
    it('should return agent when found', async () => {
      // Arrange
      const agentId = '123';
      jest.spyOn(repository, 'findById').mockResolvedValue(mockAgent);

      // Act
      const result = await service.getAgent(agentId);

      // Assert
      expect(result).toEqual(mockAgent);
      expect(repository.findById).toHaveBeenCalledWith(agentId);
    });

    it('should throw when agent not found', async () => {
      // Arrange
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.getAgent('invalid')).rejects.toThrow(
        AgentNotFoundError
      );
    });
  });
});
```

### Test Naming

```typescript
// ✓ Good: Describe what it tests
it('should return agent when ID exists', async () => {});
it('should throw AgentNotFoundError when ID does not exist', async () => {});

// ✗ Bad: Generic names
it('test getAgent', async () => {});
it('should work', async () => {});

// ✓ Good: Test edge cases
it('should handle empty agent list', async () => {});
it('should handle null values gracefully', async () => {});
```

---

## Summary Checklist

- [ ] Use PascalCase for classes and interfaces
- [ ] Use camelCase for variables and functions
- [ ] Use UPPER_SNAKE_CASE for constants
- [ ] Prefix interfaces with `I`
- [ ] Always specify return types
- [ ] Use explicit access modifiers
- [ ] Avoid `any` type - use `unknown` with type guards
- [ ] Document public APIs with JSDoc
- [ ] Group imports by type
- [ ] Keep classes focused and small
- [ ] Use composition over inheritance
- [ ] Handle errors explicitly
- [ ] Write tests for edge cases

---

Last updated: 2025-11-18
