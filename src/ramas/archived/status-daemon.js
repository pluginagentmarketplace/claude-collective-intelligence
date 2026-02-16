#!/usr/bin/env node
/**
 * RAMAS Status Daemon
 *
 * RabbitMQ'yu dinleyip terminal'lere push notification gönderen daemon.
 * Bağımsız Node.js servisi olarak çalışır.
 *
 * Özellikler:
 * - Worker durum değişikliklerini dinler (green/red)
 * - Interrupt mesajlarını terminal'lere gönderir
 * - green durumda bekleyen mesajları flush eder
 * - Terminal başlıklarını günceller
 *
 * Kullanım:
 *   node src/ramas/status-daemon.js
 *   RABBITMQ_URL=amqp://... node src/ramas/status-daemon.js
 *
 * @module ramas/status-daemon
 * @author Dr. Umit Kacar
 * @created 2025-12-31
 */

import amqp from 'amqplib';
import * as registry from './window-registry.js';
import * as applescript from './applescript-controller.js';
import * as exchanges from './ramas-exchanges.js';

// Konfigürasyon
const CONFIG = {
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:rabbitmq123@localhost:5672',
  reconnectDelay: 5000,
  maxReconnectAttempts: 10,
  heartbeat: 30
};

/**
 * RAMAS Status Daemon sınıfı
 */
class StatusDaemon {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isRunning = false;
    this.reconnectAttempts = 0;

