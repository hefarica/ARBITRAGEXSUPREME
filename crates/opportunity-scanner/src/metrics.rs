use prometheus::{Registry, Histogram, Counter, Gauge, HistogramOpts, Opts};


pub struct ScannerMetrics {
    pub registry: Registry,
    pub processing_duration: Histogram,
    pub opportunities_detected: Counter,
    pub opportunities_emitted: Counter,
    pub websocket_connections: Gauge,
    pub websocket_reconnects: Counter,
    pub mempool_transactions: Counter,
    pub dex_events: Counter,
    pub error_count: Counter,
}

impl ScannerMetrics {
    pub fn new() -> Self {
        let registry = Registry::new();
        
        let processing_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_opportunity_scanner_processing_duration",
                "Time spent processing mempool events and DEX state changes"
            )
            .buckets(vec![0.001, 0.005, 0.01, 0.015, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0])
        ).unwrap();
        
        let opportunities_detected = Counter::with_opts(
            Opts::new(
                "arbitragex_opportunities_detected_total",
                "Total number of arbitrage opportunities detected"
            )
        ).unwrap();
        
        let opportunities_emitted = Counter::with_opts(
            Opts::new(
                "arbitragex_opportunities_emitted_total",
                "Total number of opportunities emitted to router"
            )
        ).unwrap();
        
        let websocket_connections = Gauge::with_opts(
            Opts::new(
                "arbitragex_websocket_connections_active",
                "Number of active WebSocket connections"
            )
        ).unwrap();
        
        let websocket_reconnects = Counter::with_opts(
            Opts::new(
                "arbitragex_websocket_reconnects_total",
                "Total number of WebSocket reconnections"
            )
        ).unwrap();
        
        let mempool_transactions = Counter::with_opts(
            Opts::new(
                "arbitragex_mempool_transactions_total",
                "Total number of mempool transactions processed"
            )
        ).unwrap();
        
        let dex_events = Counter::with_opts(
            Opts::new(
                "arbitragex_dex_events_total",
                "Total number of DEX events processed"
            )
        ).unwrap();
        
        let error_count = Counter::with_opts(
            Opts::new(
                "arbitragex_scanner_errors_total",
                "Total number of scanner errors"
            )
        ).unwrap();
        
        // Register all metrics
        registry.register(Box::new(processing_duration.clone())).unwrap();
        registry.register(Box::new(opportunities_detected.clone())).unwrap();
        registry.register(Box::new(opportunities_emitted.clone())).unwrap();
        registry.register(Box::new(websocket_connections.clone())).unwrap();
        registry.register(Box::new(websocket_reconnects.clone())).unwrap();
        registry.register(Box::new(mempool_transactions.clone())).unwrap();
        registry.register(Box::new(dex_events.clone())).unwrap();
        registry.register(Box::new(error_count.clone())).unwrap();
        
        Self {
            registry,
            processing_duration,
            opportunities_detected,
            opportunities_emitted,
            websocket_connections,
            websocket_reconnects,
            mempool_transactions,
            dex_events,
            error_count,
        }
    }
}