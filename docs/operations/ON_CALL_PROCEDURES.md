# ON-CALL PROCEDURES & HANDBOOK
## AI Agent Orchestrator with RabbitMQ - 24/7 Support Guide

**Last Updated:** November 18, 2025
**Version:** 1.0.0
**Target Audience:** On-call engineers, on-call managers
**Status:** APPROVED FOR PRODUCTION

---

## TABLE OF CONTENTS

1. [On-Call Schedule & Expectations](#on-call-schedule--expectations)
2. [Pre-On-Call Preparation](#pre-on-call-preparation)
3. [During On-Call Shift](#during-on-call-shift)
4. [Incident Response Protocol](#incident-response-protocol)
5. [Escalation Process](#escalation-process)
6. [Post-On-Call Handoff](#post-on-call-handoff)
7. [Tools & Access](#tools--access)
8. [On-Call Culture](#on-call-culture)

---

## ON-CALL SCHEDULE & EXPECTATIONS

### Schedule Structure

```
ROTATION SCHEDULE:
├─ Primary On-Call (7 days)
│  └─ 24/7 availability, responds to all alerts
│
├─ Secondary On-Call (7 days)
│  └─ Backup if primary unavailable
│  └─ Takes over during primary's sleep (if defined)
│
└─ Tertiary On-Call (standby)
   └─ On-call manager for escalations

SHIFT HANDOFF:
├─ Every Monday 09:00 AM
├─ 30-minute overlap for knowledge transfer
├─ New on-call reviews recent incidents
└─ Old on-call available 4 hours post-shift for questions

TIME ZONES:
├─ US EAST: 9 AM Monday - 9 AM Next Monday
├─ US WEST: 9 AM Tuesday - 9 AM Next Tuesday (offset 3 hours)
├─ EMEA: 9 AM Wednesday - 9 AM Next Wednesday (offset 9 hours)
└─ APAC: 9 AM Thursday - 9 AM Next Thursday (offset 18 hours)
```

### Response Time Expectations

```
P1 - CRITICAL:
  ├─ Alert received: Instant (push notification + SMS)
  ├─ Response time: < 5 minutes
  ├─ Initial mitigation: < 15 minutes
  ├─ Business impact: System completely down
  └─ Escalation path: Primary → Manager → VP Eng

P2 - URGENT:
  ├─ Alert received: < 1 minute
  ├─ Response time: < 15 minutes
  ├─ Investigation: < 30 minutes
  ├─ Business impact: Major functionality broken
  └─ Escalation path: Primary → Manager

P3 - HIGH:
  ├─ Alert received: < 5 minutes
  ├─ Response time: < 1 hour
  ├─ Investigation: < 2 hours
  ├─ Business impact: Partial degradation
  └─ Escalation path: Can be handled by Primary

P4 - MEDIUM:
  ├─ Alert received: During business hours or next morning
  ├─ Response time: < 4 hours (business hours only)
  ├─ Investigation: < 24 hours
  ├─ Business impact: Minor or no user impact
  └─ Can be deferred until next morning if after hours

ESCALATION RULES:
├─ If issue not resolved in target time → Escalate
├─ If stuck investigating > 20 min → Get backup
├─ If uncertain about severity → Escalate
├─ If affecting customers → Always escalate early
└─ If critical outage → Page everyone
```

---

## PRE-ON-CALL PREPARATION

### One Week Before

**Monday - Review previous week:**

```bash
# 1. Review on-call summary
cat /var/log/incidents/weekly-summary.log

# 2. Check for any open issues
curl -s https://api.github.com/repos/YOUR_ORG/YOUR_REPO/issues?state=open | jq '.[] | {number, title, created_at}'

# 3. Read recent RCAs
ls -lah /var/log/incidents/*/RCA.md

# 4. Check deployment status
git log --oneline -20

# 5. Review changes since last on-call
git log --since="7 days ago" --oneline
```

**Tuesday - Self-test:**

```bash
# 1. Verify all access working
ssh ops@production
docker-compose ps

# 2. Test alert notifications
# Ask to-be-replaced on-call to trigger test alert

# 3. Verify contact info updated
# Update slack status
# Verify phone number in PagerDuty
# Check email forwarding

# 4. Review critical dashboards
# Open http://localhost:3001
# Navigate to key dashboards
# Verify you can read graphs
```

**Wednesday - Knowledge transfer:**

```
# 1. Shadow current on-call for 4 hours
# - Have them walk through recent incident
# - Ask questions about procedures
# - Watch how they investigate

# 2. Practice incident response
# - Run through decision trees
# - Execute practice runbooks
# - Time yourself

# 3. Get context on known issues
# - Ask about trending problems
# - Learn workarounds
# - Understand known limitations
```

**Thursday - Prep handoff:**

```
# 1. Prepare documentation
# - Print decision trees
# - Print quick reference guide
# - Have runbooks accessible

# 2. Set up communication
# - Create escalation contact list
# - Verify team members reachable
# - Set up Slack status

# 3. Final Q&A
# - Ask any remaining questions
# - Confirm procedures
# - Review edge cases
```

**Friday - Weekend prep (if taking weekend shift):**

```bash
# 1. Check system health
curl http://localhost:3000/health

# 2. Review queue depths
curl -u guest:guest http://localhost:15672/api/overview | jq '.queue_totals'

# 3. Check for any degraded services
curl http://localhost:3001/api/health

# 4. Verify backups completed
ls -lh /backups/daily/ | tail -3

# 5. Mental prep
# - Get good sleep Friday night
# - Keep phone charged
# - Be available and focused
```

---

## DURING ON-CALL SHIFT

### Daily Checklist

**Start of shift (9:00 AM):**

```bash
#!/bin/bash
# scripts/on-call-morning-check.sh

echo "=== ON-CALL SHIFT START CHECKLIST ==="
echo "Time: $(date)"

# 1. Verify all systems operational
echo "[1/5] System health check..."
curl -s http://localhost:3000/health | jq '.status'

# 2. Check for overnight incidents
echo "[2/5] Checking overnight incident logs..."
docker-compose logs --since "12 hours ago" orchestrator | grep "ERROR\|CRITICAL" | wc -l

# 3. Review queue depths
echo "[3/5] Checking queue health..."
curl -s -u guest:guest http://localhost:15672/api/overview | jq '.queue_totals'

# 4. Check resource utilization
echo "[4/5] Checking resource usage..."
docker stats --no-stream | tail -5

# 5. Review incident backlog
echo "[5/5] Reviewing incident backlog..."
ls -1 /var/log/incidents/ | sort -r | head -5

echo ""
echo "Morning check complete at $(date)"
```

**During shift:**

```
EVERY HOUR:
├─ Check system status (1 min)
├─ Scan error logs (2 min)
├─ Monitor key metrics (2 min)
└─ Update status

DURING ALERT:
├─ Acknowledge in PagerDuty immediately
├─ Create incident ID
├─ Begin investigation per runbooks
├─ Update status channel every 10 minutes
├─ Escalate if needed

BETWEEN ALERTS:
├─ Study recent incidents
├─ Practice runbooks
├─ Learn system quirks
├─ Review new code/changes
├─ Maintain knowledge
```

**End of shift (next day 9:00 AM):**

```bash
#!/bin/bash
# scripts/on-call-shift-end.sh

INCOMING_ONCALL=$1

echo "=== ON-CALL SHIFT END HANDOFF ==="

# 1. Generate shift summary
cat > /var/log/on-call-shift-$(date +%Y%m%d).md << EOF
# On-Call Shift Summary
Date: $(date)
On-Call: $USER
Incidents handled: [count]
Total on-call time: 24 hours
Status: [notes]

## Incidents
[List each incident with P-level and resolution time]

## Alerts Received
[List all alerts and responses]

## System Status
- Health: OK
- Queue depth: Normal
- Error rate: <0.5%

## Known Issues
[List any ongoing issues]

## Notes for Next On-Call
[Helpful information for successor]
EOF

# 2. Clean up any temporary changes
# (Remove any rate limits, circuit breakers, etc.)
curl -X POST http://localhost:3000/admin/rate-limit \
  -d '{"enabled": false}'

# 3. Verify system clean for next on-call
docker-compose ps
curl http://localhost:3000/health | jq

# 4. Document any findings
echo "Shift summary saved to: /var/log/on-call-shift-$(date +%Y%m%d).md"

# 5. Send to team
curl -X POST https://slack.com/api/chat.postMessage \
  -d '{
    "channel": "#on-call",
    "text": "Shift ended, handing off to '$INCOMING_ONCALL'"
  }'

# 6. Stay available for 4 hours for questions
echo "Available for questions until $(date -d '+4 hours')"
```

---

## INCIDENT RESPONSE PROTOCOL

### Alert Received

```
SECOND 0: Alert fires in monitoring system
  ├─ PagerDuty sends notification
  ├─ Slack alert posted
  └─ SMS sent to phone

SECOND 5: On-call acknowledges
  ├─ Log alert in incident tracking
  ├─ Create incident ID
  ├─ Note timestamp
  └─ Begin investigation

MINUTE 1: Initial assessment
  ├─ Determine severity (P1/P2/P3/P4)
  ├─ Assess business impact
  ├─ Estimate users affected
  └─ Check if requires escalation

MINUTE 3: Preliminary response
  ├─ Gather diagnostic info
  ├─ Check recent changes
  ├─ Review relevant runbooks
  └─ Begin focused investigation

MINUTE 5: Escalate if needed
  ├─ Contact backup on-call
  ├─ Contact manager (if P1/P2)
  ├─ Update status page
  └─ Notify customers (if user-facing)

MINUTE 15: Status update
  ├─ Post status to Slack
  ├─ Update incident log
  ├─ Adjust estimated resolution time
  └─ Escalate if not progressing

ONGOING: Mitigation
  ├─ Implement fixes per runbooks
  ├─ Monitor effectiveness
  ├─ Adjust approach if not working
  └─ Keep team updated

RESOLUTION: Problem fixed
  ├─ Verify fix effective
  ├─ Monitor for 10 minutes
  ├─ Document resolution
  └─ Close incident

POST-INCIDENT: Lessons learned
  ├─ RCA within 24 hours
  ├─ Update runbooks/procedures
  ├─ Add tests to prevent regression
  └─ Share learnings with team
```

### Communication Template

**Initial Alert Acknowledged:**

```
🔴 INCIDENT: [ID]
⏰ Detected: [time]
📊 Severity: [P1/P2/P3]
🎯 Impact: [what's broken]
👤 Users affected: [estimate]
🚀 Status: INVESTIGATING
📝 Next update: [time +10 min]
```

**Under Investigation:**

```
🔴 INCIDENT: [ID]
⏰ Detected: [time], investigating for [X min]
📊 Severity: [P1/P2/P3]
🎯 Impact: [what's broken]
🔍 Findings so far:
  - [finding 1]
  - [finding 2]
  - [finding 3]
🚀 Status: INVESTIGATING / IMPLEMENTING FIX
📝 Next update: [time +10 min]
🆘 Escalation: [if needed]
```

**Fix Implemented:**

```
🟡 INCIDENT: [ID]
⏰ Detected: [X min ago]
📊 Severity: [P1/P2/P3]
🎯 Impact: [what's broken]
✅ Root cause: [what caused it]
🔧 Fix applied: [what was done]
📊 Result: [partial/full recovery]
🚀 Status: MONITORING / RESOLVED
📝 ETA full recovery: [time]
```

**Resolved:**

```
✅ INCIDENT: [ID] - RESOLVED
⏰ Duration: [X minutes]
📊 Severity: [P1/P2/P3]
✅ Root cause: [what caused it]
🔧 Resolution: [what fixed it]
🧪 Testing: [verification steps]
📋 RCA: Scheduled for [date/time]
```

---

## ESCALATION PROCESS

### When to Escalate

```
ESCALATE IMMEDIATELY if:
├─ P1 severity
├─ Unsure about severity
├─ Issue not improving after 10 min
├─ Stuck investigating after 20 min
├─ Requires access you don't have
├─ Requires code change to fix
├─ Customer communication needed
└─ Need additional expertise

ESCALATE if:
├─ P2 not resolved in 30 min
├─ P3 not investigated in 1 hour
├─ Issue requires multiple areas
├─ Unknown error or root cause
└─ Need approval for action
```

### Escalation Steps

**Level 1 → Level 2:**

```bash
#!/bin/bash
# scripts/escalate-to-level-2.sh

INCIDENT_ID=$1

echo "Escalating $INCIDENT_ID to Level 2..."

# 1. Document current state
mkdir -p /var/log/incidents/$INCIDENT_ID
docker-compose logs > /var/log/incidents/$INCIDENT_ID/docker-logs.txt
curl -s http://localhost:9090/api/v1/query?query=up | jq > /var/log/incidents/$INCIDENT_ID/metrics.json

# 2. Create handoff document
cat > /var/log/incidents/$INCIDENT_ID/level2-handoff.md << EOF
# Level 2 Escalation Handoff

**Incident ID:** $INCIDENT_ID
**Time:** $(date)
**Escalated by:** $USER

## Situation Summary
[What's wrong]

## Symptoms
[What users are seeing]

## Investigation Done
[Steps taken]
[What didn't work]

## Root Cause (if known)
[What we think is wrong]

## Next Steps
[What needs to happen]

## Logs and Diagnostics
- Docker logs: docker-logs.txt
- Metrics: metrics.json
- Database state: See attached SQL
EOF

# 3. Page Level 2 on-call
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-type: application/json' \
  -d '{
    "routing_key": "'$PAGERDUTY_ESCALATION_KEY'",
    "event_action": "trigger",
    "payload": {
      "summary": "Incident escalated to Level 2: '$INCIDENT_ID'",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "severity": "critical",
      "source": "On-Call Escalation"
    }
  }'

# 4. Notify in Slack
curl -X POST https://slack.com/api/chat.postMessage \
  -H 'Content-type: application/json' \
  -d '{
    "channel": "#incidents",
    "text": "Incident '$INCIDENT_ID' escalated to Level 2",
    "attachments": [{
      "color": "danger",
      "fields": [
        {"title": "Incident ID", "value": "'$INCIDENT_ID'", "short": true},
        {"title": "Escalated by", "value": "'$USER'", "short": true},
        {"title": "Handoff", "value": "See /var/log/incidents/'$INCIDENT_ID'/level2-handoff.md"}
      ]
    }]
  }'

echo "Level 2 escalation sent"
```

**Level 2 → Executive:**

```bash
#!/bin/bash
# Only for P1 CRITICAL or > 1 hour unresolved

# Page VP Engineering / Director
# Send executive summary
# Update C-suite if customer-impacting
```

---

## POST-ON-CALL HANDOFF

### Shift Transition

**Outgoing on-call (9:00-9:30 AM):**

```bash
# 1. Comprehensive system status
echo "=== OUTGOING ON-CALL STATUS REPORT ==="
echo "Date: $(date)"
echo ""

# All systems status
curl -s http://localhost:3000/health | jq
echo ""

# Incidents this week
ls -1 /var/log/incidents/ | wc -l | xargs echo "Incidents handled:"
echo ""

# Known issues
echo "Known ongoing issues:"
# List any
echo ""

# Helpful notes
echo "Tips for next on-call:"
cat /var/log/on-call-notes.txt
```

**Incoming on-call (9:00-9:30 AM):**

```bash
# 1. Review shift summary
cat /var/log/on-call-shift-$(date -d yesterday +%Y%m%d).md

# 2. Verify access still working
ssh ops@production

# 3. Check system health
curl http://localhost:3000/health | jq

# 4. Ask clarifying questions
# - Any alerts during shift?
# - Any underlying issues?
# - Recommendations?

# 5. Take over PagerDuty schedule
# - Update in PagerDuty UI
# - Verify notifications routing

# 6. Update Slack status
# - "On-call this week"
```

### Weekly Retrospective

**Every Monday (before new shift):**

```
RETROSPECTIVE AGENDA:

1. Review incidents from past week
   ├─ Each incident: severity, duration, resolution
   ├─ Patterns: Is something recurring?
   ├─ Trends: Getting better or worse?
   └─ Outliers: Unexpected incident?

2. Discuss runbook effectiveness
   ├─ What worked?
   ├─ What was missing?
   ├─ What needs improvement?
   └─ Assign improvements

3. Discuss on-call experience
   ├─ Any stress or burnout?
   ├─ Any training needs?
   ├─ Any tool improvements needed?
   └─ Any policy changes needed?

4. Update procedures
   ├─ Merge any runbook improvements
   ├─ Update decision trees
   ├─ Share learnings with team
   └─ Schedule training if needed

5. Plan next week
   ├─ Confirm on-call person
   ├─ Identify high-risk periods
   ├─ Plan coverage for vacations
   └─ Note planned maintenance windows
```

---

## TOOLS & ACCESS

### Required Access

```
PAGERDUTY:
├─ Role: On-call user
├─ Permissions: Can acknowledge/resolve incidents
├─ Schedule: Check if assigned
└─ Setup: Download mobile app, enable notifications

SLACK:
├─ Workspace: Prod operations
├─ Channels: #incidents, #alerts, #on-call
├─ Notifications: On (do not disturb OFF)
└─ Status: Set to "On-call"

AWS/CLOUD:
├─ IAM: ops-oncall role
├─ Permissions: Read-only + limited actions
├─ 2FA: Required
└─ Setup: Store credentials securely

SSH:
├─ Key: ~/.ssh/ops_key
├─ Hosts: ops@production
├─ Permissions: Full access
└─ Sudo: Passwordless for critical commands

DATABASE:
├─ psql user: orchestrator
├─ Password: In password manager
├─ Permissions: SELECT, UPDATE (limited)
└─ Backups: psql -U postgres -d postgres

DOCKER REGISTRY:
├─ Username: ops user
├─ Token: In .docker/config.json
└─ Permissions: Pull only (push requires approval)
```

### Essential Tools

```
LOCAL SETUP:
├─ kubectl: Cloud orchestration
├─ docker-compose: Local development
├─ psql: Database CLI
├─ redis-cli: Cache CLI
├─ jq: JSON parsing
├─ curl: HTTP requests
├─ nc/telnet: Network testing
└─ vim/nano: Log viewing

REMOTE TOOLS:
├─ ssh: Remote access
├─ scp: File transfer
└─ tmux/screen: Session management

MONITORING:
├─ Grafana: Dashboards
├─ Prometheus: Metrics
├─ ELK/DataDog: Log aggregation
└─ PagerDuty: Alert management

DOCUMENTATION:
├─ OPERATIONAL_RUNBOOKS.md (local copy)
├─ INCIDENT_RESPONSE_GUIDE.md (local copy)
├─ TROUBLESHOOTING_DECISION_TREE.md (printed)
└─ System architecture diagrams (printed)
```

### Setting Up Your Environment

```bash
# 1. Clone repository
git clone https://github.com/ORG/plugin-ai-agent-rabbitmq.git
cd plugin-ai-agent-rabbitmq

# 2. Create .env with credentials
cp .env.example .env
# Edit .env - add real credentials

# 3. Set up local docker compose (for reference)
docker-compose pull

# 4. Install CLI tools
npm install -g kubectl docker-compose

# 5. Configure AWS/cloud credentials
aws configure
gcloud auth login

# 6. Add SSH key
cp ops_key ~/.ssh/
chmod 600 ~/.ssh/ops_key

# 7. Test access
ssh ops@production "docker-compose ps"

# 8. Verify database access
psql -U orchestrator -d ai_agent_db -c "SELECT version();"

# 9. Create local runbook copies
mkdir -p ~/runbooks
cp OPERATIONAL_RUNBOOKS.md ~/runbooks/
cp INCIDENT_RESPONSE_GUIDE.md ~/runbooks/
cp TROUBLESHOOTING_DECISION_TREE.md ~/runbooks/

# 10. Print decision tree
lpr ~/runbooks/TROUBLESHOOTING_DECISION_TREE.md
```

---

## ON-CALL CULTURE

### Expectations

```
PROFESSIONAL EXPECTATIONS:
├─ Respond quickly to alerts (< 5 min for P1)
├─ Take ownership of incidents
├─ Communicate clearly and frequently
├─ Follow procedures and runbooks
├─ Escalate when appropriate
├─ Document what you do
├─ Stay calm under pressure
└─ Help others when needed

PERSONAL SUSTAINABILITY:
├─ Don't work through every incident alone
├─ Take breaks between incidents
├─ Sleep during quiet times
├─ Keep phone charged
├─ Eat regular meals
├─ Use PTO for recovery if needed
└─ Tell manager if overwhelmed

TEAM CULTURE:
├─ Support each other
├─ Share knowledge
├─ Respect sleep (don't escalate unnecessarily at night)
├─ Celebrate good responses
├─ Learn from mistakes
├─ Improve procedures continuously
└─ Make on-call sustainable
```

### Preventing Burnout

```
IF EXHAUSTED:
├─ Talk to manager
├─ Request backup for that shift
├─ Take recovery time after major incident
├─ Use vacation strategically
├─ Reduce on-call frequency temporarily
└─ Consider role adjustment

ON-CALL SCHEDULE DESIGN:
├─ 1 week at a time (not multiple weeks)
├─ 5-7 days off between shifts
├─ No more than 2-3 shifts per month
├─ Senior people help junior people
├─ Coverage during vacation/sick time
└─ Regular rotation (fair allocation)

INCIDENT SUPPORT:
├─ Major incident → Debrief with manager
├─ Escalation embarrassment → Coaching, not blame
├─ Long incident → Team support
├─ User complaint → No individual blame
└─ System failure → Process improvement
```

### Growth Through On-Call

```
SKILL DEVELOPMENT:
├─ Learn system architecture deeply
├─ Develop troubleshooting skills
├─ Improve under-pressure thinking
├─ Gain debugging experience
├─ Understand operational constraints
├─ Learn infrastructure skills
└─ Become more self-reliant

PROMOTION POTENTIAL:
├─ Demonstrates reliability
├─ Shows leadership under pressure
├─ Builds operational expertise
├─ Improves communication skills
├─ Shows commitment to product
└─ Builds team credibility

MENTORSHIP OPPORTUNITIES:
├─ Junior on-call paired with senior
├─ Senior reviews junior decisions
├─ Gradual responsibility increase
├─ Feedback on responses
├─ Guidance on escalations
└─ Knowledge transfer sessions
```

---

**On-Call Handbook Complete**

**Key Takeaways:**
- Respond fast, escalate early, document everything
- Follow runbooks, don't improvise
- Communicate clearly and frequently
- Take care of yourself
- Help others succeed
- Continuously improve procedures

**First On-Call?**
1. Review all training materials
2. Shadow experienced on-call
3. Practice with test alerts
4. Review decision trees
5. Know your escalation contacts
6. Get good sleep before shift
7. Keep phone charged
8. Stay focused and calm

---

**Document Version:** 1.0
**Last Updated:** November 18, 2025
**Approval:** Engineering Manager
**Status:** APPROVED FOR PRODUCTION
