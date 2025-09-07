//! # Disk Space Guardian and Log Rotation
//! 
//! Prevents system failure by monitoring disk usage and managing
//! log rotation to avoid out-of-memory conditions.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

/// Disk usage thresholds for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskThresholds {
    /// Warning threshold (percentage)
    pub warning_percent: f64,
    /// Critical threshold (percentage) 
    pub critical_percent: f64,
    /// Emergency threshold (percentage) - start aggressive cleanup
    pub emergency_percent: f64,
    /// Minimum free space required (MB)
    pub min_free_space_mb: u64,
}

impl Default for DiskThresholds {
    fn default() -> Self {
        Self {
            warning_percent: 75.0,
            critical_percent: 85.0,
            emergency_percent: 95.0,
            min_free_space_mb: 1024, // 1GB minimum
        }
    }
}

/// Log rotation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogRotationConfig {
    /// Maximum log file size before rotation (MB)
    pub max_size_mb: u64,
    /// Maximum number of rotated files to keep
    pub max_files: u32,
    /// Compress rotated logs
    pub compress: bool,
    /// Age threshold for log deletion (days)
    pub max_age_days: u32,
}

impl Default for LogRotationConfig {
    fn default() -> Self {
        Self {
            max_size_mb: 100,  // 100MB per file
            max_files: 10,     // Keep 10 rotated files
            compress: true,    // Compress old logs
            max_age_days: 30,  // Delete logs older than 30 days
        }
    }
}

/// Disk usage information for a mount point
#[derive(Debug, Clone, Serialize)]
pub struct DiskUsage {
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub used_percent: f64,
    pub filesystem: String,
    pub is_healthy: bool,
    pub alert_level: DiskAlertLevel,
}

/// Alert levels for disk usage
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum DiskAlertLevel {
    Normal,
    Warning,
    Critical,
    Emergency,
}

/// Monitored directory configuration
#[derive(Debug, Clone)]
pub struct MonitoredDirectory {
    pub path: PathBuf,
    pub description: String,
    pub log_rotation: Option<LogRotationConfig>,
    pub cleanup_enabled: bool,
    pub max_size_mb: Option<u64>,
}

/// Disk guardian system
pub struct DiskGuard {
    thresholds: DiskThresholds,
    monitored_dirs: Vec<MonitoredDirectory>,
    check_interval: Duration,
    last_cleanup: HashMap<String, SystemTime>,
}

impl DiskGuard {
    /// Create new disk guardian
    pub fn new(thresholds: DiskThresholds, check_interval: Duration) -> Self {
        Self {
            thresholds,
            monitored_dirs: Vec::new(),
            check_interval,
            last_cleanup: HashMap::new(),
        }
    }

    /// Add directory to monitor
    pub fn add_monitored_directory(&mut self, dir: MonitoredDirectory) {
        info!("Adding monitored directory: {} ({})", 
              dir.path.display(), dir.description);
        self.monitored_dirs.push(dir);
    }

    /// Set up default monitoring for ArbitrageX directories
    pub fn setup_default_monitoring(&mut self) {
        // Main log directory
        self.add_monitored_directory(MonitoredDirectory {
            path: PathBuf::from("/var/log/arbitragex"),
            description: "ArbitrageX application logs".to_string(),
            log_rotation: Some(LogRotationConfig::default()),
            cleanup_enabled: true,
            max_size_mb: Some(1000), // 1GB max for app logs
        });

        // Docker logs
        self.add_monitored_directory(MonitoredDirectory {
            path: PathBuf::from("/var/lib/docker/containers"),
            description: "Docker container logs".to_string(),
            log_rotation: Some(LogRotationConfig {
                max_size_mb: 50,
                max_files: 5,
                compress: true,
                max_age_days: 7, // Docker logs are less critical
            }),
            cleanup_enabled: true,
            max_size_mb: Some(2000), // 2GB max for Docker logs
        });

        // System logs
        self.add_monitored_directory(MonitoredDirectory {
            path: PathBuf::from("/var/log"),
            description: "System logs".to_string(),
            log_rotation: Some(LogRotationConfig {
                max_size_mb: 200,
                max_files: 15,
                compress: true,
                max_age_days: 90,
            }),
            cleanup_enabled: false, // Don't auto-cleanup system logs
            max_size_mb: None,
        });

        // Temporary files
        self.add_monitored_directory(MonitoredDirectory {
            path: PathBuf::from("/tmp"),
            description: "Temporary files".to_string(),
            log_rotation: None,
            cleanup_enabled: true,
            max_size_mb: Some(500), // 500MB max for temp files
        });

        // Database data (monitoring only)
        self.add_monitored_directory(MonitoredDirectory {
            path: PathBuf::from("/opt/arbitragex/data"),
            description: "Database and persistent data".to_string(),
            log_rotation: None,
            cleanup_enabled: false, // Never auto-cleanup database
            max_size_mb: None,
        });
    }

