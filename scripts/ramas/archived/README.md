# Archived Scripts (Legacy Shell)

**Archived:** 2026-01-01
**Reason:** Replaced by Python implementation

---

## Why Archived?

These shell scripts were part of the original RAMAS v1.0 implementation using AppleScript/osascript for iTerm2 control. They have been **completely replaced** by Python scripts.

---

## Archived Files

| File | Size | Original Purpose | Replaced By |
|------|------|------------------|-------------|
| `interrupt-worker.sh` | 3.3K | Send interrupt message to worker via AppleScript | `scripts/ramas/python/stop_agent.py` |
| `update-title.sh` | 1.4K | Update iTerm2 tab title via AppleScript | `src/ramas/python/controller.py` |

---

## Current Implementation

Use the Python scripts instead:

```bash
# Emergency stop (Level 3 - Direct ESC)
python scripts/ramas/python/stop_agent.py worker-001

# Or via Makefile
make ramas-stop AGENT=worker-001
```

---

## Migration Path

```
Shell Script (v1.0)          →  Python Script (v2.0+)
──────────────────────────────────────────────────────
interrupt-worker.sh          →  stop_agent.py
update-title.sh              →  controller.py (session.async_set_name())
```

---

## Do Not Use

These scripts are kept for **historical reference only**. They will not work with the current Python-based RAMAS implementation.

---

*Archived: 2026-01-01 | Replaced by Python implementation*
