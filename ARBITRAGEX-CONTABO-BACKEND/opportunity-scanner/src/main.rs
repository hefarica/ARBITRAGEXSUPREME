use anyhow::Result;
use std::sync::Arc;
use tokio::time::{Duration, Instant};
use tracing::{info, error, warn};
use tracing_subscriber::EnvFilter;

mod mempool;
mod dex_state;
mod event_processor;
mod websocket_manager;
mod metrics;
mod config;

use mempool::MempoolScanner;
use dex_state::DexStateManager;
use event_processor::EventProcessor;
use websocket_manager::WebSocketManager;
use metrics::ScannerMetrics;
use config::ScannerConfig;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    info!("🚀 ArbitrageX Supreme V3.0 - Opportunity Scanner (Rust)");
    info!("⚡ Target: <15ms ingesta/normalización | Ingenio Pichichi S.A.");

    // Load configuration
    let config = ScannerConfig::from_env()?;
    info!("📋 Config loaded: {} chains, {} DEXs", 
          config.chains.len(), config.dexs.len());

    // Initialize metrics
    let metrics = Arc::new(ScannerMetrics::new());
    
    // Initialize core components
    let dex_state = Arc::new(DexStateManager::new(config.clone(), metrics.clone()).await?);
    let mempool_scanner = Arc::new(MempoolScanner::new(config.clone(), metrics.clone()).await?);
    let event_processor = Arc::new(EventProcessor::new(config.clone(), metrics.clone(), dex_state.clone()));
    let ws_manager = Arc::new(WebSocketManager::new(config.clone(), metrics.clone()).await?);

    // Start hot path processing loop
    let processor_handle = {
        let event_processor = event_processor.clone();
        let mempool_scanner = mempool_scanner.clone();
        tokio::spawn(async move {
            hot_path_loop(event_processor, mempool_scanner).await
        })
    };

    // Start WebSocket connections to DEXs and mempools
    let ws_handle = {
        let ws_manager = ws_manager.clone();
        let dex_state = dex_state.clone();
        tokio::spawn(async move {
            ws_manager.start_connections(dex_state).await
        })
    };

    // Health check and metrics server
    let metrics_handle = {
        let metrics = metrics.clone();
        tokio::spawn(async move {
            start_metrics_server(metrics).await
        })
    };

    info!("✅ All services started - entering hot path mode");

    // Wait for any service to fail
    tokio::select! {
        result = processor_handle => {
            error!("❌ Event processor failed: {:?}", result);
        }
        result = ws_handle => {
            error!("❌ WebSocket manager failed: {:?}", result);
        }
        result = metrics_handle => {
            error!("❌ Metrics server failed: {:?}", result);
        }
    }

    Ok(())
}

/// Hot path processing loop - target <15ms end-to-end
async fn hot_path_loop(
    event_processor: Arc<EventProcessor>,
    mempool_scanner: Arc<MempoolScanner>,
) -> Result<()> {
    let mut interval = tokio::time::interval(Duration::from_millis(1)); // 1000 Hz
    
    loop {
        interval.tick().await;
        let start = Instant::now();
        
        // 1. Process pending mempool transactions (target: <5ms)
        let mempool_events = mempool_scanner.scan_pending().await?;
        
        // 2. Process DEX state changes (target: <5ms) 
        let opportunities = event_processor.process_batch(mempool_events).await?;
        
        // 3. Emit opportunities to router-executor (target: <5ms)
        if !opportunities.is_empty() {
            event_processor.emit_opportunities(opportunities).await?;
        }
        
        let elapsed = start.elapsed();
        
        // Log performance warnings
        if elapsed > Duration::from_millis(15) {
            warn!("⚠️ Hot path exceeded budget: {:?} > 15ms", elapsed);
        }
        
        // Yield if we're too fast (prevent CPU burn)
        if elapsed < Duration::from_millis(1) {
            tokio::task::yield_now().await;
        }
    }
}

async fn start_metrics_server(metrics: Arc<ScannerMetrics>) -> Result<()> {
    use hyper::service::service_fn;
    use hyper::{Request, Response};
    use hyper::server::conn::http1;
    use hyper_util::rt::TokioIo;
    use std::net::SocketAddr;
    use tokio::net::TcpListener;
    
    let addr: SocketAddr = ([0, 0, 0, 0], 9090).into();
    let listener = TcpListener::bind(addr).await?;
    
    info!("📊 Metrics server listening on http://0.0.0.0:9090");
    
    loop {
        let (stream, _) = listener.accept().await?;
        let io = TokioIo::new(stream);
        let metrics = metrics.clone();
        
        tokio::task::spawn(async move {
            let service = service_fn(move |req: Request<hyper::body::Incoming>| {
                let metrics = metrics.clone();
                async move {
                    match req.uri().path() {
                        "/metrics" => {
                            let encoder = prometheus::TextEncoder::new();
                            let metric_families = metrics.registry.gather();
                            let output = encoder.encode_to_string(&metric_families).unwrap();
                            Ok::<_, hyper::Error>(Response::new(output))
                        }
                        "/health" => {
                            Ok(Response::new("OK".to_string()))
                        }
                        _ => {
                            let response = Response::builder()
                                .status(404)
                                .body("Not Found".to_string())
                                .unwrap();
                            Ok(response)
                        }
                    }
                }
            });
            
            if let Err(err) = http1::Builder::new().serve_connection(io, service).await {
                eprintln!("Error serving connection: {:?}", err);
            }
        });
    }
}