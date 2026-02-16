# Contributing to AI Agent Orchestrator RabbitMQ

Thank you for your interest in contributing to this project! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to maintain a welcoming and inclusive community.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/plugin-ai-agent-rabbitmq.git
   cd plugin-ai-agent-rabbitmq
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/umitkacar/plugin-ai-agent-rabbitmq.git
   ```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- Docker and Docker Compose
- Git

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the infrastructure services:
   ```bash
   docker-compose up -d
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Run database migrations:
   ```bash
   npm run migrate:up
   ```

5. Verify the setup:
   ```bash
   npm test
   ```

## Making Changes

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-voting-algorithm`)
- `fix/` - Bug fixes (e.g., `fix/rabbitmq-connection-leak`)
- `docs/` - Documentation updates (e.g., `docs/update-api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-auth-flow`)
- `test/` - Test additions or fixes (e.g., `test/add-e2e-voting-tests`)

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**
```bash
feat(voting): add ranked-choice voting algorithm
fix(rabbitmq): resolve connection timeout on high load
docs(api): update WebSocket endpoint documentation
test(gamification): add unit tests for achievement system
```

## Pull Request Process

1. **Update your fork** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit them following the commit message format.

4. **Run tests** to ensure nothing is broken:
   ```bash
   npm test
   npm run lint
   ```

5. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub with:
   - Clear title following commit message format
   - Description of what changed and why
   - Reference to related issues (if any)
   - Screenshots for UI changes (if applicable)

7. **Address review feedback** by pushing additional commits.

8. **Squash commits** if requested before merge.

## Coding Standards

### JavaScript/TypeScript

- Use ES Modules (`import`/`export`)
- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use `async`/`await` for asynchronous operations
- Add JSDoc comments for public APIs

### Formatting

- Run `npm run lint` before committing
- Use Prettier for code formatting: `npm run format`
- Indentation: 2 spaces
- Line length: 100 characters max

### File Organization

```
src/
  ├── auth/           # Authentication & authorization
  ├── db/             # Database layer
  ├── errors/         # Error handling
  ├── logger/         # Logging
  ├── middleware/     # Express middleware
  ├── repositories/   # Data access layer
  ├── utils/          # Utilities
  └── validation/     # Input validation

scripts/
  ├── gamification/   # Gamification system
  ├── mentorship/     # Mentorship system
  ├── voting/         # Voting algorithms
  └── ...             # Other operational scripts
```

## Testing Guidelines

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual functions and modules
   - Mock external dependencies
   - Fast execution

2. **Integration Tests** (`tests/integration/`)
   - Test component interactions
   - Use test database
   - May use Docker services

3. **E2E Tests** (`tests/e2e/`)
   - Test complete workflows
   - Require full infrastructure
   - Run before release

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

### Writing Tests

- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Cover edge cases
- Aim for 80%+ code coverage

## Documentation

### When to Update Documentation

- Adding new features
- Changing API endpoints
- Modifying configuration options
- Fixing bugs that affect behavior

### Documentation Structure

```
docs/
  ├── api/            # API reference
  ├── architecture/   # System design
  ├── development/    # Developer guides
  ├── guides/         # User guides
  ├── logging/        # Logging & monitoring
  ├── operations/     # Ops runbooks
  ├── performance/    # Performance tuning
  ├── reports/        # Project reports
  ├── security/       # Security docs
  └── testing/        # Testing guides
```

### Documentation Standards

- Use Markdown format
- Include code examples
- Add diagrams where helpful
- Keep content up-to-date with code

## Questions?

If you have questions about contributing, please:

1. Check existing [issues](https://github.com/umitkacar/plugin-ai-agent-rabbitmq/issues)
2. Open a new issue with the `question` label
3. Join our discussions

Thank you for contributing!
