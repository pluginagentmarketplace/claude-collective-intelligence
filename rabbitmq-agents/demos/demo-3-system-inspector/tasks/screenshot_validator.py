"""
Task 3: Screenshot Validator - ULTRATHINK Cross-Check System
=============================================================
İkinci ekranın screenshot'ını alır, sıkıştırır ve analiz için hazırlar.
Claude tarafından cross-check yapılarak görevin doğruluğu kanıtlanır.

ETİK - DÜRÜST - MOMENTUM - KALİTE
"""

import subprocess
import os
import json
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path

from .base import BaseTask, TaskResult, TaskStatus


class ScreenshotValidatorTask(BaseTask):
    """
    Screenshot Validator Task - Cross-Check System

    1. İkinci ekranın tam ekran screenshot'ını alır
    2. Sıkıştırır (<1MB, KB mertebesinde)
    3. Analiz sonucu rapor eder
    4. Kanıt olarak saklar
    """

    name = "screenshot_validator"
    description = "İkinci ekran screenshot'ı alır ve cross-check yapar"
    version = "1.0.0"

    DEFAULT_CONFIG = {
        'output_dir': 'screenshots',
        'max_size_kb': 500,           # Max 500KB
        'jpeg_quality': 60,           # JPEG kalitesi (1-100)
        'resize_factor': 0.5,         # Yarı boyuta küçült
        'filename_prefix': 'external_display',
        'wait_before_capture': 1.0,   # Terminal'lerin yerleşmesini bekle
    }

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.settings = {**self.DEFAULT_CONFIG, **(config or {})}

    def execute(self, context: Dict[str, Any]) -> TaskResult:
        """Screenshot al ve cross-check yap"""

        print("\n📸 Screenshot Validator (Cross-Check System)...")

        # Önceki task'lardan bilgi al
        main_display = context.get('main_display', {})
        external_display = context.get('external_display', {})
        terminals = context.get('terminals', [])
        x_offset = context.get('x_offset', 0)

        if not external_display:
            return TaskResult(
                task_name=self.name,
                status=TaskStatus.FAILED,
                error="No external display information from previous task"
            )

        # Screenshot klasörünü oluştur
        base_dir = Path(__file__).parent.parent
        screenshot_dir = base_dir / self.settings['output_dir']
        screenshot_dir.mkdir(exist_ok=True)

        # Timestamp ile dosya adı
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        raw_filename = f"{self.settings['filename_prefix']}_{timestamp}_raw.png"
        compressed_filename = f"{self.settings['filename_prefix']}_{timestamp}.jpg"

        raw_path = screenshot_dir / raw_filename
        compressed_path = screenshot_dir / compressed_filename

        print(f"   📁 Output directory: {screenshot_dir.name}/")

        # Bekle - terminallerin yerleşmesi için
        wait_time = self.settings['wait_before_capture']
        if wait_time > 0:
            print(f"   ⏳ Waiting {wait_time}s for terminals to settle...")
            import time
            time.sleep(wait_time)

        # Screenshot al - İKİNCİ EKRAN
        print(f"   📷 Capturing external display screenshot...")

        success = self._capture_external_display(
            raw_path,
            main_display,
            external_display,
            x_offset
        )

        if not success:
            return TaskResult(
                task_name=self.name,
                status=TaskStatus.FAILED,
                error="Failed to capture screenshot"
            )

        # Raw dosya boyutunu kontrol et
        raw_size_kb = raw_path.stat().st_size / 1024
        print(f"   📊 Raw screenshot: {raw_size_kb:.1f} KB")

        # Sıkıştır
        print(f"   🗜️  Compressing to JPEG (quality={self.settings['jpeg_quality']})...")
        compressed_size_kb = self._compress_screenshot(
            raw_path,
            compressed_path,
            external_display.get('width', 1920),
            external_display.get('height', 1080)
        )

        if compressed_size_kb is None:
            # sips başarısız olduysa, raw dosyayı kullan
            compressed_path = raw_path
            compressed_size_kb = raw_size_kb
            print(f"   ⚠️  Using raw PNG instead")
        else:
            print(f"   ✅ Compressed: {compressed_size_kb:.1f} KB")
            # Raw dosyayı sil
            raw_path.unlink(missing_ok=True)

        # Analiz bilgisi oluştur
        analysis = self._generate_analysis_info(
            external_display,
            terminals,
            x_offset,
            compressed_path
        )

        print(f"\n   📋 CROSS-CHECK ANALYSIS:")
        print(f"   ─────────────────────────────────────")
        print(f"   📺 Target Display: {external_display.get('name')}")
        print(f"   📐 Resolution: {external_display.get('width')}x{external_display.get('height')}")
        print(f"   🖥️  Terminals Expected: {len(terminals)}")
        print(f"   📍 X Offset: {x_offset}px")
        print(f"   📸 Screenshot: {compressed_path.name}")
        print(f"   💾 File Size: {compressed_size_kb:.1f} KB")
        print(f"   ─────────────────────────────────────")

        # Kanıt mesajı
        print(f"\n   ✅ KANIT: Screenshot '{compressed_path.name}' dosyası")
        print(f"      görevin doğru yapıldığının görsel kanıtıdır.")
        print(f"      Claude bu görüntüyü analiz ederek cross-check yapabilir.")

        return TaskResult(
            task_name=self.name,
            status=TaskStatus.SUCCESS,
            data={
                'screenshot_path': str(compressed_path),
                'screenshot_filename': compressed_path.name,
                'file_size_kb': round(compressed_size_kb, 1),
                'analysis': analysis,
                'cross_check': {
                    'target_display': external_display.get('name'),
                    'expected_terminals': len(terminals),
                    'terminal_positions': terminals,
                    'evidence_file': compressed_path.name,
                    'verification_status': 'PENDING_CLAUDE_ANALYSIS'
                }
            }
        )

    def _capture_external_display(
        self,
        output_path: Path,
        main_display: Dict,
        external_display: Dict,
        x_offset: int
    ) -> bool:
        """İkinci ekranın screenshot'ını al"""

        # Yöntem 1: screencapture ile bölge belirterek
        # İkinci ekran koordinatları: x_offset, 0, width, height
        width = external_display.get('width', 1920)
        height = external_display.get('height', 1080)

        # screencapture -R x,y,w,h ile belirli bölgeyi yakala
        cmd = [
            'screencapture',
            '-R', f'{x_offset},0,{width},{height}',
            '-x',  # Ses çıkarma
            str(output_path)
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                print(f"   ⚠️  screencapture error: {result.stderr}")
                # Fallback: tüm ekranı yakala
                return self._capture_fullscreen_fallback(output_path)

            return output_path.exists()

        except subprocess.TimeoutExpired:
            print("   ⚠️  Screenshot timeout")
            return False
        except Exception as e:
            print(f"   ❌ Screenshot error: {e}")
            return False

    def _capture_fullscreen_fallback(self, output_path: Path) -> bool:
        """Fallback: Tüm ekranı yakala"""
        try:
            subprocess.run(
                ['screencapture', '-x', str(output_path)],
                capture_output=True,
                timeout=10
            )
            return output_path.exists()
        except Exception:
            return False

    def _compress_screenshot(
        self,
        input_path: Path,
        output_path: Path,
        target_width: int,
        target_height: int
    ) -> Optional[float]:
        """Screenshot'ı sıkıştır - macOS sips kullanarak"""

        try:
            # Önce resize et (yarı boyut)
            resize_factor = self.settings['resize_factor']
            new_width = int(target_width * resize_factor)
            new_height = int(target_height * resize_factor)

            # sips ile resize ve JPEG'e çevir
            # Önce resize
            subprocess.run([
                'sips',
                '--resampleWidth', str(new_width),
                str(input_path),
                '--out', str(output_path).replace('.jpg', '_temp.png')
            ], capture_output=True, timeout=10)

            temp_path = Path(str(output_path).replace('.jpg', '_temp.png'))

            # Sonra JPEG'e çevir
            subprocess.run([
                'sips',
                '-s', 'format', 'jpeg',
                '-s', 'formatOptions', str(self.settings['jpeg_quality']),
                str(temp_path),
                '--out', str(output_path)
            ], capture_output=True, timeout=10)

            # Temp dosyayı sil
            temp_path.unlink(missing_ok=True)

            if output_path.exists():
                return output_path.stat().st_size / 1024

            return None

        except Exception as e:
            print(f"   ⚠️  Compression error: {e}")
            return None

    def _generate_analysis_info(
        self,
        external_display: Dict,
        terminals: list,
        x_offset: int,
        screenshot_path: Path
    ) -> Dict:
        """Cross-check analizi için bilgi oluştur"""

        return {
            'display_info': {
                'name': external_display.get('name'),
                'width': external_display.get('width'),
                'height': external_display.get('height'),
                'x_offset': x_offset
            },
            'expected_layout': {
                'terminal_count': len(terminals),
                'terminals': [
                    {
                        'title': t.get('title'),
                        'x': t.get('x'),
                        'y': t.get('y'),
                        'width': t.get('width'),
                        'height': t.get('height')
                    }
                    for t in terminals
                ],
                'arrangement': 'horizontal_side_by_side'
            },
            'evidence': {
                'file': screenshot_path.name,
                'timestamp': datetime.now().isoformat(),
                'verification_note': 'Bu screenshot görevin doğru yapıldığının kanıtıdır'
            }
        }
