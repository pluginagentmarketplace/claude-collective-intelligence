/**
 * RAMAS Window Registry
 *
 * Worker terminal pencere bilgilerini yönetir.
 * JSON dosyasında saklar: /tmp/ramas-windows.json
 *
 * @module ramas/window-registry
 * @author Dr. Umit Kacar
 * @created 2025-12-31
 */

import fs from 'fs';
import path from 'path';

// Registry dosya yolu
export const REGISTRY_PATH = process.env.RAMAS_REGISTRY_PATH || '/tmp/ramas-windows.json';

// Varsayılan boş registry
const DEFAULT_REGISTRY = {
  version: '1.0.0',
  created: null,
  updated: null,
  windows: {}
};

/**
 * Registry dosyasını oku
 * @returns {Object} Registry içeriği
 */
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[RAMAS] Registry load error:', error.message);
  }
  return { ...DEFAULT_REGISTRY, created: Date.now() };
}

/**
 * Registry dosyasını kaydet
 * @param {Object} registry - Kaydedilecek registry
 */
function saveRegistry(registry) {
  try {
    registry.updated = Date.now();
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[RAMAS] Registry save error:', error.message);
    return false;
  }
}

/**
 * Worker penceresi kaydet
 * @param {string} workerId - Worker ID (örn: "worker-001")
 * @param {string} windowId - iTerm2 Window ID
 * @param {string} sessionId - iTerm2 Session ID
 * @param {string} status - Durum: "green" | "red"
 * @returns {boolean} Başarılı mı
 */
export function saveWindow(workerId, windowId, sessionId = null, status = 'green') {
  const registry = loadRegistry();

  registry.windows[workerId] = {
    windowId: String(windowId),
    sessionId: sessionId ? String(sessionId) : null,
    status: status,
    registeredAt: Date.now(),
    lastStatusChange: Date.now()
  };

  return saveRegistry(registry);
}

/**
 * Worker pencere bilgisini al
 * @param {string} workerId - Worker ID
 * @returns {Object|null} Pencere bilgisi veya null
 */
export function getWindow(workerId) {
  const registry = loadRegistry();
  return registry.windows[workerId] || null;
}

/**
 * Tüm worker pencerelerini al
 * @returns {Object} Tüm pencereler
 */
export function getAllWindows() {
  const registry = loadRegistry();
  return registry.windows;
}

/**
 * Worker durumunu güncelle
 * @param {string} workerId - Worker ID
 * @param {string} status - Yeni durum: "green" | "red"
 * @returns {boolean} Başarılı mı
 */
export function updateStatus(workerId, status) {
  const registry = loadRegistry();

  if (!registry.windows[workerId]) {
    console.error(`[RAMAS] Worker not found: ${workerId}`);
    return false;
  }

  // Durum validasyonu
  if (!['green', 'red'].includes(status)) {
    console.error(`[RAMAS] Invalid status: ${status}. Must be 'green' or 'red'`);
    return false;
  }

  const previousStatus = registry.windows[workerId].status;
  registry.windows[workerId].status = status;
  registry.windows[workerId].lastStatusChange = Date.now();
  registry.windows[workerId].previousStatus = previousStatus;

  return saveRegistry(registry);
}

/**
 * Worker'ı registry'den kaldır
 * @param {string} workerId - Worker ID
 * @returns {boolean} Başarılı mı
 */
export function removeWindow(workerId) {
  const registry = loadRegistry();

  if (registry.windows[workerId]) {
    delete registry.windows[workerId];
    return saveRegistry(registry);
  }

  return false;
}

/**
 * Belirli durumdaki worker'ları al
 * @param {string} status - Filtre: "green" | "red"
 * @returns {Array} Worker ID listesi
 */
export function getWorkersByStatus(status) {
  const registry = loadRegistry();
  return Object.entries(registry.windows)
    .filter(([_, w]) => w.status === status)
    .map(([id, _]) => id);
}

/**
 * Registry'yi temizle (tüm worker'ları sil)
 * @returns {boolean} Başarılı mı
 */
export function clearRegistry() {
  const registry = { ...DEFAULT_REGISTRY, created: Date.now() };
  return saveRegistry(registry);
}

/**
 * Registry dosyasının var olup olmadığını kontrol et
 * @returns {boolean} Var mı
 */
export function exists() {
  return fs.existsSync(REGISTRY_PATH);
}

/**
 * Registry istatistiklerini al
 * @returns {Object} İstatistikler
 */
export function getStats() {
  const registry = loadRegistry();
  const windows = Object.values(registry.windows);

  return {
    total: windows.length,
    green: windows.filter(w => w.status === 'green').length,
    red: windows.filter(w => w.status === 'red').length,
    registryPath: REGISTRY_PATH,
    created: registry.created,
    updated: registry.updated
  };
}

// Default export for convenience
export default {
  saveWindow,
  getWindow,
  getAllWindows,
  updateStatus,
  removeWindow,
  getWorkersByStatus,
  clearRegistry,
  exists,
  getStats,
  REGISTRY_PATH
};
