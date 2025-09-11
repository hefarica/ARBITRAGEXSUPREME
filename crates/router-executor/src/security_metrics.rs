// Security Metrics Collector
use prometheus::{Counter, Histogram, Gauge, Registry};
use std::sync::Arc;

pub struct SecurityMetrics {
    pub registry: Registry,
    
    // EIP-712 metrics
    pub signature_validations_total: Counter,
    pub signature_validation_errors: Counter,
    pub signature_validation_duration: Histogram,
    
    // MEV Protection metrics
    pub mev_protection_activations: Counter,
    pub flashbots_bundle_submissions: Counter,
    pub flashbots_bundle_inclusions: Counter,
    pub mev_savings_total: Gauge,
    
    // Security alerts
    pub security_alerts_total: Counter,
    pub front_running_attempts_detected: Counter,
    pub replay_attacks_prevented: Counter,
}

impl SecurityMetrics {
    pub fn new() -> Self {
        let registry = Registry::new();
        
        let signature_validations_total = Counter::new(
            "signature_validations_total",
            "Total number of EIP-712 signature validations"
        ).unwrap();
        
        let signature_validation_errors = Counter::new(
            "signature_validation_errors_total",
            "Total number of signature validation errors"
        ).unwrap();
        
        let signature_validation_duration = Histogram::new(
            "signature_validation_duration_ms",
            "Duration of signature validation in milliseconds"
        ).unwrap();
        
        let mev_protection_activations = Counter::new(
            "mev_protection_activations_total",
            "Total number of MEV protection activations"
        ).unwrap();
        
        let flashbots_bundle_submissions = Counter::new(
            "flashbots_bundle_submissions_total",
            "Total number of Flashbots bundle submissions"
        ).unwrap();
        
        let flashbots_bundle_inclusions = Counter::new(
            "flashbots_bundle_inclusions_total",
            "Total number of included Flashbots bundles"
        ).unwrap();
        
        let mev_savings_total = Gauge::new(
            "mev_savings_total_wei",
            "Total MEV savings in wei"
        ).unwrap();
        
        let security_alerts_total = Counter::new(
            "security_alerts_total",
            "Total number of security alerts"
        ).unwrap();
        
        let front_running_attempts_detected = Counter::new(
            "front_running_attempts_detected_total",
            "Total number of detected front-running attempts"
        ).unwrap();
        
        let replay_attacks_prevented = Counter::new(
            "replay_attacks_prevented_total",
            "Total number of prevented replay attacks"
        ).unwrap();
        
        // Register metrics
        registry.register(Box::new(signature_validations_total.clone())).unwrap();
        registry.register(Box::new(signature_validation_errors.clone())).unwrap();
        registry.register(Box::new(signature_validation_duration.clone())).unwrap();
        registry.register(Box::new(mev_protection_activations.clone())).unwrap();
        registry.register(Box::new(flashbots_bundle_submissions.clone())).unwrap();
        registry.register(Box::new(flashbots_bundle_inclusions.clone())).unwrap();
        registry.register(Box::new(mev_savings_total.clone())).unwrap();
        registry.register(Box::new(security_alerts_total.clone())).unwrap();
        registry.register(Box::new(front_running_attempts_detected.clone())).unwrap();
        registry.register(Box::new(replay_attacks_prevented.clone())).unwrap();
        
        Self {
            registry,
            signature_validations_total,
            signature_validation_errors,
            signature_validation_duration,
            mev_protection_activations,
            flashbots_bundle_submissions,
            flashbots_bundle_inclusions,
            mev_savings_total,
            security_alerts_total,
            front_running_attempts_detected,
            replay_attacks_prevented,
        }
    }
}
