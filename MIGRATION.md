# Migration Guide - Repository Reorganization (Phase 1 & 2)

**Date:** 2025-12-07
**Version:** 1.0.0
**Status:** Active - Please follow this guide to update your code!

---

## 📋 What Changed?

We've completed a **comprehensive repository reorganization** to achieve professional structure:

- ✅ **100% root-path cleanup** (38 → 0 scripts at root)
- ✅ **9 AI systems organized** with consistent structure
- ✅ **54 files moved** to new professional locations
- ✅ **6 comprehensive READMEs** created (9,350+ lines)

**Impact:** Your imports and script paths need updating!

---

## 🚨 URGENT: Update Required

If you have:
- Local branches with code changes
- Scripts that import from old paths
- Documentation referencing old paths
- CI/CD pipelines using old paths

**You MUST update them using this guide!**

---

## 📁 New Directory Structure

### Before (Old Structure)
```
project-12-plugin-ai-agent-rabbitmq/
├── scripts/
│   ├── orchestrator.js          ❌ At root!
│   ├── mcp-server.js            ❌ At root!
│   ├── brainstorm-system.js     ❌ At root!
│   ├── voting-system.js         ❌ At root!
│   ├── deploy.sh                ❌ At root!
│   ├── health-check.sh          ❌ At root!
│   ├── ... (38 files at root!)  ❌ Chaos!
│   └── database/
│       └── db-client.js         ❌ Wrong location!
```

### After (New Structure)
```
project-12-plugin-ai-agent-rabbitmq/
├── src/
│   ├── core/                    ✅ Core orchestration
│   │   ├── orchestrator.js
│   │   ├── mcp-server.js
│   │   ├── rabbitmq-client.js
│   │   ├── monitor.js
│   │   └── cli-menu.js
│   │
│   ├── database/                ✅ Database layer
│   │   ├── client.js
│   │   ├── migrations-runner.js
│   │   └── repositories/
│   │
│   └── systems/                 ✅ AI systems
│       ├── brainstorm/
│       ├── voting/
│       ├── mentorship/
│       ├── rewards/
│       ├── penalties/
│       ├── gamification/
│       ├── reputation/
│       ├── battle/
│       └── leaderboard/
│
└── scripts/
    ├── deployment/              ✅ Production deployment
    ├── infrastructure/          ✅ Operations
    ├── backup/                  ✅ Backup & restore
    ├── demo/                    ✅ Demos
    ├── setup/                   ✅ Development setup
    └── utils/                   ✅ Utilities
```

---

## 🔄 Path Migration Table

### Core Files

| Old Path | New Path | Type |
|----------|----------|------|
| `scripts/orchestrator.js` | `src/core/orchestrator.js` | Core |
| `scripts/mcp-server.js` | `src/core/mcp-server.js` | Core |
| `scripts/rabbitmq-client.js` | `src/core/rabbitmq-client.js` | Core |
| `scripts/monitor.js` | `src/core/monitor.js` | Core |
| `scripts/cli-menu.js` | `src/core/cli-menu.js` | Core |

### Database Files

| Old Path | New Path | Type |
|----------|----------|------|
| `scripts/database/db-client.js` | `src/database/client.js` | Database |
| `scripts/database/migrations-runner.js` | `src/database/migrations-runner.js` | Database |
| `scripts/database/repositories/*` | `src/database/repositories/*` | Database |

### AI System Files

| Old Path | New Path | Type |
|----------|----------|------|
| `scripts/brainstorm-system.js` | `src/systems/brainstorm/system.js` | System |
| `scripts/voting-system.js` | `src/systems/voting/system.js` | System |
| `scripts/mentorship-system.js` | `src/systems/mentorship/system.js` | System |
| `scripts/rewards-system.js` | `src/systems/rewards/system.js` | System |
| `scripts/penalties-system.js` | `src/systems/penalties/system.js` | System |
| `scripts/gamification/*` | `src/systems/gamification/*` | System |

### Shell Scripts

| Old Path | New Path | Category |
|----------|----------|----------|
| `scripts/deploy.sh` | `scripts/deployment/02-deploy.sh` | Deployment |
| `scripts/rollback.sh` | `scripts/deployment/04-rollback.sh` | Deployment |
| `scripts/health-check.sh` | `scripts/infrastructure/health-check.sh` | Infrastructure |
| `scripts/backup-all.sh` | `scripts/backup/backup.sh` | Backup |
| `scripts/setup-database.sh` | `scripts/setup/setup-database.sh` | Setup |
| `scripts/launch-claude-demo.sh` | `scripts/demo/launch-claude-demo.sh` | Demo |

---

## 💻 Code Migration Examples

### Example 1: Update JavaScript Imports

**Before:**
```javascript
// ❌ OLD - Won't work anymore!
import { AgentOrchestrator } from './scripts/orchestrator.js';
import { RabbitMQClient } from './scripts/rabbitmq-client.js';
import { BrainstormSystem } from './scripts/brainstorm-system.js';
import { VotingSystem } from './scripts/voting-system.js';
import { dbClient } from './scripts/database/db-client.js';
```

