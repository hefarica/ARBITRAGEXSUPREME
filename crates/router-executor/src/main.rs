use anyhow::Result;
use std::sync::Arc;
use tokio::time::{Duration, Instant};
use tracing::{info, error, warn};
use tracing_subscriber::EnvFilter;

mod routing_engine;
mod gas_estimator;
mod transaction_builder;
mod signer_pool;
mod simulation_engine;
mod bundle_builder;
mod flashbots_client;
mod metrics;
mod config;
mod eip712_signer;
mod mev_protection;

use routing_engine::RoutingEngine;
use gas_estimator::GasEstimator;
use transaction_builder::TransactionBuilder;
use signer_pool::SignerPool;
use simulation_engine::SimulationEngine;
use bundle_builder::BundleBuilder;
use flashbots_client::FlashbotsClient;
use metrics::ExecutorMetrics;
use config::ExecutorConfig;
use eip712_signer::EIP712Signer;
use mev_protection::{MEVProtectionEngine, MEVProtectionConfig};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    info!("⚡ ArbitrageX Supreme V3.0 - Router Executor (Rust)");
    info!("🎯 Target: <5ms routing + <10ms bundle construction | Ingenio Pichichi S.A.");

    // Load configuration
    let config = ExecutorConfig::from_env()?;
    info!("📋 Config loaded: {} signers, {} relays", 
          config.signer_count, config.flashbots_relays.len());

    // Initialize metrics
    let metrics = Arc::new(ExecutorMetrics::new());
    
    // Initialize core components
    let routing_engine = Arc::new(RoutingEngine::new(config.clone(), metrics.clone()).await?);
    let gas_estimator = Arc::new(GasEstimator::new(config.clone(), metrics.clone()).await?);
    let signer_pool = Arc::new(SignerPool::new(config.clone()).await?);
    let simulation_engine = Arc::new(SimulationEngine::new(config.clone(), metrics.clone()).await?);
    let bundle_builder = Arc::new(BundleBuilder::new(config.clone(), metrics.clone()));
    let flashbots_client = Arc::new(FlashbotsClient::new(config.clone(), metrics.clone()).await?);

    // Redis connection for opportunity consumption
    let redis_client = redis::Client::open(config.redis_url.as_str())?;
    let mut redis_conn = redis_client.get_multiplexed_async_connection().await?;

    info!("✅ All services initialized - entering execution mode");

    // Main execution loop
    let execution_handle = {
        let routing_engine = routing_engine.clone();
        let gas_estimator = gas_estimator.clone();
        let signer_pool = signer_pool.clone();
        let simulation_engine = simulation_engine.clone();
        let bundle_builder = bundle_builder.clone();
        let flashbots_client = flashbots_client.clone();
        let metrics = metrics.clone();
        
        tokio::spawn(async move {
            execution_loop(
                routing_engine,
                gas_estimator,
                signer_pool,
                simulation_engine,
                bundle_builder,
                flashbots_client,
                metrics,
                redis_conn,
            ).await
        })
    };

    // Health check and metrics server
    let metrics_handle = {
        let metrics = metrics.clone();
        tokio::spawn(async move {
            start_metrics_server(metrics).await
        })
    };

    info!("🚀 Router Executor ready - monitoring Redis stream");

    // Wait for any service to fail
    tokio::select! {
        result = execution_handle => {
            error!("❌ Execution loop failed: {:?}", result);
        }
        result = metrics_handle => {
            error!("❌ Metrics server failed: {:?}", result);
        }
    }

    Ok(())
}

