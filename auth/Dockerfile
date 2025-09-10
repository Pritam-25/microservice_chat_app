FROM node:20-alpine AS builder
WORKDIR /app
# Pin pnpm via Corepack for reproducible builds
RUN corepack enable

# Set custom pnpm store directory for caching
ENV PNPM_STORE_DIR=/app/.pnpm-store

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable

# Set custom pnpm store directory
ENV PNPM_STORE_DIR=/app/.pnpm-store

COPY package.json pnpm-lock.yaml* ./
# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
# Drop privileges
USER node
EXPOSE 5000
CMD ["node", "dist/index.js"]
