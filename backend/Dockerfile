# --- Builder stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Use corepack instead of npm install -g pnpm for better reproducibility
RUN corepack enable

# Set custom pnpm store directory for caching
ENV PNPM_STORE_DIR=/app/.pnpm-store

# Copy only package.json and pnpm-lock.yaml first to leverage caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies (cached unless package.json changes)
RUN pnpm install --frozen-lockfile

# Copy the rest of the project files AFTER deps (better cache)
COPY . .

# Build TypeScript code
RUN pnpm run build

# --- Runner stage ---
FROM node:20-alpine AS runner
WORKDIR /app

# Use corepack
RUN corepack enable
ENV NODE_ENV=production

# Set custom pnpm store directory
ENV PNPM_STORE_DIR=/app/.pnpm-store

# Copy only package.json and pnpm-lock.yaml for production deps
COPY package.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy build output from builder stage
COPY --from=builder /app/dist ./dist

# Drop privileges for security
USER node

# Expose the port your app runs on
EXPOSE 4000

# Start the application
CMD ["node", "dist/index.js"]