**After:**
```javascript
// ✅ NEW - Use these paths!
import { AgentOrchestrator } from './src/core/orchestrator.js';
import { RabbitMQClient } from './src/core/rabbitmq-client.js';
import { BrainstormSystem } from './src/systems/brainstorm/system.js';
import { VotingSystem } from './src/systems/voting/system.js';
import { dbClient } from './src/database/client.js';
```

---

### Example 2: Update require() Statements

**Before:**
```javascript
// ❌ OLD
const { AgentOrchestrator } = require('./scripts/orchestrator.js');
const { RabbitMQClient } = require('./scripts/rabbitmq-client.js');
```

**After:**
```javascript
// ✅ NEW
const { AgentOrchestrator } = require('./src/core/orchestrator.js');
const { RabbitMQClient } = require('./src/core/rabbitmq-client.js');
```

---

### Example 3: Update Shell Script Execution

**Before:**
```bash
# ❌ OLD
./scripts/health-check.sh
./scripts/deploy.sh
./scripts/backup-all.sh
node scripts/orchestrator.js team-leader
```

**After:**
```bash
# ✅ NEW
./scripts/infrastructure/health-check.sh
./scripts/deployment/02-deploy.sh
./scripts/backup/backup.sh
node src/core/orchestrator.js team-leader
```

---

### Example 4: Update npm Scripts (package.json)

**Before:**
```json
{
  "scripts": {
    "start": "node scripts/orchestrator.js",
    "monitor": "node scripts/monitor.js"
  }
}
```

**After:**
```json
{
  "scripts": {
    "start": "node src/core/orchestrator.js",
    "monitor": "node src/core/monitor.js"
  }
}
```

**Note:** Main `package.json` is already updated! This is for your custom scripts.

---

### Example 5: Update MCP Configuration (.mcp.json)

**Before:**
```json
{
  "mcpServers": {
    "my-server": {
      "args": ["scripts/mcp-server.js"]
    }
  }
}
```

**After:**
```json
{
  "mcpServers": {
    "my-server": {
      "args": ["src/core/mcp-server.js"]
    }
  }
}
```

**Note:** Main `.mcp.json` is already updated! This is for custom MCP configs.

---

## 🔍 Finding Files to Update

### Quick Scan Commands

```bash
# Find all files with old import paths
grep -r "from './scripts/" --include="*.js" . | grep -v node_modules

# Find all require statements with old paths
grep -r "require.*scripts/" --include="*.js" . | grep -v node_modules

# Find shell scripts referencing old paths
grep -r "scripts/orchestrator.js" --include="*.sh" .
grep -r "scripts/health-check.sh" --include="*.sh" .

# Find documentation with old paths
grep -r "scripts/" --include="*.md" . | grep -E "(orchestrator|mcp-server|deploy)"
```

---

## 🛠️ Step-by-Step Migration

### Step 1: Pull Latest Changes

```bash
git checkout main
git pull origin main
```

**Verify:** You should see the new structure:
```bash
ls -la src/core/
ls -la src/systems/
ls -la scripts/deployment/
```

---

### Step 2: Update Your Feature Branch

```bash
# Checkout your feature branch
git checkout feature/your-feature

# Merge or rebase from main
git merge main
# OR
git rebase main

# Resolve any conflicts (see "Conflict Resolution" section below)
```

---

### Step 3: Update Import Paths in Your Code

**Option A: Manual Update (Recommended for small changes)**

Open each file and update imports following the examples above.

**Option B: Automated Find & Replace (Use with caution!)**

```bash
# Create backup first!
git checkout -b backup/before-migration

# Then run find & replace
find . -name "*.js" -type f -exec sed -i \
  's|from '\''./scripts/orchestrator.js'\''|from '\''./src/core/orchestrator.js'\''|g' {} \;

find . -name "*.js" -type f -exec sed -i \
  's|from '\''./scripts/rabbitmq-client.js'\''|from '\''./src/core/rabbitmq-client.js'\''|g' {} \;

# Verify changes
git diff
```

---

### Step 4: Update Shell Scripts

```bash
# Update your custom scripts
sed -i 's|scripts/orchestrator.js|src/core/orchestrator.js|g' your-script.sh
sed -i 's|scripts/health-check.sh|scripts/infrastructure/health-check.sh|g' your-script.sh
```

---

### Step 5: Test Your Changes

```bash
# Run linter (if you have one)
npm run lint

# Run tests
npm test

# Verify imports work
node --check src/core/orchestrator.js
node --check your-updated-file.js
```

---

### Step 6: Commit Your Updates

```bash
git add .
git commit -m "chore: Update import paths after repository reorganization

- Updated core imports to src/core/*
- Updated system imports to src/systems/*
- Updated script execution paths
- See MIGRATION.md for details"
```

---

## ⚠️ Conflict Resolution

### Common Merge Conflicts

#### Conflict 1: Import Path Conflicts

