import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

/**
 * Database client with connection pooling, transactions, and query builders
 */
class DatabaseClient {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_agent_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000'),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
    };
  }

  /**
   * Initialize the database connection pool
   */
  async connect() {
    if (this.pool) {
      return;
    }

    this.pool = new Pool(this.config);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
      process.exit(-1);
    });

    this.pool.on('connect', () => {
      console.log('Database client connected to pool');
    });

    this.pool.on('remove', () => {
      console.log('Database client removed from pool');
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      console.log('Database connection pool initialized successfully');
      client.release();
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Execute a query with optional parameters
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      console.error('Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  /**
   * Execute a prepared statement
   * @param {Object} config - Query configuration
   * @param {string} config.name - Statement name
   * @param {string} config.text - SQL query text
   * @param {Array} config.values - Query values
   * @returns {Promise<Object>} Query result
   */
  async executePrepared({ name, text, values = [] }) {
    const start = Date.now();
    try {
      const result = await this.pool.query({ name, text, values });
      const duration = Date.now() - start;

      if (duration > 1000) {
        console.warn(`Slow prepared statement (${duration}ms):`, name);
      }

      return result;
    } catch (error) {
      console.error('Prepared statement error:', error);
      console.error('Statement:', name);
      throw error;
    }
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<*>} Transaction result
   */
  async transaction(callback) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for manual transaction management
   * @returns {Promise<Object>} Database client
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Query builder for SELECT statements
   * @param {string} table - Table name
   * @returns {Object} Query builder
   */
  select(table) {
    const builder = {
      _table: table,
      _columns: ['*'],
      _where: [],
      _whereParams: [],
      _orderBy: [],
      _limit: null,
      _offset: null,
      _joins: [],

      columns(...cols) {
        this._columns = cols;
        return this;
      },

      where(condition, ...params) {
        this._where.push(condition);
        this._whereParams.push(...params);
        return this;
      },

      join(table, condition) {
        this._joins.push(`JOIN ${table} ON ${condition}`);
        return this;
      },

      leftJoin(table, condition) {
        this._joins.push(`LEFT JOIN ${table} ON ${condition}`);
        return this;
      },

      orderBy(column, direction = 'ASC') {
        this._orderBy.push(`${column} ${direction}`);
        return this;
      },

      limit(limit) {
        this._limit = limit;
        return this;
      },

      offset(offset) {
        this._offset = offset;
        return this;
      },

      async execute() {
        let query = `SELECT ${this._columns.join(', ')} FROM ${this._table}`;

        if (this._joins.length > 0) {
          query += ' ' + this._joins.join(' ');
        }

        if (this._where.length > 0) {
          const conditions = this._where.map((_, i) =>
            this._where[i].includes('$') ? this._where[i] : `${this._where[i]} = $${i + 1}`
          );
          query += ` WHERE ${conditions.join(' AND ')}`;
        }

        if (this._orderBy.length > 0) {
          query += ` ORDER BY ${this._orderBy.join(', ')}`;
        }

        if (this._limit !== null) {
          query += ` LIMIT ${this._limit}`;
        }

        if (this._offset !== null) {
          query += ` OFFSET ${this._offset}`;
        }

        return await dbClient.query(query, this._whereParams);
      }
    };

    return builder;
  }

  /**
   * Query builder for INSERT statements
   * @param {string} table - Table name
   * @returns {Object} Query builder
   */
  insert(table) {
    const builder = {
      _table: table,
      _data: {},
      _returning: ['*'],

      values(data) {
        this._data = data;
        return this;
      },

      returning(...cols) {
        this._returning = cols;
        return this;
      },

      async execute() {
        const keys = Object.keys(this._data);
        const values = Object.values(this._data);
        const placeholders = keys.map((_, i) => `$${i + 1}`);

        const query = `
          INSERT INTO ${this._table} (${keys.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING ${this._returning.join(', ')}
        `;

        return await dbClient.query(query, values);
      }
    };

    return builder;
  }

  /**
   * Query builder for UPDATE statements
   * @param {string} table - Table name
   * @returns {Object} Query builder
   */
  update(table) {
    const builder = {
      _table: table,
      _data: {},
      _where: [],
      _whereParams: [],
      _returning: ['*'],

      set(data) {
        this._data = data;
        return this;
      },

      where(condition, ...params) {
        this._where.push(condition);
        this._whereParams.push(...params);
        return this;
      },

      returning(...cols) {
        this._returning = cols;
        return this;
      },

      async execute() {
        const keys = Object.keys(this._data);
        const values = Object.values(this._data);

        const setClause = keys.map((key, i) => `${key} = $${i + 1}`);
        const whereParamOffset = values.length;

        let query = `UPDATE ${this._table} SET ${setClause.join(', ')}`;

        if (this._where.length > 0) {
          const conditions = this._where.map((cond, i) => {
            if (cond.includes('$')) {
              return cond.replace(/\$(\d+)/g, (_, num) => `$${whereParamOffset + parseInt(num)}`);
            }
            return `${cond} = $${whereParamOffset + i + 1}`;
          });
          query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` RETURNING ${this._returning.join(', ')}`;

        return await dbClient.query(query, [...values, ...this._whereParams]);
      }
    };

    return builder;
  }

  /**
   * Query builder for DELETE statements
   * @param {string} table - Table name
   * @returns {Object} Query builder
   */
  delete(table) {
    const builder = {
      _table: table,
      _where: [],
      _whereParams: [],
      _returning: [],

      where(condition, ...params) {
        this._where.push(condition);
        this._whereParams.push(...params);
        return this;
      },

      returning(...cols) {
        this._returning = cols;
        return this;
      },

      async execute() {
        let query = `DELETE FROM ${this._table}`;

        if (this._where.length > 0) {
          const conditions = this._where.map((_, i) =>
            this._where[i].includes('$') ? this._where[i] : `${this._where[i]} = $${i + 1}`
          );
          query += ` WHERE ${conditions.join(' AND ')}`;
        }

        if (this._returning.length > 0) {
          query += ` RETURNING ${this._returning.join(', ')}`;
        }

        return await dbClient.query(query, this._whereParams);
      }
    };

    return builder;
  }

  /**
   * Close the database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connection pool closed');
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} Pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

// Export singleton instance
export const dbClient = new DatabaseClient();
export default dbClient;
