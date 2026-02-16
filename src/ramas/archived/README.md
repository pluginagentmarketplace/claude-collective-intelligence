# Archived Source (Legacy JavaScript/Node.js)

**Archived:** 2026-01-01
**Reason:** Complete rewrite in Python

---

## Why Archived?

These JavaScript/Node.js files were part of RAMAS v1.0 implementation. The entire system was **rewritten in Python** as of 2026-01-01 for:

1. **Tab Title Bug Fix** - AppleScript couldn't set tab titles correctly
2. **Quote Hell Elimination** - Python handles strings natively
3. **Single Runtime** - No more Node.js + Python hybrid
4. **Modern Async** - asyncio + aio-pika + iTerm2 Python API

---

## Archived Files

| File | Size | Original Purpose | Replaced By |
|------|------|------------------|-------------|
| `applescript-controller.js` | 10K | iTerm2 control via osascript | `src/ramas/python/controller.py` |
| `ramas-exchanges.js` | 6.7K | RabbitMQ topology setup | `src/ramas/python/exchanges.py` |
| `status-daemon.js` | 12K | Worker status monitoring | `src/ramas/python/daemon.py` |
| `window-registry.js` | 4.8K | iTerm2 window tracking | `src/ramas/python/registry.py` |

---

## Current Implementation

All functionality now in Python:

```
src/ramas/python/
├── controller.py        # iTerm2 Python API (replaces AppleScript)
├── exchanges.py         # RabbitMQ topology (aio-pika)
├── daemon.py            # Status daemon (asyncio)
├── registry.py          # Window registry (JSON-based)
├── mcp_server.py        # MCP Server (40+ tools)
└── ...                  # + 10 more modules
```

---

## Migration Path

```
JavaScript (v1.0)              →  Python (v2.0+)
────────────────────────────────────────────────────
applescript-controller.js      →  controller.py
ramas-exchanges.js             →  exchanges.py
status-daemon.js               →  daemon.py
window-registry.js             →  registry.py
(AppleScript via osascript)    →  iTerm2 Python API
(amqplib)                      →  aio-pika (async)
```

---

## Key Improvements in Python

| Feature | JavaScript (v1.0) | Python (v2.0+) |
|---------|-------------------|----------------|
| iTerm2 Control | osascript (buggy) | iTerm2 Python API |
| RabbitMQ | amqplib (sync) | aio-pika (async) |
| String Handling | Quote escaping hell | Native strings |
| Async Model | Callbacks | asyncio/await |
| Tab Titles | Broken | Works correctly |

---

## Do Not Use

These files are kept for **historical reference only**. They are incompatible with the current Python-based RAMAS v3.4.0 implementation.

---

*Archived: 2026-01-01 | Complete Python rewrite*
