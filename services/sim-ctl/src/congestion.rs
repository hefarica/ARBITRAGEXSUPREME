//! # Congestion Gate and Backpressure Control
//! 
//! Prevents system overload by limiting concurrent simulations
//! and implementing backpressure when resources are constrained.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, Semaphore, RwLock};
use tracing::{debug, info, warn, error};
use sysinfo::{System, SystemExt, CpuExt};

/// Resource thresholds for congestion control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceThresholds {
    /// Maximum concurrent simulations (e.g., 2 for VPS-30)
    pub max_concurrent_sims: usize,
    /// CPU usage threshold for backpressure (percentage)
    pub cpu_threshold_percent: f32,
    /// Memory usage threshold for backpressure (percentage) 
    pub memory_threshold_percent: f32,
    /// Queue size limit before rejecting new requests
    pub max_queue_size: usize,
    /// Minimum time between resource checks (ms)
    pub resource_check_interval_ms: u64,
    /// Simulation timeout (ms)
    pub simulation_timeout_ms: u64,
}

impl Default for ResourceThresholds {
    fn default() -> Self {
        Self {
            max_concurrent_sims: 2,          // Conservative for VPS-30
            cpu_threshold_percent: 80.0,     // 80% CPU triggers backpressure
            memory_threshold_percent: 85.0,  // 85% RAM triggers backpressure
            max_queue_size: 20,              // Max 20 queued requests
            resource_check_interval_ms: 1000, // Check resources every 1s
            simulation_timeout_ms: 30000,    // 30s timeout per simulation
        }
    }
}

/// Simulation request in the queue
#[derive(Debug, Clone)]
pub struct SimulationRequest {
    pub id: String,
    pub priority: SimulationPriority,
    pub submitted_at: Instant,
    pub timeout_at: Instant,
    pub payload: SimulationPayload,
}

/// Priority levels for simulation requests
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SimulationPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3, // For heartbeat simulations
}

/// Simulation payload data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationPayload {
    pub strategy_type: String,
    pub chain_id: u64,
    pub transaction_data: String,
    pub expected_profit: f64,
    pub gas_limit: u64,
}

/// System resource status
#[derive(Debug, Clone, Serialize)]
pub struct ResourceStatus {
    pub cpu_usage_percent: f32,
    pub memory_usage_percent: f32,
    pub available_memory_mb: u64,
    pub load_average_1m: f32,
    pub is_under_pressure: bool,
    pub pressure_reason: Option<String>,
}

/// Congestion gate metrics
#[derive(Debug, Clone, Serialize)]
pub struct CongestionMetrics {
    pub concurrent_simulations: usize,
    pub queued_requests: usize,
    pub completed_simulations: u64,
    pub rejected_requests: u64,
    pub timed_out_requests: u64,
    pub average_queue_time_ms: f64,
    pub average_execution_time_ms: f64,
    pub resource_status: ResourceStatus,
    pub backpressure_active: bool,
}

/// Main congestion gate controller
pub struct CongestionGate {
    thresholds: ResourceThresholds,
    semaphore: Arc<Semaphore>,
    queue: Arc<Mutex<VecDeque<SimulationRequest>>>,
    metrics: Arc<RwLock<CongestionMetrics>>,
    system: Arc<Mutex<System>>,
    last_resource_check: Arc<RwLock<Instant>>,
    running_simulations: Arc<RwLock<Vec<RunningSimulation>>>,
}

#[derive(Debug, Clone)]
struct RunningSimulation {
    id: String,
    started_at: Instant,
    timeout_at: Instant,
}

impl CongestionGate {
    /// Create new congestion gate with specified thresholds
    pub fn new(thresholds: ResourceThresholds) -> Self {
        let semaphore = Arc::new(Semaphore::new(thresholds.max_concurrent_sims));
        
        Self {
            semaphore,
            queue: Arc::new(Mutex::new(VecDeque::new())),
            metrics: Arc::new(RwLock::new(CongestionMetrics {
                concurrent_simulations: 0,
                queued_requests: 0,
                completed_simulations: 0,
                rejected_requests: 0,
                timed_out_requests: 0,
                average_queue_time_ms: 0.0,
                average_execution_time_ms: 0.0,
                resource_status: ResourceStatus {
                    cpu_usage_percent: 0.0,
                    memory_usage_percent: 0.0,
                    available_memory_mb: 0,
                    load_average_1m: 0.0,
                    is_under_pressure: false,
                    pressure_reason: None,
                },
                backpressure_active: false,
            })),
            system: Arc::new(Mutex::new(System::new_all())),
            last_resource_check: Arc::new(RwLock::new(Instant::now())),
            running_simulations: Arc::new(RwLock::new(Vec::new())),
            thresholds,
        }
    }

    /// Start background resource monitoring and queue processing
    pub async fn start_background_tasks(&self) -> Result<()> {
        self.start_resource_monitor().await?;
        self.start_queue_processor().await?;
        self.start_timeout_monitor().await?;
        Ok(())
    }

