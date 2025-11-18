# TROUBLESHOOTING DECISION TREE
## AI Agent Orchestrator - Visual Troubleshooting Guide

**Last Updated:** November 18, 2025
**Version:** 1.0.0
**Purpose:** Quick visual decision tree for diagnosing common issues

---

## QUICK START: 30-SECOND HEALTH CHECK

```
Run these 4 commands:

1. curl http://localhost:3000/health
   Expected: HTTP 200 with {"status":"operational"}

2. docker-compose ps
   Expected: All services "Up"

3. curl -u guest:guest http://localhost:15672/api/overview
   Expected: HTTP 200 with queue statistics

4. psql -U orchestrator -d ai_agent_db -c "SELECT 1;"
   Expected: Output "1"

If ALL 4 pass → System healthy, move to specific issue
If ANY fail → Follow tree below
```

---

## MAIN DECISION TREE

```
START
  │
  ├─ "Users report system down / Can't access API?"
  │   └─► Go to: [TREE 1: API Unavailability]
  │
  ├─ "Tasks being submitted but not processing?"
  │   └─► Go to: [TREE 2: Task Processing Stalled]
  │
  ├─ "Error rate spike / Many errors in logs?"
  │   └─► Go to: [TREE 3: High Error Rate]
  │
  ├─ "System is slow / High latency?"
  │   └─► Go to: [TREE 4: Performance Issues]
  │
  ├─ "Database issues / Can't connect to DB?"
  │   └─► Go to: [TREE 5: Database Problems]
  │
  ├─ "RabbitMQ issues / Queue problems?"
  │   └─► Go to: [TREE 6: Message Broker Issues]
  │
  ├─ "Disk/Memory/CPU issues?"
  │   └─► Go to: [TREE 7: Resource Exhaustion]
  │
  ├─ "Users seeing inconsistent/stale data?"
  │   └─► Go to: [TREE 8: Data Consistency]
  │
  ├─ "Agent not responding?"
  │   └─► Go to: [TREE 9: Agent Issues]
  │
  └─ "Unsure what's wrong?"
      └─► Go to: [TREE 0: Information Gathering]
```

---

## TREE 0: INFORMATION GATHERING

**Purpose:** Understand the problem before diving in

```
Question: What is the user experiencing?
├─ "Page won't load" → API Problem
├─ "API returns errors" → Application Problem
├─ "App running but no results" → Processing Problem
├─ "Seeing wrong/old data" → Data Problem
└─ "System is slow" → Performance Problem

Question: How long has this been happening?
├─ < 5 minutes → Recent change/deployment
├─ 5-30 minutes → Possible resource issue
├─ 30+ minutes → Degradation or cascade failure
└─ Intermittent → Concurrency or timing issue

Question: How many users affected?
├─ 1-10% → Isolated issue, check user/resource specific
├─ 10-50% → Partial system failure
├─ 50%+ → Critical system failure
└─ ALL → Total system outage

Question: When did it start?
├─ Just after deployment → Rollback suspected change
├─ During business hours → Check traffic spike
├─ During maintenance window → Check maintenance task
└─ Random time → Check infrastructure metrics
```

---

## TREE 1: API UNAVAILABILITY

