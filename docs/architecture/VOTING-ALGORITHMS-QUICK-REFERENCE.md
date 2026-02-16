# Voting Algorithms - Quick Reference

## Algorithm Selection Guide

| Algorithm | Use When | Pros | Cons |
|-----------|----------|------|------|
| **Simple Majority** | Equal authority, binary choice | Fast, simple, clear | Ignores expertise, intensity |
| **Confidence-Weighted** | Expertise matters, uncertainty exists | Values expert opinion | Can be gamed with fake confidence |
| **Quadratic** | Preference intensity matters | Prevents tyranny, minority voice | Complex, requires token management |
| **Consensus** | Critical decisions, broad agreement needed | Forces alignment | Can deadlock, slow |
| **Ranked Choice** | Multiple options, avoid vote splitting | Fair, eliminates spoilers | Complex to explain |

---

## 1. Simple Majority Voting

**When to use:** Binary decisions, equal agent authority

### Example: API Design Decision
```javascript
const sessionId = await votingSystem.initiateVote({
  topic: 'API Design',
  question: 'Should we use REST or GraphQL?',
  options: ['REST', 'GraphQL'],
  algorithm: 'simple_majority',
  totalAgents: 5
});

// Agents vote
await votingSystem.castVote(sessionId, 'agent-1', { choice: 'GraphQL' });
await votingSystem.castVote(sessionId, 'agent-2', { choice: 'GraphQL' });
await votingSystem.castVote(sessionId, 'agent-3', { choice: 'REST' });

// Results: GraphQL wins with 2/3 votes (66%)
```

**Output:**
```
Winner: GraphQL
Tally: { GraphQL: 2, REST: 1 }
Winner Percentage: 66%
```

---

## 2. Confidence-Weighted Voting

**When to use:** Expert opinions matter more, uncertainty acknowledged

### Example: Database Selection
```javascript
const sessionId = await votingSystem.initiateVote({
  topic: 'Database Choice',
  question: 'PostgreSQL or MongoDB?',
  options: ['PostgreSQL', 'MongoDB'],
  algorithm: 'confidence_weighted',
  totalAgents: 3
});

// Senior DBA: High confidence
await votingSystem.castVote(sessionId, 'dba-agent', {
  choice: 'PostgreSQL',
  confidence: 0.95  // Very confident
});

// Junior Dev: Low confidence
await votingSystem.castVote(sessionId, 'junior-agent', {
  choice: 'MongoDB',
  confidence: 0.4  // Not very confident
});

// Mid-level: Medium confidence
await votingSystem.castVote(sessionId, 'mid-agent', {
  choice: 'PostgreSQL',
  confidence: 0.7  // Somewhat confident
});

// Results: PostgreSQL wins with higher weighted score
// PostgreSQL: 0.95 + 0.7 = 1.65
// MongoDB: 0.4
```

**Output:**
```
Winner: PostgreSQL
Weighted Tally: { PostgreSQL: 1.65, MongoDB: 0.4 }
Winner Percentage: 80.5%
Average Confidence: 68%
```

---

## 3. Quadratic Voting

**When to use:** Preference intensity matters, minority protection

### Example: Feature Prioritization
```javascript
const sessionId = await votingSystem.initiateVote({
  topic: 'Feature Priority',
  question: 'Which features should we prioritize?',
  options: ['Performance', 'Security', 'UI/UX'],
  algorithm: 'quadratic',
  tokensPerAgent: 100,
  totalAgents: 3
});

// Product Manager: Strongly cares about UI/UX
await votingSystem.castVote(sessionId, 'product-agent', {
  allocation: {
    'UI/UX': 64,        // sqrt(64) = 8 votes
    'Performance': 25,  // sqrt(25) = 5 votes
    'Security': 11      // sqrt(11) = 3.3 votes
  }
});

// Security Engineer: Strongly cares about Security
await votingSystem.castVote(sessionId, 'security-agent', {
  allocation: {
    'Security': 81,     // sqrt(81) = 9 votes
    'Performance': 16,  // sqrt(16) = 4 votes
    'UI/UX': 3          // sqrt(3) = 1.7 votes
  }
});

// Backend Engineer: Balanced preference
await votingSystem.castVote(sessionId, 'backend-agent', {
  allocation: {
    'Performance': 50,  // sqrt(50) = 7.1 votes
    'Security': 30,     // sqrt(30) = 5.5 votes
    'UI/UX': 20         // sqrt(20) = 4.5 votes
  }
});

// Results calculated by summing quadratic votes
// Performance: 5 + 4 + 7.1 = 16.1
// Security: 3.3 + 9 + 5.5 = 17.8
// UI/UX: 8 + 1.7 + 4.5 = 14.2
```

