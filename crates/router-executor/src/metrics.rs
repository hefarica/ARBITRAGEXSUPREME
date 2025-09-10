use prometheus::{Registry, Histogram, Counter, Gauge, HistogramOpts, Opts};

pub struct ExecutorMetrics {
    pub registry: Registry,
    pub routing_duration: Histogram,
    pub gas_estimation_duration: Histogram,
    pub bundle_build_duration: Histogram,
    pub submission_duration: Histogram,
    pub total_execution_duration: Histogram,
    pub flashbots_submission_duration: Histogram,
    pub successful_submissions: Counter,
    pub failed_submissions: Counter,
    pub successful_bundle_submissions: Counter,
    pub failed_bundle_submissions: Counter,
    pub simulated_profit: Histogram,
    pub transaction_build_duration: Histogram,
    pub signing_duration: Histogram,
    pub simulation_duration: Histogram,
}

impl ExecutorMetrics {
    pub fn new() -> Self {
        let registry = Registry::new();
        
        let routing_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_router_executor_routing_duration",
                "Time spent calculating optimal routes"
            )
            .buckets(vec![0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1])
        ).unwrap();
        
        let gas_estimation_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_gas_estimation_duration",
                "Time spent estimating gas costs"
            )
            .buckets(vec![0.001, 0.002, 0.005, 0.01, 0.02, 0.05])
        ).unwrap();
        
        let bundle_build_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_bundle_build_duration", 
                "Time spent building transaction bundles"
            )
            .buckets(vec![0.001, 0.005, 0.01, 0.02, 0.05, 0.1])
        ).unwrap();
        
        let submission_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_submission_duration",
                "Time spent submitting transactions"
            )
            .buckets(vec![0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5])
        ).unwrap();
        
        let total_execution_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_total_execution_duration",
                "Total time from opportunity to submission"
            )
            .buckets(vec![0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.5, 1.0])
        ).unwrap();
        
        let flashbots_submission_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_flashbots_submission_duration",
                "Time spent submitting to Flashbots"
            )
            .buckets(vec![0.005, 0.01, 0.02, 0.05, 0.1, 0.2])
        ).unwrap();
        
        let successful_submissions = Counter::with_opts(
            Opts::new(
                "arbitragex_successful_submissions_total",
                "Total successful transaction submissions"
            )
        ).unwrap();
        
        let failed_submissions = Counter::with_opts(
            Opts::new(
                "arbitragex_failed_submissions_total",
                "Total failed transaction submissions"
            )
        ).unwrap();
        
        let successful_bundle_submissions = Counter::with_opts(
            Opts::new(
                "arbitragex_successful_bundle_submissions_total",
                "Total successful bundle submissions"
            )
        ).unwrap();
        
        let failed_bundle_submissions = Counter::with_opts(
            Opts::new(
                "arbitragex_failed_bundle_submissions_total",
                "Total failed bundle submissions"
            )
        ).unwrap();
        
        let simulated_profit = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_simulated_profit",
                "Simulated profit from arbitrage opportunities"
            )
            .buckets(vec![0.001, 0.01, 0.1, 1.0, 10.0, 100.0])
        ).unwrap();
        
        let transaction_build_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_transaction_build_duration",
                "Time spent building transactions"
            )
            .buckets(vec![0.001, 0.002, 0.005, 0.01, 0.02, 0.05])
        ).unwrap();
        
        let signing_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_signing_duration",
                "Time spent signing transactions"
            )
            .buckets(vec![0.001, 0.002, 0.005, 0.01, 0.02, 0.05])
        ).unwrap();
        
        let simulation_duration = Histogram::with_opts(
            HistogramOpts::new(
                "arbitragex_simulation_duration",
                "Time spent simulating transactions"
            )
            .buckets(vec![0.001, 0.005, 0.01, 0.02, 0.05, 0.1])
        ).unwrap();
        
        // Register all metrics
        registry.register(Box::new(routing_duration.clone())).unwrap();
        registry.register(Box::new(gas_estimation_duration.clone())).unwrap();
        registry.register(Box::new(bundle_build_duration.clone())).unwrap();
        registry.register(Box::new(submission_duration.clone())).unwrap();
        registry.register(Box::new(total_execution_duration.clone())).unwrap();
        registry.register(Box::new(flashbots_submission_duration.clone())).unwrap();
        registry.register(Box::new(successful_submissions.clone())).unwrap();
        registry.register(Box::new(failed_submissions.clone())).unwrap();
        registry.register(Box::new(successful_bundle_submissions.clone())).unwrap();
        registry.register(Box::new(failed_bundle_submissions.clone())).unwrap();
        registry.register(Box::new(simulated_profit.clone())).unwrap();
        registry.register(Box::new(transaction_build_duration.clone())).unwrap();
        registry.register(Box::new(signing_duration.clone())).unwrap();
        registry.register(Box::new(simulation_duration.clone())).unwrap();
        
        Self {
            registry,
            routing_duration,
            gas_estimation_duration,
            bundle_build_duration,
            submission_duration,
            total_execution_duration,
            flashbots_submission_duration,
            successful_submissions,
            failed_submissions,
            successful_bundle_submissions,
            failed_bundle_submissions,
            simulated_profit,
            transaction_build_duration,
            signing_duration,
            simulation_duration,
        }
    }
}