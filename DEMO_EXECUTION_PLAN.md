# Claude-Swarm Demo Execution Plan

## Executive Summary

**Objective:** Demonstrate all 8 AI mechanisms in claude-swarm with professional quality
**Duration:** ~45 minutes total
**Prerequisites:** RabbitMQ running (verified available)

---

## Phase 1: Standalone Demos (No RabbitMQ Required)

### 1.1 Battle System Demo (5 min)
```bash
node examples/battle-scenario.js
```
**Demonstrates:**
- 1v1 Head-to-Head duels
- Speed Race competitions
- Leaderboard updates
- Hall of Fame eligibility
- ELO rating system

**Expected Output:**
- 4 battle examples
- Rankings for 4 agents
- Speed/Quality leaderboards

### 1.2 Rewards System Demo (5 min)
```bash
node examples/rewards-scenario.js
```
**Demonstrates:**
- Agent initialization (Bronze tier)
- Task completion with points
- Streak building (5-task multiplier)
- Brainstorm participation
- Tier progression: Bronze → Silver → Gold
- Resource allocation increases
- Permission upgrades

**Expected Output:**
- 9 phases of progression
- Final status: Gold tier, 5000+ points

---

## Phase 2: RabbitMQ-Dependent Demos

### 2.1 Voting System Demo (10 min)
```bash
node examples/voting-scenario.js
```
**Demonstrates 5 Voting Algorithms:**
1. Simple Majority - One vote per agent
2. Confidence-Weighted - Votes weighted by confidence
3. Quadratic Voting - Token allocation (sqrt)
4. Consensus (75%) - Supermajority threshold
5. Ranked Choice - Instant runoff elimination

**Scenario:** 6 agents decide on cryptocurrency feature launch
- Finance Agent (CFO)
- Compliance Agent (Legal)
- Growth Agent (Market)
- Engineering Agent (Tech)
- Product Agent (PM)
- Marketing Agent (Brand)

### 2.2 Penalties System Demo (8 min)
```bash
node examples/penalties-scenario.js
```
**Demonstrates:**
- Performance degradation detection
- Progressive penalties (Level 1 → 2 → 3 → 5)
- 6 penalty levels with restrictions
- 4-stage retraining curriculum:
  1. Diagnosis (5 min)
  2. Skill Review (10 min)
  3. Supervised Practice (30 min)
  4. Graduated Tasks (1 hour)
- Probation period
- Successful recovery

### 2.3 Mentorship System Demo (8 min)
```bash
node examples/mentorship-scenario.js
```
**Demonstrates:**
- Agent enrollment (Level 0 Novice)
- Mentor-mentee pairing
- 3-day accelerated training:
  - Day 1: Foundation (Level 0 → 1)
  - Day 2: Capability (Level 1 → 2)
  - Day 3: Mastery (Level 2 → 3)
- 5 knowledge transfer mechanisms:
  1. Observation (Shadowing)
  2. Co-Execution (Guided Practice)
  3. Pattern Sharing
  4. Feedback Sessions
  5. Assessment
- 10x training acceleration (30 days → 3 days)

### 2.4 Brainstorm System Demo (5 min)
```bash
node examples/brainstorm-scenario.js
```
**Demonstrates:**
- Session management
- Idea generation (150+ ideas)
- Idea combination
- Idea refinement
- Democratic voting
- Real-time statistics

---

## Phase 3: Live Multi-Terminal Demo

### 3.1 Orchestrator Demo (5 min)
```bash
# Terminal 1 - Team Leader
node scripts/orchestrator.js team-leader

# Terminal 2 - Worker 1
node scripts/orchestrator.js worker

# Terminal 3 - Worker 2
node scripts/orchestrator.js worker
```
**Demonstrates:**
- Multi-agent coordination
- Task distribution
- Result aggregation
- Status monitoring

---

## Execution Order (Recommended)

| Order | Demo | Duration | RabbitMQ | Complexity |
|-------|------|----------|----------|------------|
| 1 | Battle System | 5 min | No | Low |
| 2 | Rewards System | 5 min | No | Medium |
| 3 | Voting System | 10 min | Yes | High |
| 4 | Penalties System | 8 min | Yes | High |
| 5 | Mentorship System | 8 min | Yes | High |
| 6 | Brainstorm System | 5 min | Yes | Medium |
| 7 | Orchestrator | 5 min | Yes | Medium |

**Total:** ~46 minutes

---

## Success Criteria

### Per Demo:
- [ ] No errors during execution
- [ ] All phases complete
- [ ] Visual output clear and formatted
- [ ] Metrics displayed correctly

### Overall:
- [ ] All 8 mechanisms demonstrated
- [ ] Professional output quality
- [ ] Documentation of results
- [ ] Screen recordings (optional)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| RabbitMQ connection failure | Verify with `curl localhost:15672` first |
| Import errors | Use `NODE_OPTIONS=--experimental-vm-modules` |
| Timeout issues | Increase timeout if needed |
| Missing dependencies | Run `npm install` first |

---

## Post-Demo Actions

1. **Document Results**
   - Capture terminal output
   - Note any issues
   - Record execution times

2. **Update Agent Knowledge**
   - Add demo learnings to ci-cd-debugger-agent.md
   - Update README with demo instructions

3. **Create Demo Video** (Optional)
   - Screen recording of all demos
   - Voice-over explanation

---

## Quick Start Commands

```bash
# Verify RabbitMQ
curl -s http://localhost:15672 && echo "RabbitMQ OK"

# Run all standalone demos
node examples/battle-scenario.js
node examples/rewards-scenario.js

# Run RabbitMQ demos
node examples/voting-scenario.js
node examples/penalties-scenario.js
node examples/mentorship-scenario.js
node examples/brainstorm-scenario.js
```

---

**Plan Created:** December 6, 2025
**Status:** Ready for Execution
