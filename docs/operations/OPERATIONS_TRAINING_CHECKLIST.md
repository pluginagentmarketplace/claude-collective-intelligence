# OPERATIONS TRAINING COMPLETION CHECKLIST
## AI Agent Orchestrator with RabbitMQ - Production Ready Training Program

**Last Updated:** November 18, 2025
**Version:** 1.0.0
**Completion Target:** 8-10 hours
**Status:** APPROVED FOR PRODUCTION

---

## DOCUMENTATION OVERVIEW

### Core Documents You'll Study

```
📚 OPERATIONAL_RUNBOOKS.md (100+ pages)
   └─ Daily, weekly, monthly operations procedures
   └─ Emergency procedures for all scenarios
   └─ Common issues with solutions
   └─ Quick reference commands

📚 INCIDENT_RESPONSE_GUIDE.md (50+ pages)
   └─ 20+ real-world incident scenarios
   └─ Step-by-step response procedures
   └─ Root cause analysis process
   └─ Prevention strategies

📚 SYSTEM_ARCHITECTURE_TRAINING.md (40 pages)
   └─ How the system is built
   └─ Component responsibilities
   └─ Data flow and message processing
   └─ Security architecture

📚 TROUBLESHOOTING_DECISION_TREE.md (30 pages)
   └─ Visual decision trees
   └─ What to check for each symptom
   └─ Quick diagnostic commands
   └─ Where to escalate

📚 ON_CALL_PROCEDURES.md (25 pages)
   └─ On-call schedule and expectations
   └─ Pre-on-call preparation
   └─ Incident response protocol
   └─ Tools and access setup
```

---

## TRAINING PATH (Choose One)

### FAST TRACK (4-5 hours) - For Experienced SREs
**Target:** People with RabbitMQ or distributed systems experience

**Week 1:**

```
DAY 1 (Monday):
  ☐ Read SYSTEM_ARCHITECTURE_TRAINING.md (1.5 hours)
  ☐ Review architecture overview and components
  ☐ Understand message flow
  ☐ Complete Exercise 1-2 (1 hour)

DAY 2 (Tuesday):
  ☐ Read TROUBLESHOOTING_DECISION_TREE.md (1 hour)
  ☐ Print and review decision trees
  ☐ Complete Exercise 3-4 (1 hour)

DAY 3 (Wednesday):
  ☐ Read OPERATIONAL_RUNBOOKS.md sections 1-4 (1.5 hours)
  ☐ Review daily, weekly, monthly procedures
  ☐ Review emergency procedures
  ☐ Complete Exercise 5 (1 hour)

DAY 4 (Thursday):
  ☐ Skim INCIDENT_RESPONSE_GUIDE.md (1 hour)
  ☐ Focus on your role-relevant scenarios
  ☐ Review escalation procedures

DAY 5 (Friday):
  ☐ Read ON_CALL_PROCEDURES.md (1 hour)
  ☐ Complete access setup
  ☐ Shadow current on-call engineer (4 hours)
```

**Ready for:** Support rotation, escalation backup

---

### STANDARD TRACK (6-8 hours) - For New Team Members
**Target:** Engineers new to operations or this system

**Week 1-2:**