```javascript
<<<<<<< HEAD (your branch)
import { AgentOrchestrator } from './scripts/orchestrator.js';
=======
import { AgentOrchestrator } from './src/core/orchestrator.js';
>>>>>>> main
```

**Resolution:** Keep the main branch version (new path):
```javascript
import { AgentOrchestrator } from './src/core/orchestrator.js';
```

---

#### Conflict 2: Script Execution Conflicts

```bash
<<<<<<< HEAD
node scripts/orchestrator.js team-leader
=======
node src/core/orchestrator.js team-leader
>>>>>>> main
```

**Resolution:** Keep the main branch version (new path):
```bash
node src/core/orchestrator.js team-leader
```

---

## 📚 New Documentation Structure

All scripts now have comprehensive READMEs:

- **scripts/README.md** - Main index, start here!
- **scripts/deployment/README.md** - Deployment procedures
- **scripts/infrastructure/README.md** - Operations & monitoring
- **scripts/backup/README.md** - Backup & recovery
- **scripts/setup/README.md** - Development setup
- **scripts/demo/README.md** - Interactive demos

**Navigation tip:** Start with `scripts/README.md` for quick links!

---

## 🧪 Verification Checklist

After migration, verify:

- [ ] All imports resolve correctly (no "module not found" errors)
- [ ] npm scripts work (`npm start`, `npm test`)
- [ ] Shell scripts execute successfully
- [ ] MCP server starts without errors
- [ ] Tests pass
- [ ] No broken references in documentation
- [ ] CI/CD pipeline passes (if applicable)

---

## 🚨 Common Issues & Solutions

### Issue 1: "Cannot find module './scripts/orchestrator.js'"

**Cause:** Old import path
**Solution:** Update to `'./src/core/orchestrator.js'`

---

### Issue 2: "Command not found: scripts/health-check.sh"

**Cause:** Old script path
**Solution:** Use `scripts/infrastructure/health-check.sh`

---

### Issue 3: "MCP server failed to start"

**Cause:** Old path in `.mcp.json`
**Solution:** Update to `src/core/mcp-server.js`

---

### Issue 4: Tests failing with import errors

**Cause:** Test files using old paths
**Solution:** Update test imports:
```javascript
// OLD
const module = await import('../../scripts/orchestrator.js');

// NEW
const module = await import('../../src/core/orchestrator.js');
```

---

## 💡 Pro Tips

### Tip 1: Use IDE Search & Replace

Most IDEs support project-wide search & replace:

1. Search: `scripts/orchestrator.js`
2. Replace: `src/core/orchestrator.js`
3. Review each match before replacing

---

### Tip 2: Leverage npm Scripts

Use updated npm scripts instead of direct paths:

```bash
# ✅ GOOD - Uses package.json scripts (already updated!)
npm start
npm run monitor

# ❌ BAD - Hardcoded paths (will break!)
node scripts/orchestrator.js
```

---

### Tip 3: Check Backups

Before migrating, we created `.bak` backups:

```bash
# Compare your changes with backup
diff README.md README.md.bak

# Restore if needed
cp README.md.bak README.md
```

---

## 📞 Need Help?

### Self-Help Resources

1. **Read this guide thoroughly** - Most questions answered here
2. **Check README.md** - Updated with new paths
3. **See PHASE_1_2_COMPLETION_REPORT.md** - Detailed change log

### Contact Team

- **Repository Issues:** Open GitHub issue
- **Urgent Questions:** Contact maintainers
- **CI/CD Issues:** Check `.github/workflows/`

---

## 🎯 Quick Reference

### Most Common Updates

```bash
# Core files
scripts/orchestrator.js → src/core/orchestrator.js
scripts/mcp-server.js → src/core/mcp-server.js
scripts/rabbitmq-client.js → src/core/rabbitmq-client.js

# Systems
scripts/brainstorm-system.js → src/systems/brainstorm/system.js
scripts/voting-system.js → src/systems/voting/system.js

# Scripts
scripts/deploy.sh → scripts/deployment/02-deploy.sh
scripts/health-check.sh → scripts/infrastructure/health-check.sh
scripts/backup-all.sh → scripts/backup/backup.sh
```

---

## 📊 Migration Status Tracking

Track your migration progress:

- [ ] Code imports updated
- [ ] Shell scripts updated
- [ ] npm scripts verified
- [ ] Tests passing
- [ ] Documentation updated
- [ ] CI/CD pipeline adjusted
- [ ] Team members notified
- [ ] Deployment verified

---

## 🎉 Post-Migration

After successful migration:

1. **Remove backup files:**
   ```bash
   rm *.bak
   rm examples/*.bak
   ```

2. **Celebrate!** 🎊
   You've successfully migrated to a professional repository structure!

3. **Share feedback:**
   Let the team know how the migration went!

---

*Migration Guide Version: 1.0.0*
*Last Updated: 2025-12-07*
*Questions? Check PHASE_1_2_COMPLETION_REPORT.md for details*
