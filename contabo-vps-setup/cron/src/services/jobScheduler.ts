/**
 * ArbitrageX Supreme V3.0 - Job Scheduler Service
 * Real-Only Policy - Production-grade cron job scheduling and execution
 * 
 * Features:
 * - Priority-based job execution
 * - Dependency management
 * - Retry logic with exponential backoff
 * - Resource monitoring and throttling
 * - Comprehensive error handling and alerting
 */

import cron from 'node-cron';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import {
  CronJobConfig,
  JobExecutionResult,
  JobExecutionContext,
  JobHandler,
  JobScheduler,
  JobStatus,
  JobPriority,
  CronJobError
} from '../types/cron';

interface ScheduledJob {
  config: CronJobConfig;
  handler: JobHandler;
  cronTask: cron.ScheduledTask;
  lastExecution?: JobExecutionResult;
  isRunning: boolean;
  runCount: number;
}

export class ArbitrageXJobScheduler implements JobScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private executionQueue: Array<{
    jobName: string;
    priority: JobPriority;
    scheduledTime: Date;
  }> = [];
  
  private readonly maxConcurrentJobs: number = 5;
  private runningJobs: Set<string> = new Set();
  private database: Pool;
  private redis: RedisClientType;
  private logger: Logger;
  private metricsCollector: any;

  constructor(
    database: Pool,
    redis: RedisClientType,
    logger: Logger,
    metricsCollector: any,
    maxConcurrentJobs: number = 5
  ) {
    this.database = database;
    this.redis = redis;
    this.logger = logger;
    this.metricsCollector = metricsCollector;
    this.maxConcurrentJobs = maxConcurrentJobs;
    
    // Initialize job execution tracking table
    this.initializeJobTracking();
    
    // Start execution queue processor
    setInterval(() => this.processExecutionQueue(), 1000);
    
    // Start health monitoring
    setInterval(() => this.monitorJobHealth(), 30000);
  }

  /**
   * Schedule a new cron job
   */
  scheduleJob(config: CronJobConfig, handler: JobHandler): void {
    try {
      this.logger.info('Scheduling cron job', {
        job_name: config.job_name,
        schedule: config.schedule,
        priority: config.priority,
        enabled: config.enabled
      });

      // Validate cron expression
      if (!cron.validate(config.schedule)) {
        throw new Error(`Invalid cron schedule: ${config.schedule}`);
      }

      // Check for existing job
      if (this.jobs.has(config.job_name)) {
        this.logger.warn('Job already exists, updating configuration', {
          job_name: config.job_name
        });
        this.unscheduleJob(config.job_name);
      }

      // Create cron task
      const cronTask = cron.schedule(config.schedule, () => {
        this.enqueueJob(config.job_name, config.priority);
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      // Store job configuration
      const scheduledJob: ScheduledJob = {
        config,
        handler,
        cronTask,
        isRunning: false,
        runCount: 0
      };

      this.jobs.set(config.job_name, scheduledJob);

      // Start job if enabled
      if (config.enabled) {
        cronTask.start();
        this.logger.info('Cron job started successfully', {
          job_name: config.job_name
        });
      } else {
        this.logger.info('Cron job scheduled but disabled', {
          job_name: config.job_name
        });
      }

      // Update metrics
      this.metricsCollector.incrementCounter('cron_jobs_scheduled_total', {
        job_name: config.job_name,
        priority: config.priority.toString()
      });

    } catch (error) {
      this.logger.error('Failed to schedule cron job', {
        job_name: config.job_name,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Unschedule a cron job
   */
  unscheduleJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (!job) {
      this.logger.warn('Attempted to unschedule non-existent job', {
        job_name: jobName
      });
      return;
    }

    try {
      // Stop cron task
      job.cronTask.stop();
      job.cronTask.destroy();

      // Remove from maps
      this.jobs.delete(jobName);
      this.runningJobs.delete(jobName);

      // Remove from execution queue
      this.executionQueue = this.executionQueue.filter(
        item => item.jobName !== jobName
      );

      this.logger.info('Cron job unscheduled successfully', {
        job_name: jobName
      });

      // Update metrics
      this.metricsCollector.incrementCounter('cron_jobs_unscheduled_total', {
        job_name: jobName
      });

    } catch (error) {
      this.logger.error('Failed to unschedule cron job', {
        job_name: jobName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get job execution status
   */
  getJobStatus(jobName: string): JobExecutionResult | null {
    const job = this.jobs.get(jobName);
    return job?.lastExecution || null;
  }

  /**
   * Get all scheduled jobs
   */
  getAllJobs(): Map<string, CronJobConfig> {
    const jobConfigs = new Map<string, CronJobConfig>();
    
    for (const [jobName, job] of this.jobs) {
      jobConfigs.set(jobName, job.config);
    }
    
    return jobConfigs;
  }

  /**
   * Execute a job immediately (bypass schedule)
   */
  async executeJobNow(jobName: string): Promise<JobExecutionResult> {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job not found: ${jobName}`);
    }

    this.logger.info('Executing job immediately', {
      job_name: jobName,
      requested_by: 'manual_trigger'
    });

    return await this.executeJob(jobName, true);
  }

  /**
   * Enqueue job for execution with priority
   */
  private enqueueJob(jobName: string, priority: JobPriority): void {
    const job = this.jobs.get(jobName);
    if (!job || !job.config.enabled) {
      return;
    }

    // Check if job is already running
    if (job.isRunning) {
      this.logger.warn('Job already running, skipping execution', {
        job_name: jobName
      });
      
      this.metricsCollector.incrementCounter('cron_jobs_skipped_total', {
        job_name: jobName,
        reason: 'already_running'
      });
      return;
    }

    // Add to execution queue
    this.executionQueue.push({
      jobName,
      priority,
      scheduledTime: new Date()
    });

    // Sort queue by priority (lower number = higher priority)
    this.executionQueue.sort((a, b) => a.priority - b.priority);

    this.logger.debug('Job enqueued for execution', {
      job_name: jobName,
      priority,
      queue_length: this.executionQueue.length
    });
  }

  /**
   * Process execution queue respecting concurrency limits
   */
  private async processExecutionQueue(): Promise<void> {
    // Check if we can run more jobs
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    // Get next job from queue
    const nextJob = this.executionQueue.shift();
    if (!nextJob) {
      return;
    }

    const { jobName } = nextJob;

    // Check dependencies
    const job = this.jobs.get(jobName);
    if (!job) {
      return;
    }

    const dependenciesMet = await this.checkDependencies(job.config.dependencies);
    if (!dependenciesMet) {
      this.logger.info('Job dependencies not met, re-queueing', {
        job_name: jobName,
        dependencies: job.config.dependencies
      });
      
      // Re-queue with delay
      setTimeout(() => {
        this.enqueueJob(jobName, job.config.priority);
      }, 30000); // 30 seconds delay
      
      return;
    }

    // Execute job
    try {
      await this.executeJob(jobName, false);
    } catch (error) {
      this.logger.error('Job execution failed in queue processor', {
        job_name: jobName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Execute a specific job
   */
  private async executeJob(jobName: string, isManualTrigger: boolean): Promise<JobExecutionResult> {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job not found: ${jobName}`);
    }

    const executionId = uuidv4();
    const startTime = new Date();

    // Mark job as running
    job.isRunning = true;
    job.runCount++;
    this.runningJobs.add(jobName);

    this.logger.info('Starting job execution', {
      job_name: jobName,
      execution_id: executionId,
      is_manual_trigger: isManualTrigger,
      run_count: job.runCount
    });

    // Create execution context
    const context: JobExecutionContext = {
      jobName,
      executionId,
      config: job.config,
      logger: this.logger,
      database: this.database,
      redis: this.redis,
      metrics: this.metricsCollector,
      startTime
    };

    let result: JobExecutionResult;

    try {
      // Set execution timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new CronJobError(
            `Job execution timeout after ${job.config.timeout_minutes} minutes`,
            jobName,
            executionId,
            true
          ));
        }, job.config.timeout_minutes * 60 * 1000);
      });

      // Execute job with timeout
      const executionPromise = job.handler(context);
      result = await Promise.race([executionPromise, timeoutPromise]);

      // Update job state
      job.lastExecution = result;
      job.isRunning = false;
      this.runningJobs.delete(jobName);

      // Store execution result
      await this.storeExecutionResult(result);

      this.logger.info('Job execution completed successfully', {
        job_name: jobName,
        execution_id: executionId,
        duration_ms: result.duration_ms,
        records_processed: result.records_processed
      });

      // Update metrics
      this.metricsCollector.incrementCounter('cron_jobs_completed_total', {
        job_name: jobName,
        status: result.status
      });

      this.metricsCollector.observeHistogram('cron_job_duration_seconds', 
        (result.duration_ms || 0) / 1000, {
        job_name: jobName
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const endTime = new Date();

      // Create failure result
      result = {
        job_name: jobName,
        execution_id: executionId,
        status: JobStatus.FAILED,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        duration_ms: endTime.getTime() - startTime.getTime(),
        records_processed: 0,
        records_updated: 0,
        records_failed: 0,
        error_message: errorMessage,
        error_stack: error instanceof Error ? error.stack : undefined,
        metadata: { is_manual_trigger: isManualTrigger }
      };

      // Update job state
      job.lastExecution = result;
      job.isRunning = false;
      this.runningJobs.delete(jobName);

      // Store failure result
      await this.storeExecutionResult(result);

      this.logger.error('Job execution failed', {
        job_name: jobName,
        execution_id: executionId,
        error: errorMessage,
        duration_ms: result.duration_ms
      });

      // Handle retries
      if (error instanceof CronJobError && error.retryable && 
          job.config.retry_attempts > 0) {
        await this.scheduleRetry(jobName, job.config.retry_attempts, job.config.retry_delay_seconds);
      }

      // Update metrics
      this.metricsCollector.incrementCounter('cron_jobs_failed_total', {
        job_name: jobName,
        error_type: error.constructor.name
      });

      // Send alerts if configured
      if (job.config.alerting.on_failure) {
        await this.sendFailureAlert(jobName, result);
      }
    }

    return result;
  }

  /**
   * Check if job dependencies are met
   */
  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    if (dependencies.length === 0) {
      return true;
    }

    for (const depJobName of dependencies) {
      const depJob = this.jobs.get(depJobName);
      if (!depJob || !depJob.lastExecution) {
        return false;
      }

      // Check if dependency completed successfully within last hour
      const lastExecution = depJob.lastExecution;
      const lastCompletedAt = new Date(lastExecution.completed_at || 0);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (lastExecution.status !== JobStatus.COMPLETED || 
          lastCompletedAt < oneHourAgo) {
        return false;
      }
    }

    return true;
  }

  /**
   * Schedule job retry with exponential backoff
   */
  private async scheduleRetry(jobName: string, attemptsRemaining: number, baseDelaySeconds: number): Promise<void> {
    const retryDelay = baseDelaySeconds * Math.pow(2, 3 - attemptsRemaining); // Exponential backoff
    
    this.logger.info('Scheduling job retry', {
      job_name: jobName,
      attempts_remaining: attemptsRemaining,
      retry_delay_seconds: retryDelay
    });

    setTimeout(async () => {
      const job = this.jobs.get(jobName);
      if (job) {
        // Temporarily reduce retry attempts for this execution
        const originalRetries = job.config.retry_attempts;
        job.config.retry_attempts = attemptsRemaining - 1;
        
        try {
          await this.executeJob(jobName, false);
        } finally {
          // Restore original retry count
          job.config.retry_attempts = originalRetries;
        }
      }
    }, retryDelay * 1000);
  }

  /**
   * Monitor job health and send alerts
   */
  private async monitorJobHealth(): Promise<void> {
    for (const [jobName, job] of this.jobs) {
      if (!job.config.enabled) continue;

      // Check for long-running jobs
      if (job.isRunning && job.config.alerting.on_long_duration) {
        const runningTime = Date.now() - (job.lastExecution?.started_at ? 
          new Date(job.lastExecution.started_at).getTime() : Date.now());
        
        const thresholdMs = job.config.alerting.duration_threshold_minutes * 60 * 1000;
        
        if (runningTime > thresholdMs) {
          await this.sendLongDurationAlert(jobName, runningTime / 1000);
        }
      }
    }
  }

  /**
   * Initialize job execution tracking in database
   */
  private async initializeJobTracking(): Promise<void> {
    try {
      await this.database.query(`
        CREATE TABLE IF NOT EXISTS cron_job_executions (
          id SERIAL PRIMARY KEY,
          job_name VARCHAR(255) NOT NULL,
          execution_id UUID NOT NULL UNIQUE,
          status VARCHAR(50) NOT NULL,
          started_at TIMESTAMP WITH TIME ZONE NOT NULL,
          completed_at TIMESTAMP WITH TIME ZONE,
          duration_ms INTEGER,
          records_processed INTEGER DEFAULT 0,
          records_updated INTEGER DEFAULT 0,
          records_failed INTEGER DEFAULT 0,
          error_message TEXT,
          error_stack TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_cron_executions_job_name ON cron_job_executions(job_name);
        CREATE INDEX IF NOT EXISTS idx_cron_executions_started_at ON cron_job_executions(started_at);
        CREATE INDEX IF NOT EXISTS idx_cron_executions_status ON cron_job_executions(status);
      `);
    } catch (error) {
      this.logger.error('Failed to initialize job tracking tables', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Store job execution result in database
   */
  private async storeExecutionResult(result: JobExecutionResult): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO cron_job_executions (
          job_name, execution_id, status, started_at, completed_at,
          duration_ms, records_processed, records_updated, records_failed,
          error_message, error_stack, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        result.job_name,
        result.execution_id,
        result.status,
        result.started_at,
        result.completed_at,
        result.duration_ms,
        result.records_processed,
        result.records_updated,
        result.records_failed,
        result.error_message,
        result.error_stack,
        JSON.stringify(result.metadata)
      ]);
    } catch (error) {
      this.logger.error('Failed to store execution result', {
        job_name: result.job_name,
        execution_id: result.execution_id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send failure alert
   */
  private async sendFailureAlert(jobName: string, result: JobExecutionResult): Promise<void> {
    // Implementation depends on alerting system (Slack, email, etc.)
    this.logger.error('JOB FAILURE ALERT', {
      job_name: jobName,
      execution_id: result.execution_id,
      error_message: result.error_message,
      duration_ms: result.duration_ms
    });
  }

  /**
   * Send long duration alert
   */
  private async sendLongDurationAlert(jobName: string, durationSeconds: number): Promise<void> {
    this.logger.warn('JOB LONG DURATION ALERT', {
      job_name: jobName,
      duration_seconds: durationSeconds,
      message: 'Job is running longer than expected'
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down job scheduler...');

    // Stop all cron tasks
    for (const [jobName, job] of this.jobs) {
      try {
        job.cronTask.stop();
        job.cronTask.destroy();
      } catch (error) {
        this.logger.error('Error stopping cron task', {
          job_name: jobName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Wait for running jobs to complete (with timeout)
    const shutdownTimeout = 60000; // 1 minute
    const startShutdown = Date.now();

    while (this.runningJobs.size > 0 && (Date.now() - startShutdown) < shutdownTimeout) {
      this.logger.info('Waiting for running jobs to complete', {
        running_jobs: Array.from(this.runningJobs),
        remaining_time_ms: shutdownTimeout - (Date.now() - startShutdown)
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.runningJobs.size > 0) {
      this.logger.warn('Shutdown timeout reached, some jobs may still be running', {
        running_jobs: Array.from(this.runningJobs)
      });
    }

    this.logger.info('Job scheduler shutdown completed');
  }
}