```
PART 1: UNDERSTANDING THE SYSTEM
DAY 1 (Monday): Architecture Foundations (2 hours)
  ☐ Read SYSTEM_ARCHITECTURE_TRAINING.md section 1-3
  ☐ Review system components
  ☐ Understand message processing flow
  ☐ Notes: [write down 5 key concepts]

DAY 2 (Tuesday): Hands-On Exploration (2 hours)
  ☐ Complete Exercise 1: Submit and track task
  ☐ Complete Exercise 2: Monitor agent activity
  ☐ Complete Exercise 3: Inspect message flow
  ☐ Document: [what you learned]

DAY 3 (Wednesday): Infrastructure & Operations (2 hours)
  ☐ Read SYSTEM_ARCHITECTURE_TRAINING.md section 4-5
  ☐ Complete Exercise 4: Query database
  ☐ Complete Exercise 5: Check metrics dashboard
  ☐ Familiarize: All dashboards and metrics

PART 2: OPERATIONAL READINESS
DAY 4 (Thursday): Daily Operations (1.5 hours)
  ☐ Read OPERATIONAL_RUNBOOKS.md sections 1-4
  ☐ Review daily/weekly/monthly procedures
  ☐ Review emergency procedures
  ☐ Ask: Where am I uncertain?

DAY 5 (Friday): Troubleshooting (1.5 hours)
  ☐ Read TROUBLESHOOTING_DECISION_TREE.md
  ☐ Print decision trees
  ☐ Practice: Diagnose 3 sample scenarios
  ☐ Verify: Understand all pathways

PART 3: INCIDENT READINESS
DAY 8 (Monday): Incident Response (2 hours)
  ☐ Read INCIDENT_RESPONSE_GUIDE.md scenarios 1-10
  ☐ Understand escalation procedures
  ☐ Review post-incident process
  ☐ Study: RCA framework

DAY 9 (Tuesday): On-Call Preparation (1.5 hours)
  ☐ Read ON_CALL_PROCEDURES.md
  ☐ Complete access setup
  ☐ Set up tools and environment
  ☐ Test: Can you access everything?

DAY 10 (Wednesday): Shadow & Practice (4 hours)
  ☐ Shadow current on-call engineer
  ☐ Run through practice scenarios
  ☐ Ask questions
  ☐ Observe: Real incident response (if available)
```

**Ready for:** Full on-call rotation, with senior backup

---

### COMPREHENSIVE TRACK (10+ hours) - For On-Call Leads
**Target:** Engineers becoming on-call managers or senior responders

**Week 1-3:**

```
PART 1: DEEP ARCHITECTURE STUDY (4 hours)
  ☐ Complete STANDARD TRACK Part 1 (4 hours)
  ☐ Add: Deep dive into security architecture
  ☐ Add: Performance optimization details
  ☐ Add: Capacity planning considerations

PART 2: FULL OPERATIONAL MASTERY (4 hours)
  ☐ Read OPERATIONAL_RUNBOOKS.md entirely (2 hours)
  ☐ Review ALL daily/weekly/monthly procedures
  ☐ Review ALL emergency procedures
  ☐ Study: Backup and recovery procedures
  ☐ Create: Your own runbook for common scenarios

PART 3: INCIDENT MASTERY (4 hours)
  ☐ Read INCIDENT_RESPONSE_GUIDE.md entirely (2 hours)
  ☐ Study: All 20+ scenarios
  ☐ Study: RCA and prevention
  ☐ Practice: Lead response simulation
  ☐ Prepare: Escalation guidelines
  ☐ Develop: Prioritization framework

PART 4: ON-CALL LEADERSHIP (3 hours)
  ☐ Read ON_CALL_PROCEDURES.md entirely (1 hour)
  ☐ Develop: On-call team management approach
  ☐ Create: Mentoring plans for junior on-calls
  ☐ Review: On-call culture and sustainability
  ☐ Plan: Continuous improvement for procedures
  ☐ Shadow: Escalation manager (2 hours)

PART 5: ADVANCED TOPICS (3+ hours)
  ☐ Study: System performance tuning
  ☐ Study: Database optimization
  ☐ Study: Monitoring system enhancement
  ☐ Study: Disaster recovery procedures
  ☐ Develop: Custom monitoring alerts
  ☐ Create: Automation for common responses

PART 6: FINAL VALIDATION (2 hours)
  ☐ Lead full incident simulation
  ☐ Lead RCA for past incident
  ☐ Review all procedures with manager
  ☐ Demonstrate: Full on-call capability
```

**Ready for:** On-call lead role, manager support, escalations

---

## WEEK-BY-WEEK SCHEDULE

### Week 1: Foundations

