"""
Task 5: Role Prompter v3.0 - RabbitMQ Rol Atama (Doc-Based)
============================================================
Her terminalde Claude'a rol dokumantasyonu okutturur:
- LEADER → docs/roles/LEADER.md oku ve uygula
- WORKER-1 → docs/roles/WORKER-1.md oku ve uygula
- WORKER-2 → docs/roles/WORKER-2.md oku ve uygula

v3.0 - Dok tabanli rol atama + Explicit talimatlar
v2.0 - Window ID ile kesin hedefleme + Rol bazli mesajlar
ULTRATHINK Edition - 15K GEM
"""

import subprocess
import time
from datetime import datetime
from typing import Any, Dict
from pathlib import Path

from .base import BaseTask, TaskResult, TaskStatus


class RolePrompterTask(BaseTask):
    """
    Role Prompter Task - Claude'lara İlk Soru

    1. Her terminal penceresine odaklan
    2. Keystroke ile mesaj yaz
    3. Enter'a bas
    4. Cevap için bekle
    5. Screenshot al
    """

    name = "role_prompter"
    description = "Claude'lara RabbitMQ rol ataması yapar (doc-based)"
    version = "3.0.0"  # Doc-based rol atama

    # v3.0 - Dok tabanli rol mesajlari (FULL PATH!)
    # Her agent kendi rol dokumanini okuyacak ve uygulayacak
    # NOT: AppleScript uyumlulugu icin apostrophe kullanmiyoruz
    # KRITIK: Full path kullan, relative path calismaz!

    ROLE_PROMPTS = {
        'LEADER': 'Senin rolun TEAM LEADER. Simdi /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/docs/roles/LEADER.md dosyasini oku ve talimatlari uygula.',
        'WORKER-1': 'Senin rolun WORKER-1 (Collaborator). Simdi /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/docs/roles/WORKER-1.md dosyasini oku ve talimatlari uygula.',
        'WORKER-2': 'Senin rolun WORKER-2. Simdi /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/docs/roles/WORKER-2.md dosyasini oku ve talimatlari uygula.',
    }

    DEFAULT_CONFIG = {
        'wait_before_typing': 5,      # Claude hazır olana kadar bekle
        'typing_delay': 0.03,         # Karakterler arası bekleme (saniye)
        'wait_after_enter': 10,       # Enter sonrası cevap bekleme
        'wait_between_terminals': 7,  # Terminaller arası bekleme
        'screenshot_after_each': True,
        'screenshot_dir': 'screenshots',
        'jpeg_quality': 100,
        'resize_factor': 0.5,
    }

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.settings = {**self.DEFAULT_CONFIG, **(config or {})}

    def execute(self, context: Dict[str, Any]) -> TaskResult:
        """Her terminalde Claude'a ROL DOKUMANI okut - Window ID ile!"""

        print("\n💬 Role Prompter v3.0 (Doc-Based Rol Atama)...")

        # Önceki task'lardan bilgi al
        terminals = context.get('terminals', [])
        launched_in = context.get('launched_in', [])
        x_offset = context.get('x_offset', 0)
        external_display = context.get('external_display', {})

        if not terminals or not launched_in:
            return TaskResult(
                task_name=self.name,
                status=TaskStatus.FAILED,
                error="No terminal/launch information from previous tasks"
            )

        terminal_count = len(terminals)
        wait_before = self.settings['wait_before_typing']
        wait_after = self.settings['wait_after_enter']
        wait_between = self.settings['wait_between_terminals']

        print(f"   🖥️  Terminals: {terminal_count}")
        print(f"   ⏱️  Wait before typing: {wait_before}s")
        print(f"   ⏱️  Wait after enter: {wait_after}s")
        print(f"   ⏱️  Wait between terminals: {wait_between}s")

        # Rol atamaları göster
        print(f"\n   📋 ROL ATAMALARI:")
        for term in terminals:
            title = term.get('title', 'Unknown')
            window_id = term.get('window_id', 'N/A')
            role_prompt = self.ROLE_PROMPTS.get(title, 'Genel görev')
            print(f"      🔑 {title} (ID: {window_id}) → {role_prompt[:50]}...")

        # Her terminalde ROL-SPESİFİK soru sor
        results = []
        screenshots = []
        role_assignments = {}  # Terminal → Rol mapping

        for i, term in enumerate(terminals):
            terminal_title = term.get('title', f'Terminal {i+1}')
            window_id = term.get('window_id')  # Benzersiz ID!

            # Rol-spesifik mesaj al
            prompt = self.ROLE_PROMPTS.get(terminal_title, 'Sana bir görev vereceğim, hazır mısın?')

            print(f"\n   📝 [{terminal_title}] Window ID: {window_id}")
            print(f"   💬 Mesaj: {prompt}")

            # İlk terminal için bekle
            if i == 0:
                print(f"   ⏳ Waiting {wait_before}s for Claude to be ready...")
                time.sleep(wait_before)

            # Window ID ile kesin hedefle!
            if window_id:
                success = self._send_prompt_by_window_id(window_id, prompt)
            else:
                # Fallback: X pozisyonu
                terminal_x = term.get('x', 0)
                success = self._send_prompt_to_terminal(i + 1, terminal_count, terminal_title, prompt, terminal_x)

            if success:
                print(f"   ✅ Rol atandı: {terminal_title}")

                # Cevap için bekle
                print(f"   ⏳ Waiting {wait_after}s for Claude's response...")
                time.sleep(wait_after)

                # Screenshot al
                if self.settings['screenshot_after_each']:
                    screenshot_path = self._take_terminal_screenshot(
                        terminal_title, external_display, x_offset
                    )
                    if screenshot_path:
                        screenshots.append(str(screenshot_path))
                        print(f"   📸 Screenshot: {screenshot_path.name}")

                # Rol atamasını kaydet
                role_assignments[terminal_title] = {
                    'window_id': window_id,
                    'role': terminal_title,  # LEADER, WORKER-1, WORKER-2
                    'prompt_sent': prompt,
                    'status': 'assigned'
                }

                results.append({
                    'terminal': terminal_title,
                    'window_id': window_id,
                    'status': 'success',
                    'prompt_sent': prompt
                })
            else:
                print(f"   ⚠️  Failed to send prompt to {terminal_title}")
                results.append({
                    'terminal': terminal_title,
                    'window_id': window_id,
                    'status': 'failed'
                })

            # Son terminal değilse bekle
            if i < terminal_count - 1:
                print(f"   ⏳ Waiting {wait_between}s before next terminal...")
                time.sleep(wait_between)

        # Final screenshot (tüm ekran)
        print(f"\n   📸 Taking final verification screenshot...")
        final_screenshot = self._take_screenshot(external_display, x_offset)

        successful = sum(1 for r in results if r['status'] == 'success')

        print(f"\n   📋 ROL ATAMA ÖZETİ:")
        print(f"   ─────────────────────────────────────")
        print(f"   🎯 Roller atandı: {successful}/{terminal_count}")
        for r in results:
            status_icon = "✅" if r['status'] == 'success' else "❌"
            wid = r.get('window_id', 'N/A')
            print(f"      {status_icon} {r['terminal']} (ID: {wid})")
        if final_screenshot:
            print(f"   📸 Final screenshot: {final_screenshot.name}")
        print(f"   ─────────────────────────────────────")

        # Rol Tracking bilgisi
        print(f"\n   🔑 ROL-TERMINAL MAPPING (Window ID ile):")
        print(f"   ─────────────────────────────────────")
        for title, assignment in role_assignments.items():
            print(f"      {title}: Window ID {assignment['window_id']} → {assignment['role']}")
        print(f"   ─────────────────────────────────────")

        return TaskResult(
            task_name=self.name,
            status=TaskStatus.SUCCESS if successful > 0 else TaskStatus.FAILED,
            data={
                'prompts_sent': successful,
                'total_terminals': terminal_count,
                'results': results,
                'role_assignments': role_assignments,  # Terminal → Rol mapping!
                'screenshots': screenshots,
                'final_screenshot': str(final_screenshot) if final_screenshot else None,
                'verification_checklist': [
                    'Her terminalde doğru rol mesajı var mı?',
                    'Her Claude "hazırım" dedi mi?',
                    'Window ID mapping doğru mu?'
                ]
            }
        )

    def _send_prompt_by_window_id(self, window_id: int, message: str) -> bool:
        """Window ID ile kesin hedefleme - %100 güvenilir!"""

        # Escape sadece double quote - single quote AppleScript'te OK
        escaped_message = message.replace('"', '\\"')

        applescript = f'''
tell application "Terminal"
    activate
    delay 0.3

    -- Window ID ile kesin hedefle
    try
        set targetWindow to window id {window_id}

        -- Pencereyi öne getir
        set frontmost of targetWindow to true
        set index of targetWindow to 1
        delay 0.5

        -- Keystroke ile yaz
        tell application "System Events"
            tell process "Terminal"
                keystroke "{escaped_message}"
                delay 0.3
                keystroke return
            end tell
        end tell

        return "OK: Window ID {window_id}"
    on error errMsg
        return "ERROR: " & errMsg
    end try
end tell
'''

        try:
            result = subprocess.run(
                ['osascript', '-e', applescript],
                capture_output=True,
                text=True,
                timeout=15
            )

            if 'OK' in result.stdout:
                return True
            else:
                print(f"      ⚠️  AppleScript: {result.stdout.strip()} {result.stderr.strip()}")
                return False

        except Exception as e:
            print(f"      ❌ Error: {e}")
            return False

    def _send_prompt_to_terminal(self, window_index: int, total_windows: int,
                                  title: str, message: str, x_position: int = 0) -> bool:
        """Fallback: X POZİSYONU ile tanımla (Window ID yoksa)"""

        # Escape sadece double quote - single quote AppleScript'te OK
        escaped_message = message.replace('"', '\\"')

        # X pozisyonu ile pencere bul (Claude Code title değiştirebilir, pozisyon sabit!)
        applescript = f'''
tell application "Terminal"
    activate
    delay 0.3

    -- X pozisyonu ile pencere bul (title yerine - daha güvenilir)
    set targetWindow to null
    set targetX to {x_position}

    repeat with w in windows
        set windowBounds to bounds of w
        set windowX to item 1 of windowBounds
        -- X pozisyonu ±50 pixel tolerans ile eşleş
        if windowX >= (targetX - 50) and windowX <= (targetX + 50) then
            set targetWindow to w
            exit repeat
        end if
    end repeat

    if targetWindow is not null then
        -- Pencereyi öne getir
        set frontmost of targetWindow to true
        set index of targetWindow to 1
        delay 0.5

        -- Keystroke ile yaz
        tell application "System Events"
            tell process "Terminal"
                keystroke "{escaped_message}"
                delay 0.3
                keystroke return
            end tell
        end tell

        return "OK: Window at x={x_position} ({title})"
    else
        return "ERROR: Window at x={x_position} not found"
    end if
end tell
'''

        try:
            result = subprocess.run(
                ['osascript', '-e', applescript],
                capture_output=True,
                text=True,
                timeout=15
            )

            if 'OK' in result.stdout:
                return True
            else:
                print(f"      ⚠️  AppleScript: {result.stdout.strip()} {result.stderr.strip()}")
                return False

        except Exception as e:
            print(f"      ❌ Error: {e}")
            return False

    def _take_terminal_screenshot(self, terminal_title: str,
                                   external_display: Dict, x_offset: int) -> Path:
        """Tek terminal için screenshot"""

        base_dir = Path(__file__).parent.parent
        screenshot_dir = base_dir / self.settings['screenshot_dir']
        screenshot_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_title = terminal_title.replace(' ', '_').lower()
        raw_path = screenshot_dir / f"response_{safe_title}_{timestamp}_raw.png"
        final_path = screenshot_dir / f"response_{safe_title}_{timestamp}.jpg"

        width = external_display.get('width', 1920)
        height = external_display.get('height', 1080)

        try:
            subprocess.run([
                'screencapture',
                '-R', f'{x_offset},0,{width},{height}',
                '-x',
                str(raw_path)
            ], capture_output=True, timeout=10)

            if not raw_path.exists():
                return None

            # Sıkıştır
            resize_factor = self.settings['resize_factor']
            new_width = int(width * resize_factor)

            temp_path = screenshot_dir / f"temp_{safe_title}_{timestamp}.png"
            subprocess.run([
                'sips', '--resampleWidth', str(new_width),
                str(raw_path), '--out', str(temp_path)
            ], capture_output=True, timeout=10)

            subprocess.run([
                'sips', '-s', 'format', 'jpeg',
                '-s', 'formatOptions', str(self.settings['jpeg_quality']),
                str(temp_path), '--out', str(final_path)
            ], capture_output=True, timeout=10)

            # Temizlik
            raw_path.unlink(missing_ok=True)
            temp_path.unlink(missing_ok=True)

            if final_path.exists():
                return final_path

        except Exception as e:
            print(f"   ⚠️  Screenshot error: {e}")

        return None

    def _take_screenshot(self, external_display: Dict, x_offset: int) -> Path:
        """Final verification screenshot"""

        base_dir = Path(__file__).parent.parent
        screenshot_dir = base_dir / self.settings['screenshot_dir']
        screenshot_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        raw_path = screenshot_dir / f"role_prompter_final_{timestamp}_raw.png"
        final_path = screenshot_dir / f"role_prompter_final_{timestamp}.jpg"

        width = external_display.get('width', 1920)
        height = external_display.get('height', 1080)

        try:
            subprocess.run([
                'screencapture',
                '-R', f'{x_offset},0,{width},{height}',
                '-x',
                str(raw_path)
            ], capture_output=True, timeout=10)

            if not raw_path.exists():
                return None

            resize_factor = self.settings['resize_factor']
            new_width = int(width * resize_factor)

            temp_path = screenshot_dir / f"temp_final_{timestamp}.png"
            subprocess.run([
                'sips', '--resampleWidth', str(new_width),
                str(raw_path), '--out', str(temp_path)
            ], capture_output=True, timeout=10)

            subprocess.run([
                'sips', '-s', 'format', 'jpeg',
                '-s', 'formatOptions', str(self.settings['jpeg_quality']),
                str(temp_path), '--out', str(final_path)
            ], capture_output=True, timeout=10)

            raw_path.unlink(missing_ok=True)
            temp_path.unlink(missing_ok=True)

            if final_path.exists():
                size_kb = final_path.stat().st_size / 1024
                print(f"   💾 Final screenshot: {final_path.name} ({size_kb:.1f} KB)")
                return final_path

        except Exception as e:
            print(f"   ⚠️  Screenshot error: {e}")

        return None
