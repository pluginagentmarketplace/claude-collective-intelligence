# BRAINSTORM TEMPLATE

> **Version:** PATTERN-C-003 v6.2
> **Usage:** Copy to `workspace/tasks/task-XXX-name/BRAINSTORM.md`
> **Pattern:** Brainstorm-Facilitator-Agent (collective-orchestrator)

---

## Brainstorm ID: brainstorm-XXX
## Topic: [Clear challenge statement]
## Type: [Workflow / Conflict / Pattern / Innovation / Bug Fix]
## Status: PENDING
## Created: YYYY-MM-DD
## Duration: [15-45 minutes expected]

---

## 🎯 Objective

[What decision or solution are we seeking?]

---

## 👥 Participants

| Agent | Role | Expertise |
|-------|------|-----------|
| Team Leader | Facilitator | Coordination, synthesis |
| Worker-001 | Backend | API, data layer |
| Worker-002 | Frontend | UI/UX, components |

---

## 🔄 Brainstorm Flow (MCP Tools)

1. Team Leader: `start_brainstorm(topic="...", question="...")`
2. Each Worker: `propose_idea(sessionId="...", idea="...", reasoning="...")`
3. Discussion via `session_broadcast()`
4. If vote needed: `create_vote(question="...", options=[...])`
5. Team Leader: Synthesize → `session_broadcast(content="DECISION: ...")`

---

## 🗣️ Perspectives

### 👑 Team Leader Perspective:
> "[Coordination view]"

**Key Points:**
- Point 1
- Point 2

---

### ⚙️ Worker-001 (Backend) Perspective:
> "[Technical backend view]"

**Key Points:**
- Point 1
- Point 2

---

### 🎨 Worker-002 (Frontend) Perspective:
> "[UI/UX view]"

**Key Points:**
- Point 1
- Point 2

---

## 🎯 SYNTHESIS

**Common Ground:**
- [What all agree on]

**Options Considered:**
- Option A: [Description]
- Option B: [Description]
- Option C: [Description]

**Recommended Solution:**
[Clear recommendation with rationale]

---

## ✅ Decision

**Approved Approach:** [Final decision]
**Vote Result:** [If applicable]
**Implementation Owner:** [Worker-001 / Worker-002 / Both]

---

## 📌 Action Items

- [ ] Worker-001: [Backend action]
- [ ] Worker-002: [Frontend action]
- [ ] Team Leader: [Coordination action]

---

## 📚 Lessons Learned

- [Key insight from this brainstorm]

---

**Session Documented By:** Team Leader
**Saved To:** `workspace/tasks/task-XXX-name/BRAINSTORM.md`
