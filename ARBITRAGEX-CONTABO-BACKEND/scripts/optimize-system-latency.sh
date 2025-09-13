#!/bin/bash
# ArbitrageX Supreme V3.0 - System & Network Optimization Script
# Ingenio Pichichi S.A. - Ultra-Low Latency System Tuning
# Target: Squeeze every millisecond for <100ms P95 E2E

set -euo pipefail

# 🎨 Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# 🔐 Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root for system optimizations"
    fi
    success "Running as root - proceeding with system optimizations"
}

# 🧠 CPU Optimizations
optimize_cpu() {
    log "🧠 Applying CPU optimizations for ultra-low latency..."
    
    # Disable CPU frequency scaling for consistent performance
    echo "performance" > /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor 2>/dev/null || true
    success "Set CPU governor to 'performance' mode"
    
    # Disable CPU idle states (prevents deep sleep)
    echo 1 > /sys/devices/system/cpu/cpu*/cpuidle/state*/disable 2>/dev/null || true
    success "Disabled CPU idle states for consistent latency"
    
    # Set CPU affinity for interrupt handling
    if [[ -f /proc/irq/default_smp_affinity ]]; then
        echo "f" > /proc/irq/default_smp_affinity
        success "Optimized default SMP affinity"
    fi
    
    # Disable transparent huge pages (can cause latency spikes)
    echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
    echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true
    success "Disabled transparent huge pages"
}

# 🌐 Network Stack Optimizations
optimize_network() {
    log "🌐 Applying network stack optimizations..."
    
    # TCP congestion control - BBR for better throughput and lower latency
    modprobe tcp_bbr 2>/dev/null || true
    sysctl -w net.core.default_qdisc=fq
    sysctl -w net.ipv4.tcp_congestion_control=bbr
    success "Enabled BBR congestion control"
    
    # Increase network buffer sizes
    sysctl -w net.core.rmem_max=134217728           # 128MB receive buffer
    sysctl -w net.core.wmem_max=134217728           # 128MB send buffer
    sysctl -w net.core.rmem_default=87380
    sysctl -w net.core.wmem_default=65536
    sysctl -w net.ipv4.tcp_rmem="4096 87380 134217728"
    sysctl -w net.ipv4.tcp_wmem="4096 65536 134217728"
    success "Optimized network buffer sizes"
    
    # TCP optimizations for low latency
    sysctl -w net.ipv4.tcp_window_scaling=1         # Enable window scaling
    sysctl -w net.ipv4.tcp_timestamps=1             # Enable timestamps
    sysctl -w net.ipv4.tcp_sack=1                   # Enable selective acknowledgments
    sysctl -w net.ipv4.tcp_no_metrics_save=1       # Don't cache connection metrics
    sysctl -w net.ipv4.tcp_moderate_rcvbuf=1       # Auto-tune receive buffer
    success "Applied TCP optimizations"
    
    # Reduce TIME_WAIT connections
    sysctl -w net.ipv4.tcp_tw_reuse=1              # Reuse TIME_WAIT sockets
    sysctl -w net.ipv4.tcp_fin_timeout=15          # Reduce FIN timeout
    sysctl -w net.ipv4.tcp_keepalive_time=1800     # Keep-alive timeout
    sysctl -w net.ipv4.tcp_keepalive_probes=7      # Keep-alive probes
    sysctl -w net.ipv4.tcp_keepalive_intvl=30      # Keep-alive interval
    success "Optimized connection lifecycle"
    
    # Increase connection tracking limits
    sysctl -w net.netfilter.nf_conntrack_max=1048576
    sysctl -w net.netfilter.nf_conntrack_tcp_timeout_established=86400
    success "Increased connection tracking limits"
    
    # Optimize local port range
    sysctl -w net.ipv4.ip_local_port_range="1024 65535"
    success "Optimized local port range"
    
    # Enable RPS/RFS for multi-queue network processing
    for cpu_dir in /sys/class/net/*/queues/rx-*/rps_cpus; do
        [[ -f "$cpu_dir" ]] && echo "f" > "$cpu_dir" 2>/dev/null || true
    done
    success "Enabled RPS for multi-queue processing"
}