```
MONDAY (Starting Day):
Morning:
  ☐ Receive access credentials & get help setting up
  ☐ Read SYSTEM_ARCHITECTURE_TRAINING.md (Part 1)
  ☐ Understand system overview and components
  ☐ Ask questions about what you don't understand
  ⏱️  Time: 2 hours
  💡 Goal: Understand what the system does

Afternoon:
  ☐ Complete Exercise 1: Submit and track a task
  ☐ Complete Exercise 2: Monitor agent activity
  ☐ Try submitting 5 different types of tasks
  ☐ Watch them progress through the system
  ⏱️  Time: 1.5 hours
  💡 Goal: See the system in action

TUESDAY:
Morning:
  ☐ Read SYSTEM_ARCHITECTURE_TRAINING.md (Part 2)
  ☐ Study message broker and agent processors
  ☐ Understand RabbitMQ queue topology
  ☐ Review data model in PostgreSQL
  ⏱️  Time: 1.5 hours

Afternoon:
  ☐ Complete Exercise 3: Inspect message flow
  ☐ Complete Exercise 4: Query database directly
  ☐ Observe: How data flows through system
  ☐ Get hands-on with actual data
  ⏱️  Time: 2 hours
  💡 Goal: Connect concepts to real data

WEDNESDAY:
Morning:
  ☐ Read SYSTEM_ARCHITECTURE_TRAINING.md (Part 3-4)
  ☐ Understand infrastructure & networking
  ☐ Review health checks and monitoring
  ☐ Learn about deployment pipeline
  ⏱️  Time: 1.5 hours

Afternoon:
  ☐ Complete Exercise 5: Check metrics dashboard
  ☐ Explore all Grafana dashboards
  ☐ Learn what each metric means
  ☐ Understand how to read graphs
  ⏱️  Time: 1.5 hours
  💡 Goal: Become comfortable with monitoring

THURSDAY:
Morning:
  ☐ Read TROUBLESHOOTING_DECISION_TREE.md
  ☐ Print physical copy
  ☐ Understand decision tree structure
  ☐ Practice navigating trees
  ⏱️  Time: 1.5 hours

Afternoon:
  ☐ Practice 3 sample scenarios
  ☐ Try decision tree walkthrough
  ☐ Verify you understand each path
  ☐ Ask for clarification on confusing parts
  ⏱️  Time: 1.5 hours
  💡 Goal: Comfortable with troubleshooting approach

FRIDAY:
Morning:
  ☐ Read OPERATIONAL_RUNBOOKS.md sections 1-3
  ☐ Daily operations procedures
  ☐ Weekly maintenance tasks
  ☐ Monthly operations
  ⏱️  Time: 2 hours

Afternoon:
  ☐ Review emergency procedures
  ☐ Review common issues & solutions
  ☐ Read quick reference commands
  ☐ Create your own quick reference card
  ⏱️  Time: 1.5 hours
  💡 Goal: Understand operational procedures

END OF WEEK 1 CHECKLIST:
  ☑️ Understanding of system architecture
  ☑️ Hands-on experience with system
  ☑️ Comfort navigating databases and dashboards
  ☑️ Understanding of operations procedures
  ☑️ Familiarity with troubleshooting approach
```

### Week 2: Incident Response

