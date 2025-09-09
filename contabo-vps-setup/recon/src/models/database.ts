import { Pool, PoolClient } from 'pg';
import pino from 'pino';
import { config } from '@/config';
import { 
  ExecutionEvent, 
  ReconciliationRecord, 
  PortfolioSnapshot, 
  VarianceInvestigation,
  ReconciliationMetrics 
} from '@/types/reconciliation';

// =============================================================================
// DATABASE CONNECTION MANAGER
// =============================================================================

export class DatabaseManager {
  private pool: Pool;
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ service: 'database-manager' });
    
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.username,
      password: config.database.password,
      ssl: config.database.ssl,
      max: config.database.max_connections,
      idleTimeoutMillis: config.database.idle_timeout_ms,
      connectionTimeoutMillis: config.database.connection_timeout_ms,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup pool event handlers
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      this.logger.debug('New database client connected');
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      this.logger.error({ error: err.message }, 'Database pool error');
    });
  }

  /**
   * Initialize database with schema creation
   */
  async initialize(): Promise<void> {
    try {
      await this.createTables();
      await this.createIndexes();
      
      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initialize database');
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Execution Events Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS execution_events (
          event_id UUID PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          strategy_id VARCHAR(100) NOT NULL,
          bundle_id UUID NOT NULL,
          transaction_hash VARCHAR(66),
          block_number BIGINT NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL,
          
          expected_profit_wei NUMERIC(78, 0) NOT NULL,
          actual_profit_wei NUMERIC(78, 0) NOT NULL,
          gas_used BIGINT NOT NULL,
          gas_price_wei NUMERIC(78, 0) NOT NULL,
          total_gas_cost_wei NUMERIC(78, 0) NOT NULL,
          
          eth_price_usd DECIMAL(20, 8) NOT NULL,
          token_prices JSONB,
          
          relay_provider VARCHAR(50),
          slippage_bps INTEGER,
          mev_extracted_wei NUMERIC(78, 0),
          
          chain_id INTEGER NOT NULL DEFAULT 1,
          dex_venues TEXT[],
          token_addresses TEXT[],
          execution_source VARCHAR(50) NOT NULL,
          
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        )
      `);

      // Reconciliation Records Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS reconciliation_records (
          record_id UUID PRIMARY KEY,
          bundle_id UUID NOT NULL,
          strategy_id VARCHAR(100) NOT NULL,
          
          simulation_event_id UUID,
          simulated_profit_wei NUMERIC(78, 0) NOT NULL,
          simulated_gas_cost_wei NUMERIC(78, 0) NOT NULL,
          simulation_timestamp TIMESTAMPTZ,
          
          execution_event_id UUID,
          actual_profit_wei NUMERIC(78, 0) NOT NULL,
          actual_gas_cost_wei NUMERIC(78, 0) NOT NULL,
          execution_timestamp TIMESTAMPTZ,
          
          profit_variance_wei NUMERIC(78, 0) NOT NULL,
          profit_variance_percentage DECIMAL(10, 6) NOT NULL,
          gas_variance_wei NUMERIC(78, 0) NOT NULL,
          gas_variance_percentage DECIMAL(10, 6) NOT NULL,
          
          reconciliation_status VARCHAR(50) NOT NULL,
          variance_category VARCHAR(50),
          requires_investigation BOOLEAN NOT NULL DEFAULT false,
          
          profit_threshold_percentage DECIMAL(10, 6) NOT NULL DEFAULT 5.0,
          gas_threshold_percentage DECIMAL(10, 6) NOT NULL DEFAULT 10.0,
          
          profit_impact_usd DECIMAL(20, 8) NOT NULL,
          gas_impact_usd DECIMAL(20, 8) NOT NULL,
          total_impact_usd DECIMAL(20, 8) NOT NULL,
          
          investigation_notes TEXT,
          root_cause TEXT,
          corrective_actions TEXT[],
          
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        )
      `);

      // Portfolio Snapshots Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
          snapshot_id UUID PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL,
          period_type VARCHAR(20) NOT NULL,
          
          total_executions INTEGER NOT NULL,
          successful_executions INTEGER NOT NULL,
          failed_executions INTEGER NOT NULL,
          
          total_profit_wei NUMERIC(78, 0) NOT NULL,
          total_gas_cost_wei NUMERIC(78, 0) NOT NULL,
          net_profit_wei NUMERIC(78, 0) NOT NULL,
          
          total_profit_usd DECIMAL(20, 8) NOT NULL,
          total_gas_cost_usd DECIMAL(20, 8) NOT NULL,
          net_profit_usd DECIMAL(20, 8) NOT NULL,
          
          avg_profit_variance_percentage DECIMAL(10, 6) NOT NULL,
          avg_gas_variance_percentage DECIMAL(10, 6) NOT NULL,
          max_profit_variance_wei NUMERIC(78, 0) NOT NULL,
          max_gas_variance_wei NUMERIC(78, 0) NOT NULL,
          
          strategy_performance JSONB NOT NULL DEFAULT '{}',
          relay_performance JSONB NOT NULL DEFAULT '{}',
          
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Variance Investigations Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS variance_investigations (
          investigation_id UUID PRIMARY KEY,
          record_id UUID NOT NULL,
          bundle_id UUID NOT NULL,
          
          investigator VARCHAR(100) NOT NULL,
          priority VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          
          variance_type VARCHAR(20) NOT NULL,
          variance_magnitude_usd DECIMAL(20, 8) NOT NULL,
          impact_assessment VARCHAR(20) NOT NULL,
          
          suspected_causes TEXT[],
          confirmed_root_cause TEXT,
          
          findings JSONB NOT NULL DEFAULT '[]',
          recommended_actions JSONB NOT NULL DEFAULT '[]',
          
          resolution_summary TEXT,
          lessons_learned TEXT[],
          prevention_measures TEXT[],
          
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ,
          resolved_at TIMESTAMPTZ
        )
      `);

      // Reconciliation Metrics Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS reconciliation_metrics (
          metrics_id UUID PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL,
          period_minutes INTEGER NOT NULL DEFAULT 5,
          
          total_events INTEGER NOT NULL,
          simulation_events INTEGER NOT NULL,
          execution_events INTEGER NOT NULL,
          reconciliation_records INTEGER NOT NULL,
          
          reconciliation_rate DECIMAL(5, 4) NOT NULL,
          avg_reconciliation_delay_ms BIGINT NOT NULL,
          variance_within_threshold_rate DECIMAL(5, 4) NOT NULL,
          investigation_required_rate DECIMAL(5, 4) NOT NULL,
          
          cumulative_profit_variance_wei NUMERIC(78, 0) NOT NULL,
          cumulative_gas_variance_wei NUMERIC(78, 0) NOT NULL,
          avg_profit_variance_percentage DECIMAL(10, 6) NOT NULL,
          avg_gas_variance_percentage DECIMAL(10, 6) NOT NULL,
          
          system_health_score INTEGER NOT NULL,
          alert_count INTEGER NOT NULL,
          error_count INTEGER NOT NULL,
          processing_latency_ms BIGINT NOT NULL,
          
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query('COMMIT');
      
      this.logger.info('Database tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error: error.message }, 'Failed to create database tables');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create database indexes for performance
   */
  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Execution Events indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_execution_events_bundle_id ON execution_events (bundle_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_execution_events_strategy_id ON execution_events (strategy_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_execution_events_timestamp ON execution_events (timestamp)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_execution_events_block_number ON execution_events (block_number)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_execution_events_event_type ON execution_events (event_type)');
      
      // Reconciliation Records indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_reconciliation_records_bundle_id ON reconciliation_records (bundle_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_reconciliation_records_strategy_id ON reconciliation_records (strategy_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_reconciliation_records_status ON reconciliation_records (reconciliation_status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_reconciliation_records_investigation ON reconciliation_records (requires_investigation)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_reconciliation_records_created_at ON reconciliation_records (created_at)');
      
      // Portfolio Snapshots indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots (timestamp)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_period_type ON portfolio_snapshots (period_type)');
      
      // Variance Investigations indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_variance_investigations_status ON variance_investigations (status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_variance_investigations_priority ON variance_investigations (priority)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_variance_investigations_record_id ON variance_investigations (record_id)');
      
      // Reconciliation Metrics indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_reconciliation_metrics_timestamp ON reconciliation_metrics (timestamp)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_reconciliation_metrics_period ON reconciliation_metrics (period_minutes)');
      
      this.logger.info('Database indexes created successfully');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to create database indexes');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Insert execution event
   */
  async insertExecutionEvent(event: ExecutionEvent): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO execution_events (
          event_id, event_type, strategy_id, bundle_id, transaction_hash,
          block_number, timestamp, expected_profit_wei, actual_profit_wei,
          gas_used, gas_price_wei, total_gas_cost_wei, eth_price_usd,
          token_prices, relay_provider, slippage_bps, mev_extracted_wei,
          chain_id, dex_venues, token_addresses, execution_source, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      `;
      
      const values = [
        event.event_id,
        event.event_type,
        event.strategy_id,
        event.bundle_id,
        event.transaction_hash,
        event.block_number,
        event.timestamp,
        event.expected_profit_wei,
        event.actual_profit_wei,
        event.gas_used,
        event.gas_price_wei,
        event.total_gas_cost_wei,
        event.eth_price_usd,
        event.token_prices ? JSON.stringify(event.token_prices) : null,
        event.relay_provider,
        event.slippage_bps,
        event.mev_extracted_wei,
        event.chain_id,
        event.dex_venues,
        event.token_addresses,
        event.execution_source,
        event.created_at,
      ];
      
      await client.query(query, values);
      
      this.logger.debug({ event_id: event.event_id }, 'Execution event inserted');
    } catch (error) {
      this.logger.error({
        event_id: event.event_id,
        error: error.message,
      }, 'Failed to insert execution event');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Insert reconciliation record
   */
  async insertReconciliationRecord(record: ReconciliationRecord): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO reconciliation_records (
          record_id, bundle_id, strategy_id, simulation_event_id,
          simulated_profit_wei, simulated_gas_cost_wei, simulation_timestamp,
          execution_event_id, actual_profit_wei, actual_gas_cost_wei,
          execution_timestamp, profit_variance_wei, profit_variance_percentage,
          gas_variance_wei, gas_variance_percentage, reconciliation_status,
          variance_category, requires_investigation, profit_threshold_percentage,
          gas_threshold_percentage, profit_impact_usd, gas_impact_usd,
          total_impact_usd, investigation_notes, root_cause,
          corrective_actions, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      `;
      
      const values = [
        record.record_id,
        record.bundle_id,
        record.strategy_id,
        record.simulation_event_id,
        record.simulated_profit_wei,
        record.simulated_gas_cost_wei,
        record.simulation_timestamp,
        record.execution_event_id,
        record.actual_profit_wei,
        record.actual_gas_cost_wei,
        record.execution_timestamp,
        record.profit_variance_wei,
        record.profit_variance_percentage,
        record.gas_variance_wei,
        record.gas_variance_percentage,
        record.reconciliation_status,
        record.variance_category,
        record.requires_investigation,
        record.profit_threshold_percentage,
        record.gas_threshold_percentage,
        record.profit_impact_usd,
        record.gas_impact_usd,
        record.total_impact_usd,
        record.investigation_notes,
        record.root_cause,
        record.corrective_actions,
        record.created_at,
      ];
      
      await client.query(query, values);
      
      this.logger.debug({ record_id: record.record_id }, 'Reconciliation record inserted');
    } catch (error) {
      this.logger.error({
        record_id: record.record_id,
        error: error.message,
      }, 'Failed to insert reconciliation record');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get execution events by bundle ID
   */
  async getExecutionEventsByBundleId(bundleId: string): Promise<ExecutionEvent[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM execution_events 
        WHERE bundle_id = $1 
        ORDER BY timestamp
      `;
      
      const result = await client.query(query, [bundleId]);
      
      return result.rows.map(row => ({
        ...row,
        token_prices: row.token_prices ? JSON.parse(row.token_prices) : undefined,
      }));
    } catch (error) {
      this.logger.error({
        bundle_id: bundleId,
        error: error.message,
      }, 'Failed to get execution events by bundle ID');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get reconciliation records with filtering and pagination
   */
  async getReconciliationRecords(filters: {
    strategy_id?: string;
    bundle_id?: string;
    start_date?: Date;
    end_date?: Date;
    reconciliation_status?: string;
    requires_investigation?: boolean;
    limit?: number;
    offset?: number;
    order_by?: string;
    order_direction?: 'asc' | 'desc';
  }): Promise<{ records: ReconciliationRecord[]; total: number }> {
    const client = await this.pool.connect();
    
    try {
      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (filters.strategy_id) {
        whereConditions.push(`strategy_id = $${paramIndex++}`);
        params.push(filters.strategy_id);
      }

      if (filters.bundle_id) {
        whereConditions.push(`bundle_id = $${paramIndex++}`);
        params.push(filters.bundle_id);
      }

      if (filters.start_date) {
        whereConditions.push(`created_at >= $${paramIndex++}`);
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        whereConditions.push(`created_at <= $${paramIndex++}`);
        params.push(filters.end_date);
      }

      if (filters.reconciliation_status) {
        whereConditions.push(`reconciliation_status = $${paramIndex++}`);
        params.push(filters.reconciliation_status);
      }

      if (filters.requires_investigation !== undefined) {
        whereConditions.push(`requires_investigation = $${paramIndex++}`);
        params.push(filters.requires_investigation);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const orderBy = filters.order_by || 'created_at';
      const orderDirection = filters.order_direction || 'desc';
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM reconciliation_records ${whereClause}`;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get records
      const recordsQuery = `
        SELECT * FROM reconciliation_records 
        ${whereClause} 
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      params.push(limit, offset);

      const recordsResult = await client.query(recordsQuery, params);

      return {
        records: recordsResult.rows,
        total,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get reconciliation records');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      const client = await this.pool.connect();
      
      try {
        await client.query('SELECT 1');
        const latency = Date.now() - startTime;
        
        return { healthy: true, latency };
      } finally {
        client.release();
      }
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      total_connections: this.pool.totalCount,
      idle_connections: this.pool.idleCount,
      waiting_count: this.pool.waitingCount,
    };
  }

  /**
   * Shutdown database connections
   */
  async shutdown(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.info('Database connections closed');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Error closing database connections');
    }
  }
}