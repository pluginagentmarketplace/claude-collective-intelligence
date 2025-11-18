/**
 * Base Repository
 * Abstract base class for all repository implementations
 */

import connectionPool from '../db/connection-pool.js';
import { REDIS_KEYS, TTL_CONFIG } from '../db/redis-connection.js';
import winston from 'winston';
import crypto from 'crypto';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'base-repository' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Base Repository Class
 * Provides common database operations for all entities
 */
export default class BaseRepository {
  constructor(tableName, entityName) {
    this.tableName = tableName;
    this.entityName = entityName;
    this.db = connectionPool.postgres;
    this.redis = connectionPool.redis;
    this.cache = true;
    this.defaultTTL = TTL_CONFIG.CACHE_QUERY;
  }

  /**
   * Generate cache key for entity
   */
  getCacheKey(id) {
    return `cache:${this.entityName}:${id}`;
  }

  /**
   * Generate cache key for query
   */
  getQueryCacheKey(method, params) {
    const hash = crypto.createHash('sha256');
    hash.update(`${this.entityName}:${method}`);
    hash.update(JSON.stringify(params));
    return `cache:query:${this.entityName}:${hash.digest('hex')}`;
  }

  /**
   * Find entity by ID
   */
  async findById(id, options = {}) {
    try {
      // Check cache first
      if (this.cache && options.cache !== false) {
        const cached = await this.redis.get(this.getCacheKey(id));
        if (cached) {
          logger.debug(`Cache hit for ${this.entityName}:${id}`);
          return cached;
        }
      }

      // Query database
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
      const result = await this.db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const entity = result.rows[0];

      // Cache result
      if (this.cache && options.cache !== false) {
        await this.redis.set(
          this.getCacheKey(id),
          entity,
          options.ttl || this.defaultTTL
        );
      }

      return entity;

    } catch (error) {
      logger.error(`Error finding ${this.entityName} by ID`, { id, error });
      throw error;
    }
  }

  /**
   * Find all entities with optional filters
   */
  async findAll(filters = {}, options = {}) {
    try {
      const { where, params } = this.buildWhereClause(filters);
      const { orderBy, limit, offset } = this.buildQueryOptions(options);

      let query = `SELECT * FROM ${this.tableName}`;

      if (where) {
        query += ` WHERE ${where}`;
      }

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      if (offset) {
        query += ` OFFSET ${offset}`;
      }

      // Check cache for query result
      const cacheKey = this.getQueryCacheKey('findAll', { filters, options });

      if (this.cache && options.cache !== false) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          logger.debug(`Query cache hit for ${this.entityName}:findAll`);
          return cached;
        }
      }

      // Execute query
      const result = await this.db.query(query, params);

      // Cache result
      if (this.cache && options.cache !== false) {
        await this.redis.set(
          cacheKey,
          result.rows,
          options.ttl || this.defaultTTL
        );
      }

