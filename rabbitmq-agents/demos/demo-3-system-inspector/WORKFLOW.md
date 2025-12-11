# Demo 3: System Inspector - WORKFLOW Design Document

## Version Info
- **Version:** 5.1.0
- **Created:** 2025-12-11
- **Updated:** 2025-12-11
- **Status:** WORKING - VERIFIED (WORKED_2)

---

## Purpose

Multi-agent terminal orchestration pipeline for Mac dual-monitor setup:
1. Detect display configuration
2. Open terminals with Window ID tracking
3. Launch Claude Code instances
4. Assign RabbitMQ roles via keystroke
5. **NEW:** Safe shutdown with /exit command

---

## Architecture

```
=============================================================================
                    SYSTEM INSPECTOR PIPELINE v5.1.0
=============================================================================

 TASK 1           TASK 2              TASK 3           TASK 4           TASK 5
 Display   -----> Terminal    -----> Screenshot -----> Claude   -----> Role
 Inspector        Setup              Validator         Launcher        Prompter
                     |
                     v
              Window ID Capture
              [25534, 25536, 25538]
                     |
                     +------------------+------------------+
                     |                  |                  |
                     v                  v                  v
                  LEADER             WORKER-1           WORKER-2
                  (25534)            (25536)            (25538)
                     |                  |                  |
                     v                  v                  v
              Takim Lideri          Agent              Worker
               gorevi               gorevi             gorevi
                     |                  |                  |
                     +------------------+------------------+
                                       |
                                       v
                                 TASK FINAL
                               Safe Shutdown
                                       |
                     +------------------+------------------+
                     |                  |                  |
                     v                  v                  v
                  /exit              /exit              /exit
                  close              close              close

=============================================================================
```

---

## Pipeline Tasks

### Task 1: Display Inspector
**File:** `tasks/display_inspector.py`
**Version:** 1.0.0

**Purpose:** Detect Mac display configuration

**Input:** None
**Output:**
```python
{
    'displays': [...],           # All displays
    'main_display': {...},       # Primary display
    'external_display': {...}    # External monitor
}
```

**Method:** Uses `system_profiler SPDisplaysDataType` via subprocess

---

### Task 2: Terminal Setup
**File:** `tasks/terminal_setup.py`
**Version:** 3.0.0

**Purpose:** Open terminals on external display WITH Window ID capture

**Key Innovation:** Window ID capture at creation time
```applescript
do script ""
set currentWindowID to id of window 1  -- CAPTURE IMMEDIATELY!
set end of windowIDs to currentWindowID
```

**Input:** Display info from Task 1
**Output:**
```python
{
    'terminals': [
        {'title': 'LEADER', 'window_id': 25534, 'x': 1280, ...},
        {'title': 'WORKER-1', 'window_id': 25536, 'x': 1920, ...},
        {'title': 'WORKER-2', 'window_id': 25538, 'x': 2560, ...}
    ],
    'window_ids': [25534, 25536, 25538]
}
```

**Configuration:**
```yaml
terminal_count: 3
terminal_titles: ["LEADER", "WORKER-1", "WORKER-2"]
use_dark_theme: true
```

---

### Task 3: Screenshot Validator
**File:** `tasks/screenshot_validator.py`
**Version:** 1.0.0

**Purpose:** Take verification screenshot of external display

**Input:** Terminal info from Task 2
**Output:**
```python
{
    'screenshot': 'external_display_WORKED_2.jpg',
    'file_size_kb': 57.6
}
```

---

### Task 4: Claude Launcher
**File:** `tasks/claude_launcher.py`
**Version:** 2.0.0

**Purpose:** Launch Claude Code in each terminal using Window ID

**Key Method:**
```applescript
set targetWindow to window id {window_id}
do script "claude --dangerously-skip-permissions" in targetWindow
```

**Input:** Terminal info with window_ids
**Output:**
```python
{
    'launched_count': 3,
    'launched_in': ['LEADER', 'WORKER-1', 'WORKER-2']
}
```

**Configuration:**
```yaml
claude_command: "claude --dangerously-skip-permissions"
wait_between_launches: 7
wait_after_all: 5
```

---

### Task 5: Role Prompter
**File:** `tasks/role_prompter.py`
**Version:** 2.0.0

