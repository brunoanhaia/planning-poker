# PlanItPoker — Client (Vite build + Nginx)
# Build context: repository root
#   docker build -f apps/client/Dockerfile -t planitpoker-client .
#   docker build -f apps/client/Dockerfile --build-arg VITE_WS_URL=wss://api.exemplo.com -t planitpoker-client .

FROM node:20-alpine AS builder

WORKDIR /app

# VITE_WS_URL is baked at build time. Leave empty to use same-origin
# (window.location.host), which pairs with the Nginx /ws proxy in compose.
ARG VITE_WS_URL=""
ENV VITE_WS_URL=${VITE_WS_URL}

# NOTE: only the workspaces needed to build the client are installed.
# apps/server (Express/ws) and apps/e2e (Playwright) must not bloat this
# build. `npm ci` resolves fine with a subset.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/client/package.json ./apps/client/
RUN npm ci --ignore-scripts

COPY packages/shared ./packages/shared
COPY apps/client ./apps/client
COPY tsconfig.base.json ./
RUN npm run build:shared && npm --workspace=@planitpoker/client run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# Final image contains ONLY: nginx.conf + static dist/ (no *.test.*,
# no setupTests, no e2e). Vite bundles just the imported app graph.
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
