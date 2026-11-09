# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:24-alpine AS build
WORKDIR /app

# pnpm version comes from "packageManager" in package.json
RUN corepack enable

# Install deps with a clean, reproducible install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Type-check (src + test) and build the static site
COPY . .
RUN pnpm run build

# --- Runtime stage ---
# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

# Static assets
COPY --from=build /app/dist /usr/share/nginx/html
# Server config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
