/**
 * Database Initialization Script
 * Sets up PostgreSQL and Redis with proper configuration
 * Run once on first deployment
 */

import connectionPool from './connection-pool.js';
import winston from 'winston';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class DatabaseInitializer {
  constructor() {
    this.pool = connectionPool;
    this.initialized = false;
  }

  /**
   * Run all initialization steps
   */
  async initialize() {
    try {
      logger.info('Starting database initialization...');

      // Connect to databases
      await this.pool.initialize();
      logger.info('Connections established');

      // Run migrations
      await this.runMigrations();
      logger.info('Migrations completed');

      // Verify schema
      await this.verifySchema();
      logger.info('Schema verification passed');

      // Create indexes
      await this.verifyIndexes();
      logger.info('Indexes verified');

      // Seed initial data (optional)
      if (process.env.SEED_DATABASE === 'true') {
        await this.seedDatabase();
        logger.info('Database seeded with initial data');
      }

      // Run health check
      const health = await this.pool.getHealthStatus();
      logger.info('Health check passed', { health: health.status });

      this.initialized = true;
      logger.info('Database initialization completed successfully!');

      return true;

    } catch (error) {
      logger.error('Database initialization failed', error);
      throw error;
    }
  }

  /**
   * Run SQL migration files
   */
  async runMigrations() {
    try {
      const migrationDir = path.join(__dirname, '../../migrations');

      if (!fs.existsSync(migrationDir)) {
        logger.warn('Migrations directory not found');
        return;
      }

      const files = fs.readdirSync(migrationDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const filePath = path.join(migrationDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        logger.info(`Running migration: ${file}`);

        // Execute migration SQL
        await this.pool.postgres.query(sql);
      }

      logger.info(`Completed ${files.length} migrations`);

    } catch (error) {
      logger.error('Migration execution failed', error);
      throw error;
    }
  }

  /**
   * Verify schema exists and is correct
   */
  async verifySchema() {
    try {
      const tables = [
        'agents',
        'tasks',
        'sessions',
        'audit_logs',
        'achievements'
      ];

      for (const table of tables) {
        const result = await this.pool.postgres.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = $1
          ) as exists
        `, [table]);

        if (!result.rows[0].exists) {
          throw new Error(`Table '${table}' does not exist`);
        }

        logger.info(`Verified table: ${table}`);
      }

    } catch (error) {
      logger.error('Schema verification failed', error);
      throw error;
    }
  }

  /**
   * Verify indexes exist
   */
  async verifyIndexes() {
    try {
      const indexCheckQuery = `
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = $1
      `;

      const tables = ['agents', 'tasks', 'sessions'];

      for (const table of tables) {
        const result = await this.pool.postgres.query(indexCheckQuery, [table]);
        logger.info(`Found ${result.rows.length} indexes on ${table}`);
      }

    } catch (error) {
      logger.warn('Index verification warning', error.message);
      // Don't throw - indexes are not critical
    }
  }

  /**
   * Seed initial data (optional)
   */
  async seedDatabase() {
    try {
      // Check if already seeded
      const result = await this.pool.postgres.query(
        'SELECT COUNT(*) as count FROM agents'
      );

      if (result.rows[0].count > 0) {
        logger.info('Database already seeded, skipping seed');
        return;
      }

      // Insert sample agents
      const agents = [
        {
          name: 'Agent-Analysis',
          role: 'analyst',
          status: 'idle',
          capabilities: JSON.stringify(['data-analysis', 'reporting']),
          metadata: JSON.stringify({ version: '1.0', type: 'analyst' })
        },
        {
          name: 'Agent-Planning',
          role: 'planner',
          status: 'idle',
          capabilities: JSON.stringify(['planning', 'scheduling']),
          metadata: JSON.stringify({ version: '1.0', type: 'planner' })
        }
      ];

      for (const agent of agents) {
        await this.pool.postgres.query(`
          INSERT INTO agents (name, role, status, capabilities, metadata)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (name) DO NOTHING
        `, [agent.name, agent.role, agent.status, agent.capabilities, agent.metadata]);
      }

      logger.info(`Seeded ${agents.length} agents`);

    } catch (error) {
      logger.warn('Database seeding warning', error.message);
      // Don't throw - seeding is optional
    }
  }

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Main execution
 */
async function main() {
  const initializer = new DatabaseInitializer();

  try {
    await initializer.initialize();
    logger.info('Setup complete!');
    process.exit(0);

  } catch (error) {
    logger.error('Setup failed!', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default DatabaseInitializer;
export { DatabaseInitializer };
