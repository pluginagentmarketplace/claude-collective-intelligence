/**
 * RAMAS RabbitMQ Exchanges & Queues
 *
 * RAMAS sistemi için RabbitMQ exchange ve queue tanımları.
 * Mevcut sisteme ek olarak yeni exchange'ler kurar.
 *
 * @module ramas/ramas-exchanges
 * @author Dr. Umit Kacar
 * @created 2025-12-31
 */

// RAMAS Exchange tanımları
export const EXCHANGES = {
  // Worker durumları için fanout exchange (tüm agent'lara)
  STATUS: {
    name: 'agent.ramas.status',
    type: 'fanout',
    options: {
      durable: true,
      autoDelete: false
    }
  },

  // Interrupt mesajları için direct exchange (hedef worker'a)
  INTERRUPT: {
    name: 'agent.ramas.interrupt',
    type: 'direct',
    options: {
      durable: true,
      autoDelete: false
    }
  },

  // Push mesajları için topic exchange (pattern matching)
  PUSH: {
    name: 'agent.ramas.push',
    type: 'topic',
    options: {
      durable: true,
      autoDelete: false
    }
  }
};

// RAMAS Queue tanımları
export const QUEUES = {
  // Durum değişikliklerini dinleyen kuyruk (daemon için)
  STATUS_UPDATES: {
    name: 'ramas.status.updates',
    options: {
      durable: true,
      autoDelete: false,
      arguments: {
        'x-message-ttl': 300000  // 5 dakika TTL
      }
    },
    bindings: [
      { exchange: 'agent.ramas.status', routingKey: '' }
    ]
  },

  // Interrupt komutlarını dinleyen kuyruk (daemon için)
  INTERRUPTS: {
    name: 'ramas.interrupts',
    options: {
      durable: true,
      autoDelete: false,
      arguments: {
        'x-message-ttl': 60000  // 1 dakika TTL (acil mesajlar)
      }
    }
    // Binding'ler workerId bazlı dinamik yapılacak
  },

  // Worker'a özel push kuyrukları (dinamik oluşturulur)
  // ramas.push.worker-001, ramas.push.worker-002, etc.
  PUSH_TEMPLATE: {
    namePattern: 'ramas.push.{workerId}',
    options: {
      durable: false,
      exclusive: true,
      autoDelete: true,
      arguments: {
        'x-message-ttl': 600000  // 10 dakika TTL
      }
    }
  }
};

// Routing key patterns
export const ROUTING_KEYS = {
  // Status routing keys
  STATUS_ALL: 'status.*',
  STATUS_GREEN: 'status.green',
  STATUS_RED: 'status.red',

  // Interrupt routing keys (workerId kullanılır)
  INTERRUPT_PREFIX: 'interrupt.',

  // Push routing keys
  PUSH_ALL: 'push.#',
  PUSH_WORKER_PREFIX: 'push.worker.',
  PUSH_URGENT: 'push.urgent.#'
};

/**
 * RAMAS exchange'lerini kur
 * @param {Object} channel - RabbitMQ channel
 * @returns {Promise<void>}
 */
export async function setupExchanges(channel) {
  console.log('[RAMAS] Setting up exchanges...');

  for (const [key, exchange] of Object.entries(EXCHANGES)) {
    await channel.assertExchange(
      exchange.name,
      exchange.type,
      exchange.options
    );
    console.log(`  ✅ Exchange: ${exchange.name} (${exchange.type})`);
  }

  console.log('[RAMAS] Exchanges ready');
}

/**
 * RAMAS queue'larını kur
 * @param {Object} channel - RabbitMQ channel
 * @returns {Promise<void>}
 */
export async function setupQueues(channel) {
  console.log('[RAMAS] Setting up queues...');

  // Status updates queue
  await channel.assertQueue(
    QUEUES.STATUS_UPDATES.name,
    QUEUES.STATUS_UPDATES.options
  );

  // Status queue'yu exchange'e bağla
  for (const binding of QUEUES.STATUS_UPDATES.bindings) {
    await channel.bindQueue(
      QUEUES.STATUS_UPDATES.name,
      binding.exchange,
      binding.routingKey
    );
  }
  console.log(`  ✅ Queue: ${QUEUES.STATUS_UPDATES.name}`);

  // Interrupts queue
  await channel.assertQueue(
    QUEUES.INTERRUPTS.name,
    QUEUES.INTERRUPTS.options
  );
  console.log(`  ✅ Queue: ${QUEUES.INTERRUPTS.name}`);

  console.log('[RAMAS] Queues ready');
}