    /// Start background monitoring
    pub async fn start_monitoring(&self) -> Result<()> {
        info!(
            "Starting disk space monitoring (interval: {:?}, thresholds: {}%/{}%/{}%)",
            self.check_interval,
            self.thresholds.warning_percent,
            self.thresholds.critical_percent,
            self.thresholds.emergency_percent
        );

        let thresholds = self.thresholds.clone();
        let monitored_dirs = self.monitored_dirs.clone();
        let check_interval = self.check_interval;

        tokio::spawn(async move {
            let mut interval_timer = interval(check_interval);

            loop {
                interval_timer.tick().await;

                // Check disk usage for all mount points
                match Self::get_disk_usage().await {
                    Ok(disk_info) => {
                        for (mount_point, usage) in &disk_info {
                            let alert_level = Self::evaluate_disk_usage(usage, &thresholds);
                            
                            match alert_level {
                                DiskAlertLevel::Normal => {
                                    debug!("Disk {} usage: {:.1}% ({})", 
                                           mount_point, usage.used_percent, 
                                           Self::format_bytes(usage.available_bytes));
                                }
                                DiskAlertLevel::Warning => {
                                    warn!("Disk {} usage warning: {:.1}% ({} available)", 
                                          mount_point, usage.used_percent,
                                          Self::format_bytes(usage.available_bytes));
                                }
                                DiskAlertLevel::Critical => {
                                    error!("CRITICAL disk {} usage: {:.1}% ({} available)", 
                                           mount_point, usage.used_percent,
                                           Self::format_bytes(usage.available_bytes));
                                }
                                DiskAlertLevel::Emergency => {
                                    error!("EMERGENCY disk {} usage: {:.1}% - starting cleanup!", 
                                           mount_point, usage.used_percent);
                                    
                                    // Trigger emergency cleanup
                                    for dir in &monitored_dirs {
                                        if dir.cleanup_enabled {
                                            if let Err(e) = Self::emergency_cleanup(&dir.path).await {
                                                error!("Emergency cleanup failed for {}: {}", 
                                                       dir.path.display(), e);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Perform regular log rotation and cleanup
                        for dir in &monitored_dirs {
                            if let Some(ref rotation_config) = dir.log_rotation {
                                if let Err(e) = Self::rotate_logs(&dir.path, rotation_config).await {
                                    warn!("Log rotation failed for {}: {}", dir.path.display(), e);
                                }
                            }
                            
                            // Check directory size limits
                            if let Some(max_size) = dir.max_size_mb {
                                if let Err(e) = Self::enforce_size_limit(&dir.path, max_size).await {
                                    warn!("Size limit enforcement failed for {}: {}", 
                                          dir.path.display(), e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to get disk usage: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    /// Get current disk usage for all mount points
    pub async fn get_disk_usage() -> Result<HashMap<String, DiskUsage>> {
        let output = Command::new("df")
            .args(&["-B1", "--output=source,target,size,used,avail,pcent,fstype"])
            .output()?;

        if !output.status.success() {
            anyhow::bail!("df command failed");
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut disk_info = HashMap::new();

        for (i, line) in stdout.lines().enumerate() {
            if i == 0 { continue; } // Skip header

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 7 {
                let mount_point = parts[1].to_string();
                let total_bytes = parts[2].parse::<u64>().unwrap_or(0);
                let used_bytes = parts[3].parse::<u64>().unwrap_or(0);
                let available_bytes = parts[4].parse::<u64>().unwrap_or(0);
                let used_percent = parts[5].trim_end_matches('%')
                    .parse::<f64>().unwrap_or(0.0);
                let filesystem = parts[6].to_string();

                let usage = DiskUsage {
                    mount_point: mount_point.clone(),
                    total_bytes,
                    used_bytes,
                    available_bytes,
                    used_percent,
                    filesystem,
                    is_healthy: used_percent < 90.0,
                    alert_level: DiskAlertLevel::Normal, // Will be set by caller
                };

                disk_info.insert(mount_point, usage);
            }
        }

        Ok(disk_info)
    }

    /// Get disk usage metrics for monitoring
    pub async fn get_metrics(&self) -> Result<DiskMetrics> {
        let disk_usage = Self::get_disk_usage().await?;
        let mut total_directories = 0;
        let mut monitored_size_mb = 0;

        for dir in &self.monitored_dirs {
            total_directories += 1;
            if let Ok(size) = Self::get_directory_size(&dir.path).await {
                monitored_size_mb += size / (1024 * 1024);
            }
        }

        let root_usage = disk_usage.get("/").cloned();
        
        Ok(DiskMetrics {
            total_directories,
            monitored_size_mb,
            root_usage,
            cleanup_actions: 0, // TODO: Track cleanup actions
            log_rotations: 0,   // TODO: Track rotations
        })
    }

    /// Internal: Evaluate disk usage alert level
    fn evaluate_disk_usage(usage: &DiskUsage, thresholds: &DiskThresholds) -> DiskAlertLevel {
        if usage.used_percent >= thresholds.emergency_percent ||
           usage.available_bytes < thresholds.min_free_space_mb * 1024 * 1024 {
            DiskAlertLevel::Emergency
        } else if usage.used_percent >= thresholds.critical_percent {
            DiskAlertLevel::Critical
        } else if usage.used_percent >= thresholds.warning_percent {
            DiskAlertLevel::Warning
        } else {
            DiskAlertLevel::Normal
        }
    }

    /// Internal: Rotate logs in a directory
    async fn rotate_logs(dir: &Path, config: &LogRotationConfig) -> Result<()> {
        if !dir.exists() {
            return Ok(());
        }

        let entries = fs::read_dir(dir)?;
        
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                let metadata = fs::metadata(&path)?;
                let size_mb = metadata.len() / (1024 * 1024);
                
                // Check if file needs rotation
                if size_mb >= config.max_size_mb {
                    info!("Rotating log file: {} ({}MB)", 
                          path.display(), size_mb);
                    
                    Self::rotate_file(&path, config).await?;
                }
            }
        }

        // Clean up old rotated files
        Self::cleanup_old_logs(dir, config).await?;
        
        Ok(())
    }

    /// Internal: Rotate a specific file
    async fn rotate_file(file_path: &Path, config: &LogRotationConfig) -> Result<()> {
        let base_name = file_path.to_string_lossy();
        
        // Shift existing rotated files
        for i in (1..config.max_files).rev() {
            let from = if config.compress && i > 1 {
                format!("{}.{}.gz", base_name, i - 1)
            } else {
                format!("{}.{}", base_name, i - 1)
            };
            
            let to = if config.compress {
                format!("{}.{}.gz", base_name, i)
            } else {
                format!("{}.{}", base_name, i)
            };
            
            if Path::new(&from).exists() {
                if i == config.max_files - 1 {
                    // Delete the oldest file
                    fs::remove_file(&from)?;
                } else {
                    fs::rename(&from, &to)?;
                }
            }
        }
        
        // Move current file to .1
        let rotated_name = format!("{}.1", base_name);
        fs::rename(file_path, &rotated_name)?;
        
        // Compress if enabled
        if config.compress {
            let compressed_name = format!("{}.gz", rotated_name);
            let output = Command::new("gzip")
                .arg(&rotated_name)
                .output()?;
                
            if !output.status.success() {
                warn!("Failed to compress {}", rotated_name);
            }
        }
        
        // Create new empty file
        File::create(file_path)?;
        
        Ok(())
    }

    /// Internal: Clean up old log files
    async fn cleanup_old_logs(dir: &Path, config: &LogRotationConfig) -> Result<()> {
        let cutoff_time = SystemTime::now() - Duration::from_secs(
            config.max_age_days as u64 * 24 * 3600
        );
        
        let entries = fs::read_dir(dir)?;
        
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    if modified < cutoff_time {
                        // Check if this looks like a rotated log file
                        let name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("");
                            
                        if name.contains(".log.") || name.ends_with(".gz") {
                            info!("Deleting old log file: {}", path.display());
                            if let Err(e) = fs::remove_file(&path) {
                                warn!("Failed to delete {}: {}", path.display(), e);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Internal: Emergency cleanup for critical disk usage
    async fn emergency_cleanup(dir: &Path) -> Result<()> {
        warn!("Starting emergency cleanup for: {}", dir.display());
        
        if !dir.exists() {
            return Ok(());
        }

        let mut files_to_delete = Vec::new();
        
        // Find files to delete (oldest first, certain patterns)
        Self::collect_cleanup_candidates(dir, &mut files_to_delete).await?;
        
        // Sort by age (oldest first)
        files_to_delete.sort_by_key(|f| f.1);
        
        let mut freed_bytes = 0u64;
        let target_bytes = 100 * 1024 * 1024; // Try to free 100MB
        
        for (path, _modified_time, size) in files_to_delete {
            if freed_bytes >= target_bytes {
                break;
            }
            
            info!("Emergency cleanup: deleting {} ({})", 
                  path.display(), Self::format_bytes(size));
            
            if let Err(e) = fs::remove_file(&path) {
                warn!("Failed to delete {}: {}", path.display(), e);
            } else {
                freed_bytes += size;
            }
        }
        
        info!("Emergency cleanup completed: freed {}", 
              Self::format_bytes(freed_bytes));
        
        Ok(())
    }

    /// Internal: Collect files for emergency cleanup
    async fn collect_cleanup_candidates(
        dir: &Path, 
        candidates: &mut Vec<(PathBuf, SystemTime, u64)>
    ) -> Result<()> {
        let entries = fs::read_dir(dir)?;
        
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Ok(metadata) = fs::metadata(&path) {
                    let size = metadata.len();
                    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                    
                    // Only consider certain file types for emergency cleanup
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.ends_with(".log") || 
                           name.ends_with(".tmp") ||
                           name.contains("temp") ||
                           name.ends_with(".old") {
                            candidates.push((path, modified, size));
                        }
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Internal: Enforce size limit for a directory
    async fn enforce_size_limit(dir: &Path, max_size_mb: u64) -> Result<()> {
        let current_size = Self::get_directory_size(dir).await?;
        let max_bytes = max_size_mb * 1024 * 1024;
        
        if current_size > max_bytes {
            warn!("Directory {} exceeds size limit: {} > {}MB", 
                  dir.display(), 
                  Self::format_bytes(current_size),
                  max_size_mb);
            
            // Perform targeted cleanup
            Self::emergency_cleanup(dir).await?;
        }
        
        Ok(())
    }

    /// Internal: Get total size of directory
    async fn get_directory_size(dir: &Path) -> Result<u64> {
        let output = Command::new("du")
            .args(&["-sb", &dir.to_string_lossy()])
            .output()?;
            
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = stdout.lines().next() {
                if let Some(size_str) = line.split_whitespace().next() {
                    return Ok(size_str.parse().unwrap_or(0));
                }
            }
        }
        
        Ok(0)
    }

    /// Internal: Format bytes for human-readable display
    fn format_bytes(bytes: u64) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        let mut size = bytes as f64;
        let mut unit_index = 0;
        
        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }
        
        format!("{:.1}{}", size, UNITS[unit_index])
    }
}

/// Disk metrics for monitoring
#[derive(Debug, Clone, Serialize)]
pub struct DiskMetrics {
    pub total_directories: usize,
    pub monitored_size_mb: u64,
    pub root_usage: Option<DiskUsage>,
    pub cleanup_actions: u64,
    pub log_rotations: u64,
}