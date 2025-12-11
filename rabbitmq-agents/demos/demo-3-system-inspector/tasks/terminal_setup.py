"""
Task 2: Terminal Setup - ULTRATHINK v3.0
========================================
Harici ekran çözünürlüğüne göre terminal pencereleri açar.
İKİNCİ EKRANDA, YAN YANA, BÜYÜK FONT!

v3.0 - Window ID Capture: Her terminal için benzersiz ID kaydet
"""

import subprocess
import os
from typing import Any, Dict
from pathlib import Path

from .base import BaseTask, TaskResult, TaskStatus


class TerminalSetupTask(BaseTask):
    """
    Terminal Setup Task - ULTRATHINK Edition

    Harici ekran çözünürlüğüne göre N adet terminal açar.
    - İKİNCİ EKRANDA açılır (x offset hesaplanır)
    - Terminaller YAN YANA dizilir
    - Her terminal eşit genişlikte
    - Font boyutu BÜYÜK (görünür)
    """

    name = "terminal_setup"
    description = "Harici ekrana göre terminal pencereleri açar"
    version = "3.0.0"  # Window ID capture güncellemesi

    # Varsayılan ayarlar
    DEFAULT_CONFIG = {
        'terminal_count': 3,
        'use_dark_theme': True,     # Pro (koyu) tema kullan
        'use_external_display': True,
        'terminal_titles': ['LEADER', 'WORKER-1', 'WORKER-2'],  # Sade başlıklar
        'gap': 0,                   # Pencereler arası boşluk
        'menu_bar_height': 25,      # macOS menu bar
    }

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.settings = {**self.DEFAULT_CONFIG, **(config or {})}

    def execute(self, context: Dict[str, Any]) -> TaskResult:
        """Terminal pencerelerini aç - İKİNCİ EKRANDA!"""

        print("\n🖥️  Setting up terminal windows (ULTRATHINK v2.0)...")

        # Önceki task'tan ekran bilgilerini al
        main_display = context.get('main_display')
        external_display = context.get('external_display')
        displays = context.get('displays', [])

        # Main display'i bul (x_offset için)
        if not main_display:
            for d in displays:
                if d.get('is_main'):
                    main_display = d
                    break

        # External display'i bul
        if not external_display:
            for d in displays:
                if not d.get('is_main'):
                    external_display = d
                    break

        # Eğer hala yoksa, ilk ekranı kullan
        if not external_display:
            if displays:
                external_display = displays[0]
                print("   ⚠️  No external display, using primary display")
            else:
                return TaskResult(
                    task_name=self.name,
                    status=TaskStatus.FAILED,
                    error="No display information available"
                )

        # İKİNCİ EKRANIN X OFFSET'İ - KRİTİK!
        # Mac'te ikinci ekran sağda ise, x koordinatı = main_display.width'den başlar
        x_offset = 0
        if main_display and external_display and not external_display.get('is_main'):
            x_offset = main_display.get('width', 0)
            print(f"   📍 External display X offset: {x_offset}px")

        # Ekran boyutları
        screen_width = external_display.get('width', 1920)
        screen_height = external_display.get('height', 1080)

        print(f"   📺 Target display: {external_display.get('name')}")
        print(f"   📐 Resolution: {screen_width}x{screen_height}")

        # Terminal sayısı ve boyutları hesapla
        terminal_count = self.settings['terminal_count']
        gap = self.settings['gap']
        menu_bar = self.settings['menu_bar_height']

        # External display'de menu bar yok - y=0 olmalı!
        # Main display'de ise menu bar var - y=25
        is_external = not external_display.get('is_main', False)
        y_start = 0 if is_external else menu_bar

        # Her terminal genişliği: ekran_genişliği / terminal_sayısı
        terminal_width = screen_width // terminal_count
        terminal_height = screen_height - y_start

        print(f"   🖼️  Opening {terminal_count} terminals")
        print(f"   📏 Each terminal: {terminal_width}x{terminal_height}")
        print(f"   📍 Y start: {y_start}px (external={is_external})")

        # Terminal pozisyonları hesapla - İKİNCİ EKRANDA!
        terminals = []
        for i in range(terminal_count):
            # X pozisyonu: x_offset + (terminal_index * terminal_width)
            x_pos = x_offset + (i * terminal_width)
            y_pos = y_start

            terminal_info = {
                'index': i + 1,
                'title': self.settings['terminal_titles'][i] if i < len(self.settings['terminal_titles']) else f'Terminal {i+1}',
                'x': x_pos,
                'y': y_pos,
                'width': terminal_width,
                'height': terminal_height
            }
            terminals.append(terminal_info)
            print(f"   📍 Terminal {i+1}: x={x_pos}, y={y_pos}, {terminal_width}x{terminal_height}")

        # AppleScript ile terminalleri aç VE Window ID'leri al
        window_ids = self._open_terminals_with_ids(terminals)

        if window_ids:
            # Window ID'leri terminals listesine ekle
            for i, term in enumerate(terminals):
                if i < len(window_ids):
                    term['window_id'] = window_ids[i]
                    print(f"   🔑 {term['title']} → Window ID: {window_ids[i]}")

            print(f"   ✅ {terminal_count} terminals opened with ID tracking!")
        else:
            print(f"   ⚠️  Terminals opened but ID capture failed")

        return TaskResult(
            task_name=self.name,
            status=TaskStatus.SUCCESS if window_ids else TaskStatus.FAILED,
            data={
                'terminals_opened': terminal_count,
                'terminal_width': terminal_width,
                'terminal_height': terminal_height,
                'x_offset': x_offset,
                'target_display': external_display.get('name'),
                'terminals': terminals,
                'window_ids': window_ids  # Benzersiz ID'ler!
            }
        )

    def _open_terminals_with_ids(self, terminals: list) -> list:
        """AppleScript ile terminal aç VE Window ID'leri döndür - v3.0"""

        num_terminals = len(terminals)

        # Window ID'leri yakalayan AppleScript
        applescript = f'''
-- Terminal Setup - Window ID Capture v3.0
-- {num_terminals} terminal açılacak, her birinin ID'si yakalanacak

tell application "Terminal"
    -- Window ID listesi
    set windowIDs to {{}}

    -- Önce Terminal'i aktif et
    activate
    delay 0.5

    -- Mevcut pencereleri kapat (temiz başlangıç)
    try
        close every window
    end try
    delay 0.3

'''
        # Her terminal için: aç, ID'yi hemen yakala, sonra yapılandır
        for i, term in enumerate(terminals):
            applescript += f'''
    -- Terminal {i+1}: {term['title']}
    do script ""
    delay 0.3

    -- HEMEN Window ID'yi yakala (Claude title değiştirmeden önce!)
    set currentWindowID to id of window 1
    set end of windowIDs to currentWindowID

    tell window 1
        -- Boyut ve pozisyon
        set bounds to {{{term['x']}, {term['y']}, {term['x'] + term['width']}, {term['y'] + term['height']}}}
        set custom title to "{term['title']}"
        set title displays custom title to true
        -- Koyu arka plan (RGB: siyah)
        set background color to {{0, 0, 0}}
        -- Beyaz metin (RGB: beyaz)
        set normal text color to {{65535, 65535, 65535}}
    end tell
    delay 0.3

'''

        applescript += '''
    -- Window ID'leri virgülle ayrılmış string olarak döndür
    set idString to ""
    repeat with i from 1 to count of windowIDs
        if i > 1 then
            set idString to idString & ","
        end if
        set idString to idString & (item i of windowIDs as string)
    end repeat

    return idString
end tell
'''

        # AppleScript'i dosyaya yaz
        script_path = Path(__file__).parent.parent / "scripts" / "setup_terminals.scpt"
        script_path.parent.mkdir(exist_ok=True)

        with open(script_path, 'w') as f:
            f.write(applescript)

        print(f"   📝 AppleScript saved: {script_path.name}")

        # AppleScript'i çalıştır
        try:
            result = subprocess.run(
                ['osascript', str(script_path)],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                print(f"   ⚠️  AppleScript error: {result.stderr}")
                return []

            # Window ID'leri parse et: "12345,12346,12347"
            id_string = result.stdout.strip()
            print(f"   🎯 Window IDs captured: {id_string}")

            if id_string:
                window_ids = [int(x.strip()) for x in id_string.split(',') if x.strip()]
                return window_ids
            else:
                return []

        except subprocess.TimeoutExpired:
            print("   ⚠️  AppleScript timeout")
            return []
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return []