**Purpose:** Assign RabbitMQ roles to each Claude via keystroke

**Role Messages:**
```python
ROLE_PROMPTS = {
    'LEADER': 'Sana Takim Lideri gorevi verecegim, RabbitMQ baglantisi yapip gorevini deklare edeceksin, hazir misin?',
    'WORKER-1': 'Sana Agent gorevi verecegim, RabbitMQ baglantisi yapip gorevini deklare edeceksin, hazir misin?',
    'WORKER-2': 'Sana Worker gorevi verecegim, RabbitMQ baglantisi yapip gorevini deklare edeceksin, hazir misin?',
}
```

**Key Method:**
```applescript
set targetWindow to window id {window_id}
set frontmost of targetWindow to true
tell application "System Events"
    keystroke "{message}"
    keystroke return
end tell
```

**Output:**
```python
{
    'role_assignments': {
        'LEADER': {'window_id': 25534, 'role': 'LEADER', 'status': 'assigned'},
        'WORKER-1': {'window_id': 25536, 'role': 'WORKER-1', 'status': 'assigned'},
        'WORKER-2': {'window_id': 25538, 'role': 'WORKER-2', 'status': 'assigned'}
    }
}
```

---

### Task Final: Safe Shutdown (NEW in v5.1.0)
**File:** `tasks/task_final.py`
**Version:** 1.0.0

**Purpose:** Safely close Claude Code and terminals

**Process:**
1. Send `/exit` keystroke to each terminal (closes Claude Code)
2. Wait 5 seconds for Claude to exit
3. Close terminal window via AppleScript

**Key Methods:**
```applescript
-- Step 1: Send /exit to Claude Code
set targetWindow to window id {window_id}
set frontmost of targetWindow to true
tell application "System Events"
    keystroke "/exit"
    keystroke return
end tell

-- Step 2: Close terminal window
close window id {window_id}
```

**Output:**
```python
{
    'closed_count': 3,
    'total_terminals': 3,
    'results': [
        {'terminal': 'LEADER', 'window_id': 25534, 'exit_sent': True, 'terminal_closed': True, 'status': 'success'},
        {'terminal': 'WORKER-1', 'window_id': 25536, 'exit_sent': True, 'terminal_closed': True, 'status': 'success'},
        {'terminal': 'WORKER-2', 'window_id': 25538, 'exit_sent': True, 'terminal_closed': True, 'status': 'success'}
    ],
    'shutdown_complete': True
}
```

**Configuration:**
```yaml
wait_before_exit: 2        # Wait before sending /exit
wait_after_exit: 5         # Wait for Claude to close
wait_before_close: 2       # Wait before closing terminal
wait_between_terminals: 3  # Wait between terminals
close_terminal_after: true # Also close terminal window
```

**Usage:**
```bash
# Must load context from previous pipeline run
python orchestrator.py --task task_final --load-context
```

---

## Context Flow

Tasks share data via context dictionary:

```python
context = {}

# Task 1 adds:
context['displays'] = [...]
context['external_display'] = {...}
context['main_display'] = {...}

# Task 2 adds:
context['terminals'] = [...with window_ids...]
context['window_ids'] = [25534, 25536, 25538]
context['x_offset'] = 1280

# Task 3 adds:
context['screenshot'] = 'external_display_WORKED_2.jpg'

# Task 4 adds:
context['launched_in'] = ['LEADER', 'WORKER-1', 'WORKER-2']

# Task 5 adds:
context['role_assignments'] = {...}

# Task Final adds:
context['closed_count'] = 3
context['shutdown_complete'] = True
```

---

## File Structure