**Output:**
```
Winner: Security
Tally: { Security: 17.8, Performance: 16.1, UI/UX: 14.2 }
Winner Votes: 17.8 quadratic votes
```

**Why it works:** Even though only 1 agent strongly preferred Security, the quadratic mechanism allowed them to express strong preference while others had more balanced views.

---

## 4. Consensus Threshold Voting

**When to use:** Critical decisions, supermajority needed

### Example: System Migration Decision
```javascript
const sessionId = await votingSystem.initiateVote({
  topic: 'System Migration',
  question: 'Proceed with Kubernetes migration?',
  options: ['Proceed', 'Do Not Proceed'],
  algorithm: 'consensus',
  consensusThreshold: 0.75,  // 75% required
  totalAgents: 4
});

// 3 Yes, 1 No = 75% consensus
await votingSystem.castVote(sessionId, 'agent-1', { choice: 'Proceed' });
await votingSystem.castVote(sessionId, 'agent-2', { choice: 'Proceed' });
await votingSystem.castVote(sessionId, 'agent-3', { choice: 'Proceed' });
await votingSystem.castVote(sessionId, 'agent-4', { choice: 'Do Not Proceed' });

// Results: Consensus achieved (75% threshold met)
```

**Output:**
```
Winner: Proceed
Winner Percentage: 75%
Consensus Reached: true
Required Threshold: 75%
Status: CONSENSUS_ACHIEVED
```

**If threshold not met:**
```javascript
// 2 Yes, 2 No = 50% (below 75% threshold)
// Results:
Winner: Proceed
Winner Percentage: 50%
Consensus Reached: false
Required Threshold: 75%
Status: NO_CONSENSUS
// → Additional discussion needed
```

---

## 5. Ranked Choice Voting

**When to use:** Multiple options, avoid vote splitting

### Example: Framework Selection
```javascript
const sessionId = await votingSystem.initiateVote({
  topic: 'Framework Selection',
  question: 'Which framework should we use?',
  options: ['React', 'Vue', 'Angular', 'Svelte'],
  algorithm: 'ranked_choice',
  totalAgents: 5
});

// Each agent ranks all options by preference
await votingSystem.castVote(sessionId, 'agent-1', {
  rankings: ['React', 'Vue', 'Svelte', 'Angular']
});

await votingSystem.castVote(sessionId, 'agent-2', {
  rankings: ['Vue', 'React', 'Svelte', 'Angular']
});

await votingSystem.castVote(sessionId, 'agent-3', {
  rankings: ['React', 'Svelte', 'Vue', 'Angular']
});

await votingSystem.castVote(sessionId, 'agent-4', {
  rankings: ['Svelte', 'React', 'Vue', 'Angular']
});

await votingSystem.castVote(sessionId, 'agent-5', {
  rankings: ['React', 'Vue', 'Svelte', 'Angular']
});

// Instant runoff process:
// Round 1: React: 3, Vue: 1, Svelte: 1, Angular: 0
//   - React has majority (60%), wins immediately
```

**Output:**
```
Winner: React
Elimination Rounds: 0
Winner Percentage: 60%
Rounds: [
  { React: 3, Vue: 1, Svelte: 1, Angular: 0 }
]
```

