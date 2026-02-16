#!/bin/bash
#
# RAMAS Terminal Title Updater
#
# Worker terminal başlığını [GREEN]/[RED] formatında günceller.
#
# Kullanım:
#   ./update-title.sh <WINDOW_ID> <WORKER_ID> <STATUS>
#
# Örnekler:
#   ./update-title.sh 4039 worker-001 green
#   ./update-title.sh 4039 worker-001 red
#
# @author Dr. Umit Kacar
# @created 2025-12-31
#

set -e

# Parametreler
WINDOW_ID=$1
WORKER_ID=$2
STATUS=$3

# Validasyon
if [ -z "$WINDOW_ID" ] || [ -z "$WORKER_ID" ] || [ -z "$STATUS" ]; then
    echo "Hata: Tüm parametreler gerekli"
    echo "Kullanım: $0 <WINDOW_ID> <WORKER_ID> <STATUS>"
    echo "  STATUS: green | red"
    exit 1
fi

# Status validasyonu
if [ "$STATUS" != "green" ] && [ "$STATUS" != "red" ]; then
    echo "Hata: STATUS 'green' veya 'red' olmalı"
    exit 1
fi

# macOS kontrolü
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Hata: Bu script sadece macOS'ta çalışır"
    exit 1
fi

# Başlık formatı
STATUS_UPPER=$(echo "$STATUS" | tr '[:lower:]' '[:upper:]')
WORKER_UPPER=$(echo "$WORKER_ID" | tr '[:lower:]' '[:upper:]')
TITLE="[$STATUS_UPPER] $WORKER_UPPER"

echo "Updating title: $TITLE"

# AppleScript ile başlığı güncelle
osascript <<EOF
tell application "iTerm2"
    tell window id $WINDOW_ID
        tell current session
            set name to "$TITLE"
        end tell
        tell current tab
            set title to "$TITLE"
        end tell
    end tell
end tell
EOF

echo "✅ Title updated: $TITLE"