# 💾 Memory Optimizations
optimize_memory() {
    log "💾 Applying memory optimizations..."
    
    # Reduce swappiness for latency-critical applications
    sysctl -w vm.swappiness=1
    success "Set swappiness to 1 (avoid swap unless critical)"
    
    # Optimize dirty page handling
    sysctl -w vm.dirty_ratio=15                     # 15% of memory before sync writes
    sysctl -w vm.dirty_background_ratio=5           # 5% background writeback
    sysctl -w vm.dirty_expire_centisecs=1500        # 15s expiry for dirty pages
    sysctl -w vm.dirty_writeback_centisecs=500      # 5s writeback interval
    success "Optimized dirty page handling"
    
    # Memory allocation optimizations
    sysctl -w vm.zone_reclaim_mode=0                # Disable zone reclaim
    sysctl -w vm.vfs_cache_pressure=50              # Reduce VFS cache pressure
    success "Optimized memory allocation"
    
    # Huge pages configuration (if available)
    if [[ -f /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages ]]; then
        echo 1024 > /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages
        success "Allocated 2GB of huge pages"
    fi
}

# ⏱️ Scheduler Optimizations
optimize_scheduler() {
    log "⏱️ Applying scheduler optimizations..."
    
    # Set kernel scheduler for low latency
    if [[ -f /sys/kernel/debug/sched_features ]]; then
        echo "NO_NEW_FAIR_SLEEPERS" > /sys/kernel/debug/sched_features 2>/dev/null || true
        echo "NO_NORMALIZED_SLEEPER" > /sys/kernel/debug/sched_features 2>/dev/null || true
        success "Applied scheduler optimizations"
    fi
    
    # Reduce kernel timer frequency for lower overhead
    if [[ -f /proc/sys/kernel/timer_migration ]]; then
        echo 0 > /proc/sys/kernel/timer_migration
        success "Disabled timer migration"
    fi
}

# 🐳 Docker Optimizations
optimize_docker() {
    log "🐳 Applying Docker optimizations for containers..."
    
    # Docker daemon optimization
    local docker_config="/etc/docker/daemon.json"
    if [[ ! -f "$docker_config" ]] || ! grep -q "live-restore" "$docker_config" 2>/dev/null; then
        cat > "$docker_config" << 'EOF'
{
  "live-restore": true,
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 10,
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 1048576,
      "Soft": 1048576
    },
    "memlock": {
      "Name": "memlock",
      "Hard": -1,
      "Soft": -1
    }
  }
}
EOF
        success "Created optimized Docker daemon configuration"
        
        # Restart Docker daemon if running
        if systemctl is-active --quiet docker; then
            warning "Docker daemon configuration updated - restart required"
            systemctl restart docker
            success "Docker daemon restarted with optimizations"
        fi
    fi
}

# 🔧 System Limits Optimization  
optimize_limits() {
    log "🔧 Optimizing system limits for high-performance trading..."
    
    # Update limits.conf for high file descriptors and memory limits
    local limits_conf="/etc/security/limits.conf"
    
    # Backup original if it exists
    [[ -f "$limits_conf" ]] && cp "$limits_conf" "${limits_conf}.backup.$(date +%s)" 2>/dev/null || true
    
    cat >> "$limits_conf" << 'EOF'

# ArbitrageX Supreme V3.0 - Ultra-Low Latency Limits
# Added by optimize-system-latency.sh

* soft nofile 1048576
* hard nofile 1048576
* soft nproc 1048576
* hard nproc 1048576
* soft memlock unlimited
* hard memlock unlimited
* soft as unlimited
* hard as unlimited

root soft nofile 1048576
root hard nofile 1048576
root soft nproc 1048576
root hard nproc 1048576
EOF
    
    success "Updated system limits for high performance"
    
    # Update systemd limits
    local systemd_conf="/etc/systemd/system.conf"
    if [[ -f "$systemd_conf" ]]; then
        sed -i 's/#DefaultLimitNOFILE=.*/DefaultLimitNOFILE=1048576/' "$systemd_conf"
        sed -i 's/#DefaultLimitMEMLOCK=.*/DefaultLimitMEMLOCK=infinity/' "$systemd_conf"
        success "Updated systemd limits"
    fi
}

# 📊 Performance Monitoring Setup
setup_monitoring() {
    log "📊 Setting up performance monitoring tools..."
    
    # Install performance monitoring tools if available
    local tools=("htop" "iotop" "nethogs" "ss" "tcpdump" "perf")
    for tool in "${tools[@]}"; do
        if command -v "$tool" &> /dev/null; then
            success "$tool is available"
        else
            warning "$tool not found - consider installing for monitoring"
        fi
    done
    
    # Create monitoring script for continuous latency tracking
    cat > /usr/local/bin/arbitragex-monitor << 'EOF'
#!/bin/bash
# ArbitrageX Continuous Latency Monitor

LOGFILE="/var/log/arbitragex-latency.log"

while true; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # CPU usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # Memory usage
    mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    
    # Network connections
    connections=$(ss -s | grep TCP | awk '{print $2}')
    
    # Load average
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    echo "$timestamp,CPU:$cpu_usage%,MEM:$mem_usage%,CONN:$connections,LOAD:$load_avg" >> "$LOGFILE"
    
    sleep 10
done
EOF
    
    chmod +x /usr/local/bin/arbitragex-monitor
    success "Created continuous monitoring script"
}

