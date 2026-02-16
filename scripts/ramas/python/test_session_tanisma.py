#!/usr/bin/env python3
"""
Session Test: Tanışma Toplantısı (Introduction Meeting)

This test simulates a full session-based multi-agent collaboration:

1. Team Leader creates a session
2. Worker-001 joins the session
3. Worker-002 joins the session
4. Team Leader starts "Tanışma Toplantısı" (Introduction Meeting)
5. Each agent introduces themselves
6. Team Leader assigns tasks
7. Workers complete tasks and report results
8. Team Leader concludes meeting and closes session

This is the first Pattern C integration test!

Author: Dr. Umit Kacar
Date: 2026-01-01

Usage:
    cd /path/to/project
    python scripts/ramas/python/test_session_tanisma.py
"""

import os
import sys
import asyncio
import json
from datetime import datetime
from uuid import uuid4

# Add project to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from src.ramas.python.session_manager import SessionManager
from src.ramas.python.session_state import SessionConfig, SessionState, TimeoutConfig
from src.ramas.python.session_messages import (
    MessageType,
    SessionMessageFactory,
    PresenceAction,
)


# Configuration
RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://admin:rabbitmq123@localhost:5672")

# Simulated agents
TEAM_LEADER_ID = "team-leader-001"
WORKER_001_ID = "worker-001"
WORKER_002_ID = "worker-002"


def print_header(title: str):
    """Print a section header"""
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)
    print()


def print_step(step: int, description: str):
    """Print a step indicator"""
    print(f"\n📋 Step {step}: {description}")
    print("-" * 50)


def print_success(message: str):
    """Print success message"""
    print(f"  ✅ {message}")


def print_info(message: str):
    """Print info message"""
    print(f"  ℹ️  {message}")


