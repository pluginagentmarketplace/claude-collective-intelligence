/**
 * RAMAS AppleScript Controller
 *
 * iTerm2 terminal kontrolü için AppleScript wrapper.
 * ESC gönderme, mesaj yazma, başlık güncelleme işlemleri.
 *
 * @module ramas/applescript-controller
 * @author Dr. Umit Kacar
 * @created 2025-12-31
 * @platform macOS only (requires iTerm2)
 */

import { execSync, exec } from 'child_process';

// AppleScript key codes
export const KEY_CODES = {
  ESC: 53,
  ENTER: 36,
  TAB: 48,
  SPACE: 49,
  DELETE: 51,
  CTRL_C: 8  // 'c' key, used with control modifier
};

// Varsayılan delay değerleri (saniye)
export const DELAYS = {
  AFTER_ESC: 0.2,
  AFTER_MESSAGE: 0.1,
  BETWEEN_COMMANDS: 0.15
};

/**
 * AppleScript komutunu çalıştır
 * @param {string} script - AppleScript kodu
 * @param {boolean} async - Asenkron çalıştır mı
 * @returns {string|null} Çıktı veya hata durumunda null
 */
export function runAppleScript(script, async = false) {
  try {
    if (async) {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (error, stdout, stderr) => {
        if (error) {
          console.error('[RAMAS] AppleScript async error:', error.message);
        }
      });
      return null;
    }

    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf8',
      timeout: 5000
    });
    return result.trim();
  } catch (error) {
    console.error('[RAMAS] AppleScript error:', error.message);
    return null;
  }
}

/**
 * Çok satırlı AppleScript çalıştır
 * @param {string} script - AppleScript kodu
 * @returns {string|null} Çıktı
 */
export function runMultilineAppleScript(script) {
  try {
    const result = execSync(`osascript <<'APPLESCRIPT_EOF'
${script}
APPLESCRIPT_EOF`, {
      encoding: 'utf8',
      shell: '/bin/bash',
      timeout: 10000
    });
    return result.trim();
  } catch (error) {
    console.error('[RAMAS] AppleScript multiline error:', error.message);
    return null;
  }
}

/**
 * iTerm2 penceresine ESC tuşu gönder
 * @param {string} windowId - iTerm2 Window ID
 * @returns {boolean} Başarılı mı
 */
