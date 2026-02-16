#!/bin/bash
#
# RAMAS Worker Interrupt Script
#
# Worker terminal'ine ESC + mesaj gönderir.
# iTerm2 ve macOS gerektirir.
#
# Kullanım:
#   ./interrupt-worker.sh <WINDOW_ID> "<MESSAGE>" [PRIORITY]
#
# Örnekler:
#   ./interrupt-worker.sh 4039 "Yeni görev var!"
#   ./interrupt-worker.sh 4039 "ACİL: Görevi durdur!" urgent
#
# @author Dr. Umit Kacar
# @created 2025-12-31
#

set -e

# Parametreler
WINDOW_ID=$1
MESSAGE=$2
PRIORITY=${3:-normal}

# Validasyon
if [ -z "$WINDOW_ID" ]; then
    echo "Hata: WINDOW_ID gerekli"
    echo "Kullanım: $0 <WINDOW_ID> \"<MESSAGE>\" [PRIORITY]"
    exit 1
fi

if [ -z "$MESSAGE" ]; then
    echo "Hata: MESSAGE gerekli"
    echo "Kullanım: $0 <WINDOW_ID> \"<MESSAGE>\" [PRIORITY]"
    exit 1
fi

# macOS kontrolü
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Hata: Bu script sadece macOS'ta çalışır"
    exit 1
fi

# iTerm2 kontrolü
if ! osascript -e 'application "iTerm2" is running' 2>/dev/null | grep -q "true"; then
    echo "Hata: iTerm2 çalışmıyor"
    exit 1
fi

# Mesaj öneki (priority'ye göre)
if [ "$PRIORITY" == "urgent" ]; then
    PREFIX="🚨 URGENT"
    DELAY_AFTER_ESC=0.15
else
    PREFIX="📩 MESSAGE"
    DELAY_AFTER_ESC=0.2
fi

FULL_MESSAGE="$PREFIX: $MESSAGE"

echo "═══════════════════════════════════════════════════════════════════"
echo "  RAMAS Worker Interrupt"
echo "═══════════════════════════════════════════════════════════════════"
echo "  Window ID: $WINDOW_ID"
echo "  Priority:  $PRIORITY"
echo "  Message:   $MESSAGE"
echo "═══════════════════════════════════════════════════════════════════"

# URGENT modda önce Ctrl+C
if [ "$PRIORITY" == "urgent" ]; then
    echo "Sending Ctrl+C (urgent mode)..."
    osascript <<EOF
tell application "iTerm2"
    tell window id $WINDOW_ID
        tell current session
            tell application "System Events"
                key code 8 using control down
            end tell
        end tell
    end tell
end tell
EOF
    sleep 0.1
fi

# ESC gönder
echo "Sending ESC..."
osascript <<EOF
tell application "iTerm2"
    tell window id $WINDOW_ID
        tell current session
            tell application "System Events"
                key code 53
            end tell
        end tell
    end tell
end tell
EOF

# Kısa bekleme
sleep $DELAY_AFTER_ESC

# Mesajı yaz
echo "Sending message..."
osascript <<EOF
tell application "iTerm2"
    tell window id $WINDOW_ID
        tell current session
            write text "$FULL_MESSAGE"
        end tell
    end tell
end tell
EOF

echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ Interrupt sent successfully!"
echo "═══════════════════════════════════════════════════════════════════"
