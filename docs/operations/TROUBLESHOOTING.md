# Troubleshooting Guide

This comprehensive guide helps you diagnose and resolve issues with the AI Agent Orchestrator RabbitMQ system.

## Table of Contents

- [Common Issues & Solutions](#common-issues--solutions)
  - [RabbitMQ Connection Failures](#rabbitmq-connection-failures)
  - [Tasks Not Being Picked Up](#tasks-not-being-picked-up)
  - [Agents Disconnecting](#agents-disconnecting)
  - [Queue Backlog](#queue-backlog)
  - [Performance Issues](#performance-issues)
  - [Memory Leaks](#memory-leaks)
  - [Network Issues](#network-issues)
- [Error Messages Reference](#error-messages-reference)
- [Debugging Guide](#debugging-guide)
- [Performance Troubleshooting](#performance-troubleshooting)
- [Network & Connectivity](#network--connectivity)
- [Recovery Procedures](#recovery-procedures)
- [Monitoring & Diagnostics](#monitoring--diagnostics)

---

## Common Issues & Solutions

### RabbitMQ Connection Failures

#### Issue: Cannot connect to RabbitMQ server

**Symptoms:**
- Error message: `Failed to connect: Error: connect ECONNREFUSED`
- Agents fail to start
- Connection timeout errors
- Process exits immediately after start

**Root Cause:**
- RabbitMQ server is not running
- Wrong connection URL/credentials
- Network connectivity issues
- Firewall blocking port 5672

**Solution:**

1. **Verify RabbitMQ is running:**
   ```bash
   # Check if RabbitMQ container is running
   docker ps | grep rabbitmq

   # If not running, start it
   docker start rabbitmq

   # Or create new container
   docker run -d --name rabbitmq \
     -p 5672:5672 \
     -p 15672:15672 \
     rabbitmq:3-management
   ```

2. **Test connection:**
   ```bash
   # Test TCP connection
   telnet localhost 5672

   # Or use netcat
   nc -zv localhost 5672
   ```

3. **Verify credentials:**
   ```bash
   # Check .env file
   cat .env | grep RABBITMQ

   # Default credentials
   RABBITMQ_URL=amqp://guest:guest@localhost:5672
   ```

4. **Check RabbitMQ logs:**
   ```bash
   # Docker logs
   docker logs rabbitmq

   # Look for startup errors or authentication failures
   ```

**Prevention:**
- Use health check scripts to monitor RabbitMQ status
- Set up automatic container restart policy
- Configure AUTO_RECONNECT=true in .env
- Implement connection pooling

**Related Issues:**
- [Network Issues](#network-issues)
- [Agents Disconnecting](#agents-disconnecting)

---

#### Issue: Connection closes unexpectedly

**Symptoms:**
- Connection established but drops after a few seconds
- Error: `Connection closed`
- Agents repeatedly reconnecting

**Root Cause:**
- Heartbeat timeout (no activity detected)
- RabbitMQ server resource limits
- Network instability
- Client not responding to heartbeat requests

**Solution:**

1. **Adjust heartbeat interval:**
   ```bash
   # In .env file
   HEARTBEAT_INTERVAL=60
   ```

2. **Check RabbitMQ server limits:**
   ```bash
   # Access RabbitMQ management UI
   open http://localhost:15672

   # Check connection limits
   # Admin > Limits
   ```

3. **Monitor connection stability:**
   ```javascript
   // Enable connection event logging
   client.on('disconnected', () => {
     console.log('Connection lost at:', new Date());
   });
   ```

4. **Increase connection timeout:**
   ```javascript
   // In rabbitmq-client.js
   const connection = await amqp.connect(url, {
     heartbeat: 60,
     connectionTimeout: 30000  // 30 seconds
   });
   ```

**Prevention:**
- Set appropriate heartbeat values (30-60 seconds recommended)
- Monitor network latency
- Use persistent connections
- Implement exponential backoff for reconnection

**Related Issues:**
- [Agents Disconnecting](#agents-disconnecting)
- [Network Issues](#network-issues)

---

#### Issue: Maximum reconnection attempts reached

**Symptoms:**
- Error: `Max reconnect attempts reached`
- Agent gives up reconnecting
- Process continues running but not connected

**Root Cause:**
- RabbitMQ down for extended period
- Network issues persist
- Wrong connection credentials
- maxReconnectAttempts limit reached

**Solution:**

1. **Check RabbitMQ availability:**
   ```bash
   # Verify RabbitMQ is accessible
   curl http://localhost:15672/api/overview
   ```

2. **Review reconnection configuration:**
   ```javascript
   // Check in rabbitmq-client.js
   this.maxReconnectAttempts = 10;

   // Increase if needed (but not too high)
   this.maxReconnectAttempts = 20;
   ```

3. **Check reconnection delay:**
   ```javascript
   // Exponential backoff formula
   const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
   // Attempt 1: 2s
   // Attempt 2: 4s
   // Attempt 3: 8s
   // ...
   // Attempt 5+: 30s (max)
   ```

4. **Manual restart:**
   ```bash
   # Restart the agent after fixing RabbitMQ
   node scripts/orchestrator.js worker
   ```

**Prevention:**
- Configure alerts for connection failures
- Set up RabbitMQ clustering for high availability
- Use AUTO_RECONNECT=true
- Monitor reconnection attempts and investigate persistent failures

**Related Issues:**
- [RabbitMQ Connection Failures](#rabbitmq-connection-failures)
- [Network Issues](#network-issues)

---

### Tasks Not Being Picked Up

#### Issue: Tasks stuck in queue, not consumed by workers

**Symptoms:**
- Tasks published but not processed
- Queue depth increasing
- Workers connected but idle
- No "Received task" log messages

**Root Cause:**
- No workers listening to the queue
- Workers crashed or disconnected
- Queue name mismatch
- Prefetch limit too low
- Workers blocked on other tasks

**Solution:**

1. **Verify workers are connected:**
   ```bash
   # Check status
   node scripts/monitor.js

   # Should show connected workers
   ```

2. **Check queue name configuration:**
   ```bash
   # Verify .env settings
   cat .env | grep TASK_QUEUE

   # Should match in all agents
   TASK_QUEUE=agent.tasks
   ```

3. **Check queue in RabbitMQ Management UI:**
   ```bash
   # Open management interface
   open http://localhost:15672/#/queues

   # Look for:
   # - Queue: agent.tasks
   # - Consumers: Should be > 0
   # - Messages: Check ready vs unacked
   ```

4. **Increase worker count:**
   ```bash
   # Start more workers
   node scripts/orchestrator.js worker &
   node scripts/orchestrator.js worker &
   node scripts/orchestrator.js worker &
   ```

5. **Check prefetch settings:**
   ```bash
   # In .env
   PREFETCH_COUNT=1  # Increase to 5-10 for better throughput
   ```

6. **Debug worker consumption:**
   ```javascript
   // Add logging in consumeTasks
   console.log('Starting to consume from queue:', queueName);
   await this.channel.consume(queueName, async (msg) => {
     console.log('Message received!', msg.properties.messageId);
   });
   ```

**Prevention:**
- Monitor worker health continuously
- Set up auto-scaling for workers based on queue depth
- Use monitoring dashboard to track consumer count
- Configure dead-letter queues for stuck messages

**Related Issues:**
- [Queue Backlog](#queue-backlog)
- [Agents Disconnecting](#agents-disconnecting)

---

#### Issue: Workers connected but not processing tasks

**Symptoms:**
- Workers show as connected in monitor
- Queue has messages
- Consumers count > 0
- But no tasks being processed

**Root Cause:**
- Worker code hung or blocked
- Exception in task handler
- Message acknowledgment issues
- Channel blocked by RabbitMQ

**Solution:**

1. **Check worker logs for errors:**
   ```bash
   # Look for error messages
   # Task handling error: ...
   # Channel error: ...
   ```

2. **Test task handler:**
   ```javascript
   // Add debug logging
   async handleTask(msg, { ack, nack, reject }) {
     console.log('handleTask called with:', msg.id);
     try {
       // ... task processing
       console.log('Task processing complete');
       ack();
     } catch (error) {
       console.error('Task error:', error);
       nack(true); // Requeue
     }
   }
   ```

3. **Check for unacknowledged messages:**
   ```bash
   # In RabbitMQ Management UI
   # Queue > agent.tasks > "Unacked" count

   # High unacked count means workers received but didn't ack
   ```

4. **Restart worker:**
   ```bash
   # Kill hung worker
   pkill -f "orchestrator.js worker"

   # Start fresh worker
   node scripts/orchestrator.js worker
   ```

5. **Check channel flow control:**
   ```javascript
   // Monitor channel events
   channel.on('blocked', (reason) => {
     console.error('Channel blocked:', reason);
   });

   channel.on('unblocked', () => {
     console.log('Channel unblocked');
   });
   ```

**Prevention:**
- Implement timeouts for task processing
- Add health checks for workers
- Monitor unacked message count
- Implement graceful error handling
- Use message TTL to prevent eternal queuing

**Related Issues:**
- [Performance Issues](#performance-issues)
- [Memory Leaks](#memory-leaks)

---

### Agents Disconnecting

#### Issue: Agents disconnect randomly or frequently

**Symptoms:**
- Status update: "Agent disconnected from orchestration system"
- Agents drop from monitor dashboard
- Need manual restart to rejoin
- Connection error in logs

**Root Cause:**
- Network instability
- RabbitMQ server issues
- Resource exhaustion (memory/CPU)
- Heartbeat timeout
- Process crash

**Solution:**

1. **Enable auto-reconnect:**
   ```bash
   # In .env
   AUTO_RECONNECT=true
   ```

2. **Monitor agent health:**
   ```bash
   # Run health check
   node scripts/hooks/health-check.js
   ```

3. **Check system resources:**
   ```bash
   # Monitor memory
   ps aux | grep node

   # Monitor CPU
   top -p $(pgrep -f orchestrator)
   ```

4. **Review disconnection logs:**
   ```bash
   # Look for pattern before disconnect
   # Connection error: ...
   # Channel error: ...
   # Memory warning: ...
   ```

5. **Implement keep-alive mechanism:**
   ```bash
   # Add to crontab or systemd
   */5 * * * * /path/to/health-check.sh
   ```

6. **Check RabbitMQ server logs:**
   ```bash
   docker logs rabbitmq | grep -i error
   docker logs rabbitmq | grep -i close
   ```

**Prevention:**
- Use process managers (PM2, systemd)
- Configure automatic restarts
- Monitor agent status proactively
- Set up alerting for disconnections
- Use connection pooling
- Implement circuit breaker pattern

**Related Issues:**
- [RabbitMQ Connection Failures](#rabbitmq-connection-failures)
- [Network Issues](#network-issues)
- [Memory Leaks](#memory-leaks)

---

### Queue Backlog

#### Issue: Messages accumulating in queue faster than consumption

**Symptoms:**
- Queue depth continuously increasing
- Monitor shows high "Queued" count
- Task completion rate < task creation rate
- Workers always busy but queue grows

**Root Cause:**
- Insufficient workers
- Tasks taking too long to process
- Worker bottleneck (slow operations)
- Task creation rate too high
- Worker failures causing requeuing

**Solution:**

1. **Scale up workers:**
   ```bash
   # Start additional workers immediately
   for i in {1..5}; do
     node scripts/orchestrator.js worker &
   done
   ```

2. **Check worker processing time:**
   ```bash
   # In monitor, check task duration metrics
   # Identify slow tasks
   ```

3. **Set queue limits:**
   ```javascript
   // In setupTaskQueue
   await channel.assertQueue('agent.tasks', {
     durable: true,
     arguments: {
       'x-max-length': 10000,  // Drop oldest after 10k
       'x-overflow': 'reject-publish'  // Or drop-head
     }
   });
   ```

4. **Implement priority queuing:**
   ```javascript
   // Prioritize critical tasks
   await assignTask({
     title: "Critical task",
     priority: "high"
   });
   ```

5. **Monitor and alert:**
   ```bash
   # Set up threshold alerts
   # If queue depth > 1000, alert and auto-scale
   ```

6. **Optimize task processing:**
   ```javascript
   // Profile task handler
   console.time('task-processing');
   // ... task work
   console.timeEnd('task-processing');
   ```

**Prevention:**
- Auto-scale workers based on queue depth
- Set maximum queue length
- Implement task prioritization
- Monitor task creation rate
- Use batch processing for bulk operations
- Consider message TTL for non-critical tasks

**Related Issues:**
- [Performance Issues](#performance-issues)
- [Tasks Not Being Picked Up](#tasks-not-being-picked-up)

---

### Performance Issues

#### Issue: Slow task execution and high latency

**Symptoms:**
- Tasks taking longer than expected
- High task duration in monitor
- Low tasks/minute throughput
- Workers idle but tasks slow

**Root Cause:**
- Inefficient task processing code
- Network latency between components
- Resource contention
- Prefetch count too low
- Synchronous operations blocking
- External API slowness

**Solution:**

1. **Profile task execution:**
   ```javascript
   async handleTask(msg, { ack, nack, reject }) {
     const startTime = Date.now();

     console.time('task-total');
     console.time('task-processing');
     // ... processing
     console.timeEnd('task-processing');

     console.time('task-result-publish');
     await this.publishResult(result);
     console.timeEnd('task-result-publish');

     console.timeEnd('task-total');
     console.log(`Task duration: ${Date.now() - startTime}ms`);
   }
   ```

2. **Increase prefetch count:**
   ```bash
   # In .env
   PREFETCH_COUNT=10  # Process multiple messages
   ```

3. **Optimize RabbitMQ settings:**
   ```javascript
   // Use publisher confirms for reliability
   await channel.confirmSelect();

   // Batch acknowledge messages
   channel.ack(msg, true);  // Multiple ack
   ```

4. **Use connection pooling:**
   ```javascript
   // Reuse connections and channels
   // Don't create new connection per message
   ```

5. **Enable lazy queues for large backlogs:**
   ```javascript
   await channel.assertQueue('agent.tasks', {
     durable: true,
     arguments: {
       'x-queue-mode': 'lazy'  // Messages stored on disk
     }
   });
   ```

6. **Monitor RabbitMQ performance:**
   ```bash
   # Check message rates
   open http://localhost:15672/#/queues

   # Look for:
   # - Message rates (in/out)
   # - Consumer utilization
   # - Connection/channel count
   ```

**Prevention:**
- Regular performance testing
- Implement caching where appropriate
- Use asynchronous operations
- Optimize task processing logic
- Monitor and set SLAs
- Use performance profiling tools

**Related Issues:**
- [Queue Backlog](#queue-backlog)
- [Network Issues](#network-issues)

---

### Memory Leaks

#### Issue: Agent memory usage continuously growing

**Symptoms:**
- Node.js process memory increasing over time
- System running out of memory
- Process killed by OOM killer
- Performance degradation over time

**Root Cause:**
- Unacknowledged messages accumulating
- Event listeners not cleaned up
- Large objects in Map/Set not cleared
- Circular references
- Retained closures
- Message buffers not released

**Solution:**

1. **Monitor memory usage:**
   ```bash
   # Watch process memory
   watch -n 5 'ps aux | grep node'

   # Node.js memory profiling
   node --inspect scripts/orchestrator.js worker

   # Then use Chrome DevTools > Memory
   ```

2. **Clean up completed tasks:**
   ```javascript
   // In handleTask, after completion
   this.activeTasks.delete(id);

   // Periodically clean old results
   setInterval(() => {
     const cutoff = Date.now() - 3600000; // 1 hour
     for (const [id, result] of this.results.entries()) {
       if (result.timestamp < cutoff) {
         this.results.delete(id);
       }
     }
   }, 600000); // Every 10 minutes
   ```

3. **Limit Map/Set sizes:**
   ```javascript
   // Set maximum sizes
   if (this.results.size > 1000) {
     const oldest = Array.from(this.results.keys())[0];
     this.results.delete(oldest);
   }
   ```

4. **Remove event listeners:**
   ```javascript
   // Before shutdown
   this.client.removeAllListeners();
   ```

5. **Use heap snapshots:**
   ```javascript
   const v8 = require('v8');
   const fs = require('fs');

   // Take snapshot
   const snapshot = v8.writeHeapSnapshot();
   console.log('Heap snapshot written to:', snapshot);
   ```

6. **Set memory limit:**
   ```bash
   # Start with memory limit
   node --max-old-space-size=2048 scripts/orchestrator.js worker
   ```

**Prevention:**
- Implement proper cleanup in shutdown handlers
- Limit collection sizes
- Use WeakMap/WeakSet for temporary references
- Acknowledge messages promptly
- Regular restarts for long-running processes
- Monitor memory usage with alerts

**Related Issues:**
- [Performance Issues](#performance-issues)
- [Agents Disconnecting](#agents-disconnecting)

---

### Network Issues

#### Issue: Network connectivity problems affecting agents

**Symptoms:**
- Intermittent connection failures
- High latency in message delivery
- Timeouts in operations
- DNS resolution errors

**Root Cause:**
- Firewall blocking ports
- DNS issues
- Network congestion
- Routing problems
- Proxy configuration

**Solution:**

1. **Verify network connectivity:**
   ```bash
   # Test RabbitMQ port
   telnet localhost 5672

   # Test DNS resolution
   nslookup localhost

   # Check firewall
   sudo iptables -L | grep 5672
   sudo ufw status | grep 5672
   ```

2. **Use IP address instead of hostname:**
   ```bash
   # In .env
   RABBITMQ_URL=amqp://127.0.0.1:5672
   ```

3. **Configure timeouts:**
   ```javascript
   const connection = await amqp.connect(url, {
     heartbeat: 60,
     timeout: 30000
   });
   ```

4. **Check network latency:**
   ```bash
   # Ping RabbitMQ host
   ping localhost -c 10

   # Check route
   traceroute localhost
   ```

5. **Configure proxy if needed:**
   ```bash
   # Set proxy environment variables
   export HTTP_PROXY=http://proxy:8080
   export HTTPS_PROXY=http://proxy:8080
   ```

6. **Use connection retry with backoff:**
   ```javascript
   // Already implemented in rabbitmq-client.js
   async reconnect() {
     const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
     await new Promise(resolve => setTimeout(resolve, delay));
   }
   ```

**Prevention:**
- Monitor network health
- Configure appropriate timeouts
- Use local RabbitMQ when possible
- Implement circuit breaker pattern
- Set up network monitoring and alerts

**Related Issues:**
- [RabbitMQ Connection Failures](#rabbitmq-connection-failures)
- [Agents Disconnecting](#agents-disconnecting)

---

## Error Messages Reference

### Connection Errors

#### `Failed to connect: Error: connect ECONNREFUSED`

**Meaning:** Cannot establish TCP connection to RabbitMQ server.

**Cause:** RabbitMQ not running or not accessible on specified host:port.

**Fix:**
```bash
# Start RabbitMQ
docker start rabbitmq
# Or
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

**Prevention:** Use health checks and auto-start scripts.

---

#### `Connection closed`

**Meaning:** Existing connection was closed by server or network.

**Cause:** Heartbeat timeout, server shutdown, or network interruption.

**Fix:**
```bash
# Check heartbeat settings
HEARTBEAT_INTERVAL=60

# Enable auto-reconnect
AUTO_RECONNECT=true
```

**Prevention:** Configure appropriate heartbeat intervals and auto-reconnect.

---

#### `Max reconnect attempts reached`

**Meaning:** Client gave up trying to reconnect after multiple failures.

**Cause:** Persistent connection issues, wrong credentials, or server down.

**Fix:**
```bash
# Verify RabbitMQ is accessible
curl http://localhost:15672/api/overview

# Check credentials in .env
# Restart agent after fixing issue
```

**Prevention:** Fix underlying connection issues, increase max attempts if needed.

---

#### `Authentication failed`

**Meaning:** Invalid username/password credentials.

**Cause:** Wrong credentials in RABBITMQ_URL.

**Fix:**
```bash
# Update .env with correct credentials
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Default RabbitMQ credentials are guest/guest
```

**Prevention:** Use environment variables, never hardcode credentials.

---

### Channel Errors

#### `Channel error: Illegal method frame`

**Meaning:** Invalid AMQP operation attempted on channel.

**Cause:** Queue/exchange already declared with different properties.

**Fix:**
```bash
# Delete and recreate queue with correct properties
# Via RabbitMQ Management UI or API
curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2F/agent.tasks
```

**Prevention:** Ensure consistent queue/exchange declarations across agents.

---

#### `Channel closed: 406 PRECONDITION_FAILED`

**Meaning:** Operation failed due to unmet precondition.

**Cause:** Queue exists with different parameters, exclusive queue access conflict.

**Fix:**
```bash
# Check existing queue properties
curl -u guest:guest http://localhost:15672/api/queues/%2F/agent.tasks

# Delete and recreate, or change queue name
```

**Prevention:** Use consistent queue declarations, avoid changing parameters.

---

#### `Channel blocked: resource-alarm`

**Meaning:** RabbitMQ blocked channel due to resource limits.

**Cause:** Memory or disk alarm triggered on server.

**Fix:**
```bash
# Check RabbitMQ status
docker exec rabbitmq rabbitmqctl status

# Check alarms
docker exec rabbitmq rabbitmqctl alarm_list

# Increase resources or clear disk space
```

**Prevention:** Monitor RabbitMQ resources, set up alerts, increase limits.

---

### Task Handling Errors

#### `Task handling error: Cannot read property 'task' of undefined`

**Meaning:** Task message format is invalid or missing required fields.

**Cause:** Malformed message, wrong message schema.

**Fix:**
```javascript
// Add validation in consumeTasks
const content = JSON.parse(msg.content.toString());
if (!content.task) {
  console.error('Invalid task message:', content);
  this.channel.reject(msg, false);
  return;
}
```

**Prevention:** Validate message format, use schema validation.

---

#### `Task failed: timeout exceeded`

**Meaning:** Task processing took longer than allowed time.

**Cause:** Long-running operation, infinite loop, blocked process.

**Fix:**
```javascript
// Implement timeout
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('timeout')), MESSAGE_TIMEOUT)
);

await Promise.race([
  processTask(task),
  timeoutPromise
]);
```

**Prevention:** Set reasonable timeouts, optimize task processing.

---

#### `Brainstorm handling error: session not found`

**Meaning:** Received brainstorm response for unknown session.

**Cause:** Session expired, session ID mismatch, timing issue.

**Fix:**
```javascript
// Add session validation
if (!this.brainstormSessions.has(sessionId)) {
  console.warn('Unknown brainstorm session:', sessionId);
  return;
}
```

**Prevention:** Implement session timeouts, clean up old sessions.

---

### Queue Errors

#### `Queue 'agent.tasks' not found`

**Meaning:** Attempting to consume from non-existent queue.

**Cause:** Queue not created yet, wrong queue name.

**Fix:**
```javascript
// Ensure queue exists before consuming
await this.channel.assertQueue('agent.tasks', {
  durable: true
});

await this.channel.consume('agent.tasks', handler);
```

**Prevention:** Always assert queues before use, check queue name configuration.

---

#### `Queue 'agent.tasks' is in use (exclusive)`

**Meaning:** Trying to access exclusive queue from another connection.

**Cause:** Queue declared as exclusive by another consumer.

**Fix:**
```bash
# Identify and close exclusive consumer
# In RabbitMQ Management UI: Queues > agent.tasks > Consumers

# Or use unique queue names per agent
const queueName = `agent.tasks.${this.agentId}`;
```

**Prevention:** Don't use exclusive flag for shared queues.

---

### System Errors

#### `Error: EMFILE, too many open files`

**Meaning:** Process reached file descriptor limit.

**Cause:** Too many connections, channels, or file handles.

**Fix:**
```bash
# Increase system limits
ulimit -n 10000

# Or in /etc/security/limits.conf
* soft nofile 10000
* hard nofile 10000
```

**Prevention:** Reuse connections, close unused channels, monitor open files.

---

#### `Error: Cannot allocate memory`

**Meaning:** System out of memory.

**Cause:** Memory leak, too many agents, large messages.

**Fix:**
```bash
# Increase swap or memory
# Restart agents
# Implement memory limits
node --max-old-space-size=2048 scripts/orchestrator.js worker
```

**Prevention:** Fix memory leaks, limit collection sizes, monitor memory usage.

---

## Debugging Guide

### Enable Debug Logging

#### Application-Level Logging

```javascript
// Set environment variable
DEBUG=* node scripts/orchestrator.js worker

// Or specific modules
DEBUG=rabbitmq:* node scripts/orchestrator.js worker
```

#### RabbitMQ Client Logging

```javascript
// In rabbitmq-client.js, add verbose logging
constructor(config) {
  super();
  this.debug = process.env.DEBUG_RABBITMQ === 'true';
}

log(message, ...args) {
  if (this.debug) {
    console.log(`[RabbitMQ ${new Date().toISOString()}]`, message, ...args);
  }
}

// Use throughout client
this.log('Publishing message:', message.id);
```

#### Enable in .env

```bash
# Enable debug mode
DEBUG_RABBITMQ=true
DEBUG_ORCHESTRATOR=true
LOG_LEVEL=debug
```

---

### RabbitMQ Management UI

#### Access Management Interface

```bash
# Open in browser
open http://localhost:15672

# Default credentials
Username: guest
Password: guest
```

#### Key Pages

1. **Overview**
   - System health
   - Message rates (global)
   - Connection/channel counts
   - Resource usage

2. **Connections**
   - Active connections
   - Connection details (client properties, channels)
   - Connection state and traffic

3. **Channels**
   - Active channels
   - Channel mode (confirm, transactional)
   - Prefetch count
   - Unacknowledged messages

4. **Queues**
   - All queues with stats
   - Message counts (ready, unacked, total)
   - Consumer counts
   - Message rates

5. **Exchanges**
   - All exchanges
   - Bindings
   - Publishing rates

#### Useful Operations

```bash
# Purge queue (remove all messages)
# Queues > agent.tasks > Purge

# Delete queue
# Queues > agent.tasks > Delete

# View message contents
# Queues > agent.tasks > Get messages

# Force close connection
# Connections > [connection] > Force Close
```

---

### Message Tracing

#### Enable Tracing Plugin

```bash
# Enable tracer
docker exec rabbitmq rabbitmq-plugins enable rabbitmq_tracing

# Access tracer UI
open http://localhost:15672/#/traces
```

#### Create Trace

1. Go to Admin > Tracing
2. Click "Add a new trace"
3. Set pattern (e.g., "#" for all messages)
4. Start trace
5. Perform operations
6. Download trace log file

#### Analyze Trace

```bash
# Trace file shows:
# - Published messages (with routing key, properties, payload)
# - Delivered messages (to which consumer)
# - Acknowledged/rejected messages
# - Timestamps for each event
```

---

### Agent State Inspection

#### Check Agent Status

```javascript
// In orchestrator
console.log('Agent Stats:', orchestrator.getStats());

// Output:
// {
//   tasksReceived: 10,
//   tasksCompleted: 8,
//   tasksFailed: 2,
//   brainstormsParticipated: 3,
//   resultsPublished: 8,
//   activeTasks: 2,
//   activeBrainstorms: 0,
//   totalResults: 8
// }
```

#### Inspect Active Tasks

```javascript
// Log active tasks
console.log('Active Tasks:', Array.from(orchestrator.activeTasks.entries()));

// Output:
// [
//   ['task-id-1', { title: 'Task 1', startedAt: 1699999999999 }],
//   ['task-id-2', { title: 'Task 2', startedAt: 1699999999999 }]
// ]
```

#### Check Connection State

```javascript
// Check client health
console.log('Client Healthy:', orchestrator.client.isHealthy());
console.log('Connected:', orchestrator.client.isConnected);
console.log('Reconnect Attempts:', orchestrator.client.reconnectAttempts);
```

---

### Queue Inspection

#### Via RabbitMQ CLI

```bash
# List all queues
docker exec rabbitmq rabbitmqctl list_queues name messages consumers

# Detailed queue info
docker exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers

# Example output:
# agent.tasks    42    2
# agent.results  0     1
```

#### Via Management API

```bash
# Get queue details
curl -u guest:guest http://localhost:15672/api/queues/%2F/agent.tasks | jq

# Check specific metrics
curl -u guest:guest http://localhost:15672/api/queues/%2F/agent.tasks | \
  jq '{messages, messages_ready, messages_unacknowledged, consumers}'
```

#### Via Node.js

```javascript
// Check queue in code (requires management plugin)
const axios = require('axios');

async function checkQueue(queueName) {
  const response = await axios.get(
    `http://localhost:15672/api/queues/%2F/${queueName}`,
    { auth: { username: 'guest', password: 'guest' } }
  );

  console.log('Queue Stats:', {
    messages: response.data.messages,
    messagesReady: response.data.messages_ready,
    messagesUnacked: response.data.messages_unacknowledged,
    consumers: response.data.consumers
  });
}
```

---

## Performance Troubleshooting

### Slow Task Execution

#### Identify Bottleneck

```javascript
// Add detailed timing
async handleTask(msg, { ack, nack, reject }) {
  const timers = {};

  timers.start = Date.now();

  // Parse message
  const parseStart = Date.now();
  const { id, task } = msg;
  timers.parse = Date.now() - parseStart;

  // Process task
  const processStart = Date.now();
  // ... task processing
  timers.process = Date.now() - processStart;

  // Publish result
  const publishStart = Date.now();
  await this.publishResult(result);
  timers.publish = Date.now() - publishStart;

  // Acknowledge
  const ackStart = Date.now();
  ack();
  timers.ack = Date.now() - ackStart;

  timers.total = Date.now() - timers.start;

  console.log('Task Timing:', timers);
  // Output: { parse: 1ms, process: 2500ms, publish: 50ms, ack: 1ms, total: 2552ms }
}
```

#### Optimize Hot Paths

```javascript
// If parsing is slow
const content = JSON.parse(msg.content.toString());
// Consider using faster JSON parser
// const content = require('fast-json-parse')(msg.content.toString());

// If publishing is slow
// Use batch publishing or publisher confirms

// If processing is slow
// Profile the task processing code
// Optimize algorithms, add caching
```

---

### High Latency

#### Measure End-to-End Latency

```javascript
// Add timestamp to message
await publishTask({
  ...task,
  _publishedAt: Date.now()
});

// Measure on receive
async handleTask(msg, { ack, nack, reject }) {
  const latency = Date.now() - msg.task._publishedAt;
  console.log('Message Latency:', latency, 'ms');

  if (latency > 1000) {
    console.warn('High latency detected!');
  }
}
```

#### Reduce Latency

1. **Increase prefetch count:**
   ```bash
   PREFETCH_COUNT=10
   ```

2. **Use lazy queues for large backlogs:**
   ```javascript
   await channel.assertQueue('agent.tasks', {
     arguments: { 'x-queue-mode': 'lazy' }
   });
   ```

3. **Optimize network:**
   ```bash
   # Use local RabbitMQ
   RABBITMQ_URL=amqp://localhost:5672

   # Reduce heartbeat interval (more overhead but faster detection)
   HEARTBEAT_INTERVAL=15
   ```

4. **Use direct reply-to for RPC:**
   ```javascript
   // For request-response patterns
   const reply = await channel.consume('amq.rabbitmq.reply-to', handler);
   ```

---

### Queue Buildup

#### Monitor Queue Growth

```javascript
// Periodically check queue depth
async function monitorQueue() {
  const queueInfo = await axios.get(
    'http://localhost:15672/api/queues/%2F/agent.tasks',
    { auth: { username: 'guest', password: 'guest' } }
  );

  const depth = queueInfo.data.messages;
  console.log('Queue Depth:', depth);

  if (depth > 1000) {
    console.error('Queue backlog detected!');
    // Trigger alert or auto-scaling
  }
}

setInterval(monitorQueue, 30000); // Every 30s
```

#### Auto-Scale Workers

```bash
# Simple auto-scaling script
#!/bin/bash

QUEUE_DEPTH=$(curl -s -u guest:guest http://localhost:15672/api/queues/%2F/agent.tasks | jq '.messages')

if [ "$QUEUE_DEPTH" -gt 1000 ]; then
  echo "Scaling up workers..."
  for i in {1..3}; do
    node scripts/orchestrator.js worker &
  done
fi
```

---

### Memory Usage

#### Profile Memory

```bash
# Use Node.js inspector
node --inspect scripts/orchestrator.js worker

# Open Chrome DevTools
# chrome://inspect

# Take heap snapshots periodically
# Compare snapshots to find leaks
```

#### Monitor Memory in Code

```javascript
// Log memory usage
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: Math.round(used.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(used.external / 1024 / 1024) + 'MB'
  });

  // Alert if heap usage > 80%
  const heapPercent = (used.heapUsed / used.heapTotal) * 100;
  if (heapPercent > 80) {
    console.error('High memory usage!', heapPercent.toFixed(1) + '%');
  }
}, 60000); // Every minute
```

---

### CPU Usage

#### Identify CPU Hotspots

```bash
# Profile CPU usage
node --prof scripts/orchestrator.js worker

# After stopping, process the log
node --prof-process isolate-*.log > profile.txt

# Analyze profile.txt for hot functions
```

#### Monitor CPU in Code

```javascript
const os = require('os');

function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - (100 * idle / total);

  return usage.toFixed(2);
}

setInterval(() => {
  console.log('CPU Usage:', getCPUUsage() + '%');
}, 60000);
```

---

## Network & Connectivity

### Firewall Issues

#### Check Firewall Rules

```bash
# Linux - iptables
sudo iptables -L -n | grep 5672

# Linux - ufw
sudo ufw status | grep 5672

# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

#### Open Required Ports

```bash
# Linux - ufw
sudo ufw allow 5672/tcp  # AMQP
sudo ufw allow 15672/tcp # Management UI

# Linux - iptables
sudo iptables -A INPUT -p tcp --dport 5672 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 15672 -j ACCEPT

# macOS - add to allow list via System Preferences > Security & Privacy
```

#### Test Port Accessibility

```bash
# From same host
telnet localhost 5672

# From remote host
telnet <rabbitmq-host> 5672

# Or use nc
nc -zv localhost 5672
```

---

### DNS Resolution

#### Check DNS Configuration

```bash
# Test DNS resolution
nslookup localhost
nslookup <rabbitmq-host>

# Check /etc/hosts
cat /etc/hosts | grep rabbitmq

# Check DNS servers
cat /etc/resolv.conf
```

#### Use IP Address Directly

```bash
# Bypass DNS by using IP
RABBITMQ_URL=amqp://127.0.0.1:5672

# Or add to /etc/hosts
echo "127.0.0.1 rabbitmq.local" | sudo tee -a /etc/hosts
```

---

### Connection Pooling

#### Implement Connection Pool

```javascript
// connection-pool.js
class ConnectionPool {
  constructor(config) {
    this.config = config;
    this.pools = new Map();
    this.maxConnections = config.maxConnections || 10;
  }

  async getConnection(key = 'default') {
    if (!this.pools.has(key)) {
      const connection = await amqp.connect(this.config.url);
      this.pools.set(key, connection);
    }
    return this.pools.get(key);
  }

  async getChannel(connectionKey = 'default') {
    const connection = await this.getConnection(connectionKey);
    return await connection.createChannel();
  }

  async close() {
    for (const [key, connection] of this.pools.entries()) {
      await connection.close();
      this.pools.delete(key);
    }
  }
}

// Usage
const pool = new ConnectionPool({ url: process.env.RABBITMQ_URL });
const channel = await pool.getChannel();
```

---

### Timeout Configuration

#### Set Connection Timeouts

```javascript
// In rabbitmq-client.js
async connect() {
  this.connection = await amqp.connect(this.config.url, {
    heartbeat: 60,                    // Heartbeat interval
    connectionTimeout: 30000,         // Connection timeout (30s)
    timeout: 30000                    // Socket timeout (30s)
  });
}
```

#### Set Operation Timeouts

```javascript
// Timeout for task processing
const MESSAGE_TIMEOUT = parseInt(process.env.MESSAGE_TIMEOUT) || 300000; // 5 minutes

async handleTask(msg, { ack, nack, reject }) {
  const timeoutId = setTimeout(() => {
    console.error('Task timeout!');
    nack(true); // Requeue
  }, MESSAGE_TIMEOUT);

  try {
    // Process task
    await processTask(msg);
    clearTimeout(timeoutId);
    ack();
  } catch (error) {
    clearTimeout(timeoutId);
    nack(true);
  }
}
```

---

## Recovery Procedures

### Restart Strategies

#### Graceful Restart

```bash
# Send SIGTERM for graceful shutdown
kill -TERM <pid>

# Wait for shutdown (up to 30s)
sleep 30

# Restart
node scripts/orchestrator.js worker
```

#### Automatic Restart with PM2

```bash
# Install PM2
npm install -g pm2

# Start with auto-restart
pm2 start scripts/orchestrator.js --name worker -- worker

# Auto-restart on failure
pm2 startup
pm2 save

# Monitor
pm2 monit

# Logs
pm2 logs worker
```

#### Systemd Service

```ini
# /etc/systemd/system/agent-worker.service
[Unit]
Description=AI Agent Worker
After=network.target rabbitmq.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/plugin-ai-agent-rabbitmq
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/.env
ExecStart=/usr/bin/node scripts/orchestrator.js worker
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable agent-worker
sudo systemctl start agent-worker

# Check status
sudo systemctl status agent-worker

# View logs
sudo journalctl -u agent-worker -f
```

---

### Data Recovery

#### Recover Messages from Dead Letter Queue

```bash
# View dead letter queue
curl -u guest:guest http://localhost:15672/api/queues/%2F/agent.tasks.dlq

# Get messages from DLQ
# Via Management UI: Queues > agent.tasks.dlq > Get messages

# Or via CLI
docker exec rabbitmq rabbitmqctl list_queues name messages | grep dlq
```

#### Republish Dead Letters

```javascript
// Script to republish DLQ messages
async function reprocessDeadLetters() {
  const client = new RabbitMQClient();
  await client.connect();

  const dlqName = 'agent.tasks.dlq';

  await client.channel.consume(dlqName, async (msg) => {
    if (!msg) return;

    console.log('Reprocessing DLQ message:', msg.properties.messageId);

    // Republish to main queue
    await client.channel.sendToQueue(
      'agent.tasks',
      msg.content,
      msg.properties
    );

    client.channel.ack(msg);
  });
}
```

---

### Queue Purging

#### Purge via Management UI

1. Open http://localhost:15672
2. Go to Queues
3. Click on queue name (e.g., agent.tasks)
4. Click "Purge" button
5. Confirm

#### Purge via CLI

```bash
# Purge specific queue
docker exec rabbitmq rabbitmqctl purge_queue agent.tasks

# Or delete and recreate
docker exec rabbitmq rabbitmqctl delete_queue agent.tasks
```

#### Purge via API

```bash
# Purge queue
curl -u guest:guest -X DELETE \
  http://localhost:15672/api/queues/%2F/agent.tasks/contents
```

#### Purge in Code

```javascript
// In orchestrator or maintenance script
async function purgeQueue(queueName) {
  await client.channel.purgeQueue(queueName);
  console.log(`Purged queue: ${queueName}`);
}

// Usage
await purgeQueue('agent.tasks');
```

---

### System Reset

#### Complete System Reset

```bash
#!/bin/bash
# reset-system.sh

echo "Stopping all agents..."
pkill -f orchestrator.js

echo "Stopping RabbitMQ..."
docker stop rabbitmq

echo "Removing RabbitMQ container and data..."
docker rm rabbitmq
docker volume rm rabbitmq_data

echo "Starting fresh RabbitMQ..."
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -v rabbitmq_data:/var/lib/rabbitmq \
  rabbitmq:3-management

echo "Waiting for RabbitMQ to start..."
sleep 10

echo "Starting team leader..."
node scripts/orchestrator.js team-leader &

echo "Starting workers..."
for i in {1..3}; do
  node scripts/orchestrator.js worker &
done

echo "System reset complete!"
```

#### Partial Reset (Keep RabbitMQ)

```bash
#!/bin/bash
# reset-agents.sh

echo "Stopping all agents..."
pkill -f orchestrator.js

echo "Purging queues..."
docker exec rabbitmq rabbitmqctl purge_queue agent.tasks
docker exec rabbitmq rabbitmqctl purge_queue agent.results

echo "Restarting agents..."
node scripts/orchestrator.js team-leader &
node scripts/orchestrator.js worker &
node scripts/orchestrator.js worker &

echo "Agents restarted!"
```

---

## Monitoring & Diagnostics

### Health Check Commands

#### Agent Health Check

```bash
# Run health check script
node scripts/hooks/health-check.js

# Expected output:
# ✅ Agent health check passed
# - Agent: agent-abc123
# - Status: connected
# - Tasks: 5 completed, 0 failed
# - Memory: 45MB / 512MB
```

#### RabbitMQ Health Check

```bash
# Check RabbitMQ status
docker exec rabbitmq rabbitmqctl status

# Check node health
docker exec rabbitmq rabbitmqctl node_health_check

# Check alarms
docker exec rabbitmq rabbitmqctl alarm_list
```

#### System Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "=== System Health Check ==="

# Check RabbitMQ
echo -n "RabbitMQ: "
if curl -sf http://localhost:15672 > /dev/null; then
  echo "✅ Running"
else
  echo "❌ Not running"
  exit 1
fi

# Check queue status
echo -n "Task Queue: "
QUEUE_DEPTH=$(curl -s -u guest:guest http://localhost:15672/api/queues/%2F/agent.tasks | jq '.messages')
echo "$QUEUE_DEPTH messages"

if [ "$QUEUE_DEPTH" -gt 5000 ]; then
  echo "⚠️  Warning: High queue depth"
fi

# Check agent processes
echo -n "Agents: "
AGENT_COUNT=$(pgrep -f orchestrator.js | wc -l)
echo "$AGENT_COUNT running"

if [ "$AGENT_COUNT" -lt 2 ]; then
  echo "⚠️  Warning: Low agent count"
fi

echo "=== Health Check Complete ==="
```

---

### Diagnostic Scripts

#### Connection Diagnostic

```javascript
// diagnose-connection.js
import { RabbitMQClient } from './scripts/rabbitmq-client.js';

async function diagnoseConnection() {
  console.log('=== Connection Diagnostic ===\n');

  const client = new RabbitMQClient();

  try {
    console.log('Testing connection...');
    await client.connect();
    console.log('✅ Connection successful\n');

    console.log('Connection details:');
    console.log('- URL:', client.config.url);
    console.log('- Heartbeat:', client.config.heartbeat);
    console.log('- Agent ID:', client.agentId);
    console.log('- Connected:', client.isConnected);

    await client.close();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check RabbitMQ is running: docker ps | grep rabbitmq');
    console.error('2. Verify connection URL:', client.config.url);
    console.error('3. Test port: telnet localhost 5672');
  }
}

diagnoseConnection();
```

#### Queue Diagnostic

```javascript
// diagnose-queues.js
import axios from 'axios';

async function diagnoseQueues() {
  console.log('=== Queue Diagnostic ===\n');

  const baseURL = 'http://localhost:15672/api';
  const auth = { username: 'guest', password: 'guest' };

  try {
    const queues = await axios.get(`${baseURL}/queues`, { auth });

    console.log('Queues found:', queues.data.length);

    for (const queue of queues.data) {
      console.log(`\nQueue: ${queue.name}`);
      console.log('- Messages:', queue.messages);
      console.log('- Ready:', queue.messages_ready);
      console.log('- Unacked:', queue.messages_unacknowledged);
      console.log('- Consumers:', queue.consumers);
      console.log('- State:', queue.state);

      // Warnings
      if (queue.messages > 1000) {
        console.warn('⚠️  High message count!');
      }
      if (queue.consumers === 0 && queue.messages > 0) {
        console.warn('⚠️  Messages but no consumers!');
      }
      if (queue.messages_unacknowledged > 100) {
        console.warn('⚠️  High unacked count!');
      }
    }
  } catch (error) {
    console.error('❌ Failed to get queue info:', error.message);
    console.error('\nMake sure RabbitMQ Management plugin is enabled.');
  }
}

diagnoseQueues();
```

---

### Log Analysis

#### Centralized Logging

```bash
# Redirect all agent logs to files
node scripts/orchestrator.js team-leader > logs/leader.log 2>&1 &
node scripts/orchestrator.js worker > logs/worker1.log 2>&1 &
node scripts/orchestrator.js worker > logs/worker2.log 2>&1 &
```

#### Parse and Analyze Logs

```bash
# Find errors
grep "ERROR\|❌" logs/*.log

# Find connection issues
grep -i "connect\|disconnect" logs/*.log

# Find task failures
grep "Task failed\|tasksFailed" logs/*.log

# Count task completions
grep -c "Task completed" logs/*.log

# Find slow tasks
grep "duration" logs/*.log | awk -F': ' '{print $NF}' | sort -n | tail -10
```

#### Log Analysis Script

```javascript
// analyze-logs.js
const fs = require('fs');

function analyzeLogs(logFile) {
  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.split('\n');

  const stats = {
    errors: 0,
    warnings: 0,
    tasksReceived: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    connections: 0,
    disconnections: 0
  };

  for (const line of lines) {
    if (line.includes('ERROR') || line.includes('❌')) stats.errors++;
    if (line.includes('WARN') || line.includes('⚠️')) stats.warnings++;
    if (line.includes('Received task')) stats.tasksReceived++;
    if (line.includes('Task completed')) stats.tasksCompleted++;
    if (line.includes('Task failed')) stats.tasksFailed++;
    if (line.includes('connected to orchestration')) stats.connections++;
    if (line.includes('disconnected from orchestration')) stats.disconnections++;
  }

  console.log('Log Analysis:', logFile);
  console.log(stats);

  // Calculate success rate
  const total = stats.tasksCompleted + stats.tasksFailed;
  if (total > 0) {
    const successRate = (stats.tasksCompleted / total * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);
  }
}

// Usage
analyzeLogs('logs/worker1.log');
```

---

### Metrics Interpretation

#### Understanding Monitor Dashboard

```
🤖 AGENTS
   Total: 5
   Connected: 4 ✅         # Should match expected agent count
   Disconnected: 1 ❌      # Investigate why agents disconnect

📋 TASKS
   Queued: 42             # Backlog - consider scaling if high
   Active: 8              # Currently processing
   Completed: 156 ✅      # Total successful
   Failed: 4 ❌           # Check error rate

⚡ PERFORMANCE
   Success Rate: 97.5%    # Should be >95%
   Tasks/min: 12.3        # Throughput - compare to baseline
```

#### Key Metrics to Monitor

1. **Queue Depth (Queued)**
   - Normal: < 100
   - Warning: 100-1000
   - Critical: > 1000
   - Action: Scale workers if consistently high

2. **Success Rate**
   - Healthy: > 95%
   - Warning: 90-95%
   - Critical: < 90%
   - Action: Investigate failures, check logs

3. **Active Tasks**
   - Should correlate with worker count
   - If all workers busy but queue growing: scale up
   - If workers idle but tasks queued: investigate

4. **Throughput (Tasks/min)**
   - Establish baseline for your workload
   - Sudden drops indicate issues
   - Compare to historical data

5. **Agent Connections**
   - Should be stable
   - Frequent disconnections indicate problems
   - Monitor reconnection attempts

---

## Quick Reference

### Essential Commands

```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Check RabbitMQ status
docker ps | grep rabbitmq
curl http://localhost:15672

# Start agents
node scripts/orchestrator.js team-leader
node scripts/orchestrator.js worker

# Monitor system
node scripts/monitor.js

# Health check
node scripts/hooks/health-check.js

# Purge queue
docker exec rabbitmq rabbitmqctl purge_queue agent.tasks

# View logs
docker logs rabbitmq
tail -f logs/*.log
```

### Common Fixes

| Problem | Quick Fix |
|---------|-----------|
| Can't connect | `docker start rabbitmq` |
| Tasks stuck | Start more workers |
| Agent disconnected | Check AUTO_RECONNECT=true |
| Queue growing | Scale workers or optimize tasks |
| Memory high | Restart agent, check for leaks |
| Slow performance | Increase PREFETCH_COUNT |

### Support Resources

- RabbitMQ Documentation: https://www.rabbitmq.com/documentation.html
- RabbitMQ Management UI: http://localhost:15672
- Project Issues: [GitHub Issues](https://github.com/umitkacar/plugin-ai-agent-rabbitmq/issues)
- Node.js AMQP Lib: https://github.com/amqp-node/amqplib

---

**Need more help?** Open an issue on GitHub with:
- Error messages
- Logs (sanitized)
- System configuration
- Steps to reproduce
