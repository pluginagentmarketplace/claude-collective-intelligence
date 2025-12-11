"""
Task 1: Display Inspector
=========================
Mac çoklu ekran bilgilerini toplar ve sonraki task'lara iletir.
"""

import subprocess
import json
import re
from datetime import datetime
from typing import Any, Dict, List

from .base import BaseTask, TaskResult, TaskStatus


class DisplayInspectorTask(BaseTask):
    """
    Mac Display Inspector Task

    Çıktı (context'e eklenir):
        - displays: List[DisplayInfo]
        - external_display: Harici ekran bilgisi
        - total_displays: Ekran sayısı
    """

    name = "display_inspector"
    description = "Mac çoklu ekran yapılandırmasını tespit eder"
    version = "2.0.0"

    def execute(self, context: Dict[str, Any]) -> TaskResult:
        """Ekran bilgilerini topla"""

        print("\n🖥️  Detecting displays...")

        # Sistem bilgileri
        hostname = self._run_command("hostname")
        macos_version = self._run_command("sw_vers -productVersion")

        print(f"   💻 Hostname: {hostname}")
        print(f"   🍎 macOS: {macos_version}")

        # Ekran bilgilerini al
        displays = self._get_displays()

        print(f"   📺 Found {len(displays)} display(s)")

        # Harici ekranı bul (main olmayan)
        external_display = None
        main_display = None

        for disp in displays:
            if disp.get('is_main'):
                main_display = disp
                print(f"   ⭐ Main: {disp.get('name')} ({disp.get('width')}x{disp.get('height')})")
            else:
                external_display = disp
                print(f"   🖥️  External: {disp.get('name')} ({disp.get('width')}x{disp.get('height')})")

        # Result data - sonraki task'lar kullanacak
        result_data = {
            'hostname': hostname,
            'macos_version': macos_version,
            'total_displays': len(displays),
            'displays': displays,
            'main_display': main_display,
            'external_display': external_display,
            'timestamp': datetime.now().isoformat()
        }

        return TaskResult(
            task_name=self.name,
            status=TaskStatus.SUCCESS,
            data=result_data
        )

    def _run_command(self, cmd: str) -> str:
        """Shell komutu çalıştır"""
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=30
            )
            return result.stdout.strip()
        except Exception as e:
            return f"Error: {e}"

    def _get_displays(self) -> List[Dict]:
        """system_profiler ile ekran bilgilerini al"""
        displays = []

        output = self._run_command("system_profiler SPDisplaysDataType -json 2>/dev/null")

        try:
            data = json.loads(output)
            graphics_cards = data.get('SPDisplaysDataType', [])

            display_id = 1
            for card in graphics_cards:
                card_name = card.get('sppci_model', 'Unknown GPU')
                card_displays = card.get('spdisplays_ndrvs', [])

                for disp in card_displays:
                    name = disp.get('_name', f'Display {display_id}')
                    resolution = disp.get('_spdisplays_resolution', 'Unknown')

                    # Çözünürlüğü parse et
                    res_match = re.search(r'(\d+)\s*x\s*(\d+)', resolution)
                    width = int(res_match.group(1)) if res_match else 0
                    height = int(res_match.group(2)) if res_match else 0

                    # Main display kontrolü
                    is_main = disp.get('spdisplays_main', '') == 'spdisplays_yes'

                    # Connection type
                    connection = disp.get('spdisplays_connection_type', 'Unknown')
                    if 'internal' in connection.lower() or 'built-in' in name.lower():
                        connection = 'Built-in'
                    else:
                        connection = 'External'

                    display_info = {
                        'display_id': display_id,
                        'name': name,
                        'resolution': resolution,
                        'width': width,
                        'height': height,
                        'is_main': is_main,
                        'is_retina': 'Retina' in resolution or 'Retina' in name,
                        'connection_type': connection,
                        'gpu': card_name
                    }
                    displays.append(display_info)
                    display_id += 1

        except (json.JSONDecodeError, KeyError) as e:
            print(f"   ⚠️  JSON parse error: {e}")

        return displays