```
"Is the API responding at all?"
│
├─ YES, but with errors
│   └─► Go to: TREE 3 (Error Rate)
│
└─ NO response / Connection refused
    │
    "Check if Docker container is running:"
    │  docker-compose ps orchestrator
    │
    ├─ Status is NOT "Up"
    │   │
    │   "Container exited, check logs:"
    │   │  docker-compose logs orchestrator | head -50
    │   │
    │   ├─ Shows "out of memory" / "killed"
    │   │   └─► SOLUTION: Free disk/memory, see TREE 7
    │   │
    │   ├─ Shows "port already in use"
    │   │   └─► SOLUTION:
    │   │       lsof -i :3000
    │   │       kill -9 <PID>
    │   │       docker-compose restart orchestrator
    │   │
    │   ├─ Shows "cannot connect to RabbitMQ"
    │   │   └─► SOLUTION: Check RabbitMQ, see TREE 6
    │   │
    │   ├─ Shows "cannot connect to database"
    │   │   └─► SOLUTION: Check DB, see TREE 5
    │   │
    │   └─ Shows other error
    │       └─► SOLUTION:
    │           1. Check error message specifically
    │           2. Search INCIDENT_RESPONSE_GUIDE.md
    │           3. Escalate if unclear
    │
    └─ Status is "Up"
        │
        "Check if port 3000 is listening:"
        │  netstat -tlnp | grep 3000
        │  nc -zv localhost 3000
        │
        ├─ Port NOT listening
        │   └─► Application started but hung
        │       SOLUTION:
        │       1. docker-compose restart orchestrator
        │       2. Check logs for hang/deadlock
        │       3. Check database connections
        │
        ├─ Port listening but no response
        │   └─► Check application health endpoint
        │       curl -v http://localhost:3000/health
        │
        │       ├─ Timeout
        │       │   └─► Application hung/deadlocked
        │       │       SOLUTION:
        │       │       1. Kill and restart: docker-compose restart orchestrator
        │       │       2. Check for database lock
        │       │       3. Check for infinite loop
        │       │
        │       └─ Connection refused
        │           └─► Application crashed between start and now
        │               SOLUTION:
        │               docker-compose restart orchestrator
        │               tail -100 /var/log/orchestrator.log
        │
        └─ Port listening, health returns error
            └─► Check health status response
                curl -s http://localhost:3000/health | jq

                ├─ Shows database down
                │   └─► Go to TREE 5
                │
                ├─ Shows RabbitMQ down
                │   └─► Go to TREE 6
                │
                └─ Shows other service down
                    └─► Check that specific service
```

---

## TREE 2: TASK PROCESSING STALLED

```
"Are new tasks being added to the system?"
│
├─ NO
│   └─► Users aren't submitting tasks
│       SOLUTION: Check API is working (TREE 1)
│
└─ YES, but not being processed
    │
    "Check RabbitMQ queue depth:"
    │  curl -u guest:guest http://localhost:15672/api/overview | jq '.queue_totals'
    │
    ├─ Queue depth = 0
    │   └─► Tasks completed immediately
    │       SOLUTION: Check database for results
    │       psql -c "SELECT COUNT(*) FROM task_results WHERE created_at > NOW() - INTERVAL '1 hour';"
    │
    │       ├─ 0 results found
    │       │   └─► No agents processing
    │       │       SOLUTION: Check agent status (TREE 9)
    │       │
    │       └─ Results found
    │           └─► System is working
    │               SOLUTION: User perception mismatch or timing issue
    │
    └─ Queue depth > 0 (messages accumulating)
        │
        "Are agents consuming messages?"
        │  curl -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name, consumers}'
        │
        ├─ consumers = 0 for all queues
        │   └─► No agents listening
        │       SOLUTION:
        │       1. Check agent status: curl http://localhost:3000/api/agents
        │       2. If 0 agents: Restart agents
        │           docker-compose up -d agent-brainstorm agent-worker
        │       3. If agents exist but consumers=0: Restart agents
        │           docker-compose restart orchestrator
        │
        └─ consumers > 0 but queue growing
            │
            "Check agent logs:"
            │  docker-compose logs orchestrator | grep "ERROR" | head -20
            │
            ├─ Shows processing errors
            │   └─► Agents crashing or failing
            │       SOLUTION: Fix application error (TREE 3)
            │
            ├─ Shows timeout errors
            │   └─► Messages taking too long to process
            │       SOLUTION:
            │       1. Check if system is slow (TREE 4)
            │       2. Check if database is slow
            │       3. Consider scaling more agents
            │
            ├─ Shows "no error" but queue not draining
            │   └─► Agents very slow or stuck
            │       SOLUTION:
            │       1. Check processing time:
            │           curl http://localhost:9090/api/v1/query?query=task_processing_duration_seconds
            │       2. If time increased 5x: System overloaded
            │           SOLUTION: TREE 4 (Performance)
            │       3. If same but queue backing up: Scale agents
            │           docker-compose up -d --scale agent-worker=5
            │
            └─ No errors visible
                └─► Check unacked messages:
                    curl -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name, messages_unacked}'

                    ├─ messages_unacked high
                    │   └─► Agents processing but slow to complete
                    │       SOLUTION: Increase prefetch size or scale agents
                    │
                    └─ messages_unacked low
                        └─► Messages being acked but not stored
                            SOLUTION: Check database (TREE 5)
```

---

## TREE 3: HIGH ERROR RATE

