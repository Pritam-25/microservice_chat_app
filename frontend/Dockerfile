FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

# Set custom pnpm store directory for caching
ENV PNPM_STORE_DIR=/app/.pnpm-store

# Build-time args (different for frontend1 & frontend2 via compose build args)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_AUTH_URL

# Make them available during build so Next.js inlines them
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
  NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL} \
  NEXT_PUBLIC_AUTH_URL=${NEXT_PUBLIC_AUTH_URL}

# Install dependencies first (cached unless package.json changes)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source AFTER deps (so code changes don't invalidate deps layer)
COPY . .
RUN pnpm build

# Prune dev dependencies to shrink runtime
RUN pnpm prune --prod

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable

# Copy production artifacts & deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

# Runtime environment variables (for SSR/server-side calls)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG INTERNAL_API_URL
ARG INTERNAL_SOCKET_URL
ARG INTERNAL_AUTH_URL

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
  NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL} \
  NEXT_PUBLIC_AUTH_URL=${NEXT_PUBLIC_AUTH_URL} \
  INTERNAL_API_URL=${INTERNAL_API_URL} \
  INTERNAL_SOCKET_URL=${INTERNAL_SOCKET_URL} \
  INTERNAL_AUTH_URL=${INTERNAL_AUTH_URL}

EXPOSE 3000
ENV NODE_ENV=production
CMD ["pnpm", "start"]
