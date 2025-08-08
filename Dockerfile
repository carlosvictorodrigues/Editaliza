# Multi-stage build for production optimization
# Stage 1: Build dependencies
FROM node:18-alpine AS dependencies

# Set working directory
WORKDIR /app

# Install security updates and create non-root user
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init sqlite && \
    addgroup -g 1001 -S nodejs && \
    adduser -S editaliza -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Production image
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init sqlite

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S editaliza -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from build stage
COPY --from=dependencies --chown=editaliza:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --chown=editaliza:nodejs package*.json ./
COPY --chown=editaliza:nodejs server.js ./
COPY --chown=editaliza:nodejs database.js ./
COPY --chown=editaliza:nodejs middleware.js ./
COPY --chown=editaliza:nodejs performance_middleware.js ./
COPY --chown=editaliza:nodejs performance_benchmark.js ./

# Copy static files
COPY --chown=editaliza:nodejs *.html ./
COPY --chown=editaliza:nodejs css/ ./css/
COPY --chown=editaliza:nodejs js/ ./js/

# Create directories for application data
RUN mkdir -p /app/data /app/logs && \
    chown -R editaliza:nodejs /app/data /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/database.db
ENV SESSION_SECRET_FILE=/run/secrets/session_secret
ENV JWT_SECRET_FILE=/run/secrets/jwt_secret

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http=require('http');http.get('http://localhost:3000/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Switch to non-root user
USER editaliza

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]