```
"How high is the error rate?"
│
├─ Slightly elevated (0.5% - 2%)
│   └─► Transient issue, monitor closely
│       Check if still increasing
│       └─ YES: Go to escalation
│       └─ NO: May auto-recover
│
└─ Critical (>2% or >20/min)
    │
    "What type of errors?"
    │  docker-compose logs --since 10m orchestrator | grep "ERROR" | head -30
    │
    ├─ Database connection errors
    │   └─► SOLUTION: Go to TREE 5 (Database)
    │
    ├─ RabbitMQ connection errors
    │   └─► SOLUTION: Go to TREE 6 (Message Broker)
    │
    ├─ Timeout errors
    │   └─► SOLUTION: System slow, Go to TREE 4 (Performance)
    │
    ├─ Out of memory / Resource errors
    │   └─► SOLUTION: Go to TREE 7 (Resources)
    │
    ├─ Validation errors (400 Bad Request)
    │   └─► SOLUTION:
    │       1. Check recent API changes
    │       2. Verify request format
    │       3. Review application logic
    │
    ├─ Authorization errors (403 Forbidden)
    │   └─► SOLUTION:
    │       1. Check JWT tokens valid
    │       2. Check user permissions
    │       3. Check token expiration
    │
    ├─ Not found errors (404)
    │   └─► SOLUTION:
    │       1. Check resource exists
    │       2. Verify API routes
    │       3. Check if resources deleted
    │
    └─ Application errors (500 Internal Server Error)
        │
        "Check error details:"
        │  docker-compose logs orchestrator | grep "500" -A 5
        │
        ├─ Shows database error
        │   └─► TREE 5
        │
        ├─ Shows unhandled exception
        │   └─► Need code fix
        │       SOLUTION:
        │       1. Identify code path
        │       2. Add error handling
        │       3. Deploy fix
        │       4. Temporary: Rollback change causing issue
        │
        ├─ Shows assertion error
        │   └─► Code bug
        │       SOLUTION:
        │       1. Identify assertion
        │       2. Fix code
        │       3. Deploy
        │
        └─ Error message unclear
            └─► SOLUTION:
                1. Check full stack trace in logs
                2. Check application code for error source
                3. Escalate if unclear
```

---

## TREE 4: PERFORMANCE ISSUES / HIGH LATENCY

```
"What is baseline latency?"
│
├─ Normally < 100ms, now > 500ms
│   └─► 5x slowdown, investigate immediately
│
├─ Normally < 1s, now > 5s
│   └─► 5x slowdown, investigate immediately
│
└─ Gradually increasing over hours
    └─► Possible memory leak or resource leak

"Check system resources:"
│
├─ CPU high (>80%)
│   │
│   ├─ One container high?
│   │   └─► Check application CPU usage
│   │       docker stats --no-stream orchestrator
│   │       (look at CPU %)
│   │
│   │       ├─ Node process: Infinite loop or busy wait
│   │       │   SOLUTION:
│   │       │   1. Check logs for loop errors
│   │       │   2. Check for CPU-intensive operation
│   │       │   3. May need code fix
│   │       │   4. Temporary: Restart and scale
│   │       │
│   │       └─ Database CPU high
│   │           SOLUTION: TREE 5
│   │
│   └─ All containers high?
│       └─► System overloaded
│           SOLUTION:
│           1. Check load: uptime
│           2. Check if traffic spike
│           3. Scale workers horizontally
│
├─ Memory high (>80% of limit)
│   │
│   ├─ Growing continuously (leak)
│   │   └─► SOLUTION:
│   │       1. Check OPERATIONAL_RUNBOOKS.md SCENARIO 10
│   │       2. Get heap dump
│   │       3. Need code fix
│   │       4. Temporary: Restart container
│   │
│   └─ Steady at high level
│       └─► Not enough memory for workload
│           SOLUTION:
│           1. Increase container memory limit
│           2. Optimize memory usage in code
│           3. Reduce working set
│
├─ Disk I/O high
│   │
│   ├─ Read I/O high
│   │   └─► Many disk reads
│   │       SOLUTION:
│   │       1. Check database queries slow
│   │       2. Check cache hit rate
│   │       3. Check if sequential scan vs index
│   │
│   └─ Write I/O high
│       └─► Many disk writes
│           SOLUTION:
│           1. Check logging level (too verbose)
│           2. Check database INSERTS/UPDATES high
│           3. Check checkpoint frequency
│
└─ Resources normal
    │
    "Check database query performance:"
    │  psql -U orchestrator -d ai_agent_db
    │  SELECT query, mean_exec_time FROM pg_stat_statements
    │  ORDER BY mean_exec_time DESC LIMIT 5;
    │
    ├─ Queries > 1 second
    │   └─► SOLUTION:
    │       1. Check EXPLAIN plan
    │       2. Check if using index
    │       3. Add index if needed
    │       4. Optimize query
    │
    └─ Queries normal
        │
        "Check RabbitMQ latency:"
        │  Check message_latency_seconds metric
        │
        ├─ Message latency high
        │   └─► RabbitMQ slow or saturated
        │       SOLUTION:
        │       1. Check RabbitMQ resources
        │       2. Check queue depth
        │       3. Reduce message size
        │       4. Scale brokers (cluster)
        │
        └─ Message latency normal
            │
            "Check network latency:"
            │  ping other-service
            │  Check network MTU: ip link show
            │
            └─ If network latency high
                └─► SOLUTION:
                    1. Check network interfaces
                    2. Check for packet loss
                    3. Check routing
                    4. Coordinate with infrastructure team
```

