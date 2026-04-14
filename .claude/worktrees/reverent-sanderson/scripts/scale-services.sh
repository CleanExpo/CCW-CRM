#!/bin/bash
# Service Scaling Script for CCW-Online ERP
# Version: 1.0
# Description: Manual and automated service scaling for Docker Swarm/Compose
# Related: ISS-D045

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
MIN_REPLICAS=2
MAX_REPLICAS=10
DEFAULT_REPLICAS=3

# Scaling thresholds
CPU_SCALE_OUT_THRESHOLD=70
CPU_SCALE_IN_THRESHOLD=30
MEMORY_SCALE_OUT_THRESHOLD=80
MEMORY_SCALE_IN_THRESHOLD=40

# Function to display usage
usage() {
    cat <<EOF
Usage: $0 <service> <action> [options]

Scale CCW-Online ERP services manually or automatically.

SERVICES:
    backend         FastAPI backend service
    frontend        Next.js frontend service
    all             Both frontend and backend

ACTIONS:
    <number>        Scale to specific number of replicas (2-10)
    up              Scale up by 1 replica
    down            Scale down by 1 replica
    status          Show current scaling status
    auto            Auto-scale based on current metrics
    reset           Reset to default scaling (3 replicas)

OPTIONS:
    --min N         Set minimum replicas (default: 2)
    --max N         Set maximum replicas (default: 10)
    --force         Skip confirmation prompts

EXAMPLES:
    # Scale backend to 5 replicas
    $0 backend 5

    # Scale up backend by 1
    $0 backend up

    # Auto-scale based on metrics
    $0 backend auto

    # Show current status
    $0 backend status

    # Scale all services to 4
    $0 all 4

EOF
    exit 1
}

# Function to detect deployment type
detect_deployment() {
    if command -v docker &> /dev/null; then
        if docker info 2>/dev/null | grep -q "Swarm: active"; then
            echo "swarm"
        elif [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
            echo "compose"
        else
            echo "unknown"
        fi
    else
        echo "none"
    fi
}

# Function to get current replica count
get_current_replicas() {
    local service=$1
    local deployment_type=$(detect_deployment)

    case $deployment_type in
        swarm)
            docker service ls --filter name="$service" --format "{{.Replicas}}" | cut -d'/' -f1
            ;;
        compose)
            docker compose ps "$service" --format json 2>/dev/null | jq length || echo "0"
            ;;
        *)
            echo "0"
            ;;
    esac
}

# Function to scale service
scale_service() {
    local service=$1
    local replicas=$2
    local deployment_type=$(detect_deployment)

    log_step "Scaling $service to $replicas replicas..."

    case $deployment_type in
        swarm)
            # Docker Swarm scaling
            if docker service scale "${service}=${replicas}"; then
                log_info "Scaled $service to $replicas replicas (Swarm)"
            else
                log_error "Failed to scale $service"
                return 1
            fi
            ;;
        compose)
            # Docker Compose scaling
            if docker compose up -d --scale "$service=$replicas" --no-recreate; then
                log_info "Scaled $service to $replicas replicas (Compose)"
            else
                log_error "Failed to scale $service"
                return 1
            fi
            ;;
        *)
            log_error "Unable to detect deployment type. Is Docker running?"
            return 1
            ;;
    esac
}

# Function to get service metrics
get_service_metrics() {
    local service=$1
    local deployment_type=$(detect_deployment)

    log_info "Gathering metrics for $service..."

    # Get CPU usage
    CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" \
        $(docker ps --filter "name=$service" --format "{{.ID}}") 2>/dev/null | \
        sed 's/%//g' | awk '{sum+=$1; count++} END {if (count>0) print sum/count; else print 0}')

    # Get memory usage
    MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemPerc}}" \
        $(docker ps --filter "name=$service" --format "{{.ID}}") 2>/dev/null | \
        sed 's/%//g' | awk '{sum+=$1; count++} END {if (count>0) print sum/count; else print 0}')

    # Round to integer
    CPU_USAGE=$(printf "%.0f" "$CPU_USAGE" 2>/dev/null || echo "0")
    MEMORY_USAGE=$(printf "%.0f" "$MEMORY_USAGE" 2>/dev/null || echo "0")

    echo "CPU:${CPU_USAGE}%,Memory:${MEMORY_USAGE}%"
}

# Function to calculate recommended scale
calculate_recommended_scale() {
    local service=$1
    local current_replicas=$2

    # Get metrics
    metrics=$(get_service_metrics "$service")
    cpu=$(echo "$metrics" | cut -d',' -f1 | cut -d':' -f2 | sed 's/%//')
    memory=$(echo "$metrics" | cut -d',' -f2 | cut -d':' -f2 | sed 's/%//')

    log_info "Current metrics - CPU: ${cpu}%, Memory: ${memory}%"

    # Calculate recommended replicas
    local recommended=$current_replicas

    # Scale out conditions
    if [ "$cpu" -gt "$CPU_SCALE_OUT_THRESHOLD" ] || [ "$memory" -gt "$MEMORY_SCALE_OUT_THRESHOLD" ]; then
        log_warn "High resource usage detected"
        if [ "$cpu" -gt 90 ] || [ "$memory" -gt 90 ]; then
            recommended=$((current_replicas + 2))  # Add 2 if critical
            log_warn "Critical levels - recommending +2 replicas"
        else
            recommended=$((current_replicas + 1))  # Add 1 if high
            log_warn "High levels - recommending +1 replica"
        fi
    # Scale in conditions
    elif [ "$cpu" -lt "$CPU_SCALE_IN_THRESHOLD" ] && [ "$memory" -lt "$MEMORY_SCALE_IN_THRESHOLD" ]; then
        if [ "$current_replicas" -gt "$MIN_REPLICAS" ]; then
            recommended=$((current_replicas - 1))
            log_info "Low resource usage - recommending -1 replica"
        fi
    else
        log_info "Resource usage is optimal - no scaling recommended"
    fi

    # Enforce limits
    if [ "$recommended" -lt "$MIN_REPLICAS" ]; then
        recommended=$MIN_REPLICAS
    elif [ "$recommended" -gt "$MAX_REPLICAS" ]; then
        recommended=$MAX_REPLICAS
    fi

    echo "$recommended"
}