**Complex example with elimination:**
```javascript
// Round 1: React: 2, Vue: 1, Svelte: 1, Angular: 1
//   - No majority, eliminate Angular (lowest)
// Round 2: React: 2, Vue: 2, Svelte: 1
//   - No majority, eliminate Svelte
// Round 3: React: 3, Vue: 2
//   - React wins with majority
```

---

## Quorum Configuration Examples

### Strict Quorum (High-Stakes Decision)
```javascript
const sessionId = await votingSystem.initiateVote({
  topic: 'Critical Decision',
  question: 'Proceed with major refactor?',
  options: ['Yes', 'No'],
  algorithm: 'consensus',
  totalAgents: 10,

  // Strict requirements
  minParticipation: 0.9,  // 90% must vote
  minConfidence: 7.0,      // Total confidence ≥ 7.0
  minExperts: 3,           // At least 3 Level 4+ agents
  consensusThreshold: 0.8  // 80% consensus required
});
```

### Relaxed Quorum (Routine Decision)
```javascript
const sessionId = await votingSystem.initiateVote({
  topic: 'Routine Decision',
  question: 'Update dependency version?',
  options: ['Yes', 'No'],
  algorithm: 'simple_majority',
  totalAgents: 10,

  // Relaxed requirements
  minParticipation: 0.5,  // 50% must vote
  minConfidence: 0,        // No confidence requirement
  minExperts: 0            // No expert requirement
});
```

---

## Tie-Breaking Examples

When votes are tied, the system uses these mechanisms in order:

### 1. Confidence Weighting
```javascript
// Scenario: 2 agents vote for A, 2 for B
// Agent 1: A, confidence 0.9
// Agent 2: A, confidence 0.6
// Agent 3: B, confidence 0.5
// Agent 4: B, confidence 0.4
// Winner: A (total confidence 1.5 vs 0.9)
```

### 2. Expertise Weighting
```javascript
// Scenario: Confidence tied
// Agent 1: A, Level 5 (expert)
// Agent 2: B, Level 2 (junior)
// Winner: A (expert vote weighted 2x)
```

### 3. Timestamp
```javascript
// Scenario: Expertise tied
// Agent 1: A, voted at 10:00:00
// Agent 2: B, voted at 10:00:05
// Winner: A (voted first)
```

### 4. Random
```javascript
// Scenario: All tie-breakers failed
// Winner: Random selection between tied options
```

---

## Real-World Decision Matrix

| Decision Type | Recommended Algorithm | Threshold | Reasoning |
|---------------|----------------------|-----------|-----------|
| **Code review approval** | Confidence-weighted | N/A | Senior reviewers' opinions matter more |
| **Feature prioritization** | Quadratic | N/A | Product intensity should influence outcome |
| **Architecture change** | Consensus | 80% | Critical decision needs broad agreement |
| **Tool selection** | Ranked choice | N/A | Multiple options, avoid splitting |
| **Daily standup location** | Simple majority | N/A | Low stakes, equal say |
| **Security policy** | Consensus | 90% | Critical, needs near-unanimous support |
| **Bug severity** | Confidence-weighted | N/A | Experience determines severity assessment |
| **Tech debt priority** | Quadratic | N/A | Teams can express urgency |

---

## Performance Comparison

| Algorithm | Time Complexity | Space Complexity | Network Overhead |
|-----------|----------------|------------------|------------------|
| Simple Majority | O(n) | O(k) | Low |
| Confidence-Weighted | O(n) | O(k) | Low |
| Quadratic | O(n × k) | O(n × k) | Medium |
| Consensus | O(n) | O(k) | Low |
| Ranked Choice | O(n × k²) | O(n × k) | High |

Where:
- n = number of agents
- k = number of options

---

## Common Patterns

### Pattern 1: Two-Stage Voting
```javascript
// Stage 1: Narrow down options with ranked choice
const stage1 = await runRankedChoiceVote(allOptions);
const top3 = getTop3Options(stage1);

// Stage 2: Final decision with consensus
const stage2 = await runConsensusVote(top3, threshold: 0.75);
```

