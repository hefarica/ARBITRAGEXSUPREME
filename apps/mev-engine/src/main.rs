// ArbitrageX Supreme V3.0 - MEV Engine Core
// High-performance Rust MEV Engine para detección y ejecución de arbitraje

use anyhow::Result;
use clap::Parser;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tracing::{info, error};

mod config;
mod engine;
mod api;
mod database;
mod redis_client;
mod blockchain;
mod strategies;
mod monitoring;
mod types;

use config::Config;
use engine::MevEngine;
use api::ApiServer;
use monitoring::MetricsCollector;

#[derive(Parser)]
#[command(name = "arbitragex-mev-engine")]
#[command(about = "ArbitrageX Supreme V3.0 - MEV Engine Core")]
struct Cli {
    /// Configuration file path
    #[arg(short, long, default_value = "config.yaml")]
    config: String,
    
    /// Enable debug logging
    #[arg(short, long)]
    debug: bool,
    
    /// Run in simulation mode (no real transactions)
    #[arg(short, long)]
    simulate: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Parse CLI arguments
    let cli = Cli::parse();
    
    // Initialize logging
    init_logging(cli.debug);
    
    info!("🚀 Starting ArbitrageX Supreme V3.0 MEV Engine...");
    
    // Load configuration
    let config = Arc::new(Config::load(&cli.config)?);
    info!("✅ Configuration loaded from {}", cli.config);
    
    // Initialize metrics collector
    let metrics = Arc::new(MetricsCollector::new());
    info!("✅ Metrics collector initialized");
    
    // Initialize MEV Engine
    let engine = Arc::new(MevEngine::new(config.clone(), metrics.clone(), cli.simulate).await?);
    info!("✅ MEV Engine initialized");
    
    // Start API server
    let api_server = ApiServer::new(config.clone(), engine.clone());
    let api_handle = tokio::spawn(async move {
        if let Err(e) = api_server.start().await {
            error!("API server error: {}", e);
        }
    });
    
    // Start MEV engine monitoring
    let engine_clone = engine.clone();
    let engine_handle = tokio::spawn(async move {
        engine_clone.start().await;
    });
    
    // Start metrics collection
    let metrics_clone = metrics.clone();
    let metrics_handle = tokio::spawn(async move {
        metrics_clone.start_collection().await;
    });
    
    info!("🔥 ArbitrageX Supreme V3.0 MEV Engine is now ACTIVE!");
    info!("📊 API Server: http://localhost:{}", config.server.port);
    info!("📈 Metrics: http://localhost:{}/metrics", config.server.port);
    
    // Wait for shutdown signal
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("🛑 Shutdown signal received");
        }
        result = api_handle => {
            if let Err(e) = result {
                error!("API server task failed: {}", e);
            }
        }
        result = engine_handle => {
            if let Err(e) = result {
                error!("MEV engine task failed: {}", e);
            }
        }
        result = metrics_handle => {
            if let Err(e) = result {
                error!("Metrics task failed: {}", e);
            }
        }
    }
    
    info!("🛑 Shutting down MEV Engine gracefully...");
    
    // Graceful shutdown
    engine.shutdown().await?;
    
    info!("✅ ArbitrageX Supreme V3.0 MEV Engine stopped");
    Ok(())
}

fn init_logging(debug: bool) {
    let level = if debug { "debug" } else { "info" };
    
    tracing_subscriber::fmt()
        .with_env_filter(format!("arbitragex_mev_engine={},tower_http=debug", level))
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();
}