async def run_tanisma_toplantisi():
    """
    Run the Tanışma Toplantısı (Introduction Meeting) test.

    This simulates a complete session lifecycle with multiple agents.
    """
    print_header("PATTERN C TEST: Tanışma Toplantısı (Introduction Meeting)")

    print("This test simulates a multi-agent session-based collaboration:")
    print()
    print("  👔 Team Leader: Creates session, assigns tasks, leads meeting")
    print("  👷 Worker-001: Joins, introduces self, completes assigned task")
    print("  👷 Worker-002: Joins, introduces self, completes assigned task")
    print()

    # =========================================================================
    # Step 1: Team Leader creates session
    # =========================================================================
    print_step(1, "Team Leader creates session")

    # Create session manager for Team Leader
    team_leader_manager = SessionManager(RABBITMQ_URL)

    try:
        await team_leader_manager.connect()
        print_success("Team Leader connected to RabbitMQ")
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        print("\n  Make sure RabbitMQ is running:")
        print("    docker compose -f infrastructure/docker/compose/docker-compose.yml up -d")
        return False

    # Create session config
    session_config = SessionConfig(
        session_id=f"tanisma-{uuid4().hex[:8]}",
        session_name="Tanışma Toplantısı",
        session_type="meeting",
        expected_worker_count=2,
        timeouts=TimeoutConfig(
            join_timeout=120.0,  # 2 minutes to join
            session_timeout=600.0,  # 10 minutes max session
        ),
        metadata={
            "purpose": "Team introduction and task assignment",
            "language": "tr",
        }
    )

    # Create session
    session = await team_leader_manager.create_session(session_config)
    session_id = session.session_id
    print_success(f"Session created: {session_id}")
    print_info(f"Session name: {session_config.session_name}")
    print_info(f"State: {session.state_machine.state.value}")

    # Team Leader joins as leader
    join_result = await session.join(
        agent_id=TEAM_LEADER_ID,
        agent_role="team-leader",
        capabilities=["assign_tasks", "lead_meetings", "aggregate_results"],
    )
    print_success(f"Team Leader joined: {TEAM_LEADER_ID}")
    print_info(f"State: {session.state_machine.state.value}")

    # =========================================================================
    # Step 2: Worker-001 joins
    # =========================================================================
    print_step(2, "Worker-001 joins session")

    # In real scenario, Worker-001 would have its own SessionManager
    # Here we simulate by joining the same session

    join_result = await session.join(
        agent_id=WORKER_001_ID,
        agent_role="worker",
        capabilities=["code_review", "testing", "python"],
    )
    print_success(f"Worker-001 joined: {WORKER_001_ID}")
    print_info(f"Participants: {len(session.participants)}")
    print_info(f"State: {session.state_machine.state.value}")

    # =========================================================================
    # Step 3: Worker-002 joins
    # =========================================================================
    print_step(3, "Worker-002 joins session")

    join_result = await session.join(
        agent_id=WORKER_002_ID,
        agent_role="worker",
        capabilities=["documentation", "research", "typescript"],
    )
    print_success(f"Worker-002 joined: {WORKER_002_ID}")
    print_info(f"Participants: {len(session.participants)}")
    print_info(f"State: {session.state_machine.state.value}")

    # All workers joined
    if len(session.participants) >= session.config.expected_worker_count + 1:  # +1 for leader
        print_success("All expected participants have joined!")

    # =========================================================================
    # Step 4: Team Leader broadcasts welcome message
    # =========================================================================
    print_step(4, "Team Leader broadcasts welcome message")

    welcome_message = SessionMessageFactory.chat(
        session_id=session_id,
        sender_id=TEAM_LEADER_ID,
        content="Merhaba arkadaşlar! Tanışma toplantımıza hoş geldiniz. 🎉",
    )

    await session.broadcast(welcome_message)
    print_success("Welcome message broadcast")
    print_info(f"Message history count: {len(session.message_history)}")

    # =========================================================================
    # Step 5: Start the introduction meeting
    # =========================================================================
    print_step(5, "Team Leader starts the Introduction Meeting")

    meeting = await session.start_meeting(
        title="Tanışma Toplantısı - İlk Buluşma",
        meeting_type="introduction",
        agenda=[
            {"topic": "Kendini tanıt", "duration": 2},
            {"topic": "Yeteneklerini paylaş", "duration": 2},
            {"topic": "Görev dağılımı", "duration": 5},
        ],
        started_by=TEAM_LEADER_ID,
    )
    print_success(f"Meeting started: {meeting.meeting_id}")
    print_info(f"Meeting type: {meeting.meeting_type}")
    print_info(f"Agenda items: {len(meeting.agenda)}")

    # =========================================================================
    # Step 6: Agents introduce themselves
    # =========================================================================
    print_step(6, "Agents introduce themselves")

    # Worker-001 introduces
    intro_001 = SessionMessageFactory.chat(
        session_id=session_id,
        sender_id=WORKER_001_ID,
        content="Merhaba! Ben Worker-001, Python ve test konularında uzmanım. "
                "Code review ve testing görevlerini alabilirim. 🐍",
    )
    await session.broadcast(intro_001)
    print_success("Worker-001: Kendini tanıttı")

    # Worker-002 introduces
    intro_002 = SessionMessageFactory.chat(
        session_id=session_id,
        sender_id=WORKER_002_ID,
        content="Merhaba! Ben Worker-002, dokümantasyon ve araştırma uzmanıyım. "
                "TypeScript ve teknik yazım konularında yardımcı olabilirim. 📝",
    )
    await session.broadcast(intro_002)
    print_success("Worker-002: Kendini tanıttı")

    # Team Leader response
    leader_response = SessionMessageFactory.chat(
        session_id=session_id,
        sender_id=TEAM_LEADER_ID,
        content="Harika! İkinizin de yetenekleri projemiz için çok değerli. "
                "Şimdi görevleri dağıtıyorum.",
    )
    await session.broadcast(leader_response)
    print_success("Team Leader: Görev dağılımına geçiyor")

    # =========================================================================
    # Step 7: Team Leader assigns tasks
    # =========================================================================
    print_step(7, "Team Leader assigns tasks")

    # Task for Worker-001: Prime numbers calculation
    task_001 = await session.assign_task(
        title="Asal Sayı Hesaplama",
        description="1'den 100'e kadar tüm asal sayıları bul ve listeye yaz.",
        assigned_to=WORKER_001_ID,
        assigned_by=TEAM_LEADER_ID,
        task_type="calculation",
        priority="high",
    )
    print_success(f"Task assigned to Worker-001: {task_001.task_id}")
    print_info(f"Title: {task_001.title}")

    # Task for Worker-002: Fibonacci calculation
    task_002 = await session.assign_task(
        title="Fibonacci Dizisi",
        description="100'den küçük tüm Fibonacci sayılarını bul ve listeye yaz.",
        assigned_to=WORKER_002_ID,
        assigned_by=TEAM_LEADER_ID,
        task_type="calculation",
        priority="high",
    )
    print_success(f"Task assigned to Worker-002: {task_002.task_id}")
    print_info(f"Title: {task_002.title}")

    # =========================================================================
    # Step 8: Workers complete tasks
    # =========================================================================
    print_step(8, "Workers complete their tasks")

    # Simulate Worker-001 completing task (prime numbers 1-100)
    primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
              53, 59, 61, 67, 71, 73, 79, 83, 89, 97]

    await session.complete_task(
        task_id=task_001.task_id,
        result={"primes": primes, "count": len(primes)},
        success=True,
    )
    print_success(f"Worker-001 completed task: Found {len(primes)} prime numbers")

    # Simulate Worker-002 completing task (Fibonacci < 100)
    fibonacci = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]

    await session.complete_task(
        task_id=task_002.task_id,
        result={"fibonacci": fibonacci, "count": len(fibonacci)},
        success=True,
    )
    print_success(f"Worker-002 completed task: Found {len(fibonacci)} Fibonacci numbers")

    # =========================================================================
    # Step 9: Check session status
    # =========================================================================
    print_step(9, "Check session status")

    status = session.get_status()

    print_info(f"Session ID: {status['session_id']}")
    print_info(f"State: {status['state']}")
    print_info(f"Participants: {status['participant_count']}")
    print_info(f"Tasks completed: {status['tasks']['completed']}/{status['tasks']['total']}")
    print_info(f"Message count: {status['metrics']['message_count']}")

    # =========================================================================
    # Step 10: Conclude meeting and close session
    # =========================================================================
    print_step(10, "Conclude meeting and close session")

    # Conclude meeting
    await session.conclude_meeting(
        meeting_id=meeting.meeting_id,
        summary="Tanışma toplantısı başarıyla tamamlandı. "
                "Tüm görevler başarıyla tamamlandı. "
                f"Toplam {len(primes)} asal sayı ve {len(fibonacci)} Fibonacci sayısı bulundu.",
        decisions=[
            {"decision": "Her hafta benzer toplantılar yapılacak", "owner": TEAM_LEADER_ID},
            {"decision": "Görevler RabbitMQ üzerinden dağıtılacak", "owner": TEAM_LEADER_ID},
        ],
    )
    print_success("Meeting concluded")

    # Team Leader says goodbye
    goodbye = SessionMessageFactory.chat(
        session_id=session_id,
        sender_id=TEAM_LEADER_ID,
        content="Harika iş çıkardınız! Herkese teşekkürler. "
                "Bir sonraki toplantıda görüşmek üzere! 👋",
    )
    await session.broadcast(goodbye)
    print_success("Team Leader: Session closing")

    # Close session
    await team_leader_manager.close_session(session_id, "completed")
    print_success("Session closed successfully")

    # Final status
    print_info(f"Final state: {session.state_machine.state.value}")
    print_info(f"Total messages: {len(session.message_history)}")

    # Cleanup
    await team_leader_manager.disconnect()
    print_success("Team Leader disconnected")

    # =========================================================================
    # Summary
    # =========================================================================
    print_header("TEST SUMMARY")

    print("Session Lifecycle:")
    for transition in session.state_machine.history:
        print(f"  {transition.from_state.value} → {transition.to_state.value} ({transition.event.value})")

    print()
    print("Results:")
    print(f"  ✅ Session created and closed successfully")
    print(f"  ✅ 3 agents joined (1 leader, 2 workers)")
    print(f"  ✅ Introduction meeting completed")
    print(f"  ✅ 2 tasks assigned and completed")
    print(f"  ✅ {len(session.message_history)} messages exchanged")
    print()
    print("Pattern C Session-Based Multi-Agent: SUCCESS! 🎉")
    print()

    return True


async def main():
    """Main entry point"""
    try:
        success = await run_tanisma_toplantisi()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
