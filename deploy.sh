#!/bin/bash

# Editaliza Production Deploy Script
# Usage: ./deploy.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="editaliza"
DOCKER_IMAGE="$APP_NAME:latest"
CONTAINER_NAME="$APP_NAME-$ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Pre-deployment checks
pre_deploy_checks() {
    log "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
    fi
    
    # Check if required files exist
    required_files=("Dockerfile" "package.json" "server.js")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file $file not found"
        fi
    done
    
    # Check if secrets directory exists
    if [[ ! -d "secrets" ]]; then
        warn "Secrets directory not found. Creating..."
        mkdir -p secrets
        echo "Please add your secrets to the secrets/ directory before deployment"
    fi
    
    log "Pre-deployment checks passed"
}

# Build Docker image
build_image() {
    log "Building Docker image..."
    
    # Build the image
    docker build -t $DOCKER_IMAGE . || error "Failed to build Docker image"
    
    # Tag with timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    docker tag $DOCKER_IMAGE "$APP_NAME:$TIMESTAMP"
    
    log "Docker image built successfully: $DOCKER_IMAGE"
}

# Run tests in container
run_tests() {
    log "Running tests in container..."
    
    # Create test container
    docker run --rm \
        -v "$(pwd)/tests:/app/tests" \
        -e NODE_ENV=test \
        $DOCKER_IMAGE npm test || error "Tests failed"
    
    log "All tests passed"
}

# Deploy application
deploy_app() {
    log "Deploying application..."
    
    # Stop existing container if running
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        log "Stopping existing container..."
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
    fi
    
    # Start new container
    docker-compose -f docker-compose.yml up -d || error "Failed to start application"
    
    log "Application deployed successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for application to start
    sleep 10
    
    # Check if container is running
    if ! docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        error "Container is not running"
    fi
    
    # Check application health
    for i in {1..30}; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log "Health check passed"
            return 0
        fi
        sleep 2
    done
    
    error "Health check failed - application not responding"
}

# Cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Keep only last 3 versions
    docker images "$APP_NAME" --format "table {{.Tag}}\t{{.ID}}" | \
        grep -v latest | \
        tail -n +4 | \
        awk '{print $2}' | \
        xargs -r docker rmi
    
    log "Cleanup completed"
}

# Rollback function
rollback() {
    log "Rolling back to previous version..."
    
    # Get previous version
    PREVIOUS_VERSION=$(docker images "$APP_NAME" --format "{{.Tag}}" | grep -v latest | head -n 1)
    
    if [[ -z "$PREVIOUS_VERSION" ]]; then
        error "No previous version found for rollback"
    fi
    
    # Stop current container
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
    
    # Start previous version
    docker run -d \
        --name $CONTAINER_NAME \
        -p 3000:3000 \
        --env-file .env.$ENVIRONMENT \
        "$APP_NAME:$PREVIOUS_VERSION"
    
    log "Rollback completed to version: $PREVIOUS_VERSION"
}

# Main deployment flow
main() {
    log "Starting deployment process for environment: $ENVIRONMENT"
    
    case "${1:-deploy}" in
        "deploy")
            pre_deploy_checks
            build_image
            run_tests
            deploy_app
            health_check
            cleanup
            log "Deployment completed successfully!"
            ;;
        "rollback")
            rollback
            ;;
        "health-check")
            health_check
            ;;
        *)
            echo "Usage: $0 [deploy|rollback|health-check]"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'error "Deployment interrupted"' INT TERM

# Run main function
main $@