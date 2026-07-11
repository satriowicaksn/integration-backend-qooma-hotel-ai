# syntax=docker/dockerfile:1.7
# =============================================================================
# Qooma Backend Service — Multi-stage Dockerfile
# =============================================================================
# Satu Dockerfile menghasilkan 2 image runtime: api, worker.
# Pilih target lewat `docker build --target <api|worker>`.
#
# Service yang butuh process tambahan (SMTP, gRPC) tambah stage sendiri.
# =============================================================================

ARG NODE_VERSION=20.18-alpine

# --- Stage 1: deps ----------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prod=false

# --- Stage 2: prisma generate -----------------------------------------------
FROM deps AS prisma
COPY prisma ./prisma
RUN pnpm prisma:generate

# --- Stage 3: build ---------------------------------------------------------
FROM prisma AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm build

# --- Stage 4: prod-deps (prune dev deps) ------------------------------------
FROM node:${NODE_VERSION} AS prod-deps
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prod=true
COPY prisma ./prisma
RUN pnpm prisma:generate

# --- Stage 5a: api runtime --------------------------------------------------
FROM node:${NODE_VERSION} AS api
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini openssl && addgroup -S app && adduser -S app -G app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --chown=app:app package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --spider --tries=1 http://localhost:3000/healthz || exit 1
LABEL org.opencontainers.image.source="https://github.com/satriowicaksn/integration-backend-qooma-hotel-ai"
LABEL org.opencontainers.image.title="qooma-integration-backend-api"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/entrypoints/api.js"]

# --- Stage 5b: worker runtime -----------------------------------------------
FROM node:${NODE_VERSION} AS worker
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini openssl && addgroup -S app && adduser -S app -G app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --chown=app:app package.json ./
USER app
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/entrypoints/worker.js"]