/**
 * Worker için push queue oluştur
 * @param {Object} channel - RabbitMQ channel
 * @param {string} workerId - Worker ID
 * @returns {Promise<string>} Queue adı
 */
export async function createWorkerPushQueue(channel, workerId) {
  const queueName = `ramas.push.${workerId}`;

  await channel.assertQueue(queueName, QUEUES.PUSH_TEMPLATE.options);

  // Interrupt exchange'e bağla (direct routing)
  await channel.bindQueue(
    queueName,
    EXCHANGES.INTERRUPT.name,
    workerId  // workerId routing key olarak kullanılır
  );

  // Push exchange'e bağla (topic routing)
  await channel.bindQueue(
    queueName,
    EXCHANGES.PUSH.name,
    `push.${workerId}`
  );

  // Urgent mesajlar için de bağla
  await channel.bindQueue(
    queueName,
    EXCHANGES.PUSH.name,
    'push.urgent.*'
  );

  console.log(`[RAMAS] Worker queue created: ${queueName}`);
  return queueName;
}

/**
 * Worker push queue'sunu sil
 * @param {Object} channel - RabbitMQ channel
 * @param {string} workerId - Worker ID
 * @returns {Promise<void>}
 */
export async function deleteWorkerPushQueue(channel, workerId) {
  const queueName = `ramas.push.${workerId}`;

  try {
    await channel.deleteQueue(queueName);
    console.log(`[RAMAS] Worker queue deleted: ${queueName}`);
  } catch (error) {
    // Queue yoksa hata verme
    console.log(`[RAMAS] Queue not found: ${queueName}`);
  }
}

/**
 * Tüm RAMAS altyapısını kur
 * @param {Object} channel - RabbitMQ channel
 * @returns {Promise<void>}
 */
export async function setupAll(channel) {
  await setupExchanges(channel);
  await setupQueues(channel);
  console.log('[RAMAS] Full infrastructure ready');
}

/**
 * Exchange ve queue durumunu kontrol et
 * @param {Object} channel - RabbitMQ channel
 * @returns {Promise<Object>} Durum bilgisi
 */
export async function checkStatus(channel) {
  const status = {
    exchanges: {},
    queues: {}
  };

  // Exchange'leri kontrol et
  for (const [key, exchange] of Object.entries(EXCHANGES)) {
    try {
      await channel.checkExchange(exchange.name);
      status.exchanges[exchange.name] = 'ok';
    } catch {
      status.exchanges[exchange.name] = 'missing';
    }
  }

  // Queue'ları kontrol et
  try {
    const statusQueue = await channel.checkQueue(QUEUES.STATUS_UPDATES.name);
    status.queues[QUEUES.STATUS_UPDATES.name] = {
      status: 'ok',
      messageCount: statusQueue.messageCount,
      consumerCount: statusQueue.consumerCount
    };
  } catch {
    status.queues[QUEUES.STATUS_UPDATES.name] = { status: 'missing' };
  }

  try {
    const interruptQueue = await channel.checkQueue(QUEUES.INTERRUPTS.name);
    status.queues[QUEUES.INTERRUPTS.name] = {
      status: 'ok',
      messageCount: interruptQueue.messageCount,
      consumerCount: interruptQueue.consumerCount
    };
  } catch {
    status.queues[QUEUES.INTERRUPTS.name] = { status: 'missing' };
  }

  return status;
}

// Default export for convenience
export default {
  // Tanımlar
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,

  // Kurulum fonksiyonları
  setupExchanges,
  setupQueues,
  setupAll,

  // Worker queue yönetimi
  createWorkerPushQueue,
  deleteWorkerPushQueue,

  // Durum kontrolü
  checkStatus
};