---

## TREE 5: DATABASE PROBLEMS

```
"Can you connect to database?"
│
├─ Connection refused (port 5432 not open)
│   │
│   "Check if postgres container running:"
│   │  docker-compose ps postgres
│   │
│   ├─ Status NOT "Up"
│   │   └─► Container crashed
│   │       SOLUTION:
│   │       1. Check logs: docker-compose logs postgres
│   │       2. Look for startup errors
│   │       3. Restart: docker-compose restart postgres
│   │       4. Check disk space (common cause)
│   │       5. If won't start, restore from backup
│   │
│   └─ Status "Up"
│       └─► Port not listening (application hung)
│           SOLUTION:
│           1. Stop container: docker-compose stop postgres
│           2. Check for locks: fuser /var/lib/postgresql
│           3. Force restart: docker-compose restart postgres
│           4. Verify port listening: netstat -tlnp | grep 5432
│
├─ Connection accepted but query hangs
│   │
│   ├─ Hangs on INSERT/UPDATE
│   │   └─► Possible lock
│   │       SOLUTION:
│   │       1. Check for active transactions:
│   │          SELECT * FROM pg_stat_activity WHERE state='active';
│   │       2. Check for locks:
│   │          SELECT * FROM pg_locks WHERE NOT granted;
│   │       3. Kill blocking transaction if safe
│   │
│   └─ Hangs on SELECT
│       └─► Query too slow or resource issue
│           SOLUTION:
│           1. EXPLAIN the query
│           2. Check for missing index
│           3. Check for full table scan
│           4. Optimize query
│
└─ Connection works, but slow
    │
    "Check connection pool:"
    │  SELECT count(*) FROM pg_stat_activity;
    │
    ├─ Connection count > 80% of max
    │   └─► Pool nearly exhausted
    │       SOLUTION:
    │       1. Kill idle connections:
    │          SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    │          WHERE state='idle' AND state_change < NOW() - INTERVAL '5 minutes';
    │       2. Restart application pool
    │       3. Increase max_connections if persistent
    │
    ├─ Connection count normal
    │   └─► Problem elsewhere
    │
    └─ Check query performance
        │
        ├─ Query > 1 second
        │   └─► SOLUTION:
        │       1. EXPLAIN ANALYZE query
        │       2. Check for index scan vs seq scan
        │       3. Add index if needed
        │       4. Optimize query
        │
        └─ Query < 1 second but system slow
            └─► Many concurrent queries
                SOLUTION:
                1. Check work_mem setting
                2. Increase shared_buffers
                3. Optimize most common queries
```

---

## TREE 6: RABBITMQ ISSUES

