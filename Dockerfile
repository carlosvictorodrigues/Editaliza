# =========================================
# EDITALIZA - DOCKERFILE MULTI-STAGE
# Produção otimizada com segurança
# =========================================

# === ARGUMENTOS DE BUILD ===
ARG NODE_VERSION=18-alpine
ARG APP_USER=editaliza
ARG APP_UID=1001
ARG APP_GID=1001

# =========================================
# STAGE 1: BUILDER
# =========================================
FROM node:${NODE_VERSION} AS builder

# Labels para metadados
LABEL stage="builder"
LABEL maintainer="Editaliza Team"
LABEL description="Build stage for Editaliza application"

# Argumentos no builder
ARG APP_USER
ARG APP_UID
ARG APP_GID

# Instalar dependências do sistema necessárias para build
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root
RUN addgroup -g ${APP_GID} ${APP_USER} && \
    adduser -D -u ${APP_UID} -G ${APP_USER} ${APP_USER}

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências primeiro (otimização de cache)
COPY --chown=${APP_USER}:${APP_USER} package*.json ./

# Instalar dependências de produção
USER ${APP_USER}
RUN npm ci --only=production --no-audit --no-fund

# Copiar código fonte
USER root
COPY --chown=${APP_USER}:${APP_USER} . .

# Criar diretórios necessários com permissões corretas
RUN mkdir -p uploads logs data && \
    chown -R ${APP_USER}:${APP_USER} uploads logs data && \
    chmod 755 uploads logs data

# Voltar para usuário não-root
USER ${APP_USER}

# =========================================
# STAGE 2: RUNNER (PRODUÇÃO)
# =========================================
FROM node:${NODE_VERSION} AS runner

# Labels completos para produção
LABEL org.opencontainers.image.title="Editaliza"
LABEL org.opencontainers.image.description="Sistema inteligente de cronograma de estudos"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Editaliza Team"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.created="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

# Argumentos no runner
ARG APP_USER
ARG APP_UID
ARG APP_GID

# Instalar apenas dependências mínimas de runtime
RUN apk add --no-cache \
    sqlite \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root
RUN addgroup -g ${APP_GID} ${APP_USER} && \
    adduser -D -u ${APP_UID} -G ${APP_USER} ${APP_USER}

# Definir diretório de trabalho
WORKDIR /app

# Copiar aplicação do builder
COPY --from=builder --chown=${APP_USER}:${APP_USER} /app ./

# Criar diretórios de dados se não existirem
RUN mkdir -p uploads logs data && \
    chown -R ${APP_USER}:${APP_USER} uploads logs data && \
    chmod 755 uploads logs data

# Configurar variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expor porta
EXPOSE ${PORT}

# Volumes para dados persistentes
VOLUME ["/app/uploads", "/app/logs", "/app/data"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${PORT}/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Mudar para usuário não-root
USER ${APP_USER}

# Ponto de entrada com dumb-init para proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando padrão
CMD ["node", "server.js"]

# =========================================
# INSTRUÇÕES DE BUILD
# =========================================
# Build local:
# docker build -t editaliza:latest .
#
# Build multi-arch:
# docker buildx create --use
# docker buildx build --platform linux/amd64,linux/arm64 -t editaliza:latest .
#
# Run:
# docker run -d -p 3000:3000 --name editaliza editaliza:latest
# =========================================