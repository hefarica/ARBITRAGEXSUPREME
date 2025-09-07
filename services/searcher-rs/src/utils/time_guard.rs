//! # Time Guard and Clock Drift Monitoring
//! 
//! Critical time synchronization monitoring for MEV operations.
//! Alerts when chrony/NTP drift exceeds thresholds that could
//! affect EIP-712 signatures and transaction timing.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

/// Time synchronization status and drift measurements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSyncStatus {
    pub system_time_utc: u64,
    pub ntp_time_utc: Option<u64>,
    pub drift_ms: Option<i64>,
    pub is_synchronized: bool,
    pub sync_source: Option<String>,
    pub last_sync: Option<u64>,
    pub leap_status: LeapStatus,
    pub stratum: Option<u8>,
    pub precision_ms: Option<f64>,
}

/// NTP leap second status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LeapStatus {
    None,
    InsertSecond,
    DeleteSecond,
    Unknown,
}

/// Time drift alert levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DriftAlertLevel {
    Normal,      // < 10ms
    Warning,     // 10-50ms
    Critical,    // > 50ms
    Emergency,   // > 200ms
}

/// Configuration for time monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeGuardConfig {
    /// Check interval in seconds
    pub check_interval_secs: u64,
    /// Warning threshold in milliseconds
    pub warning_threshold_ms: i64,
    /// Critical threshold in milliseconds
    pub critical_threshold_ms: i64,
    /// Emergency threshold in milliseconds (stop operations)
    pub emergency_threshold_ms: i64,
    /// Maximum allowed stratum level
    pub max_stratum: u8,
    /// Enable automatic chrony restart on critical drift
    pub auto_restart_chrony: bool,
}

impl Default for TimeGuardConfig {
    fn default() -> Self {
        Self {
            check_interval_secs: 30,
            warning_threshold_ms: 10,
            critical_threshold_ms: 50,
            emergency_threshold_ms: 200,
            max_stratum: 4,
            auto_restart_chrony: true,
        }
    }
}

/// Time guard monitoring system
pub struct TimeGuard {
    config: TimeGuardConfig,
    last_status: Option<TimeSyncStatus>,
    drift_history: Vec<i64>,
    consecutive_alerts: u32,
}

impl TimeGuard {
    /// Create new time guard with configuration
    pub fn new(config: TimeGuardConfig) -> Self {
        Self {
            config,
            last_status: None,
            drift_history: Vec::with_capacity(100),
            consecutive_alerts: 0,
        }
    }

    /// Start background time monitoring
    pub async fn start_monitoring(&mut self) -> Result<()> {
        info!(
            "Starting time guard monitoring (interval: {}s, thresholds: {}ms/{}ms/{}ms)",
            self.config.check_interval_secs,
            self.config.warning_threshold_ms,
            self.config.critical_threshold_ms,
            self.config.emergency_threshold_ms
        );

        let config = self.config.clone();
        let mut check_interval = interval(Duration::from_secs(config.check_interval_secs));

        loop {
            check_interval.tick().await;

            match self.check_time_sync().await {
                Ok(status) => {
                    let alert_level = self.evaluate_drift(&status);
                    
                    // Handle alerts based on severity
                    match alert_level {
                        DriftAlertLevel::Normal => {
                            self.consecutive_alerts = 0;
                        }
                        DriftAlertLevel::Warning => {
                            self.consecutive_alerts += 1;
                            if self.consecutive_alerts >= 3 {
                                warn!(
                                    "Time drift warning: {}ms (consecutive: {})",
                                    status.drift_ms.unwrap_or(0),
                                    self.consecutive_alerts
                                );
                            }
                        }
                        DriftAlertLevel::Critical => {
                            self.consecutive_alerts += 1;
                            error!(
                                "CRITICAL time drift: {}ms - may affect EIP-712 signatures!",
                                status.drift_ms.unwrap_or(0)
                            );
                            
                            // Attempt automatic recovery
                            if config.auto_restart_chrony && self.consecutive_alerts >= 2 {
                                warn!("Attempting automatic chrony restart...");
                                if let Err(e) = self.restart_time_sync().await {
                                    error!("Failed to restart chrony: {}", e);
                                }
                            }
                        }
                        DriftAlertLevel::Emergency => {
                            error!(
                                "EMERGENCY time drift: {}ms - STOPPING MEV OPERATIONS!",
                                status.drift_ms.unwrap_or(0)
                            );
                            // TODO: Trigger emergency stop of all MEV operations
                            // This should integrate with a circuit breaker system
                        }
                    }

                    // Update drift history
                    if let Some(drift) = status.drift_ms {
                        self.drift_history.push(drift);
                        if self.drift_history.len() > 100 {
                            self.drift_history.remove(0);
                        }
                    }

                    self.last_status = Some(status);
                    debug!("Time sync check completed: drift={}ms", 
                           self.last_status.as_ref().unwrap().drift_ms.unwrap_or(0));
                }
                Err(e) => {
                    error!("Time sync check failed: {}", e);
                    self.consecutive_alerts += 1;
                }
            }
        }
    }

