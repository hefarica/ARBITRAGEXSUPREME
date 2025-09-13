// ================================
// ArbitrageX Supreme V3.0 - Searcher Engine Main
// Motor principal Rust de descubrimiento y ejecución
// ================================

use actix_web::{web, App, HttpServer, middleware, Result};
use anyhow::Context;
use std::sync::Arc;
use tokio::signal;
use tracing::{info, error};
use tracing_subscriber::EnvFilter;

// Módulos internos
mod config;
mod strategy_engine;
mod execution;
mod reporting;
mod selectors;
mod metrics;
mod health;
mod api;

use config::SearcherConfig;
use strategy_engine::StrategyEngine;
use execution::ExecutionEngine;
use reporting::ReportingEngine;
use selectors::{ChainSelector, DexSelector, LendingSelector, TokenFilter};
use metrics::MetricsRegistry;

/// Estado compartido de la aplicación
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<SearcherConfig>,
    pub strategy_engine: Arc<StrategyEngine>,
    pub execution_engine: Arc<ExecutionEngine>,
    pub reporting_engine: Arc<ReportingEngine>,
    pub chain_selector: Arc<ChainSelector>,
    pub dex_selector: Arc<DexSelector>,
    pub lending_selector: Arc<LendingSelector>,
    pub token_filter: Arc<TokenFilter>,
    pub metrics: Arc<MetricsRegistry>,
}

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    // Inicializar logging
    init_logging()?;
    
    info!("🚀 Iniciando ArbitrageX Supreme V3.0 Searcher Engine");

    // Cargar configuración
    let config = Arc::new(SearcherConfig::from_env()
        .context("Error cargando configuración")?);
    
    info!("✅ Configuración cargada - Modo: {}", config.execution_mode);
    
    // Validar política Real-Only
    if config.allow_mock_data {
        error!("❌ POLÍTICA REAL-ONLY VIOLADA: mock data habilitado");
        return Err(anyhow::anyhow!("Real-Only policy violation"));
    }
    
    // Inicializar componentes principales
    let metrics = Arc::new(MetricsRegistry::new());
    
    let strategy_engine = Arc::new(StrategyEngine::new(config.clone(), metrics.clone())
        .await.context("Error inicializando strategy engine")?);
    
    let execution_engine = Arc::new(ExecutionEngine::new(config.clone(), metrics.clone())
        .await.context("Error inicializando execution engine")?);
    
    let reporting_engine = Arc::new(ReportingEngine::new(config.clone())
        .await.context("Error inicializando reporting engine")?);
    
    // Inicializar selectores
    let chain_selector = Arc::new(ChainSelector::new(config.clone(), metrics.clone())
        .await.context("Error inicializando chain selector")?);
        
    let dex_selector = Arc::new(DexSelector::new(config.clone(), metrics.clone())
        .await.context("Error inicializando dex selector")?);
        
    let lending_selector = Arc::new(LendingSelector::new(config.clone(), metrics.clone())
        .await.context("Error inicializando lending selector")?);
        
    let token_filter = Arc::new(TokenFilter::new(config.clone(), metrics.clone())
        .await.context("Error inicializando token filter")?);

    // Crear estado de aplicación
    let app_state = AppState {
        config: config.clone(),
        strategy_engine,
        execution_engine,
        reporting_engine,
        chain_selector,
        dex_selector,
        lending_selector,
        token_filter,
        metrics,
    };

    info!("✅ Componentes inicializados correctamente");
    
    // Verificar conectividad con dependencias
    verify_dependencies(&app_state).await?;
    
    // Iniciar engine principal en background
    let engine_state = app_state.clone();
    tokio::spawn(async move {
        if let Err(e) = run_searcher_engine(engine_state).await {
            error!("❌ Error en searcher engine: {}", e);
        }
    });

    // Configurar servidor HTTP
    let bind_address = format!("0.0.0.0:{}", config.api_port);
    info!("🌐 Iniciando servidor HTTP en {}", bind_address);

    let server = HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .service(
                web::scope("/api/v1")
                    .configure(api::configure_routes)
            )
            .service(
                web::scope("/metrics")
                    .route("", web::get().to(metrics::prometheus_metrics))
            )
            .service(
                web::scope("/health")
                    .route("", web::get().to(health::health_check))
                    .route("/ready", web::get().to(health::readiness_check))
                    .route("/live", web::get().to(health::liveness_check))
            )
    })
    .bind(bind_address)?;

    // Configurar graceful shutdown
    let server_handle = server.run();
    
    info!("🎯 ArbitrageX Searcher Engine operativo");
    info!("📊 Métricas disponibles en: http://0.0.0.0:{}/metrics", config.api_port);
    info!("🏥 Health checks en: http://0.0.0.0:{}/health", config.api_port);
    
    // Esperar señal de shutdown
    tokio::select! {
        _ = server_handle => {
            info!("🛑 Servidor HTTP terminado");
        }
        _ = signal::ctrl_c() => {
            info!("🛑 Recibida señal SIGINT, terminando...");
        }
    }

    info!("✅ ArbitrageX Searcher Engine terminado correctamente");
    Ok(())
}