```
demo-3-system-inspector/
├── orchestrator.py              # Main pipeline runner (v5.1.0)
├── run.sh                       # Quick start script
├── config/
│   └── workflow.yaml            # Pipeline configuration v5.1.0
├── tasks/
│   ├── __init__.py              # Task exports
│   ├── base.py                  # BaseTask abstract class
│   ├── display_inspector.py     # Task 1 (v1.0.0)
│   ├── terminal_setup.py        # Task 2 (v3.0.0)
│   ├── screenshot_validator.py  # Task 3 (v1.0.0)
│   ├── claude_launcher.py       # Task 4 (v2.0.0)
│   ├── role_prompter.py         # Task 5 (v2.0.0)
│   └── task_final.py            # Task Final (v1.0.0) NEW!
├── scripts/
│   └── setup_terminals.scpt     # Auto-generated
├── screenshots/
│   └── *_WORKED_2.jpg           # Verified evidence (immutable)
├── reports/
│   ├── pipeline_report_WORKED_2.json   # Task 1-5 report
│   └── shutdown_report_WORKED_2.json   # Task Final report
├── archive/
│   ├── screenshots/             # Previous WORKED files
│   └── reports/
├── CLAUDE.md                    # Session instructions
├── README.md                    # User documentation
└── WORKFLOW.md                  # This file
```

---

## Key Innovation: Window ID Solution

### Problem
AppleScript ile 3 terminale mesaj gonderirken hangisinin hangisi oldugunu tespit edemiyorduk:
- Window index: Unreliable (changes when windows reorder)
- Title-based: Claude Code overwrites terminal titles
- X-position: Fragile (+/-50px tolerance)

### Solution: Window ID at Creation Time
1. Terminal acilir acilmaz `id of window 1` yakala
2. Bu ID terminal kapatilmadikca degismez
3. Window ID ile kesin hedefleme yap

### Implementation
```applescript
-- terminal_setup.py
tell application "Terminal"
    set windowIDs to {}

    do script ""
    set end of windowIDs to id of window 1  -- CAPTURE!
    -- configure window...

    do script ""
    set end of windowIDs to id of window 1  -- CAPTURE!
    -- configure window...

    return windowIDs  -- "25534,25536,25538"
end tell
```

```applescript
-- role_prompter.py & task_final.py
tell application "Terminal"
    set targetWindow to window id 25534  -- EXACT TARGET!
    set frontmost of targetWindow to true
    -- keystroke message or /exit...
end tell
```

---

## Verified Evidence

Immutable files (chflags uchg) - WORKED_2:

**Screenshots:**
- `screenshots/external_display_WORKED_2.jpg`
- `screenshots/claude_verification_WORKED_2.jpg`
- `screenshots/response_leader_WORKED_2.jpg`
- `screenshots/response_worker-1_WORKED_2.jpg`
- `screenshots/response_worker-2_WORKED_2.jpg`
- `screenshots/role_prompter_final_WORKED_2.jpg`

**Reports:**
- `reports/pipeline_report_WORKED_2.json` - Task 1-5
- `reports/shutdown_report_WORKED_2.json` - Task Final

**Archive (Previous WORKED):**
- `archive/screenshots/*_WORKED.jpg`
- `archive/reports/pipeline_report_WORKED.json`

---

## Timing Configuration

| Parameter | Value | Purpose |
|-----------|-------|---------|
| wait_between_launches | 7s | Claude initialization |
| wait_after_all | 5s | All Claudes ready |
| wait_before_typing | 5s | Claude ready for input |
| wait_after_enter | 10s | Claude response time |
| wait_between_terminals | 7s | Context switch time |
| wait_before_exit | 2s | Before /exit command |
| wait_after_exit | 5s | Claude shutdown time |
| wait_before_close | 2s | Before terminal close |

**Total Pipeline Duration:** ~80 seconds (Task 1-5)
**Total Shutdown Duration:** ~37 seconds (Task Final)

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| AppleScript syntax error | Turkish characters | Remove apostrophes from messages |
| Window ID not found | Terminal closed | Fallback to X-position |
| Claude not responding | Slow startup | Increase wait times |
| Old Window IDs loaded | Wrong report | Use --load-context with latest report |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.1.0 | 2025-12-11 | Task Final (safe shutdown), --load-context option, WORKED_2 |
| 5.0.0 | 2025-12-11 | Window ID tracking, RabbitMQ role assignment, VERIFIED |
| 4.0.0 | 2025-12-11 | Added role_prompter task |
| 3.0.0 | 2025-12-11 | Added claude_launcher task |
| 2.0.0 | 2025-12-11 | Added screenshot_validator task |
| 1.0.0 | 2025-12-11 | Initial: display_inspector, terminal_setup |

---

**Demo 3 - System Inspector Pipeline v5.1.0**
*WORKING - VERIFIED on 2025-12-11 (WORKED_2)*