      return result.rows;

    } catch (error) {
      logger.error(`Error finding all ${this.entityName}`, { filters, error });
      throw error;
    }
  }

  /**
   * Find one entity matching filters
   */
  async findOne(filters = {}, options = {}) {
    try {
      const results = await this.findAll(filters, { ...options, limit: 1 });
      return results.length > 0 ? results[0] : null;

    } catch (error) {
      logger.error(`Error finding one ${this.entityName}`, { filters, error });
      throw error;
    }
  }

  /**
   * Count entities matching filters
   */
  async count(filters = {}) {
    try {
      const { where, params } = this.buildWhereClause(filters);

      let query = `SELECT COUNT(*) FROM ${this.tableName}`;

      if (where) {
        query += ` WHERE ${where}`;
      }

      const result = await this.db.query(query, params);
      return parseInt(result.rows[0].count);

    } catch (error) {
      logger.error(`Error counting ${this.entityName}`, { filters, error });
      throw error;
    }
  }

  /**
   * Create new entity
   */
  async create(data, options = {}) {
    try {
      // Add timestamps if not present
      if (!data.created_at) {
        data.created_at = new Date();
      }
      if (!data.updated_at) {
        data.updated_at = new Date();
      }

      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      let result;

      if (options.transaction) {
        result = await options.transaction.query(query, values);
      } else {
        result = await this.db.query(query, values);
      }

      const entity = result.rows[0];

      // Invalidate relevant caches
      await this.invalidateCaches(entity);

      logger.info(`Created ${this.entityName}`, { id: entity.id });

      return entity;

    } catch (error) {
      logger.error(`Error creating ${this.entityName}`, { data, error });
      throw error;
    }
  }

  /**
   * Update entity by ID
   */
  async update(id, data, options = {}) {
    try {
      // Add updated_at timestamp
      data.updated_at = new Date();

      // Remove undefined values
      const cleanData = Object.entries(data)
        .filter(([_, value]) => value !== undefined)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

      const columns = Object.keys(cleanData);
      const values = Object.values(cleanData);

      if (columns.length === 0) {
        throw new Error('No data to update');
      }

      const setClause = columns
        .map((col, idx) => `${col} = $${idx + 1}`)
        .join(', ');

      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}
        WHERE id = $${values.length + 1}
        RETURNING *
      `;

      let result;

      if (options.transaction) {
        result = await options.transaction.query(query, [...values, id]);
      } else {
        result = await this.db.query(query, [...values, id]);
      }

      if (result.rows.length === 0) {
        return null;
      }

      const entity = result.rows[0];

      // Invalidate caches
      await this.invalidateCaches(entity);
      await this.redis.delete(this.getCacheKey(id));

      logger.info(`Updated ${this.entityName}`, { id });

      return entity;

    } catch (error) {
      logger.error(`Error updating ${this.entityName}`, { id, data, error });
      throw error;
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id, options = {}) {
    try {
      const query = `
        DELETE FROM ${this.tableName}
        WHERE id = $1
        RETURNING *
      `;

      let result;

      if (options.transaction) {
        result = await options.transaction.query(query, [id]);
      } else {
        result = await this.db.query(query, [id]);
      }

      if (result.rows.length === 0) {
        return null;
      }

      const entity = result.rows[0];

      // Invalidate caches
      await this.invalidateCaches(entity);
      await this.redis.delete(this.getCacheKey(id));

      logger.info(`Deleted ${this.entityName}`, { id });

      return entity;

    } catch (error) {
      logger.error(`Error deleting ${this.entityName}`, { id, error });
      throw error;
    }
  }

  /**
   * Bulk create entities
   */
  async bulkCreate(records, options = {}) {
    try {
      const results = [];

      await this.db.transaction(async (client) => {
        for (const record of records) {
          const result = await this.create(record, {
            ...options,
            transaction: client
          });
          results.push(result);
        }
      });

      // Invalidate all caches for this entity type
      await this.redis.clearByPattern(`cache:${this.entityName}:*`);
      await this.redis.clearByPattern(`cache:query:${this.entityName}:*`);

      logger.info(`Bulk created ${results.length} ${this.entityName}`);

      return results;

    } catch (error) {
      logger.error(`Error bulk creating ${this.entityName}`, { count: records.length, error });
      throw error;
    }
  }

  /**
   * Bulk update entities
   */
  async bulkUpdate(updates, options = {}) {
    try {
      const results = [];

      await this.db.transaction(async (client) => {
        for (const { id, data } of updates) {
          const result = await this.update(id, data, {
            ...options,
            transaction: client
          });
          results.push(result);
        }
      });

      // Invalidate all caches for this entity type
      await this.redis.clearByPattern(`cache:${this.entityName}:*`);
      await this.redis.clearByPattern(`cache:query:${this.entityName}:*`);

      logger.info(`Bulk updated ${results.length} ${this.entityName}`);

      return results;

    } catch (error) {
      logger.error(`Error bulk updating ${this.entityName}`, { count: updates.length, error });
      throw error;
    }
  }

  /**
   * Bulk delete entities
   */
  async bulkDelete(ids, options = {}) {
    try {
      const results = [];

      await this.db.transaction(async (client) => {
        for (const id of ids) {
          const result = await this.delete(id, {
            ...options,
            transaction: client
          });
          results.push(result);
        }
      });

      // Invalidate all caches for this entity type
      await this.redis.clearByPattern(`cache:${this.entityName}:*`);
      await this.redis.clearByPattern(`cache:query:${this.entityName}:*`);

      logger.info(`Bulk deleted ${results.length} ${this.entityName}`);

      return results;

    } catch (error) {
      logger.error(`Error bulk deleting ${this.entityName}`, { count: ids.length, error });
      throw error;
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id) {
    try {
      const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
      const result = await this.db.query(query, [id]);
      return result.rows.length > 0;

    } catch (error) {
      logger.error(`Error checking existence of ${this.entityName}`, { id, error });
      throw error;
    }
  }

  /**
   * Execute raw query
   */
  async rawQuery(query, params = [], options = {}) {
    try {
      logger.debug(`Executing raw query for ${this.entityName}`, { query: query.substring(0, 100) });

      let result;

      if (options.transaction) {
        result = await options.transaction.query(query, params);
      } else {
        result = await this.db.query(query, params);
      }

      return result.rows;

    } catch (error) {
      logger.error(`Error executing raw query for ${this.entityName}`, { error });
      throw error;
    }
  }

  /**
   * Build WHERE clause from filters
   */
  buildWhereClause(filters) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (value === undefined) {
        continue;
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { $gt: 5, $lt: 10 }
        for (const [op, val] of Object.entries(value)) {
          switch (op) {
            case '$gt':
              conditions.push(`${key} > $${paramIndex++}`);
              params.push(val);
              break;
            case '$gte':
              conditions.push(`${key} >= $${paramIndex++}`);
              params.push(val);
              break;
            case '$lt':
              conditions.push(`${key} < $${paramIndex++}`);
              params.push(val);
              break;
            case '$lte':
              conditions.push(`${key} <= $${paramIndex++}`);
              params.push(val);
              break;
            case '$ne':
              conditions.push(`${key} != $${paramIndex++}`);
              params.push(val);
              break;
            case '$like':
              conditions.push(`${key} LIKE $${paramIndex++}`);
              params.push(val);
              break;
            case '$ilike':
              conditions.push(`${key} ILIKE $${paramIndex++}`);
              params.push(val);
              break;
            case '$in':
              const inPlaceholders = val.map(() => `$${paramIndex++}`).join(', ');
              conditions.push(`${key} IN (${inPlaceholders})`);
              params.push(...val);
              break;
            case '$nin':
              const ninPlaceholders = val.map(() => `$${paramIndex++}`).join(', ');
              conditions.push(`${key} NOT IN (${ninPlaceholders})`);
              params.push(...val);
              break;
          }
        }
      } else {
        conditions.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }

    return {
      where: conditions.join(' AND '),
      params
    };
  }

  /**
   * Build query options
   */
  buildQueryOptions(options) {
    const result = {};

    if (options.orderBy) {
      if (typeof options.orderBy === 'string') {
        result.orderBy = options.orderBy;
      } else if (Array.isArray(options.orderBy)) {
        result.orderBy = options.orderBy.join(', ');
      } else if (typeof options.orderBy === 'object') {
        const orderClauses = Object.entries(options.orderBy)
          .map(([field, direction]) => `${field} ${direction}`)
          .join(', ');
        result.orderBy = orderClauses;
      }
    }

    if (options.limit) {
      result.limit = parseInt(options.limit);
    }

    if (options.offset) {
      result.offset = parseInt(options.offset);
    }

    return result;
  }

  /**
   * Invalidate related caches
   */
  async invalidateCaches(entity) {
    try {
      // Clear query caches for this entity type
      await this.redis.clearByPattern(`cache:query:${this.entityName}:*`);

      // Clear specific entity cache
      if (entity && entity.id) {
        await this.redis.delete(this.getCacheKey(entity.id));
      }

      logger.debug(`Invalidated caches for ${this.entityName}`);

    } catch (error) {
      logger.error(`Error invalidating caches for ${this.entityName}`, error);
    }
  }

  /**
   * Paginate results
   */
  async paginate(filters = {}, page = 1, pageSize = 20, options = {}) {
    try {
      const offset = (page - 1) * pageSize;

      const [items, totalCount] = await Promise.all([
        this.findAll(filters, { ...options, limit: pageSize, offset }),
        this.count(filters)
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      };

    } catch (error) {
      logger.error(`Error paginating ${this.entityName}`, { filters, page, pageSize, error });
      throw error;
    }
  }

  /**
   * Search with full-text search
   */
  async search(searchTerm, fields, filters = {}, options = {}) {
    try {
      const { where: filterWhere, params: filterParams } = this.buildWhereClause(filters);

      const searchConditions = fields
        .map((field, idx) => `${field} ILIKE $${filterParams.length + idx + 1}`)
        .join(' OR ');

      const searchParams = fields.map(() => `%${searchTerm}%`);

      let query = `SELECT * FROM ${this.tableName} WHERE (${searchConditions})`;

      if (filterWhere) {
        query += ` AND (${filterWhere})`;
      }

      const { orderBy, limit, offset } = this.buildQueryOptions(options);

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      if (offset) {
        query += ` OFFSET ${offset}`;
      }

      const result = await this.db.query(query, [...filterParams, ...searchParams]);

      return result.rows;

    } catch (error) {
      logger.error(`Error searching ${this.entityName}`, { searchTerm, fields, error });
      throw error;
    }
  }
}