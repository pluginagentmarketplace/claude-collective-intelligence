# AppleScript & iTerm2 Automation Cookbook

**"Terminal uçar, yazı kalır"** - Bir RAMAS Dersi

> Bu dokümantasyon, RAMAS (Reactive Agent Messaging & Automation System) kurulumu sırasında
> kazanılan pratik deneyimlerin bir arşividir. Saatler süren debug, onlarca deneme-yanılma
> ve nihayetinde başarıyla sonuçlanan bir yolculuğun öğretileri burada kayıt altındadır.

**Parent Document:** [RAMAS-GUIDE.md](./RAMAS-GUIDE.md)
**Date:** 2025-12-31
**Author:** Dr. Umit Kacar
**Lesson Source:** RAMAS Implementation Journey

---

## Table of Contents

1. [Critical Discoveries](#1-critical-discoveries)
2. [iTerm2 AppleScript Gotchas](#2-iterm2-applescript-gotchas)
3. [Bash + AppleScript Integration Patterns](#3-bash--applescript-integration-patterns)
4. [Key Codes & Terminal Control](#4-key-codes--terminal-control)
5. [Window & Session Management](#5-window--session-management)
6. [Error Codes Reference](#6-error-codes-reference)
7. [Proven Patterns](#7-proven-patterns)
8. [Anti-Patterns (What NOT to Do)](#8-anti-patterns-what-not-to-do)
9. [Quick Reference Card](#9-quick-reference-card)

---

## 1. Critical Discoveries

### 1.1 The Tab Title Trap (Error -10000)

**Problem:** iTerm2'de tab title ayarlamaya çalışınca hata alınır.

```applescript
-- ❌ YANLIŞ - Bu ÇALIŞMAZ!
tell application "iTerm2"
    tell window id 12345
        tell current tab
            set title to "[GREEN] WORKER"  -- AppleEvent handler failed (-10000)
        end tell
    end tell
end tell
```

**Root Cause:** iTerm2 AppleScript API'si, tab title'ı doğrudan ayarlamayı desteklemiyor. Tab title, session name'den türetilir.

**Solution:** Sadece session name ayarla - tab title otomatik güncellenir:

```applescript
-- ✅ DOĞRU - Bu ÇALIŞIR!
tell application "iTerm2"
    tell window id 12345
        tell current session
            set name to "[GREEN] WORKER"  -- Bu hem session hem tab'ı günceller
        end tell
    end tell
end tell
```

**Lesson Learned:** iTerm2'de her şey session-centric. Tab sadece session'ın bir container'ı.

---

### 1.2 The Apostrophe Catastrophe (Error -2740)

**Problem:** AppleScript'te text item delimiters kullanırken syntax hatası.

```applescript
-- ❌ YANLIŞ - Syntax Error!
set AppleScript text item delimiters to ","  -- Missing 's!
```

**Root Cause:** `AppleScript's text item delimiters` ifadesinde apostrof (') + s gerekli. "AppleScript'in text item delimiters'ı" anlamında.

**Solution:**

```applescript
-- ✅ DOĞRU
set AppleScript's text item delimiters to ","
set myList to {"a", "b", "c"}
set joinedText to myList as text  -- "a,b,c"
set AppleScript's text item delimiters to ""
```

**Lesson Learned:** AppleScript possessive case kullanır. `AppleScript's` = "AppleScript'in".

---

### 1.3 The Bash Quote Hell

**Problem:** Bash içinde AppleScript çalıştırırken quote'lar çakışır.

```bash
# ❌ YANLIŞ - Apostrof bash'i bozar!
RESULT=$(osascript -e '
tell application "iTerm2"
    set AppleScript's text item delimiters to ","  # 's burada bash quote kapatır!
end tell
')
```

**Root Cause:** Bash tek tırnak içinde (`'...'`) hiçbir escape yapılamaz. `AppleScript's` içindeki `'` bash string'ini kapatır.

**Solutions:**

#### Solution 1: Temporary File (En Güvenli)

```bash
# ✅ EN GÜVENLİ - Geçici dosya kullan
TEMP_SCRIPT=$(mktemp /tmp/script.XXXXXX.scpt)
cat > "$TEMP_SCRIPT" << 'EOF'
tell application "iTerm2"
    set AppleScript's text item delimiters to ","
    -- ... rest of script
end tell
EOF

RESULT=$(osascript "$TEMP_SCRIPT")
rm -f "$TEMP_SCRIPT"
```

#### Solution 2: Heredoc (Dikkatli Kullan)

```bash
# ⚠️ DİKKAT - Heredoc + $() karışabilir
# Tek tırnaklı heredoc ('EOF') variable expansion'ı kapatır
osascript << 'APPLESCRIPT_EOF'
tell application "iTerm2"
    set AppleScript's text item delimiters to ","
end tell
APPLESCRIPT_EOF
```

#### Solution 3: Escape (Karmaşık ama inline)

```bash
# 🔧 ESCAPE - Karmaşık ama tek satırda çalışır
osascript -e 'set AppleScript'\''s text item delimiters to ","'
# '\'' = tek tırnağı kapat, literal ', tek tırnağı aç
```

**Lesson Learned:** AppleScript + Bash = Quote management nightmare. Geçici dosya en güvenli yol.

---

## 2. iTerm2 AppleScript Gotchas

### 2.1 Window vs Tab vs Session Hierarchy

```
iTerm2 Application
└── Window (has id, bounds)
    └── Tab (container only, title from session)
        └── Session (has id, name, can receive commands)
```

**Key Insight:** Çoğu işlem session seviyesinde yapılır. Window sadece positioning için.

### 2.2 Window Creation & Positioning

```applescript
tell application "iTerm2"
    activate

    -- Yeni pencere oluştur
    set win to (create window with default profile)

    -- Pencereyi konumlandır (x1, y1, x2, y2)
    tell win
        set bounds to {0, 25, 480, 900}
    end tell

    -- Session'a komut gönder
    tell win
        tell current session
            set name to "[GREEN] WORKER"
            write text "echo Hello World"
        end tell
    end tell
end tell
```

### 2.3 Getting Window Information

```applescript
tell application "iTerm2"
    repeat with w in windows
        set winID to id of w
        set winBounds to bounds of w
        set xPos to item 1 of winBounds  -- X position for classification
        set sessionID to id of current session of current tab of w
        set sessionName to name of current session of current tab of w
    end repeat
end tell
```

### 2.4 Position-Based Window Classification

```applescript
-- Ekran genişliği 1440px, 3 pencere yan yana
if xPos < 100 then
    set role to "left-window"    -- 0-480
else if xPos < 600 then
    set role to "center-window"  -- 480-960
else
    set role to "right-window"   -- 960-1440
end if
```

---

## 3. Bash + AppleScript Integration Patterns

### 3.1 Pattern: Temporary File Execution (Recommended)

```bash
#!/bin/bash
# En güvenli ve readable pattern

run_applescript() {
    local script_content="$1"
    local temp_script=$(mktemp /tmp/applescript.XXXXXX.scpt)

    echo "$script_content" > "$temp_script"
    local result=$(osascript "$temp_script" 2>/dev/null)
    rm -f "$temp_script"

    echo "$result"
}

# Kullanım
WINDOW_ID=$(run_applescript '
tell application "iTerm2"
    set win to (create window with default profile)
    return id of win
end tell
')
```

### 3.2 Pattern: Heredoc with Cat

```bash
#!/bin/bash
# Heredoc'u dosyaya yaz, sonra çalıştır

SCRIPT_FILE=$(mktemp)
cat > "$SCRIPT_FILE" << 'APPLESCRIPT'
tell application "iTerm2"
    set AppleScript's text item delimiters to "|"
    -- Complex script here
end tell
APPLESCRIPT

RESULT=$(osascript "$SCRIPT_FILE")
rm -f "$SCRIPT_FILE"
```

### 3.3 Pattern: Simple Inline (Apostrof-Free Only)

```bash
# Sadece apostrof içermeyen basit scriptler için
WINDOW_COUNT=$(osascript -e 'tell application "iTerm2" to return count of windows')
```

### 3.4 Pattern: JSON Output from AppleScript

```applescript
-- AppleScript'ten structured data döndür (pipe-delimited)
tell application "iTerm2"
    set outputLines to {}
    repeat with w in windows
        set winID to id of w
        set sessionID to id of current session of current tab of w
        set end of outputLines to "worker-001|" & winID & "|" & sessionID
    end repeat

    set oldDelim to AppleScript's text item delimiters
    set AppleScript's text item delimiters to linefeed
    set outputText to outputLines as text
    set AppleScript's text item delimiters to oldDelim

    return outputText
end tell
```

```bash
# Bash'te parse et
while IFS='|' read -r workerId windowId sessionId; do
    echo "Worker: $workerId, Window: $windowId"
done <<< "$APPLESCRIPT_OUTPUT"
```

---

## 4. Key Codes & Terminal Control

### 4.1 Essential Key Codes

| Key | Code | Usage |
|-----|------|-------|
| ESC | 53 | Cancel current input, exit modes |
| ENTER | 36 | Submit command |
| TAB | 48 | Autocomplete |
| SPACE | 49 | Space character |
| DELETE | 51 | Backspace |
| c (for Ctrl+C) | 8 | With `control down` - interrupt process |

### 4.2 Sending Keys to iTerm2

```applescript
tell application "iTerm2"
    tell window id 12345
        tell current session
            -- ESC tuşu gönder
            tell application "System Events"
                key code 53
            end tell

            -- Ctrl+C gönder (process interrupt)
            tell application "System Events"
                key code 8 using control down
            end tell
        end tell
    end tell
end tell
```

### 4.3 Complete Interrupt Pattern

```applescript
-- Acil interrupt: Ctrl+C + ESC + Mesaj
tell application "iTerm2"
    activate
    tell window id 12345
        tell current session
            -- 1. Çalışan process'i durdur
            tell application "System Events"
                key code 8 using control down
            end tell
            delay 0.1

            -- 2. Input buffer'ı temizle
            tell application "System Events"
                key code 53
            end tell
            delay 0.2

            -- 3. Mesaj yaz ve gönder
            write text "URGENT: Stop everything!"
        end tell
    end tell
end tell
```

---

## 5. Window & Session Management

### 5.1 Getting All Window IDs

```applescript
tell application "iTerm2"
    set windowIds to {}
    repeat with w in windows
        set end of windowIds to id of w
    end repeat
    return windowIds
end tell
-- Returns: "4039, 4040, 4041"
```

### 5.2 Closing All Windows

```applescript
tell application "iTerm2"
    close every window
end tell
```

### 5.3 Focus a Specific Window

```applescript
tell application "iTerm2"
    activate
    set frontmost of window id 12345 to true
end tell
```

### 5.4 Check if iTerm2 is Running

```bash
osascript -e 'application "iTerm2" is running'
# Returns: "true" or "false"
```

---

## 6. Error Codes Reference

| Error Code | Name | Cause | Solution |
|------------|------|-------|----------|
| **-10000** | AppleEvent handler failed | Invalid property access (e.g., tab title) | Use session name instead |
| **-2740** | Syntax error | Missing `'s` in `AppleScript's text item delimiters` | Add apostrophe |
| **-1728** | Can't get object | Window/session not found | Verify ID exists |
| **-600** | Application not running | iTerm2 not open | Start iTerm2 first |
| **-1** | Execution error | General script failure | Check syntax, verify objects |

---

## 7. Proven Patterns

### 7.1 Safe Window Creation with Status

```applescript
tell application "iTerm2"
    activate

    set win to (create window with default profile)
    tell win
        set bounds to {0, 25, 480, 900}
        tell current session
            set name to "[GREEN] WORKER-001"
            write text "cd /project && echo 'Ready'"
        end tell
    end tell

    return id of win
end tell
```

### 7.2 Status Title Update

```applescript
on updateWorkerStatus(windowId, workerId, status)
    set statusLabel to do shell script "echo " & status & " | tr '[:lower:]' '[:upper:]'"
    set newTitle to "[" & statusLabel & "] " & workerId

    tell application "iTerm2"
        tell window id windowId
            tell current session
                set name to newTitle
            end tell
        end tell
    end tell
end updateWorkerStatus
```

### 7.3 Multi-Window Launcher

```applescript
tell application "iTerm2"
    activate

    set screenWidth to 1440
    set windowWidth to 480
    set menuBarHeight to 25

    -- Window 1: LEFT
    set win1 to (create window with default profile)
    tell win1
        set bounds to {0, menuBarHeight, windowWidth, 900}
        tell current session
            set name to "[GREEN] LEADER"
        end tell
    end tell

    delay 1

    -- Window 2: CENTER
    set win2 to (create window with default profile)
    tell win2
        set bounds to {windowWidth, menuBarHeight, windowWidth * 2, 900}
        tell current session
            set name to "[GREEN] WORKER-1"
        end tell
    end tell

    delay 1

    -- Window 3: RIGHT
    set win3 to (create window with default profile)
    tell win3
        set bounds to {windowWidth * 2, menuBarHeight, screenWidth, 900}
        tell current session
            set name to "[GREEN] WORKER-2"
        end tell
    end tell
end tell
```

---

## 8. Anti-Patterns (What NOT to Do)

### 8.1 Don't Set Tab Title Directly

```applescript
-- ❌ NEVER DO THIS
tell current tab
    set title to "My Title"  -- ERROR -10000
end tell

-- ✅ DO THIS INSTEAD
tell current session
    set name to "My Title"  -- Works!
end tell
```

### 8.2 Don't Use Inline Quotes with Apostrophes

```bash
# ❌ BROKEN
osascript -e 'set AppleScript's text item delimiters to ","'

# ✅ USE TEMP FILE
cat > /tmp/script.scpt << 'EOF'
set AppleScript's text item delimiters to ","
EOF
osascript /tmp/script.scpt
```

### 8.3 Don't Nest Heredocs in Command Substitution

```bash
# ❌ UNRELIABLE
RESULT=$(osascript << 'EOF'
tell application "iTerm2"
    -- complex script
end tell
EOF
)

# ✅ USE TEMP FILE
cat > /tmp/script.scpt << 'EOF'
tell application "iTerm2"
    -- complex script
end tell
EOF
RESULT=$(osascript /tmp/script.scpt)
rm /tmp/script.scpt
```

### 8.4 Don't Forget Delays Between Window Operations

```applescript
-- ❌ MAY FAIL (race condition)
set win1 to (create window with default profile)
set win2 to (create window with default profile)

-- ✅ ADD DELAYS
set win1 to (create window with default profile)
delay 1
set win2 to (create window with default profile)
```

---

## 9. Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    AppleScript + iTerm2 QUICK REFERENCE                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  WINDOW CREATION                                                          ║
║  ───────────────                                                          ║
║  set win to (create window with default profile)                          ║
║  set bounds of win to {x1, y1, x2, y2}                                    ║
║                                                                           ║
║  SESSION CONTROL (Most commands here!)                                    ║
║  ───────────────                                                          ║
║  tell current session                                                     ║
║      set name to "[GREEN] WORKER"     -- Sets tab title too!              ║
║      write text "command here"        -- Execute command                  ║
║  end tell                                                                 ║
║                                                                           ║
║  KEY CODES                                                                ║
║  ─────────                                                                ║
║  ESC = 53    ENTER = 36    TAB = 48    c (Ctrl+C) = 8                     ║
║                                                                           ║
║  COMMON ERRORS                                                            ║
║  ─────────────                                                            ║
║  -10000: Don't use "tell current tab set title"                           ║
║  -2740:  Use "AppleScript's" (with apostrophe 's)                         ║
║                                                                           ║
║  BASH INTEGRATION                                                         ║
║  ────────────────                                                         ║
║  ✅ SAFE:  Temp file → osascript file.scpt                                ║
║  ⚠️ RISKY: Heredoc in $()                                                 ║
║  ❌ AVOID: Single quotes with AppleScript's                               ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## Epilogue: Lessons from the Journey

Bu dokümantasyon, RAMAS sisteminin kurulumu sırasında yaşanan saatler süren debug sürecinin bir ürünüdür. Her hata, her "neden çalışmıyor?" sorusu, ve her eureka anı burada kayıt altına alınmıştır.

**Key Takeaways:**

1. **İzole Test Et:** Karmaşık bir script çalışmıyorsa, parçalara ayır ve her parçayı ayrı test et.

2. **Hata Mesajlarını Oku:** AppleScript hata kodları (-10000, -2740, etc.) spesifik anlam taşır.

3. **Quote Yönetimi:** Bash + AppleScript = Quote Hell. Geçici dosya en güvenli çözüm.

4. **Delay Kullan:** iTerm2 window operasyonları arasında `delay 1` gerekebilir.

5. **Session-Centric Düşün:** iTerm2'de her şey session seviyesinde. Tab ve Window sadece container.

---

**"Terminal uçar, yazı kalır."**

*Bu dokümantasyon, gelecekte benzer bir yolculuğa çıkacak olanlar için bir rehberdir.*
*2025-12-31, RAMAS Implementation - Elhamdülillah.*