/// Main execution loop - processes opportunities from Redis stream
async fn execution_loop(
    routing_engine: Arc<RoutingEngine>,
    gas_estimator: Arc<GasEstimator>,
    signer_pool: Arc<SignerPool>,
    simulation_engine: Arc<SimulationEngine>,
    bundle_builder: Arc<BundleBuilder>,
    flashbots_client: Arc<FlashbotsClient>,
    metrics: Arc<ExecutorMetrics>,
    mut redis_conn: redis::aio::MultiplexedConnection,
) -> Result<()> {
    use redis::AsyncCommands;
    
    loop {
        let start = Instant::now();
        
        // 1. Read opportunities from Redis stream (non-blocking)
        let stream_result: Vec<redis::Value> = redis_conn
            .xread_options(
                &["arbitrage:opportunities"],
                &[">"],
                &redis::streams::StreamReadOptions::default()
                    .count(1)
                    .block(100), // 100ms timeout
            )
            .await?;
            
        if stream_result.is_empty() {
            continue;
        }
        
        // Parse opportunity
        let opportunity = match parse_opportunity_from_stream(&stream_result) {
            Ok(opp) => opp,
            Err(e) => {
                warn!("Failed to parse opportunity: {:?}", e);
                continue;
            }
        };
        
        info!("📥 Processing opportunity: {}", opportunity.id);
        
        // 2. Route calculation (target: <5ms)
        let route_start = Instant::now();
        let route = match routing_engine.calculate_optimal_route(&opportunity).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Routing failed for {}: {:?}", opportunity.id, e);
                continue;
            }
        };
        let route_duration = route_start.elapsed();
        metrics.routing_duration.observe(route_duration.as_millis() as f64);
        
        // 3. Gas estimation (target: <2ms)
        let gas_start = Instant::now();
        let gas_estimate = gas_estimator.estimate_gas(&route).await?;
        let gas_duration = gas_start.elapsed();
        metrics.gas_estimation_duration.observe(gas_duration.as_millis() as f64);
        
        // 4. Transaction building and signing (target: <3ms)
        let build_start = Instant::now();
        let signer = signer_pool.get_available_signer().await?;
        let signed_txs = bundle_builder.build_bundle(&route, &gas_estimate, &signer).await?;
        signer_pool.return_signer(signer).await?;
        let build_duration = build_start.elapsed();
        metrics.bundle_build_duration.observe(build_duration.as_millis() as f64);
        
        // 5. Simulation (parallel - not in critical path)
        let simulation_handle = {
            let simulation_engine = simulation_engine.clone();
            let signed_txs = signed_txs.clone();
            tokio::spawn(async move {
                simulation_engine.simulate_bundle(&signed_txs).await
            })
        };
        
        // 6. Submit to Flashbots Protect (fast mode with multiple builders)
        let submit_start = Instant::now();
        let submission_result = flashbots_client.submit_bundle_fast(&signed_txs).await;
        let submit_duration = submit_start.elapsed();
        metrics.submission_duration.observe(submit_duration.as_millis() as f64);
        
        match submission_result {
            Ok(bundle_hash) => {
                info!("✅ Bundle submitted: {} in {:?}", bundle_hash, submit_duration);
                metrics.successful_submissions.inc();
            }
            Err(e) => {
                error!("❌ Bundle submission failed: {:?}", e);
                metrics.failed_submissions.inc();
            }
        }
        
        // Check simulation result (non-blocking)
        if let Ok(simulation_result) = simulation_handle.await {
            match simulation_result {
                Ok(profit) => {
                    info!("💰 Simulated profit: {}", profit);
                    metrics.simulated_profit.observe(profit as f64);
                }
                Err(e) => {
                    warn!("⚠️ Simulation failed: {:?}", e);
                }
            }
        }
        
        let total_duration = start.elapsed();
        metrics.total_execution_duration.observe(total_duration.as_millis() as f64);
        
        // Performance warnings
        if total_duration > Duration::from_millis(15) {
            warn!("⚠️ Execution exceeded 15ms budget: {:?} (route: {:?}, gas: {:?}, build: {:?}, submit: {:?})", 
                  total_duration, route_duration, gas_duration, build_duration, submit_duration);
        }
        
        info!("⚡ Opportunity {} processed in {:?}", opportunity.id, total_duration);
    }
}

async fn start_metrics_server(metrics: Arc<ExecutorMetrics>) -> Result<()> {
    use hyper::service::service_fn;
    use hyper::{Request, Response};
    use hyper_util::rt::TokioIo;
    use tokio::net::TcpListener;
    
    let listener = TcpListener::bind("0.0.0.0:9091").await?;
    
    let service = service_fn(move |req: Request<hyper::body::Incoming>| {
        let metrics = metrics.clone();
        async move {
            match req.uri().path() {
                "/metrics" => {
                    let encoder = prometheus::TextEncoder::new();
                    let metric_families = metrics.registry.gather();
                    let output = encoder.encode_to_string(&metric_families).unwrap();
                    Ok::<_, hyper::Error>(Response::new(output.into()))
                }
                "/health" => {
                    Ok(Response::new("OK".into()))
                }
                _ => {
                    Ok(Response::builder()
                        .status(404)
                        .body("Not Found".into())
                        .unwrap())
                }
            }
        }
    });
    
    info!("📊 Metrics server listening on http://0.0.0.0:9091");
    
    loop {
        let (stream, _) = listener.accept().await?;
        let io = TokioIo::new(stream);
        let service = service.clone();
        
        tokio::spawn(async move {
            if let Err(err) = hyper::server::conn::http1::Builder::new()
                .serve_connection(io, service)
                .await
            {
                eprintln!("Error serving connection: {:?}", err);
            }
        });
    }
}

fn parse_opportunity_from_stream(_stream_result: &[redis::Value]) -> Result<ArbitrageOpportunity> {
    // TODO: Parse Redis stream response into ArbitrageOpportunity
    todo!("Implement Redis stream parsing")
}

#[derive(Debug, Clone)]
pub struct ArbitrageOpportunity {
    pub id: String,
    pub token_in: ethers::types::Address,
    pub token_out: ethers::types::Address,
    pub amount_in: ethers::types::U256,
    pub expected_profit: ethers::types::U256,
    pub dex_path: Vec<String>,
    pub confidence_score: f64,
    pub gas_estimate: ethers::types::U256,
    pub deadline: u64,
    pub priority_score: f64,
}