"""
Task 4: Claude Launcher - Dangerous Mode v2.0
==============================================
3 terminalde sırayla Claude Code açar (dangerous mode).
Her terminal arasında bekler, sonra screenshot ile kanıtlar.

v2.0 - Window ID ile kesin hedefleme (UUID yerine)
10K GEM - ULTRATHINK Edition
"""

import subprocess
import time
from datetime import datetime
from typing import Any, Dict
from pathlib import Path

from .base import BaseTask, TaskResult, TaskStatus


class ClaudeLauncherTask(BaseTask):
    """
    Claude Launcher Task - Dangerous Mode

    1. 3 terminalde sırayla claude --dangerously-skip-permissions açar
    2. Her terminal arasında 5-10 saniye bekler
    3. Screenshot alır - açıldığının kanıtı
    """

    name = "claude_launcher"
    description = "3 terminalde Claude Code (dangerous mode) açar"
    version = "2.0.0"  # Window ID hedefleme

    DEFAULT_CONFIG = {
        'claude_command': 'claude --dangerously-skip-permissions',
        'wait_between_launches': 7,    # Her terminal arası bekleme (saniye)
        'wait_after_all': 5,           # Tümü açıldıktan sonra bekleme
        'screenshot_after': True,       # Sonunda screenshot al
        'screenshot_dir': 'screenshots',
        'jpeg_quality': 100,
        'resize_factor': 0.5,
    }

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.settings = {**self.DEFAULT_CONFIG, **(config or {})}

    def execute(self, context: Dict[str, Any]) -> TaskResult:
        """3 terminalde Claude aç"""

        print("\n🤖 Claude Launcher (Dangerous Mode)...")

        # Önceki task'lardan bilgi al
        terminals = context.get('terminals', [])
        x_offset = context.get('x_offset', 0)
        external_display = context.get('external_display', {})

        if not terminals:
            return TaskResult(
                task_name=self.name,
                status=TaskStatus.FAILED,
                error="No terminal information from previous task"
            )

        terminal_count = len(terminals)
        wait_time = self.settings['wait_between_launches']
        claude_cmd = self.settings['claude_command']

        print(f"   🖥️  Terminals to launch: {terminal_count}")
        print(f"   ⏱️  Wait between launches: {wait_time}s")
        print(f"   💻 Command: {claude_cmd}")

        # Her terminalde Claude aç - Window ID ile!
        launched = []
        for i, term in enumerate(terminals):
            terminal_title = term.get('title', f'Terminal {i+1}')
            window_id = term.get('window_id')  # Benzersiz ID!

            if window_id:
                print(f"\n   🚀 Launching Claude in {terminal_title} (Window ID: {window_id})...")
                success = self._launch_claude_by_window_id(window_id, claude_cmd)
            else:
                # Fallback: eski index yöntemi
                print(f"\n   🚀 Launching Claude in {terminal_title} (fallback mode)...")
                success = self._launch_claude_in_terminal(i + 1, terminal_count, claude_cmd)

            if success:
                launched.append(terminal_title)
                print(f"   ✅ Claude started in {terminal_title}")
            else:
                print(f"   ⚠️  Failed to start Claude in {terminal_title}")

            # Son terminal değilse bekle
            if i < terminal_count - 1:
                print(f"   ⏳ Waiting {wait_time}s before next launch...")
                time.sleep(wait_time)

        # Tümü açıldıktan sonra bekle
        wait_after = self.settings['wait_after_all']
        print(f"\n   ⏳ Waiting {wait_after}s for all Claude instances to initialize...")
        time.sleep(wait_after)

        # Screenshot al
        screenshot_path = None
        if self.settings['screenshot_after']:
            print(f"\n   📸 Taking verification screenshot...")
            screenshot_path = self._take_screenshot(external_display, x_offset)

        print(f"\n   📋 CLAUDE LAUNCH SUMMARY:")
        print(f"   ─────────────────────────────────────")
        print(f"   🤖 Claude instances launched: {len(launched)}/{terminal_count}")
        for title in launched:
            print(f"      ✅ {title}")
        if screenshot_path:
            print(f"   📸 Verification: {screenshot_path.name}")
        print(f"   ─────────────────────────────────────")

        return TaskResult(
            task_name=self.name,
            status=TaskStatus.SUCCESS,
            data={
                'launched_count': len(launched),
                'total_terminals': terminal_count,
                'launched_in': launched,
                'claude_command': claude_cmd,
                'screenshot': str(screenshot_path) if screenshot_path else None,
                'verification': {
                    'status': 'SUCCESS' if len(launched) == terminal_count else 'PARTIAL',
                    'evidence': screenshot_path.name if screenshot_path else None,
                    'message': f'{len(launched)} Claude instances running in dangerous mode'
                }
            }
        )

    def _launch_claude_by_window_id(self, window_id: int, command: str) -> bool:
        """Window ID ile kesin hedefleme - %100 güvenilir!"""

        applescript = f'''
tell application "Terminal"
    activate
    delay 0.3

    -- Window ID ile kesin hedefle
    try
        set targetWindow to window id {window_id}
        do script "{command}" in targetWindow
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
                timeout=10
            )

            if 'OK' in result.stdout:
                return True
            else:
                print(f"      ⚠️  AppleScript: {result.stdout.strip()} {result.stderr.strip()}")
                return False

        except Exception as e:
            print(f"      ❌ Error: {e}")
            return False

    def _launch_claude_in_terminal(self, window_index: int, total_windows: int, command: str) -> bool:
        """Fallback: Eski index yöntemi (Window ID yoksa)"""

        # Ters çevir: 1 -> 3, 2 -> 2, 3 -> 1
        actual_window = total_windows - window_index + 1

        applescript = f'''
