# PlanItPoker — Server (Node 20 + Express + ws)
# Build context: repository root
#   docker build -f apps/server/Dockerfile -t planitpoker-server .
#
# Final image contains ONLY: prod node_modules + shared/dist + server/dist.
# No src/*.ts, no tests, no e2e, no devDependencies.

FROM node:20-alpine AS builder

WORKDIR /app

# NOTE: only the workspaces needed to build the server are installed.
# apps/client (React/MUI) and apps/e2e (Playwright) are test/UI-only and
# must not bloat this build. `npm ci` resolves fine with a subset.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN npm ci

# Copy only the sources required by tsc (tsconfig includes src/**/*,
# so tests/ directories are never compiled into dist/).
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/server/src ./apps/server/src
COPY apps/server/tsconfig.json ./apps/server/
COPY tsconfig.base.json ./
RUN npm run build:shared && npm --workspace=@planitpoker/server run build

FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /app

# Reinstall prod-only deps (no devDependencies, no test runners).
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN npm ci --omit=dev --ignore-scripts

# Runtime payload only — compiled output, never sources or tests.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:5000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

WORKDIR /app/apps/server

CMD ["node", "dist/index.js"]
