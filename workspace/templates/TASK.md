# TASK TEMPLATE

> **Version:** PATTERN-C-003 v6.1
> **Usage:** Copy this file to `workspace/tasks/task-XXX-name/TASK.md`
> **Replace:** XXX with task number, name with short description

---

## Task ID: task-XXX-name
## Priority: [LOW | NORMAL | HIGH | CRITICAL]
## Status: PENDING
## Created: YYYY-MM-DD
## Workers: 2

---

## Objective

[Clear description of what needs to be accomplished]

---

## Context Files

> List files that Team Leader and Workers should read before starting

1. `path/to/context/file1.md`
2. `path/to/context/file2.py`

---

## Sub-Tasks

### Task 1: [Title] → worker-001

| Field | Value |
|-------|-------|
| **Title** | [Short task name] |
| **Description** | [Detailed instructions] |
| **Expected Output** | [JSON format, metrics, report, etc.] |
| **Deadline** | [Immediate \| By time \| Duration] |

### Task 2: [Title] → worker-002

| Field | Value |
|-------|-------|
| **Title** | [Short task name] |
| **Description** | [Detailed instructions] |
| **Expected Output** | [JSON format, metrics, report, etc.] |
| **Deadline** | [Immediate \| By time \| Duration] |

---

## Success Criteria

- [ ] [First criterion - measurable outcome]
- [ ] [Second criterion - measurable outcome]
- [ ] [Third criterion - measurable outcome]

---

## Notes

- [Any special instructions or context]
- [Dependencies or prerequisites]
- [Expected timeline: X minutes]

---

## Result Aggregation Template

Team Leader should use this format for final summary:

```
═══════════════════════════════════════════════════════════════
TASK-XXX-NAME SUMMARY
Date: YYYY-MM-DD HH:MM
═══════════════════════════════════════════════════════════════

## Worker-001 Result
[Result details from worker-001]

## Worker-002 Result
[Result details from worker-002]

## Combined Analysis
[Team Leader's aggregation and insights]

═══════════════════════════════════════════════════════════════
Status: [COMPLETE | PARTIAL | FAILED]
═══════════════════════════════════════════════════════════════
```

---

## Task Workflow

```
1. Team Leader reads this file
2. Team Leader creates session
3. Team Leader sends SESSION_READY (v6)
4. Workers join and send WORKER_READY (v6)
5. Team Leader assigns sub-tasks
6. Workers process and report
7. Team Leader aggregates results
8. Session closed
```

---

*Template Version: PATTERN-C-003 v6.1 | Updated: 2026-01-08*