# Function to show service status
show_status() {
    local service=$1
    local deployment_type=$(detect_deployment)

    log_info "Service: $service"
    log_info "Deployment Type: $deployment_type"

    case $deployment_type in
        swarm)
            docker service ps "$service" --format "table {{.Name}}\t{{.CurrentState}}\t{{.Node}}"
            echo ""
            docker service ls --filter name="$service"
            ;;
        compose)
            docker compose ps "$service"
            ;;
        *)
            log_error "Unable to get status - Docker not detected"
            return 1
            ;;
    esac

    # Show metrics
    metrics=$(get_service_metrics "$service")
    cpu=$(echo "$metrics" | cut -d',' -f1 | cut -d':' -f2)
    memory=$(echo "$metrics" | cut -d',' -f2 | cut -d':' -f2)

    echo ""
    log_info "Current Metrics:"
    echo "  CPU Usage: $cpu"
    echo "  Memory Usage: $memory"

    # Show current replica count
    current=$(get_current_replicas "$service")
    echo ""
    log_info "Scaling Configuration:"
    echo "  Current Replicas: $current"
    echo "  Min Replicas: $MIN_REPLICAS"
    echo "  Max Replicas: $MAX_REPLICAS"
}

# Function to auto-scale
auto_scale() {
    local service=$1
    local force=${2:-false}

    log_step "Auto-scaling $service based on metrics..."

    current=$(get_current_replicas "$service")
    recommended=$(calculate_recommended_scale "$service" "$current")

    if [ "$current" -eq "$recommended" ]; then
        log_info "No scaling needed - current replicas ($current) is optimal"
        return 0
    fi

    log_info "Recommended scaling: $current → $recommended replicas"

    if [ "$force" != "true" ]; then
        read -p "Proceed with auto-scaling? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warn "Auto-scaling cancelled"
            return 0
        fi
    fi

    scale_service "$service" "$recommended"
}

# Function to validate replica count
validate_replicas() {
    local replicas=$1

    if ! [[ "$replicas" =~ ^[0-9]+$ ]]; then
        log_error "Invalid replica count: $replicas (must be a number)"
        return 1
    fi

    if [ "$replicas" -lt "$MIN_REPLICAS" ]; then
        log_error "Replica count too low: $replicas (minimum: $MIN_REPLICAS)"
        return 1
    fi

    if [ "$replicas" -gt "$MAX_REPLICAS" ]; then
        log_error "Replica count too high: $replicas (maximum: $MAX_REPLICAS)"
        return 1
    fi

    return 0
}

# Main execution
main() {
    if [ $# -lt 2 ]; then
        usage
    fi

    local service=$1
    local action=$2
    local force=false

    # Parse options
    shift 2
    while [[ $# -gt 0 ]]; do
        case $1 in
            --min)
                MIN_REPLICAS=$2
                shift 2
                ;;
            --max)
                MAX_REPLICAS=$2
                shift 2
                ;;
            --force)
                force=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done

    # Map service names
    case $service in
        backend)
            service="ccw-backend"
            ;;
        frontend)
            service="ccw-frontend"
            ;;
        all)
            log_info "Scaling all services..."
            $0 backend "$action" ${force:+--force}
            $0 frontend "$action" ${force:+--force}
            return 0
            ;;
        *)
            log_error "Unknown service: $service"
            usage
            ;;
    esac

    # Detect deployment type
    deployment=$(detect_deployment)
    if [ "$deployment" = "none" ] || [ "$deployment" = "unknown" ]; then
        log_error "Docker not detected or not configured properly"
        exit 1
    fi

    log_info "Detected deployment: $deployment"

    # Execute action
    case $action in
        status)
            show_status "$service"
            ;;
        auto)
            auto_scale "$service" "$force"
            ;;
        up)
            current=$(get_current_replicas "$service")
            new_replicas=$((current + 1))
            if validate_replicas "$new_replicas"; then
                scale_service "$service" "$new_replicas"
            fi
            ;;
        down)
            current=$(get_current_replicas "$service")
            new_replicas=$((current - 1))
            if validate_replicas "$new_replicas"; then
                scale_service "$service" "$new_replicas"
            fi
            ;;
        reset)
            scale_service "$service" "$DEFAULT_REPLICAS"
            ;;
        [0-9]*)
            if validate_replicas "$action"; then
                scale_service "$service" "$action"
            fi
            ;;
        *)
            log_error "Unknown action: $action"
            usage
            ;;
    esac

    log_info "Scaling operation completed"
}

# Run main function
main "$@"
