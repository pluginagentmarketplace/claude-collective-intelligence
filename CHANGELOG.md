# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - Session Handshake Bug (2026-01-08)
- **MCP Server datetime Import Bug** - `session_handshake()` failed with NameError
  - Root cause: Global import not available in MCP subprocess scope
  - Solution: Added local import at line 2237 in `mcp_server.py`
  - Impact: Session handshake now works correctly, no more deadlocks

### Added - Documentation (2026-01-08)
- **Shutdown Commands Section in CLAUDE.md**
  - Clear distinction: `make ramas-stop-all` (ESC) vs `make ramas-shutdown` (exit + close)
  - Decision tree for command selection
- **MCP Server Subprocess Behavior Section**
  - Documented: MCP server does NOT hot-reload
  - Local import pattern for critical functions
- **Lesson #6 & #7 in LESSONS_LEARNED.md**
  - #6: MCP Server Subprocess Does NOT Hot-Reload
  - #7: shutdown vs stop-all Command Distinction
  - Comprehensive root cause analysis and prevention patterns

## [3.4.0] - 2026-01-07

### Added - RAMAS PATTERN-C-003 v6
- **MERKEZ Documentation System** - Centralized navigation at `workspace/docs/`
  - `RAMAS-INDEX.md` - Central navigation hub for all RAMAS docs
  - `CODEBASE-MAP.md` - Complete file structure and component inventory
  - `PATTERN-C-003-v6.md` - v6 quick reference
  - `3-LEVEL-COMMUNICATION.md` - Emergency stop procedures
  - `MCP-TOOLS-REFERENCE.md` - 40+ MCP tools catalog
- **v6 Features Implementation**
  - Stale wake cleanup (old session signals auto-cleared)
  - Task fallback (results broadcast if task not found)
  - Session handshake protocol (SESSION_READY → WORKER_READY)
  - Bidirectional wake signals via Redis Streams
- **Workspace Structure**
  - `workspace/docs/` - Operational documentation (MERKEZ)
  - `workspace/docs/architecture/` - Deep dive patterns
  - `workspace/templates/` - Reusable agent/task templates
  - `workspace/tasks/` - Active and archived task instances
- **Archive README Files**
  - `src/ramas/archived/README.md` - Legacy JS files explanation
  - `scripts/ramas/archived/README.md` - Legacy shell scripts explanation
  - `workspace/docs/architecture/archive/README.md` - Deprecated docs

### Changed
- **Documentation Consolidation**
  - Moved 7 RAMAS files from `docs/architecture/` to `workspace/docs/architecture/`
  - Archived `MASTER-GUIDE.md` (v1.0, 4359 lines - outdated)
  - Archived `ephemeral-consumer-master-guide.md` (legacy patterns)
- **Version Updates**
  - `src/ramas/python/README.md` → v3.4.0 (PATTERN-C-003 v6)
  - `CLAUDE.md` → Added PATTERN v6 + MERKEZ references
  - `Makefile` → PATTERN-C-003 v5 → v6 (line 226)
- **Cross-Reference System**
  - Bidirectional links between workspace/docs/ and architecture/
  - Quick Reference sections in all major docs

### Fixed
- 3-Level Communication documented (RabbitMQ → Interrupt → Direct ESC)
- ESC key behavior clarified (1x = interrupt, 2x = Rewind menu - avoid!)

## [3.2.0] - 2026-01-04

### Added - RAMAS PATTERN-C-003 v5
- Two-phase wake protocol (Redis Streams + RabbitMQ)
- Bidirectional wake signals
- Python-native iTerm2 control (replaced AppleScript)
- Complete JavaScript → Python rewrite

### Changed
- `src/ramas/` - JS files archived, Python implementation active
- `scripts/ramas/` - Shell scripts archived, Python scripts active

## [2.0.0] - 2026-01-01

### Added
- Complete Python rewrite of RAMAS system
- iTerm2 Python API integration (replaces AppleScript)
- aio-pika async RabbitMQ client
- MCP Server with 40+ tools

### Removed
- JavaScript/Node.js implementation (archived)
- AppleScript-based iTerm2 control (buggy tab titles)

## [1.1.0] - 2025-12-07

### Added
- Professional documentation structure with categorized folders
- CONTRIBUTING.md for contributor guidelines
- SECURITY.md for security policy
- CHANGELOG.md for version tracking
- `docs/lessons/LESSONS_LEARNED.md` - Critical architectural lessons documentation
- REAL vs MOCK testing policy (project discovery!)

### Changed
- Reorganized 97 markdown files from root to `docs/` subdirectories
- Documentation now follows industry-standard categorization

### Fixed
- Security vulnerability in `jws` package (npm audit fix)
- LICENSE consistency (Apache 2.0 across all files)

### Identified (Pending Implementation)
- **Result Queue Architecture Conflict** (December 7, 2025)
  - Single `agent.results` queue used for dual purposes causes race condition
  - Workers and Leaders compete for same messages
  - Proposed Solution: Separate `agent.brainstorm.results` queue
  - See: `docs/lessons/LESSONS_LEARNED.md` for full analysis

## [1.0.0] - 2024-12-04

### Added
- Multi-agent orchestration system with RabbitMQ
- Event-driven architecture with CQRS pattern
- PostgreSQL persistence layer with migrations
- Redis caching integration
- Comprehensive monitoring with Prometheus/Grafana
- Docker and Docker Compose deployment
- CI/CD pipeline with GitHub Actions
- Unit, integration, and E2E test suites
- API documentation with OpenAPI/Swagger
- SDK for TypeScript/JavaScript clients
- Brainstorming and voting system for agents
- Mentorship system for agent training
- Career progression tracking
- Performance metrics and dashboards

### Infrastructure
- RabbitMQ 3.12+ message broker
- PostgreSQL 15+ database
- Redis 7+ caching
- OpenTelemetry instrumentation
- Structured logging system

### Documentation
- Architecture documentation
- API reference
- Deployment guides
- Troubleshooting guides
- Performance tuning guides

---

## Version History Summary

| Version | Date       | Highlights                           |
|---------|------------|--------------------------------------|
| 3.4.0   | 2026-01-07 | PATTERN-C-003 v6, MERKEZ docs, workspace reorganization |
| 3.2.0   | 2026-01-04 | PATTERN-C-003 v5, bidirectional wake, Python rewrite |
| 2.0.0   | 2026-01-01 | Complete Python rewrite, iTerm2 Python API |
| 1.1.0   | 2025-12-07 | Documentation structure, REAL vs MOCK testing policy |
| 1.0.0   | 2024-12-04 | Initial release with full feature set |

[Unreleased]: https://github.com/umitkacar/plugin-ai-agent-rabbitmq/compare/v3.4.0...HEAD
[3.4.0]: https://github.com/umitkacar/plugin-ai-agent-rabbitmq/compare/v3.2.0...v3.4.0
[3.2.0]: https://github.com/umitkacar/plugin-ai-agent-rabbitmq/compare/v2.0.0...v3.2.0
[2.0.0]: https://github.com/umitkacar/plugin-ai-agent-rabbitmq/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/umitkacar/plugin-ai-agent-rabbitmq/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/umitkacar/plugin-ai-agent-rabbitmq/releases/tag/v1.0.0