```
"Can you reach RabbitMQ?"
│
├─ Connection refused (port 5672)
│   │
│   "Check container:"
│   │  docker-compose ps rabbitmq
│   │
│   ├─ Not running
│   │   └─► SOLUTION: docker-compose restart rabbitmq
│   │
│   └─ Running but port closed
│       └─► SOLUTION:
│           1. Check logs: docker-compose logs rabbitmq | grep -i "error"
│           2. Common: Disk full, RAM limit, port conflict
│           3. Restart: docker-compose restart rabbitmq
│
├─ Connected but can't publish
│   │
│   ├─ "Queue does not exist" error
│   │   └─► SOLUTION:
│   │       1. Create queue: curl -u guest:guest -X PUT http://localhost:15672/api/queues/%2f/queue_name
│   │       2. Or restart: docker-compose restart rabbitmq (recreates definitions)
│   │
│   ├─ "No publishers allowed" error
│   │   └─► SOLUTION: Check user permissions
│   │       curl -u guest:guest http://localhost:15672/api/users | jq '.[] | select(.name=="publisher")'
│   │
│   └─ "Memory/disk issue" error
│       └─► SOLUTION:
│           1. Check RabbitMQ status: curl -u guest:guest http://localhost:15672/api/overview
│           2. Check alarms: .alarms field
│           3. If memory: Clear old messages
│           4. If disk: Free up disk space
│
└─ Connected but messages not delivering
    │
    "Check queue status:"
    │  curl -u guest:guest http://localhost:15672/api/queues
    │
    ├─ Queue has messages but no consumers
    │   └─► SOLUTION:
    │       1. Check agent status: curl http://localhost:3000/api/agents
    │       2. Restart agents: docker-compose restart orchestrator
    │       3. Check agent logs for connection errors
    │
    ├─ Queue empty but messages should be there
    │   └─► Messages consumed but not processed (TREE 2)
    │       Or messages lost (check application for error)
    │
    ├─ Queue growing (messages not removed)
    │   └─► Consumer acknowledged but requeue
    │       SOLUTION:
    │       1. Check application logic
    │       2. Check if message format wrong
    │       3. Check if consumer crash before ack
    │
    └─ Message latency high
        └─► Messages slow to deliver
            SOLUTION:
            1. Check RabbitMQ CPU: docker stats rabbitmq
            2. Check RabbitMQ memory
            3. Check message size (large = slower)
            4. Check network
```

---

## TREE 7: RESOURCE EXHAUSTION

```
"Check disk space:"
│  df -h /
│
├─ < 1GB free
│   └─► CRITICAL - Disk almost full
│       SOLUTION:
│       1. Find large files: du -sh /* | sort -rh
│       2. Delete old logs: find /var/log -mtime +30 -delete
│       3. Docker cleanup: docker system prune -a
│       4. PostgreSQL vacuum: VACUUM FULL
│       5. Increase volume if persistent
│
├─ 1-5GB free
│   └─► Adequate for now, monitor growth
│       SOLUTION:
│       1. Check growth rate: du -sh / ; wait 1 hour; du -sh /
│       2. If growing fast, implement retention policies
│
└─ > 5GB free
    └─► Adequate, continue

"Check memory:"
│  free -h
│  docker stats --no-stream
│
├─ System memory > 85%
│   └─► Critical
│       SOLUTION:
│       1. Identify memory hog: docker stats --no-stream
│       2. If application: Check for leak (TREE 4)
│       3. Restart container: docker-compose restart <service>
│       4. Increase system memory if persistent
│
├─ Container memory > 80% of limit
│   └─► High, monitor closely
│       SOLUTION:
│       1. Check for leak
│       2. Increase container limit
│       3. Optimize memory usage
│
└─ < 80%
    └─► OK

"Check CPU:"
│  top -b -n 1
│
├─ > 85%
│   └─► Check what's running
│       SOLUTION:
│       1. Identify process: top
│       2. Check if normal: Application processing
│       3. Check if leak: CPU increasing over time
│       4. Check if spike: Traffic spike (temporary OK)
│       5. If persistent high: Optimize or scale
│
└─ < 85%
    └─► OK
```

---

## TREE 8: DATA CONSISTENCY ISSUES

```
"What kind of inconsistency?"
│
├─ Cache vs Database mismatch
│   │
│   ├─ Cache has old data
│   │   └─► SOLUTION:
│   │       1. Invalidate cache: redis-cli DEL <key>
│   │       2. Check invalidation logic
│   │       3. Monitor cache freshness
│   │
│   ├─ Cache has wrong data
│   │   └─► SOLUTION:
│   │       1. Flush entire cache: redis-cli FLUSHDB
│   │       2. Rebuild: curl -X POST /admin/cache-rebuild
│   │       3. Check update logic
│   │
│   └─ Cache empty but data in DB
│       └─► SOLUTION:
│           1. Rebuild cache
│           2. Check if cache layer is working
│
├─ Different agents returning different results
│   │
│   ├─ Data format inconsistent
│   │   └─► SOLUTION:
│   │       1. Check response schema
│   │       2. Ensure agents follow same format
│   │       3. Add validation
│   │
│   └─ Calculation difference
│       └─► SOLUTION:
│           1. Review agent logic
│           2. Ensure same data input
│           3. Add unit tests
│
└─ User sees stale information
    │
    ├─ Recently updated, seeing old
    │   └─► SOLUTION:
    │       1. Check if cache not invalidated
    │       2. Check if reading from replica lag
    │       3. Force refresh: Cache bust
    │
    └─ Data changed, not reflecting
        └─► SOLUTION:
            1. Restart service
            2. Check WebSocket connections updated
            3. Check polling interval
```