    // Worker'a gönderilecek bekleyen mesajlar
    // { workerId: [{ message, priority, timestamp }] }
    this.pendingMessages = {};
  }

  /**
   * Daemon'u başlat
   */
  async start() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    RAMAS Status Daemon                             ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    // Platform kontrolü
    if (!applescript.isMacOS()) {
      console.error('❌ RAMAS Daemon sadece macOS\'ta çalışır!');
      process.exit(1);
    }

    // iTerm2 kontrolü
    if (!applescript.isITerm2Available()) {
      console.warn('⚠️  iTerm2 çalışmıyor. Daemon başlatılıyor ama komutlar çalışmayacak.');
    }

    try {
      await this.connect();
      await this.setupInfrastructure();
      await this.startListeners();

      this.isRunning = true;
      console.log('');
      console.log('✅ RAMAS Daemon başarıyla başlatıldı!');
      console.log('');
      console.log('Dinleniyor:');
      console.log('  - Status değişiklikleri (agent.ramas.status)');
      console.log('  - Interrupt komutları (agent.ramas.interrupt)');
      console.log('');
      console.log('Registry: ' + registry.REGISTRY_PATH);
      console.log('');
      console.log('Durdurmak için: Ctrl+C');
      console.log('═══════════════════════════════════════════════════════════════════');

      // Graceful shutdown
      this.setupShutdownHandlers();

    } catch (error) {
      console.error('❌ Daemon başlatma hatası:', error.message);
      process.exit(1);
    }
  }

  /**
   * RabbitMQ'ya bağlan
   */
  async connect() {
    console.log('📡 RabbitMQ\'ya bağlanılıyor...');
    console.log('   URL:', CONFIG.rabbitmqUrl.replace(/:[^:@]+@/, ':****@'));

    this.connection = await amqp.connect(CONFIG.rabbitmqUrl, {
      heartbeat: CONFIG.heartbeat
    });

    this.connection.on('error', (err) => {
      console.error('❌ RabbitMQ bağlantı hatası:', err.message);
      this.handleDisconnect();
    });

    this.connection.on('close', () => {
      console.warn('⚠️  RabbitMQ bağlantısı kapandı');
      this.handleDisconnect();
    });

    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(10);

    console.log('✅ RabbitMQ bağlantısı kuruldu');
  }

  /**
   * Bağlantı koptuğunda yeniden bağlan
   */
  async handleDisconnect() {
    if (!this.isRunning) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts > CONFIG.maxReconnectAttempts) {
      console.error('❌ Maksimum yeniden bağlanma denemesi aşıldı. Daemon durduruluyor.');
      process.exit(1);
    }

    console.log(`🔄 Yeniden bağlanılıyor... (${this.reconnectAttempts}/${CONFIG.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        await this.setupInfrastructure();
        await this.startListeners();
        this.reconnectAttempts = 0;
        console.log('✅ Yeniden bağlandı!');
      } catch (error) {
        console.error('❌ Yeniden bağlanma hatası:', error.message);
        this.handleDisconnect();
      }
    }, CONFIG.reconnectDelay);
  }

  /**
   * RAMAS altyapısını kur
   */
  async setupInfrastructure() {
    console.log('🔧 RAMAS altyapısı kuruluyor...');
    await exchanges.setupAll(this.channel);

    // Registry'deki her worker için interrupt binding yap
    await this.bindInterruptQueue();
  }

  /**
   * Interrupt queue'yu exchange'e bağla
   * Her worker için ayrı binding gerekir (direct exchange)
   */
  async bindInterruptQueue() {
    const workers = registry.getAllWindows();
    const workerIds = Object.keys(workers);

    if (workerIds.length === 0) {
      console.log('  ⚠️  Registry boş - interrupt binding bekliyor');
      // Boş olsa bile genel bir binding yapalım
      await this.channel.bindQueue(
        exchanges.QUEUES.INTERRUPTS.name,
        exchanges.EXCHANGES.INTERRUPT.name,
        '#'  // Tüm mesajları al (topic'te çalışır, direct'te çalışmaz)
      );
    }

    for (const workerId of workerIds) {
      await this.channel.bindQueue(
        exchanges.QUEUES.INTERRUPTS.name,
        exchanges.EXCHANGES.INTERRUPT.name,
        workerId  // workerId routing key olarak kullanılır
      );
      console.log(`  🔗 Interrupt binding: ${workerId}`);
    }
  }

  /**
   * Mesaj dinleyicilerini başlat
   */
  async startListeners() {
    console.log('👂 Dinleyiciler başlatılıyor...');

    // Status değişikliklerini dinle
    await this.listenStatusUpdates();

    // Interrupt komutlarını dinle
    await this.listenInterrupts();

    console.log('✅ Dinleyiciler aktif');
  }

  /**
   * Status güncellemelerini dinle
   */
  async listenStatusUpdates() {
    await this.channel.consume(
      exchanges.QUEUES.STATUS_UPDATES.name,
      async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          console.log(`📊 Status update: ${content.workerId} -> ${content.status}`);

          await this.handleStatusChange(content);
          this.channel.ack(msg);

        } catch (error) {
          console.error('❌ Status mesajı işleme hatası:', error.message);
          this.channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  }

  /**
   * Interrupt mesajlarını dinle
   */
  async listenInterrupts() {
    await this.channel.consume(
      exchanges.QUEUES.INTERRUPTS.name,
      async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          console.log(`🔔 Interrupt: ${content.workerId} - ${content.priority}`);

          await this.handleInterrupt(content);
          this.channel.ack(msg);

        } catch (error) {
          console.error('❌ Interrupt mesajı işleme hatası:', error.message);
          this.channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  }

  /**
   * Status değişikliğini işle
   * @param {Object} data - { workerId, status, timestamp }
   */
  async handleStatusChange(data) {
    const { workerId, status } = data;

    // Registry'den worker bilgisini al
    const worker = registry.getWindow(workerId);
    if (!worker) {
      console.warn(`⚠️  Worker bulunamadı: ${workerId}`);
      return;
    }

    // Terminal başlığını güncelle
    const titleUpdated = applescript.updateStatusTitle(
      worker.windowId,
      workerId,
      status
    );

    if (titleUpdated) {
      console.log(`   ✅ Başlık güncellendi: [${status.toUpperCase()}] ${workerId}`);
    }

    // Registry'yi güncelle
    registry.updateStatus(workerId, status);

    // green olduysa bekleyen mesajları gönder
    if (status === 'green') {
      await this.flushPendingMessages(workerId);
    }
  }

  /**
   * Interrupt mesajını işle
   * @param {Object} data - { workerId, message, priority }
   */
  async handleInterrupt(data) {
    const { workerId, message, priority = 'normal' } = data;

    // Registry'den worker bilgisini al
    const worker = registry.getWindow(workerId);
    if (!worker) {
      console.warn(`⚠️  Worker bulunamadı: ${workerId}`);
      return;
    }

    // Priority veya green durumda hemen gönder
    if (priority === 'urgent' || worker.status === 'green') {
      let success;

      if (priority === 'urgent') {
        // Acil: Ctrl+C + ESC + mesaj
        success = applescript.urgentInterrupt(worker.windowId, message);
      } else {
        // Normal: ESC + mesaj
        success = applescript.interruptAndMessage(worker.windowId, message);
      }

      if (success) {
        console.log(`   ✅ Mesaj gönderildi: ${workerId}`);
      } else {
        console.error(`   ❌ Mesaj gönderilemedi: ${workerId}`);
      }

    } else {
      // red durumda kuyruğa ekle
      this.addPendingMessage(workerId, message, priority);
      console.log(`   📥 Mesaj kuyruğa eklendi (worker red): ${workerId}`);
    }
  }

  /**
   * Bekleyen mesaj ekle
   * @param {string} workerId - Worker ID
   * @param {string} message - Mesaj
   * @param {string} priority - Öncelik
   */
  addPendingMessage(workerId, message, priority) {
    if (!this.pendingMessages[workerId]) {
      this.pendingMessages[workerId] = [];
    }

    this.pendingMessages[workerId].push({
      message,
      priority,
      timestamp: Date.now()
    });
  }

  /**
   * Bekleyen mesajları gönder (worker green olunca)
   * @param {string} workerId - Worker ID
   */
  async flushPendingMessages(workerId) {
    const pending = this.pendingMessages[workerId];
    if (!pending || pending.length === 0) {
      return;
    }

    const worker = registry.getWindow(workerId);
    if (!worker) return;

    console.log(`   📤 ${pending.length} bekleyen mesaj gönderiliyor: ${workerId}`);

    // Mesajları sırayla gönder
    for (const item of pending) {
      applescript.interruptAndMessage(worker.windowId, item.message, {
        pressEnter: true
      });

      // Mesajlar arası kısa bekleme
      await this.sleep(500);
    }

    // Kuyruğu temizle
    this.pendingMessages[workerId] = [];
    console.log(`   ✅ Bekleyen mesajlar gönderildi: ${workerId}`);
  }

  /**
   * Yardımcı: ms kadar bekle
   * @param {number} ms - Milisaniye
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown için handler'lar kur
   */
  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      console.log('');
      console.log(`${signal} alındı. Daemon durduruluyor...`);
      this.isRunning = false;

      try {
        if (this.channel) {
          await this.channel.close();
        }
        if (this.connection) {
          await this.connection.close();
        }
        console.log('✅ Temiz kapanış tamamlandı');
        process.exit(0);
      } catch (error) {
        console.error('❌ Kapanış hatası:', error.message);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Daemon durumunu al
   * @returns {Object} Durum bilgisi
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      reconnectAttempts: this.reconnectAttempts,
      pendingMessagesCount: Object.values(this.pendingMessages)
        .reduce((sum, arr) => sum + arr.length, 0),
      registryStats: registry.getStats()
    };
  }
}

// Ana modül olarak çalıştırılırsa daemon'u başlat
// ES Module'de import.meta.url kullanıyoruz
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this is the main module
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  const daemon = new StatusDaemon();
  daemon.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default StatusDaemon;