```
MONDAY:
Morning:
  ☐ Read INCIDENT_RESPONSE_GUIDE.md overview
  ☐ Understand severity classification
  ☐ Review quick incident response steps
  ⏱️  Time: 1 hour

Afternoon:
  ☐ Read Scenarios 1-5
  ☐ Study response procedures
  ☐ Note: Key diagnostic steps
  ☐ Question: When would each scenario occur?
  ⏱️  Time: 2 hours
  💡 Goal: Understand critical scenarios

TUESDAY:
Morning:
  ☐ Read Scenarios 6-10
  ☐ Study response procedures
  ☐ Note: Escalation triggers
  ⏱️  Time: 2 hours

Afternoon:
  ☐ Read Scenarios 11-15
  ☐ Study response procedures
  ⏱️  Time: 1 hour
  💡 Goal: Coverage of all major scenarios

WEDNESDAY:
Morning:
  ☐ Read Scenarios 16-20+
  ☐ Study POST-INCIDENT procedures
  ☐ Review RCA & prevention
  ⏱️  Time: 2 hours

Afternoon:
  ☐ Review entire incident response guide
  ☐ Highlight key sections
  ☐ Create summary notes
  ⏱️  Time: 1 hour
  💡 Goal: Full incident response capability

THURSDAY:
Morning:
  ☐ Read ON_CALL_PROCEDURES.md sections 1-3
  ☐ Pre-on-call preparation
  ☐ During on-call expectations
  ⏱️  Time: 1.5 hours

Afternoon:
  ☐ Read ON_CALL_PROCEDURES.md sections 4-8
  ☐ Incident response protocol
  ☐ Escalation process
  ☐ Tools & access
  ⏱️  Time: 1.5 hours
  💡 Goal: Ready for on-call shifts

FRIDAY:
All Day:
  ☐ Shadow current on-call engineer (4+ hours)
  ☐ Observe: Real incident response
  ☐ Ask: Questions about procedures
  ☐ Learn: Practical tips and tricks
  ☐ Practice: Run through scenarios
  ⏱️  Time: 4+ hours
  💡 Goal: See it all in action

END OF WEEK 2 CHECKLIST:
  ☑️ Understand all major incident scenarios
  ☑️ Know escalation procedures
  ☑️ Comfortable with incident response steps
  ☑️ Observed real incidents (or simulations)
  ☑️ Ready for first on-call shift
```

### Week 3: Preparation for First On-Call

```
MONDAY-FRIDAY:
  ☐ One-on-one sessions with manager
  ☐ Q&A about procedures
  ☐ Setup access and credentials
  ☐ Configure tools and environment
  ☐ Practice scenarios
  ☐ Final validation

FRIDAY AFTERNOON:
  ☐ Handoff from previous on-call
  ☐ System status walkthrough
  ☐ Known issues discussion
  ☐ Escalation contacts verification

READY FOR: First on-call rotation starting NEXT WEEK
```

---

## HANDS-ON EXERCISES COMPLETION LOG

### Exercise 1: Submit and Track Task

**Objective:** Understand task submission flow

**Duration:** 30 minutes

```bash
☐ Successfully authenticated
  └─ Token received: _______________

☐ Submitted task successfully
  └─ Task ID: _______________

☐ Tracked task status progression
  └─ Initial status: queued
  └─ Final status: completed

☐ Retrieved task result
  └─ Result type: _____________

☐ Understood flow:
  API → Queue → Agent → Database → Cache → Client

✓ EXERCISE PASSED: _____ date
Instructor: _______________
```

---

### Exercise 2: Monitor Agent Activity

**Objective:** Understand agent metrics and status

**Duration:** 20 minutes

```bash
☐ Retrieved agent list
  └─ Total agents: _____

☐ Identified agent types
  └─ Brainstorm agents: _____
  └─ Worker agents: _____
  └─ Aggregator agents: _____

☐ Reviewed agent metrics
  └─ Active agents: _____
  └─ Inactive agents: _____

☐ Checked RabbitMQ queue depths
  └─ brainstorm_tasks: _____
  └─ task_distribution: _____
  └─ results: _____

✓ EXERCISE PASSED: _____ date
Instructor: _______________
```

---

### Exercise 3: Inspect Message Flow

**Objective:** Understand RabbitMQ message routing

**Duration:** 25 minutes

```bash
☐ Listed exchanges
  └─ Number of exchanges: _____

☐ Listed queues
  └─ Total queues: _____
  └─ Queue with most messages: _____

☐ Understood bindings
  └─ Binding from: _________ to _________

☐ Published test message
  └─ Message accepted: YES / NO

☐ Verified message in queue
  └─ Message count increased: YES / NO

✓ EXERCISE PASSED: _____ date
Instructor: _______________
```

---

### Exercise 4: Query Database

**Objective:** Understand data model and SQL queries

**Duration:** 20 minutes