# 💾 Make optimizations persistent
make_persistent() {
    log "💾 Making optimizations persistent across reboots..."
    
    # Create sysctl configuration
    cat > /etc/sysctl.d/99-arbitragex-optimizations.conf << 'EOF'
# ArbitrageX Supreme V3.0 - Persistent System Optimizations
# Generated by optimize-system-latency.sh

# Network optimizations
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.rmem_default = 87380
net.core.wmem_default = 65536
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_sack = 1
net.ipv4.tcp_no_metrics_save = 1
net.ipv4.tcp_moderate_rcvbuf = 1
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 1800
net.ipv4.tcp_keepalive_probes = 7
net.ipv4.tcp_keepalive_intvl = 30
net.netfilter.nf_conntrack_max = 1048576
net.netfilter.nf_conntrack_tcp_timeout_established = 86400
net.ipv4.ip_local_port_range = 1024 65535

# Memory optimizations
vm.swappiness = 1
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.dirty_expire_centisecs = 1500
vm.dirty_writeback_centisecs = 500
vm.zone_reclaim_mode = 0
vm.vfs_cache_pressure = 50
EOF
    
    success "Created persistent sysctl configuration"
    
    # Create systemd service for CPU optimizations that require runtime setting
    cat > /etc/systemd/system/arbitragex-cpu-optimize.service << 'EOF'
[Unit]
Description=ArbitrageX CPU Optimizations
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'echo performance > /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor'
ExecStart=/bin/bash -c 'echo 1 > /sys/devices/system/cpu/cpu*/cpuidle/state*/disable'
ExecStart=/bin/bash -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'
ExecStart=/bin/bash -c 'echo never > /sys/kernel/mm/transparent_hugepage/defrag'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl enable arbitragex-cpu-optimize.service
    success "Created and enabled CPU optimization service"
}

# 🎯 Validation and Performance Testing
validate_optimizations() {
    log "🎯 Validating applied optimizations..."
    
    # Check CPU governor
    local cpu_governor=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "unknown")
    if [[ "$cpu_governor" == "performance" ]]; then
        success "CPU governor: $cpu_governor ✅"
    else
        warning "CPU governor: $cpu_governor (expected: performance)"
    fi
    
    # Check BBR congestion control
    local tcp_cc=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo "unknown")
    if [[ "$tcp_cc" == "bbr" ]]; then
        success "TCP congestion control: $tcp_cc ✅"
    else
        warning "TCP congestion control: $tcp_cc (expected: bbr)"
    fi
    
    # Check transparent huge pages
    local thp_status=$(cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || echo "unknown")
    if [[ "$thp_status" == *"[never]"* ]]; then
        success "Transparent huge pages: disabled ✅"
    else
        warning "Transparent huge pages: $thp_status (expected: disabled)"
    fi
    
    # Network buffer sizes
    local rmem_max=$(sysctl -n net.core.rmem_max 2>/dev/null || echo "0")
    if [[ "$rmem_max" -ge 134217728 ]]; then
        success "Network receive buffer: $rmem_max bytes ✅"
    else
        warning "Network receive buffer: $rmem_max bytes (expected: ≥134217728)"
    fi
    
    log "🏁 Optimization validation completed"
}

# 📋 Main function
main() {
    log "🚀 ArbitrageX Supreme V3.0 - System Optimization for Ultra-Low Latency"
    log "🎯 Target: Squeeze every millisecond for <100ms P95 E2E"
    log "🏢 Ingenio Pichichi S.A. - Methodical, Disciplined, Organized"
    
    check_root
    
    # Apply optimizations
    optimize_cpu
    optimize_network
    optimize_memory
    optimize_scheduler
    optimize_docker
    optimize_limits
    setup_monitoring
    make_persistent
    
    # Validate results
    validate_optimizations
    
    success "🎉 System optimization completed successfully!"
    warning "🔄 Reboot recommended to ensure all optimizations take full effect"
    log "📊 Monitor performance with: /usr/local/bin/arbitragex-monitor"
    log "📝 Logs will be written to: /var/log/arbitragex-latency.log"
    
    log "🏁 Optimization completed in $SECONDS seconds"
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi