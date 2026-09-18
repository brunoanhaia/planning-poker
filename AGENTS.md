# PlanItPoker — Agent Notes

A compact source of truth for OpenCode sessions. Prefer this over README.md prose when they conflict with config or scripts.

## Monorepo Layout

npm workspaces monorepo:

- `apps/client` — React 19 + Vite + MUI, package name `@planitpoker/client`
- `apps/server` — Node + Express + native `ws`, package name `@planitpoker/server`
- `apps/e2e` — Playwright + Axe-core, package name `@planitpoker/e2e`
- `packages/shared` — TypeScript types, enums, constants, package name `@planitpoker/shared`

All WebSocket message types and domain models live in `packages/shared/src/index.ts`. Treat it as the source of truth; do not redefine event payloads locally.

## Development

There is **no** root `npm run dev` script (README is stale). Start both sides separately:

```bash
npm run dev:server   # Express + ws on http://localhost:5000
npm run dev:client   # Vite on http://localhost:5173
```

- Client proxies `/ws` to `ws://localhost:5000` in dev via `apps/client/vite.config.ts`.
- Server default port is `5000`, not `3000` (`process.env.PORT || 5000`).
- Server CORS origins come from `ALLOWED_ORIGINS` env var; default allows `http://localhost:5173`.
- Devcontainer (`.devcontainer/devcontainer.json` + `.devcontainer/Dockerfile`): Node 24 LTS image (same major as prod Dockerfiles; client vitest/jsdom+undici is broken on Node 20.19 workers). Chromium OS deps are baked into the image so `postCreateCommand` only runs `npm ci` + `build:shared` + Playwright browser download; ports 5000/5173 forwarded.

## Build

`@planitpoker/shared` must be built before dependent apps because it is consumed from `dist/`:

```bash
npm run build:shared
npm run build          # builds shared + all apps with a build script
```

## Test

```bash
npm run test                  # all workspaces with tests
npm --workspace=@planitpoker/server run test
npm --workspace=@planitpoker/client run test
npm --workspace=@planitpoker/e2e run test
```

- E2E `playwright.config.ts` auto-starts `npm run dev:server` (port 5000) and `npm run dev:client` (port 5173) with `reuseExistingServer` outside CI.
- E2E base URL is `http://localhost:5173`.

## Lint / Format

```bash
npm run lint             # all workspaces
npm run format           # prettier across repo
```

- Prettier config: 4 spaces, single quotes, `printWidth: 100`, trailing commas `es5`.
- ESLint allows `@typescript-eslint/no-explicit-any: off` in all packages.
- `vitest/no-focused-tests` is an error in client/server.
- Imports are sorted with `perfectionist/sort-imports`.

## Environment Variables

- Server: `PORT`, `ALLOWED_ORIGINS` (comma-separated)
- Client: `VITE_WS_URL` (production WebSocket URL, e.g. `wss://...`; empty = same-origin via Nginx `/ws` proxy). Baked at build time (`--build-arg VITE_WS_URL=...`).
- Compose: `SERVER_PORT`, `CLIENT_PORT` (host port mappings). See `.env.example`.

## Deployment

Primary path is **containers** (build context = repo root):

```bash
cp .env.example .env
docker compose up --build   # client :80, server :5000
```

- **Server image**: `apps/server/Dockerfile` (Node 24 multi-stage, `HEALTHCHECK` on `/api/health`, runs `node dist/index.js` as `node` user).
- **Client image**: `apps/client/Dockerfile` (Vite build + `nginxinc/nginx-unprivileged:1.27-alpine` as `nginx` user on `:8080`, config in `apps/client/nginx.conf`). Nginx serves the SPA with fallback to `index.html` and proxies `/api/*` + `/ws` (with `Upgrade`) to the `server` service.

## Style & Conventions

Project conventions previously in GEMINI.md:

- Clean code: early returns, explicit `if` blocks, meaningful names, minimal `let`.
- No magic values or deprecated APIs; extract constants and use modern equivalents.
- Strict literal typing: prefer enums or string literal unions over generic `string`.
- Backend documentation: TSDoc/JSDoc for methods, classes, interfaces, and service functions.
- Single responsibility: small cohesive modules; avoid monolithic classes.
- Prefer named imports; import directly from specific files instead of barrel files when tree-shaking matters.
- Strict type safety: use `@planitpoker/shared` for all socket events, payloads, and domain models. Avoid `any` and local redefinitions.
- React components should be "dumb"; extract logic into custom hooks. One component per file.
- Keep styling modular and out of JSX.
- Real-time: never put core business logic inside socket event listeners.
- Accessibility: WAI-ARIA compliant, keyboard navigable.
- Responsive: support 320px to 4K without horizontal scrolling, clipping, or overlaps.

## Custom Agent Tooling

- Custom skills live in `.agents/skills/` (e.g. `realtime-websocket-manager`, `react-clean-architecture`, `accessible-ui-components`, `modular-css-architecture`).
- Custom rules live in `.agents/rules/` (e.g. `update-readme.md`, `update-requirements.md`, `update-agents.md`).
- Verify style conventions against executable config when in doubt.

## Gotchas

- `useSocket` uses the React 19 `use(Context)` hook, not `useContext`.
- Client WebSocket URL resolution: `VITE_WS_URL` → dev fallback `ws://localhost:5000` → prod fallback uses `window.location.host`.
- Server default CORS only allows `http://localhost:5173`; set `ALLOWED_ORIGINS` for other frontends.
- `packages/shared` must be rebuilt after type changes before dependent apps see them in dev/build.