### Pattern 2: Escalating Quorum
```javascript
// Try with 50% quorum
const result1 = await runVote({ minParticipation: 0.5 });

if (result1.status === 'QUORUM_NOT_MET') {
  // Escalate to leadership team with 80% quorum
  const result2 = await runVote({
    minParticipation: 0.8,
    minExperts: 2
  });
}
```

### Pattern 3: Fallback Chain
```javascript
// Try consensus first
const consensus = await runConsensusVote({ threshold: 0.75 });

if (!consensus.consensusReached) {
  // Fall back to confidence-weighted
  const weighted = await runConfidenceWeightedVote();
  return weighted;
}
```

---

## Anti-Patterns (What NOT to Do)

❌ **Using simple majority for critical decisions**
```javascript
// BAD: Low quorum, simple majority for critical decision
await votingSystem.initiateVote({
  topic: 'Shut down production database',
  algorithm: 'simple_majority',  // ❌ Too simple for critical decision
  minParticipation: 0.3          // ❌ Too low
});
```

✅ **Better: Use consensus with high threshold**
```javascript
await votingSystem.initiateVote({
  topic: 'Shut down production database',
  algorithm: 'consensus',
  consensusThreshold: 0.9,  // ✓ High threshold
  minParticipation: 0.8,    // ✓ High participation
  minExperts: 3             // ✓ Expert requirement
});
```

❌ **Ignoring confidence scores**
```javascript
// BAD: Asking for confidence but using simple majority
await votingSystem.castVote(sessionId, agentId, {
  choice: 'Option A',
  confidence: 0.3  // ❌ Ignored in simple majority
});
```

✅ **Better: Use confidence-weighted algorithm**
```javascript
await votingSystem.initiateVote({
  algorithm: 'confidence_weighted'  // ✓ Uses confidence
});
```

❌ **Too many options in ranked choice**
```javascript
// BAD: 20 options in ranked choice
await votingSystem.initiateVote({
  options: [...20Options],  // ❌ Too complex
  algorithm: 'ranked_choice'
});
```

✅ **Better: Narrow down first**
```javascript
// Stage 1: Quadratic vote to identify top 5
const top5 = await narrowDownOptions(allOptions);

// Stage 2: Ranked choice among top 5
await votingSystem.initiateVote({
  options: top5,  // ✓ Manageable number
  algorithm: 'ranked_choice'
});
```

---

## Quick Reference: Algorithm Parameters

```javascript
// Simple Majority - No special parameters
{ algorithm: 'simple_majority' }

// Confidence-Weighted - Agents provide confidence
{
  algorithm: 'confidence_weighted',
  vote: { choice: 'A', confidence: 0.85 }
}

// Quadratic - Agents allocate tokens
{
  algorithm: 'quadratic',
  tokensPerAgent: 100,
  vote: { allocation: { 'A': 64, 'B': 25, 'C': 11 } }
}

// Consensus - Set threshold
{
  algorithm: 'consensus',
  consensusThreshold: 0.75
}

// Ranked Choice - Agents rank options
{
  algorithm: 'ranked_choice',
  vote: { rankings: ['First', 'Second', 'Third'] }
}
```

---

## Troubleshooting

### Issue: Quorum not met
**Solution:** Lower participation requirement or extend deadline
```javascript
// Extend deadline
const newDeadline = Date.now() + 300000; // +5 minutes

// Or lower participation
minParticipation: 0.5  // From 0.7 to 0.5
```

### Issue: No consensus reached
**Solution:** Lower threshold or use different algorithm
```javascript
// Lower threshold
consensusThreshold: 0.66  // From 0.75

// Or switch algorithm
algorithm: 'confidence_weighted'  // From 'consensus'
```

### Issue: Tied results
**Solution:** System auto-breaks ties, or collect more votes
```javascript
// Tie-breaking is automatic, but you can:
// 1. Collect one more vote
// 2. Use confidence-weighted (less likely to tie)
// 3. Trust the automatic tie-breaker
```

---

**For more details, see:**
- Full implementation: `/scripts/voting-system.js`
- Examples: `/examples/voting-scenario.js`
- Tests: `/tests/unit/voting-system.test.js`
