# Use an official Node.js LTS image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy only package.json and pnpm-lock.yaml first to leverage caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the project files
COPY . .

# Build TypeScript code
RUN pnpm run build

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
