#!/usr/bin/env python3
"""
Pattern C Live Test: Session-Based Multi-Agent

Sends commands to 3 live Claude Code instances to test:
1. Team Leader creates session
2. Workers join session
3. Tasks assigned (primes, fibonacci)
4. Results collected and intersection calculated

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

import asyncio
import sys
import os
import time
from pathlib import Path

# Add project to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import iterm2
except ImportError:
    print("Error: iterm2 not installed")
    sys.exit(1)

from src.ramas.python import registry


async def send_message_to_session(connection, session_id: str, message: str):
    """Send a message to a specific iTerm2 session"""
    app = await iterm2.async_get_app(connection)

    for window in app.windows:
        for tab in window.tabs:
            for session in tab.sessions:
                if session.session_id == session_id:
                    # Send ESC first to ensure we're at prompt
                    await session.async_send_text("\x1b")
                    await asyncio.sleep(0.3)

                    # Send the message
                    await session.async_send_text(message)
                    await asyncio.sleep(0.5)

                    # Press Enter (carriage return for iTerm2)
                    await session.async_send_text("\r")

                    print(f"  ✅ Message sent to {session_id[:20]}...")
                    return True

    print(f"  ❌ Session not found: {session_id}")
    return False


async def run_test():
    """Run the Pattern C test"""
    print()
    print("=" * 70)
    print("  PATTERN C LIVE TEST: Session-Based Multi-Agent")
    print("  Asal Sayılar × Fibonacci → Kesişim (1-1000)")
    print("=" * 70)
    print()

    # Get sessions from registry
    windows = registry.get_all_windows()

    if len(windows) < 3:
        print(f"❌ Need 3 windows, found {len(windows)}")
        print("   Run launch_windows.py first!")
        return False

    team_leader = windows.get("team-leader")
    worker_001 = windows.get("worker-001")
    worker_002 = windows.get("worker-002")

    if not all([team_leader, worker_001, worker_002]):
        print("❌ Missing required workers in registry")
        return False

    print("Workers found:")
    print(f"  Team Leader: {team_leader.session_id[:20]}...")
    print(f"  Worker-001:  {worker_001.session_id[:20]}...")
    print(f"  Worker-002:  {worker_002.session_id[:20]}...")
    print()

    # Connect to iTerm2
    print("Connecting to iTerm2...")
    connection = await iterm2.Connection.async_create()
    print("✅ Connected")
    print()

    # =========================================================================
    # Step 1: Team Leader creates session
    # =========================================================================
    print("=" * 70)
    print("STEP 1: Team Leader creates session and connects to RabbitMQ")
    print("=" * 70)
    print()

    team_leader_cmd = """Şimdi Pattern C Session-Based Multi-Agent testini yapacağız.

GÖREV:
1. RabbitMQ'ya bağlan (register_agent tool'u ile team-leader olarak)
2. "Matematik Hesaplama" adlı bir session oluştur (create_session tool'u ile)
3. Session ID'yi bana söyle

Başla!"""

    await send_message_to_session(connection, team_leader.session_id, team_leader_cmd)

    print()
    print("⏳ Team Leader çalışıyor... (30 saniye bekle)")
    print("   Session oluşturulduğunda session_id'yi not al!")
    print()

    # Wait for user to get session_id
    print("-" * 70)
    input("Session ID'yi aldıktan sonra ENTER'a bas...")
    print("-" * 70)

    session_id = input("Session ID'yi gir: ").strip()

    if not session_id:
        print("❌ Session ID gerekli!")
        return False

    print(f"✅ Session ID: {session_id}")
    print()

    # =========================================================================
    # Step 2: Worker-001 joins and gets task
    # =========================================================================
    print("=" * 70)
    print("STEP 2: Worker-001 joins session → Asal Sayılar görevi")
    print("=" * 70)
    print()

    worker1_cmd = f"""Pattern C Session testine katılıyorsun.

GÖREV:
1. RabbitMQ'ya bağlan (register_agent tool'u ile worker olarak)
2. Session'a katıl: join_session(sessionId="{session_id}", agentRole="worker")
3. Team Leader'dan görev bekle
4. Görev gelince: 1-1000 arası TÜM ASAL SAYILARI bul
5. Sonucu report_task_completion ile bildir

Başla!"""

    await send_message_to_session(connection, worker_001.session_id, worker1_cmd)
    print()

    # =========================================================================
    # Step 3: Worker-002 joins and gets task
    # =========================================================================
    print("=" * 70)
    print("STEP 3: Worker-002 joins session → Fibonacci görevi")
    print("=" * 70)
    print()

    worker2_cmd = f"""Pattern C Session testine katılıyorsun.

GÖREV:
1. RabbitMQ'ya bağlan (register_agent tool'u ile worker olarak)
2. Session'a katıl: join_session(sessionId="{session_id}", agentRole="worker")
3. Team Leader'dan görev bekle
4. Görev gelince: 1-1000 arası TÜM FİBONACCİ SAYILARINI bul
5. Sonucu report_task_completion ile bildir

Başla!"""

    await send_message_to_session(connection, worker_002.session_id, worker2_cmd)
    print()

    print("⏳ Worker'lar session'a katılıyor... (20 saniye bekle)")
    await asyncio.sleep(5)

    # =========================================================================
    # Step 4: Team Leader assigns tasks
    # =========================================================================
    print()
    print("=" * 70)
    print("STEP 4: Team Leader assigns tasks")
    print("=" * 70)
    print()

    assign_cmd = """Worker'lar session'a katıldı. Şimdi görevleri dağıt:

1. Worker-001'e görev ata (assign_session_task):
   - title: "Asal Sayılar"
   - description: "1-1000 arası tüm asal sayıları bul ve listele"
   - assignTo: worker-001 için agent_id

2. Worker-002'ye görev ata (assign_session_task):
   - title: "Fibonacci Sayıları"
   - description: "1-1000 arası tüm Fibonacci sayılarını bul ve listele"
   - assignTo: worker-002 için agent_id

Görevleri ata!"""

    await send_message_to_session(connection, team_leader.session_id, assign_cmd)
    print()

    print("⏳ Görevler dağıtılıyor ve worker'lar çalışıyor...")
    print("   Bu birkaç dakika sürebilir.")
    print()
    print("-" * 70)
    input("Tüm görevler tamamlandığında ENTER'a bas...")
    print("-" * 70)
    print()

    # =========================================================================
    # Step 5: Team Leader collects results and calculates intersection
    # =========================================================================
    print("=" * 70)
    print("STEP 5: Team Leader collects results and calculates intersection")
    print("=" * 70)
    print()

    collect_cmd = """Görevler tamamlandı. Şimdi:

1. get_session_status ile session durumunu kontrol et
2. Her iki worker'ın sonuçlarını al
3. KESİŞİMİ HESAPLA: Hem asal hem Fibonacci olan sayılar hangileri?
4. Sonucu session_broadcast ile tüm katılımcılara duyur
5. conclude_meeting ile toplantıyı bitir

Sonuçları topla ve kesişimi hesapla!"""

    await send_message_to_session(connection, team_leader.session_id, collect_cmd)
    print()

    print("=" * 70)
    print("  TEST TAMAMLANDI!")
    print("=" * 70)
    print()
    print("Beklenen Kesişim (Hem Asal Hem Fibonacci):")
    print("  2, 3, 5, 13, 89, 233")
    print()
    print("Team Leader penceresinde sonuçları kontrol edin!")
    print()

    return True


async def main():
    try:
        success = await run_test()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