    /// Get current time synchronization status
    pub async fn get_status(&self) -> Result<TimeSyncStatus> {
        self.check_time_sync().await
    }

    /// Check if time is synchronized and within acceptable drift
    pub fn is_time_safe(&self) -> bool {
        if let Some(ref status) = self.last_status {
            status.is_synchronized && 
            status.drift_ms.map_or(false, |d| d.abs() < self.config.critical_threshold_ms)
        } else {
            false
        }
    }

    /// Get time drift statistics
    pub fn get_drift_stats(&self) -> DriftStatistics {
        if self.drift_history.is_empty() {
            return DriftStatistics::default();
        }

        let mut sorted = self.drift_history.clone();
        sorted.sort();
        
        let sum: i64 = self.drift_history.iter().sum();
        let mean = sum as f64 / self.drift_history.len() as f64;
        
        let variance: f64 = self.drift_history.iter()
            .map(|&d| (d as f64 - mean).powi(2))
            .sum::<f64>() / self.drift_history.len() as f64;
        let std_dev = variance.sqrt();

        DriftStatistics {
            samples: self.drift_history.len(),
            mean_ms: mean,
            std_dev_ms: std_dev,
            min_ms: *sorted.first().unwrap_or(&0),
            max_ms: *sorted.last().unwrap_or(&0),
            median_ms: sorted[sorted.len() / 2],
            recent_drift_ms: self.drift_history.last().copied(),
        }
    }

    /// Internal: Check time synchronization status
    async fn check_time_sync(&self) -> Result<TimeSyncStatus> {
        let system_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_millis() as u64;

        // Try to get NTP status from chrony
        let chrony_status = self.get_chrony_status().await?;
        
        // Calculate drift if we have NTP time
        let drift_ms = if let Some(ntp_time) = chrony_status.ntp_time_utc {
            Some((system_time as i64) - (ntp_time as i64))
        } else {
            None
        };

        Ok(TimeSyncStatus {
            system_time_utc: system_time,
            ntp_time_utc: chrony_status.ntp_time_utc,
            drift_ms,
            is_synchronized: chrony_status.is_synchronized,
            sync_source: chrony_status.sync_source,
            last_sync: chrony_status.last_sync,
            leap_status: chrony_status.leap_status,
            stratum: chrony_status.stratum,
            precision_ms: chrony_status.precision_ms,
        })
    }

