# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests AND prisma schema before npm ci.
# postinstall runs `prisma generate` automatically — schema must exist first.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy source and compile TypeScript
COPY . .
RUN npm run build

# Verify the build produced the entry point
RUN test -f dist/src/main.js || (echo "ERROR: dist/src/main.js not found. Actual dist contents:" && find dist -name "*.js" | head -20 && exit 1)

# Prune dev dependencies
RUN npm prune --omit=dev

# ============================================================
# Stage 2: Production image
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

# Copy only what's needed at runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000

# dumb-init ensures SIGTERM propagates correctly (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]