    /// Submit simulation request (returns immediately with queue position)
    pub async fn submit_simulation(
        &self,
        request: SimulationRequest,
    ) -> Result<SimulationSubmissionResult> {
        // Check if we should reject immediately due to overload
        if self.should_reject_request().await? {
            let mut metrics = self.metrics.write().await;
            metrics.rejected_requests += 1;
            
            return Ok(SimulationSubmissionResult::Rejected {
                reason: "System under pressure - rejecting new requests".to_string(),
            });
        }

        // Check queue size limits
        let queue_size = {
            let queue = self.queue.lock().await;
            queue.len()
        };

        if queue_size >= self.thresholds.max_queue_size {
            let mut metrics = self.metrics.write().await;
            metrics.rejected_requests += 1;
            
            return Ok(SimulationSubmissionResult::Rejected {
                reason: format!("Queue full ({} requests)", queue_size),
            });
        }

        // Add to queue
        {
            let mut queue = self.queue.lock().await;
            queue.push_back(request.clone());
            
            // Sort queue by priority (highest first)
            let mut queue_vec: Vec<_> = queue.drain(..).collect();
            queue_vec.sort_by(|a, b| b.priority.cmp(&a.priority));
            *queue = queue_vec.into();
        }

        // Update metrics
        {
            let mut metrics = self.metrics.write().await;
            metrics.queued_requests = queue_size + 1;
        }

        info!(
            "Simulation {} queued (priority: {:?}, queue_size: {})",
            request.id, request.priority, queue_size + 1
        );

        Ok(SimulationSubmissionResult::Queued {
            position: queue_size + 1,
            estimated_wait_ms: self.estimate_wait_time().await,
        })
    }

    /// Get current congestion metrics
    pub async fn get_metrics(&self) -> CongestionMetrics {
        self.metrics.read().await.clone()
    }

    /// Check if system is under backpressure
    pub async fn is_under_backpressure(&self) -> bool {
        self.metrics.read().await.backpressure_active
    }