    /// Internal: Get status from chrony
    async fn get_chrony_status(&self) -> Result<ChronyStatus> {
        // Try chronyc tracking command
        let output = Command::new("chronyc")
            .arg("tracking")
            .output();

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                self.parse_chrony_tracking(&stdout)
            }
            _ => {
                // Fallback to ntpq if available
                let ntpq_output = Command::new("ntpq")
                    .args(&["-p", "-n"])
                    .output();

                match ntpq_output {
                    Ok(output) if output.status.success() => {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        self.parse_ntpq_output(&stdout)
                    }
                    _ => {
                        // No time sync service available - use system time only
                        warn!("No time synchronization service available (chrony/ntp)");
                        Ok(ChronyStatus {
                            ntp_time_utc: None,
                            is_synchronized: false,
                            sync_source: None,
                            last_sync: None,
                            leap_status: LeapStatus::Unknown,
                            stratum: None,
                            precision_ms: None,
                        })
                    }
                }
            }
        }
    }

    /// Internal: Parse chronyc tracking output
    fn parse_chrony_tracking(&self, output: &str) -> Result<ChronyStatus> {
        let mut status = ChronyStatus {
            ntp_time_utc: None,
            is_synchronized: false,
            sync_source: None,
            last_sync: None,
            leap_status: LeapStatus::None,
            stratum: None,
            precision_ms: None,
        };

        for line in output.lines() {
            let line = line.trim();
            
            if line.starts_with("Reference ID") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    status.sync_source = Some(parts[3].to_string());
                    status.is_synchronized = !parts[3].contains("0.0.0.0");
                }
            } else if line.starts_with("Stratum") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    if let Ok(stratum) = parts[2].parse::<u8>() {
                        status.stratum = Some(stratum);
                    }
                }
            } else if line.starts_with("System time") {
                // Parse system time offset
                let parts: Vec<&str> = line.split_whitespace().collect();
                for (i, part) in parts.iter().enumerate() {
                    if part.ends_with("seconds") && i > 0 {
                        if let Ok(offset_sec) = parts[i-1].parse::<f64>() {
                            // Convert to milliseconds and use as reference for NTP time
                            let system_time_ms = SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64;
                            
                            status.ntp_time_utc = Some(
                                (system_time_ms as f64 - offset_sec * 1000.0) as u64
                            );
                            break;
                        }
                    }
                }
            } else if line.contains("leap") {
                if line.contains("Normal") {
                    status.leap_status = LeapStatus::None;
                } else if line.contains("Insert") {
                    status.leap_status = LeapStatus::InsertSecond;
                } else if line.contains("Delete") {
                    status.leap_status = LeapStatus::DeleteSecond;
                }
            }
        }

        Ok(status)
    }

    /// Internal: Parse ntpq output (fallback)
    fn parse_ntpq_output(&self, output: &str) -> Result<ChronyStatus> {
        // Basic ntpq parsing - look for synchronized peers
        let mut is_synchronized = false;
        let mut sync_source = None;

        for line in output.lines() {
            if line.starts_with('*') {
                // This is the current sync source
                is_synchronized = true;
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() > 0 {
                    sync_source = Some(parts[0][1..].to_string()); // Remove '*' prefix
                }
                break;
            }
        }

        Ok(ChronyStatus {
            ntp_time_utc: None, // ntpq doesn't give us precise time offset
            is_synchronized,
            sync_source,
            last_sync: None,
            leap_status: LeapStatus::Unknown,
            stratum: None,
            precision_ms: None,
        })
    }

    /// Internal: Evaluate drift alert level
    fn evaluate_drift(&self, status: &TimeSyncStatus) -> DriftAlertLevel {
        if let Some(drift) = status.drift_ms {
            let abs_drift = drift.abs();
            
            if abs_drift >= self.config.emergency_threshold_ms {
                DriftAlertLevel::Emergency
            } else if abs_drift >= self.config.critical_threshold_ms {
                DriftAlertLevel::Critical
            } else if abs_drift >= self.config.warning_threshold_ms {
                DriftAlertLevel::Warning
            } else {
                DriftAlertLevel::Normal
            }
        } else {
            DriftAlertLevel::Warning // No drift data is concerning
        }
    }

    /// Internal: Attempt to restart time synchronization service
    async fn restart_time_sync(&self) -> Result<()> {
        info!("Attempting to restart chrony service...");
        
        let output = Command::new("sudo")
            .args(&["systemctl", "restart", "chrony"])
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to restart chrony: {}", stderr);
        }

        // Wait a moment for service to restart
        tokio::time::sleep(Duration::from_secs(3)).await;

        // Force time sync
        let sync_output = Command::new("sudo")
            .args(&["chronyc", "makestep"])
            .output()?;

        if !sync_output.status.success() {
            let stderr = String::from_utf8_lossy(&sync_output.stderr);
            warn!("chronyc makestep failed: {}", stderr);
        }

        info!("Chrony restart completed");
        Ok(())
    }
}

/// Internal chrony status structure
#[derive(Debug, Clone)]
struct ChronyStatus {
    ntp_time_utc: Option<u64>,
    is_synchronized: bool,
    sync_source: Option<String>,
    last_sync: Option<u64>,
    leap_status: LeapStatus,
    stratum: Option<u8>,
    precision_ms: Option<f64>,
}

/// Drift statistics for monitoring
#[derive(Debug, Clone, Serialize, Default)]
pub struct DriftStatistics {
    pub samples: usize,
    pub mean_ms: f64,
    pub std_dev_ms: f64,
    pub min_ms: i64,
    pub max_ms: i64,
    pub median_ms: i64,
    pub recent_drift_ms: Option<i64>,
}

/// Time guard health check result
#[derive(Debug, Clone, Serialize)]
pub struct TimeGuardHealth {
    pub is_healthy: bool,
    pub current_drift_ms: Option<i64>,
    pub alert_level: String,
    pub consecutive_alerts: u32,
    pub is_synchronized: bool,
    pub sync_source: Option<String>,
    pub drift_stats: DriftStatistics,
}