```bash
☐ Connected to PostgreSQL
  └─ Database: ai_agent_db
  └─ User: orchestrator

☐ Viewed task submissions
  └─ Recent tasks count: _____

☐ Analyzed task results
  └─ Completed tasks: _____
  └─ Failed tasks: _____

☐ Checked agent status
  └─ Active agents: _____

☐ Ran performance analysis
  └─ Average task time: _____ ms
  └─ Total tasks processed: _____

✓ EXERCISE PASSED: _____ date
Instructor: _______________
```

---

### Exercise 5: Check Metrics Dashboard

**Objective:** Learn to interpret monitoring dashboards

**Duration:** 30 minutes

```bash
☐ Opened Grafana
  └─ URL: http://localhost:3001
  └─ Logged in: YES / NO

☐ Reviewed System Dashboard
  └─ Current CPU: _____%
  └─ Current Memory: _____%
  └─ Current Disk: _____%

☐ Reviewed Agent Dashboard
  └─ Active agents: _____
  └─ Tasks being processed: _____

☐ Reviewed Performance Dashboard
  └─ API latency: _____ ms
  └─ Database query time: _____ ms

☐ Interpreted trends
  └─ CPU trend: increasing / stable / decreasing
  └─ Error rate trend: _____________

☐ Identified anomalies
  └─ Anything unusual? _______________

✓ EXERCISE PASSED: _____ date
Instructor: _______________
```

---

## KNOWLEDGE ASSESSMENT

### Self-Assessment (Complete Honestly)

**Part 1: System Knowledge**

Rate your confidence (1-5): 1=No idea, 5=Expert

```
☐ System architecture: _____
☐ Component responsibilities: _____
☐ Message flow: _____
☐ Data model: _____
☐ RabbitMQ queue topology: _____
☐ PostgreSQL schema: _____
☐ Redis caching strategy: _____
☐ Monitoring and metrics: _____

Average score: _____ (target: 4+)
```

**Part 2: Operations Knowledge**

```
☐ Daily operations procedures: _____
☐ Weekly maintenance tasks: _____
☐ Emergency procedures: _____
☐ Health check procedures: _____
☐ Troubleshooting approach: _____
☐ Backup and recovery: _____
☐ Performance optimization: _____
☐ Security procedures: _____

Average score: _____ (target: 4+)
```

**Part 3: Incident Response**

```
☐ Severity classification: _____
☐ Incident response procedures: _____
☐ Escalation process: _____
☐ Decision trees: _____
☐ RCA process: _____
☐ Communication templates: _____
☐ Post-incident procedures: _____

Average score: _____ (target: 4+)
```

**Part 4: On-Call Readiness**

```
☐ On-call expectations: _____
☐ Response time targets: _____
☐ Escalation contacts: _____
☐ Tool access: _____
☐ Procedure documentation access: _____
☐ Communication protocol: _____
☐ Shift handoff process: _____

Average score: _____ (target: 4.5+)
```

---

## FINAL VALIDATION

### Scenario-Based Assessment

**Scenario 1: Application is down (P1)**

Instructions: Without looking at notes, describe what you would do in the first 5 minutes.

```
Your response:
_________________________________________________________
_________________________________________________________
_________________________________________________________

Expected actions:
 ☐ Acknowledge alert immediately
 ☐ Create incident ID
 ☐ Page team lead
 ☐ Check application status
 ☐ Review recent changes
 ☐ Check logs for error message
 ☐ Attempt restart
 ☐ Escalate if not fixed in 5 min

Score: _____ / 8
Feedback: ___________________
```

**Scenario 2: High error rate (P2)**

Instructions: Describe your troubleshooting approach.

```
Your response:
_________________________________________________________
_________________________________________________________

Expected approach:
 ☐ Quantify error rate
 ☐ Identify error types
 ☐ Correlate with infrastructure metrics
 ☐ Review recent changes
 ☐ Check affected services
 ☐ Check database/RabbitMQ
 ☐ Implement mitigation
 ☐ Monitor recovery

Score: _____ / 8
Feedback: ___________________
```