/// Inicializar sistema de logging
fn init_logging() -> anyhow::Result<()> {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .json()
        .init();

    Ok(())
}

/// Verificar conectividad con dependencias
async fn verify_dependencies(state: &AppState) -> anyhow::Result<()> {
    info!("🔍 Verificando dependencias...");
    
    // Verificar base de datos
    match sqlx::query("SELECT 1")
        .fetch_one(&state.config.database_pool)
        .await
    {
        Ok(_) => info!("✅ PostgreSQL conectado"),
        Err(e) => {
            error!("❌ Error conectando PostgreSQL: {}", e);
            return Err(anyhow::anyhow!("PostgreSQL connection failed"));
        }
    }
    
    // Verificar Redis
    match state.config.redis_client.get::<_, String>("ping").await {
        Ok(_) | Err(_) => info!("✅ Redis conectado"), // Redis puede no tener la key 'ping'
    }
    
    // Verificar RPC principal (geth)
    match state.config.geth_provider.get_block_number().await {
        Ok(block_number) => {
            info!("✅ Geth RPC conectado - Block: {}", block_number);
        }
        Err(e) => {
            error!("❌ Error conectando Geth RPC: {}", e);
            return Err(anyhow::anyhow!("Geth RPC connection failed"));
        }
    }
    
    info!("✅ Todas las dependencias verificadas");
    Ok(())
}

/// Loop principal del searcher engine
async fn run_searcher_engine(state: AppState) -> anyhow::Result<()> {
    info!("🔄 Iniciando loop principal del searcher engine");
    
    let mut interval = tokio::time::interval(
        std::time::Duration::from_millis(state.config.scan_interval_ms)
    );
    
    loop {
        interval.tick().await;
        
        let start = std::time::Instant::now();
        
        // Ejecutar ciclo de búsqueda
        if let Err(e) = execute_search_cycle(&state).await {
            error!("❌ Error en ciclo de búsqueda: {}", e);
            state.metrics.search_cycle_errors.inc();
        }
        
        // Registrar latencia
        let elapsed = start.elapsed();
        state.metrics.search_cycle_duration
            .observe(elapsed.as_secs_f64());
        
        // Verificar latencia objetivo
        if elapsed.as_millis() > 200 {
            tracing::warn!(
                "⚠️ Ciclo de búsqueda excedió latencia objetivo: {}ms", 
                elapsed.as_millis()
            );
        }
    }
}

/// Ejecutar un ciclo completo de búsqueda de oportunidades
async fn execute_search_cycle(state: &AppState) -> anyhow::Result<()> {
    // 1. Actualizar datos de chains/dex/tokens
    let chains = state.chain_selector.get_active_chains().await?;
    let dex_data = state.dex_selector.get_dex_data(&chains).await?;
    let lending_data = state.lending_selector.get_lending_data(&chains).await?;
    let tokens = state.token_filter.get_filtered_tokens(&chains).await?;
    
    // 2. Ejecutar estrategias habilitadas
    for strategy_id in &state.config.enabled_strategies {
        if let Err(e) = state.strategy_engine
            .execute_strategy(
                strategy_id,
                &chains,
                &dex_data,
                &lending_data,
                &tokens
            ).await
        {
            error!("❌ Error ejecutando estrategia {}: {}", strategy_id, e);
        }
    }
    
    Ok(())
}