---

## TREE 9: AGENT ISSUES

```
"What's wrong with agent?"
│
├─ Agent not registered
│   │
│   "Check agent existence:"
│   │  psql -c "SELECT COUNT(*) FROM agents WHERE agent_id='agent-1';"
│   │
│   ├─ 0 agents
│   │   └─► SOLUTION:
│   │       1. Start agent: docker-compose up -d agent-brainstorm
│   │       2. Verify registration: curl http://localhost:3000/api/agents
│   │       3. Check agent logs
│   │
│   └─ Agent exists but status inactive
│       └─► Agent registered but not connecting
│           SOLUTION:
│           1. Check agent logs
│           2. Check if RabbitMQ accessible from agent
│           3. Restart agent
│
├─ Agent registered but not processing
│   │
│   "Check if consuming messages:"
│   │  curl -u guest:guest http://localhost:15672/api/queues | jq '.[] | select(.name=="task_queue") | .consumers'
│   │
│   ├─ consumers = 0
│   │   └─► Agent connected but not consuming
│   │       SOLUTION:
│   │       1. Restart agent: docker-compose restart orchestrator
│   │       2. Check agent code
│   │
│   ├─ consumers > 0 but tasks not completing
│   │   └─► Agent consuming but failing to process
│   │       SOLUTION:
│   │       1. Check agent logs: docker-compose logs orchestrator | grep "agent-" | grep "ERROR"
│   │       2. Fix error in agent code
│   │       3. Deploy fix
│   │
│   └─ No error visible
│       └─► Check if very slow
│           SOLUTION:
│           1. Monitor agent processing time
│           2. May need to scale more agents
│
├─ Agent crashing after startup
│   │
│   "Check logs:"
│   │  docker-compose logs orchestrator | head -50
│   │
│   ├─ Shows dependency error
│   │   └─► SOLUTION:
│   │       1. Verify dependency running
│   │       2. Check connectivity
│   │       3. Add retry logic
│   │
│   ├─ Shows assertion error
│   │   └─► SOLUTION: Fix agent code bug
│   │
│   └─ Shows configuration error
│       └─► SOLUTION:
│           1. Check environment variables
│           2. Check .env file
│           3. Verify configuration
│
└─ Agent running but degraded
    │
    ├─ Slow processing
    │   └─► SOLUTION:
    │       1. Check agent CPU: docker stats
    │       2. Check if dependent services slow
    │       3. Check system resources (TREE 7)
    │       4. Scale more agents
    │
    ├─ High error rate
    │   └─► SOLUTION:
    │       1. Check application error logs
    │       2. Fix error
    │       3. Deploy
    │
    └─ Failing specific message types
        └─► SOLUTION:
            1. Identify message type
            2. Test with sample message
            3. Fix agent logic for that type
            4. Replay failed messages
```

---

**Quick Command Reference:**

```bash
# Health checks
curl http://localhost:3000/health
docker-compose ps

# Logs
docker-compose logs -f <service>
docker-compose logs --since 10m

# Resource stats
docker stats --no-stream
free -h
df -h /

# Database
psql -U orchestrator -d ai_agent_db
\d  # List tables
\du # List users

# RabbitMQ
curl -u guest:guest http://localhost:15672/api/overview
curl -u guest:guest http://localhost:15672/api/queues

# Redis
redis-cli
redis-cli INFO
redis-cli KEYS "*"

# Restart services
docker-compose restart
docker-compose restart <service>

# View specific errors
docker-compose logs orchestrator | grep ERROR | tail -20
```

---

**Document Version:** 1.0
**Last Updated:** November 18, 2025
**Status:** APPROVED FOR PRODUCTION