**Scenario 3: Tasks not processing (P2)**

Instructions: Walk through decision tree steps.

```
Your response:
_________________________________________________________
_________________________________________________________

Expected steps:
 ☐ Check queue depth
 ☐ Check consumer count
 ☐ Check agent status
 ☐ Review logs for errors
 ☐ Check RabbitMQ connectivity
 ☐ Restart agents if needed
 ☐ Monitor recovery
 ☐ Escalate if not fixed

Score: _____ / 8
Feedback: ___________________
```

**Overall Scenario Score: _____ / 24**

(Target: 18+ = Ready for on-call, <18 = Need more training)

---

## FINAL SIGN-OFF

### Manager Verification

```
I have verified that _____________________ has completed training for
the AI Agent Orchestrator system and is ready to join the on-call rotation.

Learning demonstrated:
 ☑️ System architecture understanding
 ☑️ Operational procedures mastery
 ☑️ Incident response capability
 ☑️ Decision tree navigation
 ☑️ Tool access and setup
 ☑️ Scenario response skills
 ☑️ Escalation understanding
 ☑️ On-call readiness

First on-call shift: _____________________ (date)

Areas for continued growth: _________________________________
_________________________________________________________

Manager name: _____________________
Manager signature: _____________________ Date: _____

---

### Trainee Sign-Off

I confirm that I have completed the training program for the AI Agent
Orchestrator system and feel confident in my ability to respond to incidents.

I understand:
 ☑️ System architecture and components
 ☑️ Operational procedures
 ☑️ Incident response protocol
 ☑️ When and how to escalate
 ☑️ Tools and access requirements
 ☑️ On-call expectations
 ☑️ Where to find documentation

Trainee name: _____________________
Trainee signature: _____________________ Date: _____

Ready for: ☑️ On-call rotation
           ☑️ Support escalation
           ☑️ Operational tasks

---

### Team Lead Verification

I have shadowed/reviewed this trainee and confirm readiness for
on-call duties with the following notes:

Strengths: _______________________________________________
Areas to watch: __________________________________________
Recommended backup: __________________ (initial shift)

Team lead: _____________________ Date: _____
```

---

## ONGOING LEARNING

### Monthly Review

```
Each month, complete this review:

☐ Re-read 1 section from OPERATIONAL_RUNBOOKS.md
☐ Review 5 scenarios from INCIDENT_RESPONSE_GUIDE.md
☐ Complete 1 practice scenario walkthrough
☐ Attend monthly retrospective
☐ Review any new incidents
☐ Document any procedure improvements
```

### Quarterly Deep Dive

```
Each quarter (3 months):

☐ Full systems architecture review
☐ Review all incidents from quarter
☐ Practice full RCA of historical incident
☐ Update procedures based on learnings
☐ Mentor junior team member
```

### Annual Certification

```
Once per year:

☐ Complete full training assessment
☐ Lead incident simulation
☐ Present on system architecture
☐ Review and update all procedures
☐ Evaluate on-call performance
☐ Plan professional development
```

---

## CONTINUOUS IMPROVEMENT

### Share Your Learnings

```
Found something unclear in documentation?
  → Submit a PR with improvements

Encountered unexpected issue?
  → Document the scenario
  → Add to incident guide if relevant
  → Share learnings with team

Have an idea for improvement?
  → Document it
  → Discuss with team
  → Implement and test

Better procedure or runbook?
  → Update documentation
  → Get peer review
  → Share in team meeting
```

---

**Training Complete!**

**You are now qualified for on-call duties.**

**Remember:**
- Follow the runbooks and procedures
- Don't hesitate to escalate
- Communicate clearly and frequently
- Take care of yourself
- Help your teammates
- Continuously improve the system

**Questions? Contact:**
- Technical: Your team lead
- On-call: On-call manager
- System: Architecture owner
- Procedures: Operations team

**Welcome to the team!**

---

**Document Version:** 1.0
**Last Updated:** November 18, 2025
**Status:** APPROVED FOR TRAINING