export function sendESC(windowId) {
  const script = `
tell application "iTerm2"
    tell window id ${windowId}
        tell current session
            tell application "System Events"
                key code ${KEY_CODES.ESC}
            end tell
        end tell
    end tell
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * iTerm2 penceresine Ctrl+C gönder (process interrupt)
 * @param {string} windowId - iTerm2 Window ID
 * @returns {boolean} Başarılı mı
 */
export function sendCtrlC(windowId) {
  const script = `
tell application "iTerm2"
    tell window id ${windowId}
        tell current session
            tell application "System Events"
                key code ${KEY_CODES.CTRL_C} using control down
            end tell
        end tell
    end tell
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * iTerm2 penceresine mesaj yaz (Enter basmadan)
 * @param {string} windowId - iTerm2 Window ID
 * @param {string} text - Yazılacak metin
 * @returns {boolean} Başarılı mı
 */
export function writeText(windowId, text) {
  // Özel karakterleri escape et
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  const script = `
tell application "iTerm2"
    tell window id ${windowId}
        tell current session
            write text "${escapedText}" newline NO
        end tell
    end tell
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * iTerm2 penceresine mesaj yaz ve Enter bas
 * @param {string} windowId - iTerm2 Window ID
 * @param {string} text - Yazılacak metin
 * @returns {boolean} Başarılı mı
 */
export function sendMessage(windowId, text) {
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const script = `
tell application "iTerm2"
    tell window id ${windowId}
        tell current session
            write text "${escapedText}"
        end tell
    end tell
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * iTerm2 pencere/tab başlığını güncelle
 * @param {string} windowId - iTerm2 Window ID
 * @param {string} title - Yeni başlık (örn: "[GREEN] WORKER-001")
 * @returns {boolean} Başarılı mı
 */
export function updateTitle(windowId, title) {
  const escapedTitle = title.replace(/"/g, '\\"');

  // iTerm2'de session name ayarlamak yeterli - tab başlığını da günceller
  // Tab title ayrıca ayarlanamaz, sadece session name kullanılır
  const script = `
tell application "iTerm2"
    activate
    tell window id ${windowId}
        tell current session
            set name to "${escapedTitle}"
        end tell
    end tell
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * Worker durumuna göre başlık güncelle
 * @param {string} windowId - iTerm2 Window ID
 * @param {string} workerId - Worker ID (örn: "worker-001")
 * @param {string} status - Durum: "green" | "red"
 * @returns {boolean} Başarılı mı
 */
export function updateStatusTitle(windowId, workerId, status) {
  const statusLabel = status.toUpperCase();
  const title = `[${statusLabel}] ${workerId.toUpperCase()}`;
  return updateTitle(windowId, title);
}

/**
 * ESC ile interrupt yap ve mesaj gönder
 * @param {string} windowId - iTerm2 Window ID
 * @param {string} message - Gönderilecek mesaj
 * @param {Object} options - Seçenekler
 * @param {number} options.escDelay - ESC sonrası bekleme (saniye)
 * @param {boolean} options.pressEnter - Enter basılsın mı
 * @returns {boolean} Başarılı mı
 */
export function interruptAndMessage(windowId, message, options = {}) {
  const escDelay = options.escDelay || DELAYS.AFTER_ESC;
  const pressEnter = options.pressEnter !== false;

  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const writeCommand = pressEnter
    ? `write text "${escapedMessage}"`
    : `write text "${escapedMessage}" newline NO`;

  const script = `
tell application "iTerm2"
    activate
    tell window id ${windowId}
        tell current session
            -- ESC ile mevcut komutu iptal et
            tell application "System Events"
                key code ${KEY_CODES.ESC}
            end tell

            delay ${escDelay}

            -- Mesajı yaz
            ${writeCommand}
        end tell
    end tell
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * Acil interrupt - Ctrl+C + ESC + mesaj
 * @param {string} windowId - iTerm2 Window ID
 * @param {string} message - Gönderilecek acil mesaj
 * @returns {boolean} Başarılı mı
 */
export function urgentInterrupt(windowId, message) {
  const escapedMessage = message
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  const script = `
tell application "iTerm2"
    activate
    tell window id ${windowId}
        tell current session
            -- Önce Ctrl+C ile çalışan process'i durdur
            tell application "System Events"
                key code ${KEY_CODES.CTRL_C} using control down
            end tell

            delay 0.1

            -- Sonra ESC ile input'u temizle
            tell application "System Events"
                key code ${KEY_CODES.ESC}
            end tell

            delay ${DELAYS.AFTER_ESC}

            -- Acil mesajı yaz
            write text "🚨 URGENT: ${escapedMessage}"
        end tell
    end tell
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * iTerm2 penceresini öne getir (focus)
 * @param {string} windowId - iTerm2 Window ID
 * @returns {boolean} Başarılı mı
 */
export function focusWindow(windowId) {
  const script = `
tell application "iTerm2"
    activate
    set frontmost of window id ${windowId} to true
end tell
`;
  return runMultilineAppleScript(script) !== null;
}

/**
 * Tüm iTerm2 pencerelerinin ID'lerini al
 * @returns {Array} Window ID listesi
 */
export function getAllWindowIds() {
  const script = `
tell application "iTerm2"
    set windowIds to {}
    repeat with w in windows
        set end of windowIds to id of w
    end repeat
    return windowIds
end tell
`;
  const result = runMultilineAppleScript(script);
  if (result) {
    // AppleScript list format: "id1, id2, id3"
    return result.split(', ').map(id => id.trim());
  }
  return [];
}

/**
 * Pencere bilgilerini al (konum, boyut)
 * @param {string} windowId - iTerm2 Window ID
 * @returns {Object|null} Pencere bilgileri
 */
export function getWindowInfo(windowId) {
  const script = `
tell application "iTerm2"
    tell window id ${windowId}
        set b to bounds
        set sessionName to name of current session
        return (item 1 of b as string) & "," & (item 2 of b as string) & "," & (item 3 of b as string) & "," & (item 4 of b as string) & "," & sessionName
    end tell
end tell
`;
  const result = runMultilineAppleScript(script);
  if (result) {
    const parts = result.split(',');
    return {
      x: parseInt(parts[0]),
      y: parseInt(parts[1]),
      width: parseInt(parts[2]) - parseInt(parts[0]),
      height: parseInt(parts[3]) - parseInt(parts[1]),
      sessionName: parts.slice(4).join(',').trim()
    };
  }
  return null;
}

/**
 * Platform kontrolü - sadece macOS'ta çalışır
 * @returns {boolean} macOS mu
 */
export function isMacOS() {
  return process.platform === 'darwin';
}

/**
 * iTerm2'nin kurulu ve çalışıyor olduğunu kontrol et
 * @returns {boolean} iTerm2 hazır mı
 */
export function isITerm2Available() {
  if (!isMacOS()) return false;

  try {
    const result = execSync('osascript -e "application \\"iTerm2\\" is running"', {
      encoding: 'utf8'
    });
    return result.trim() === 'true';
  } catch {
    return false;
  }
}

// Default export for convenience
export default {
  // Temel işlemler
  sendESC,
  sendCtrlC,
  writeText,
  sendMessage,
  updateTitle,
  updateStatusTitle,

  // Interrupt işlemleri
  interruptAndMessage,
  urgentInterrupt,

  // Pencere yönetimi
  focusWindow,
  getAllWindowIds,
  getWindowInfo,

  // Utility
  isMacOS,
  isITerm2Available,
  runAppleScript,
  runMultilineAppleScript,

  // Sabitler
  KEY_CODES,
  DELAYS
};