    /// Internal: Start resource monitoring task
    async fn start_resource_monitor(&self) -> Result<()> {
        let system = self.system.clone();
        let metrics = self.metrics.clone();
        let thresholds = self.thresholds.clone();
        let last_check = self.last_resource_check.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(
                Duration::from_millis(thresholds.resource_check_interval_ms)
            );

            loop {
                interval.tick().await;

                // Update system info
                {
                    let mut sys = system.lock().await;
                    sys.refresh_all();
                    
                    let cpu_usage = sys.global_cpu_info().cpu_usage();
                    let memory_total = sys.total_memory();
                    let memory_used = sys.used_memory();
                    let memory_percent = (memory_used as f32 / memory_total as f32) * 100.0;
                    let available_mb = (memory_total - memory_used) / 1024 / 1024;

                    // Determine if under pressure
                    let (is_under_pressure, pressure_reason) = if cpu_usage > thresholds.cpu_threshold_percent {
                        (true, Some(format!("CPU usage: {:.1}%", cpu_usage)))
                    } else if memory_percent > thresholds.memory_threshold_percent {
                        (true, Some(format!("Memory usage: {:.1}%", memory_percent)))
                    } else {
                        (false, None)
                    };

                    // Update metrics
                    let mut metrics_guard = metrics.write().await;
                    metrics_guard.resource_status = ResourceStatus {
                        cpu_usage_percent: cpu_usage,
                        memory_usage_percent: memory_percent,
                        available_memory_mb: available_mb,
                        load_average_1m: 0.0, // TODO: Get actual load average
                        is_under_pressure,
                        pressure_reason,
                    };
                    metrics_guard.backpressure_active = is_under_pressure;

                    if is_under_pressure {
                        warn!("System under pressure: CPU: {:.1}%, Memory: {:.1}%", 
                              cpu_usage, memory_percent);
                    }
                }

                // Update last check timestamp
                *last_check.write().await = Instant::now();
            }
        });

        Ok(())
    }

    /// Internal: Start queue processor task
    async fn start_queue_processor(&self) -> Result<()> {
        let queue = self.queue.clone();
        let semaphore = self.semaphore.clone();
        let metrics = self.metrics.clone();
        let running_sims = self.running_simulations.clone();

        tokio::spawn(async move {
            loop {
                // Try to get next request from queue
                let next_request = {
                    let mut queue_guard = queue.lock().await;
                    queue_guard.pop_front()
                };

                if let Some(request) = next_request {
                    // Check if request has timed out while in queue
                    if Instant::now() > request.timeout_at {
                        warn!("Simulation {} timed out in queue", request.id);
                        let mut metrics_guard = metrics.write().await;
                        metrics_guard.timed_out_requests += 1;
                        metrics_guard.queued_requests = metrics_guard.queued_requests.saturating_sub(1);
                        continue;
                    }

                    // Try to acquire simulation slot
                    if let Ok(permit) = semaphore.try_acquire() {
                        let request_id = request.id.clone();
                        let queue_time = request.submitted_at.elapsed().as_millis() as f64;
                        
                        // Update metrics
                        {
                            let mut metrics_guard = metrics.write().await;
                            metrics_guard.concurrent_simulations += 1;
                            metrics_guard.queued_requests = metrics_guard.queued_requests.saturating_sub(1);
                            metrics_guard.average_queue_time_ms = 
                                (metrics_guard.average_queue_time_ms + queue_time) / 2.0;
                        }

                        // Add to running simulations
                        {
                            let mut running = running_sims.write().await;
                            running.push(RunningSimulation {
                                id: request_id.clone(),
                                started_at: Instant::now(),
                                timeout_at: request.timeout_at,
                            });
                        }

                        // Spawn simulation task
                        let metrics_clone = metrics.clone();
                        let running_clone = running_sims.clone();
                        tokio::spawn(async move {
                            let start_time = Instant::now();
                            
                            // Execute simulation (placeholder)
                            let result = Self::execute_simulation(request).await;
                            
                            let execution_time = start_time.elapsed().as_millis() as f64;
                            
                            // Update metrics
                            {
                                let mut metrics_guard = metrics_clone.write().await;
                                metrics_guard.concurrent_simulations = 
                                    metrics_guard.concurrent_simulations.saturating_sub(1);
                                
                                if result.is_ok() {
                                    metrics_guard.completed_simulations += 1;
                                    metrics_guard.average_execution_time_ms = 
                                        (metrics_guard.average_execution_time_ms + execution_time) / 2.0;
                                }
                            }

                            // Remove from running simulations
                            {
                                let mut running = running_clone.write().await;
                                running.retain(|sim| sim.id != request_id);
                            }
                            
                            // Release permit
                            drop(permit);
                            
                            match result {
                                Ok(_) => debug!("Simulation {} completed in {:.1}ms", request_id, execution_time),
                                Err(e) => error!("Simulation {} failed: {}", request_id, e),
                            }
                        });
                        
                        info!("Started simulation {} (queue_time: {:.1}ms)", request_id, queue_time);
                    } else {
                        // No slots available, put request back at front of queue
                        let mut queue_guard = queue.lock().await;
                        queue_guard.push_front(request);
                    }
                } else {
                    // No requests in queue, wait a bit
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        });

        Ok(())
    }

    /// Internal: Start timeout monitor for running simulations
    async fn start_timeout_monitor(&self) -> Result<()> {
        let running_sims = self.running_simulations.clone();
        let metrics = self.metrics.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                let now = Instant::now();
                let mut timed_out_count = 0;
                
                {
                    let mut running = running_sims.write().await;
                    let before_count = running.len();
                    running.retain(|sim| {
                        if now > sim.timeout_at {
                            warn!("Simulation {} timed out during execution", sim.id);
                            false
                        } else {
                            true
                        }
                    });
                    timed_out_count = before_count - running.len();
                }
                
                if timed_out_count > 0 {
                    let mut metrics_guard = metrics.write().await;
                    metrics_guard.timed_out_requests += timed_out_count as u64;
                    metrics_guard.concurrent_simulations = 
                        metrics_guard.concurrent_simulations.saturating_sub(timed_out_count);
                }
            }
        });

        Ok(())
    }

    /// Internal: Check if we should reject new requests due to overload
    async fn should_reject_request(&self) -> Result<bool> {
        let metrics = self.metrics.read().await;
        Ok(metrics.backpressure_active && 
           metrics.resource_status.cpu_usage_percent > 95.0)
    }

    /// Internal: Estimate wait time for new requests
    async fn estimate_wait_time(&self) -> u64 {
        let metrics = self.metrics.read().await;
        let avg_execution_time = metrics.average_execution_time_ms.max(5000.0); // At least 5s
        let queue_size = metrics.queued_requests as f64;
        let max_concurrent = self.thresholds.max_concurrent_sims as f64;
        
        ((queue_size / max_concurrent) * avg_execution_time) as u64
    }

    /// Internal: Execute actual simulation (placeholder)
    async fn execute_simulation(_request: SimulationRequest) -> Result<SimulationResult> {
        // Simulate work
        tokio::time::sleep(Duration::from_millis(2000)).await;
        
        Ok(SimulationResult {
            success: true,
            profit: 0.1,
            gas_used: 150000,
        })
    }
}

/// Result of simulation submission
#[derive(Debug, Clone)]
pub enum SimulationSubmissionResult {
    Queued {
        position: usize,
        estimated_wait_ms: u64,
    },
    Rejected {
        reason: String,
    },
}

/// Result of simulation execution
#[derive(Debug, Clone)]
pub struct SimulationResult {
    pub success: bool,
    pub profit: f64,
    pub gas_used: u64,
}