tell application "Terminal"
    activate
    delay 0.3
    if (count of windows) >= {actual_window} then
        do script "{command}" in window {actual_window}
        return "OK"
    else
        return "ERROR: Window {actual_window} not found"
    end if
end tell
'''

        try:
            result = subprocess.run(
                ['osascript', '-e', applescript],
                capture_output=True,
                text=True,
                timeout=10
            )

            if 'OK' in result.stdout:
                return True
            else:
                print(f"      ⚠️  AppleScript: {result.stdout.strip()}")
                return False

        except Exception as e:
            print(f"      ❌ Error: {e}")
            return False

    def _take_screenshot(self, external_display: Dict, x_offset: int) -> Path:
        """Verification screenshot al"""

        base_dir = Path(__file__).parent.parent
        screenshot_dir = base_dir / self.settings['screenshot_dir']
        screenshot_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        raw_path = screenshot_dir / f"claude_verification_{timestamp}_raw.png"
        final_path = screenshot_dir / f"claude_verification_{timestamp}.jpg"

        # Ekran boyutları
        width = external_display.get('width', 1920)
        height = external_display.get('height', 1080)

        # Screenshot al
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

            # Resize
            temp_path = screenshot_dir / f"temp_{timestamp}.png"
            subprocess.run([
                'sips', '--resampleWidth', str(new_width),
                str(raw_path), '--out', str(temp_path)
            ], capture_output=True, timeout=10)

            # JPEG'e çevir
            subprocess.run([
                'sips', '-s', 'format', 'jpeg',
                '-s', 'formatOptions', str(self.settings['jpeg_quality']),
                str(temp_path), '--out', str(final_path)
            ], capture_output=True, timeout=10)

            # Temizlik
            raw_path.unlink(missing_ok=True)
            temp_path.unlink(missing_ok=True)

            if final_path.exists():
                size_kb = final_path.stat().st_size / 1024
                print(f"   💾 Screenshot saved: {final_path.name} ({size_kb:.1f} KB)")
                return final_path

        except Exception as e:
            print(f"   ⚠️  Screenshot error: {e}")

        return None
