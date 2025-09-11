FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

# Build-time args (different for frontend1 & frontend2 via compose build args)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_AUTH_URL

# Make them available during build so Next.js inlines them
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
  NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL} \
  NEXT_PUBLIC_AUTH_URL=${NEXT_PUBLIC_AUTH_URL}

# Improve network reliability for pnpm fetches inside Docker
ENV PNPM_FETCH_RETRIES=6 \
  PNPM_FETCH_RETRY_FACTOR=2 \
  PNPM_FETCH_RETRY_MINTIMEOUT=20000 \
  PNPM_FETCH_RETRY_MAXTIMEOUT=120000 \
  PNPM_NETWORK_CONCURRENCY=8

COPY package.json pnpm-lock.yaml* ./
# Add retries and lower concurrency to reduce npm registry socket hangups
RUN pnpm install --frozen-lockfile --network-concurrency ${PNPM_NETWORK_CONCURRENCY}
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

# Also keep the env vars at runtime (not strictly required for already inlined client code, but useful for server side fetches)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
  NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL} \
  NEXT_PUBLIC_AUTH_URL=${NEXT_PUBLIC_AUTH_URL}

EXPOSE 3000
ENV NODE_ENV=production
CMD ["pnpm", "start"]
