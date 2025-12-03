import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dbClient from './db-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration runner for database schema management
 */
class MigrationsRunner {
  constructor(db = dbClient) {
    this.db = db;
    this.migrationsDir = path.join(__dirname, '../../migrations');
  }

  /**
   * Initialize migrations table
   */
  async initMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await this.db.query(query);
    console.log('Migrations table initialized');
  }

  /**
   * Get list of executed migrations
   * @returns {Promise<Array>} List of executed migration names
   */
  async getExecutedMigrations() {
    const query = 'SELECT migration_name FROM schema_migrations ORDER BY id ASC';

    try {
      const result = await this.db.query(query);
      return result.rows.map(row => row.migration_name);
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Get list of migration files
   * @returns {Promise<Array>} List of migration file names
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      console.warn(`Migrations directory not found: ${this.migrationsDir}`);
      return [];
    }
  }

  /**
   * Execute a single migration
   * @param {string} migrationName - Migration file name
   * @returns {Promise<void>}
   */
  async executeMigration(migrationName) {
    const filePath = path.join(this.migrationsDir, migrationName);

    try {
      const sql = await fs.readFile(filePath, 'utf-8');

      await this.db.transaction(async (client) => {
        // Execute migration SQL
        await client.query(sql);

        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [migrationName]
        );
      });

      console.log(`✓ Executed migration: ${migrationName}`);
    } catch (error) {
      console.error(`✗ Failed to execute migration ${migrationName}:`, error.message);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   * @returns {Promise<Object>} Migration results
   */
  async runMigrations() {
    await this.db.connect();
    await this.initMigrationsTable();

    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();

    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return {
        executed: 0,
        pending: 0,
        total: migrationFiles.length,
      };
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('All migrations executed successfully');

    return {
      executed: pendingMigrations.length,
      pending: 0,
      total: migrationFiles.length,
    };
  }

  /**
   * Rollback last migration
   * @returns {Promise<void>}
   */
  async rollbackLastMigration() {
    const executedMigrations = await this.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    const rollbackFile = lastMigration.replace('.sql', '.rollback.sql');
    const filePath = path.join(this.migrationsDir, rollbackFile);

    try {
      const sql = await fs.readFile(filePath, 'utf-8');

      await this.db.transaction(async (client) => {
        // Execute rollback SQL
        await client.query(sql);

        // Remove migration record
        await client.query(
          'DELETE FROM schema_migrations WHERE migration_name = $1',
          [lastMigration]
        );
      });

      console.log(`✓ Rolled back migration: ${lastMigration}`);
    } catch (error) {
      console.error(`✗ Failed to rollback migration ${lastMigration}:`, error.message);
      throw error;
    }
  }

  /**
   * Get migration status
   * @returns {Promise<Object>} Migration status
   */
  async getStatus() {
    await this.db.connect();

    try {
      await this.initMigrationsTable();
    } catch (error) {
      // Ignore if table already exists
    }

    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();

    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    return {
      executed: executedMigrations,
      pending: pendingMigrations,
      total: migrationFiles.length,
    };
  }

  /**
   * Create a new migration file
   * @param {string} name - Migration name
   * @returns {Promise<string>} Migration file path
   */
  async createMigration(name) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const fileName = `${timestamp}_${name}.sql`;
    const rollbackFileName = `${timestamp}_${name}.rollback.sql`;

    const filePath = path.join(this.migrationsDir, fileName);
    const rollbackFilePath = path.join(this.migrationsDir, rollbackFileName);

    // Ensure migrations directory exists
    await fs.mkdir(this.migrationsDir, { recursive: true });

    // Create migration file
    await fs.writeFile(
      filePath,
      `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n\n-- Add your migration SQL here\n`
    );

    // Create rollback file
    await fs.writeFile(
      rollbackFilePath,
      `-- Rollback: ${name}\n-- Created: ${new Date().toISOString()}\n\n-- Add your rollback SQL here\n`
    );

    console.log(`Created migration files:`);
    console.log(`  ${fileName}`);
    console.log(`  ${rollbackFileName}`);

    return filePath;
  }

  /**
   * Reset database (drop all tables and re-run migrations)
   * WARNING: This will delete all data!
   * @param {boolean} confirm - Confirmation flag
   * @returns {Promise<void>}
   */
  async reset(confirm = false) {
    if (!confirm) {
      throw new Error('Reset requires confirmation. Pass confirm=true to proceed.');
    }

    console.warn('⚠️  WARNING: Resetting database - all data will be lost!');

    await this.db.connect();

    // Drop all tables
    const dropQuery = `
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `;

    await this.db.query(dropQuery);
    console.log('✓ Database reset');

    // Re-run all migrations
    await this.runMigrations();
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new MigrationsRunner();
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'run':
          await runner.runMigrations();
          break;

        case 'rollback':
          await runner.rollbackLastMigration();
          break;

        case 'status':
          const status = await runner.getStatus();
          console.log('\nMigration Status:');
          console.log(`  Total: ${status.total}`);
          console.log(`  Executed: ${status.executed.length}`);
          console.log(`  Pending: ${status.pending.length}`);
          if (status.pending.length > 0) {
            console.log('\nPending migrations:');
            status.pending.forEach(m => console.log(`  - ${m}`));
          }
          break;

        case 'create':
          const name = process.argv[3];
          if (!name) {
            console.error('Error: Migration name required');
            console.log('Usage: node migrations-runner.js create <name>');
            process.exit(1);
          }
          await runner.createMigration(name);
          break;

        case 'reset':
          const confirm = process.argv[3] === '--confirm';
          await runner.reset(confirm);
          break;

        default:
          console.log('Database Migration Runner');
          console.log('\nUsage:');
          console.log('  node migrations-runner.js run           - Run all pending migrations');
          console.log('  node migrations-runner.js rollback      - Rollback last migration');
          console.log('  node migrations-runner.js status        - Show migration status');
          console.log('  node migrations-runner.js create <name> - Create new migration');
          console.log('  node migrations-runner.js reset --confirm - Reset database (DANGEROUS!)');
          process.exit(0);
      }

      await runner.db.close();
      process.exit(0);
    } catch (error) {
      console.error('Migration error:', error);
      await runner.db.close();
      process.exit(1);
    }
  })();
}

export default MigrationsRunner;
