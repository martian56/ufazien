# Multi-stage build for React frontend

# Build stage. Bun installs and runs the scripts; Vite still does the bundling,
# so the output is unchanged.
FROM oven/bun:1-alpine AS builder

# Set working directory
WORKDIR /app

# Copy manifest and lockfile
COPY package.json bun.lock ./

# Install all dependencies (including dev dependencies for build).
# Frozen, so a deploy never silently resolves different versions than CI did.
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
