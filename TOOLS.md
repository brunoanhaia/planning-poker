# PlanItPoker — Command Reference

Every command in this repository, grouped by task. The rules and conventions behind them live in [`AGENTS.md`](./AGENTS.md).

Run these two checks before a push; the rest of this file is optional during development.

```bash
npm run lint
npm run test
```

## Workspace Scripts

Run these from the repo root. The `dev`, `build`, `test` and `test:*` entries shell out to the workspace that owns the task; `lint`, `format`, `lint:commits`, `release` and `prepare` run at the root.

| Script                 | What it runs                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev:server`   | `@planitpoker/server` in watch mode (`tsx watch src/index.ts`) |
| `npm run dev:client`   | `@planitpoker/client` through Vite                             |
| `npm run build:shared` | `@planitpoker/shared` compiled to `dist/`                      |
| `npm run build`        | `build:shared`, then every workspace with a build script       |
| `npm run test`         | every workspace with a test script                             |
| `npm run test:server`  | the server Vitest suite                                        |
| `npm run test:client`  | the client Vitest suite                                        |
| `npm run lint`         | `eslint .` across the monorepo                                 |
| `npm run lint:fix`     | `eslint . --fix` across the monorepo                           |
| `npm run format`       | Prettier over `**/*.{ts,tsx,js,jsx,json,css,md}`               |
| `npm run lint:commits` | `commitlint --from origin/main`                                |
| `npm run release`      | `semantic-release` (runs in CI on `main`, not by hand)         |
| `npm run release:dry`  | `semantic-release --dry-run`, to see the next version locally  |
| `npm run prepare`      | the Husky commit-msg hook installed                            |

## Package Scripts

Each workspace also exposes its own scripts, in `packages/<name>/package.json` or `apps/<name>/package.json`.

| Workspace         | Scripts                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| `packages/shared` | `build` (`tsc`), `dev` (`tsc --watch`)                                       |
| `apps/client`     | `dev` (Vite), `build` (`tsc` then `vite build`), `preview`, `test`           |
| `apps/server`     | `dev` (`tsx watch`), `build` (`tsc`), `start` (`node dist/index.js`), `test` |
| `apps/e2e`        | `test` (`playwright test`), `test:ui` (`playwright test --ui`)               |

## Development Servers

There is no root `npm run dev`. Start both processes in separate terminals:

```bash
npm run dev:server   # Express + ws on http://localhost:5000
npm run dev:client   # Vite on http://localhost:5173
```

- The client proxies `/ws` to `ws://localhost:5000` in dev (`apps/client/vite.config.ts`).
- The server port comes from `process.env.PORT` (PORT: the listening port), with `5000` as the default.
- `ALLOWED_ORIGINS` holds the CORS origins; the default allows `http://localhost:5173`.
- Devcontainer: `.devcontainer/devcontainer.json` plus `.devcontainer/Dockerfile` pin a Node 24 LTS (Long Term Support) image, the same major as the prod Dockerfiles. Client vitest/jsdom+undici is broken on Node 20.19 workers.
- Chromium OS deps are baked into the image, so `postCreateCommand` runs only `npm ci`, `build:shared` and the Playwright browser download. Ports 5000 and 5173 are forwarded.

## Build

```bash
npm run build:shared   # compile @planitpoker/shared to dist/
npm run build          # builds shared + all apps with a build script
```

## Test

```bash
npm run test                  # all workspaces with tests
npm --workspace=@planitpoker/server run test
npm --workspace=@planitpoker/client run test
npm --workspace=@planitpoker/e2e run test
```

- `E2E_BASE_URL` points the e2e suite at an already-running stack. An empty value counts as unset:

```bash
export E2E_BASE_URL=http://localhost:8080
npm --workspace=@planitpoker/e2e run test
```

- A single file: `npm --workspace=@planitpoker/e2e run test -- timer.spec.ts`.
- UI mode: `npm --workspace=@planitpoker/e2e run test:ui`.

## Containers

```bash
cp .env.example .env
docker compose up --build   # client :80, server :5000
```

## End-to-End and Chaos

- Container chaos: `cd apps/e2e && E2E_BASE_URL=http://localhost:8080 npx playwright test --config=playwright.chaos.config.ts`. It needs a live compose stack, and `CHAOS_RUNTIME=docker` when Docker is the runtime.
- WebSocket chaos: `node apps/e2e/chaos/ws-chaos.mjs --http http://localhost:5000 --ws ws://localhost:5000/ws`.
- The same script through Nginx: `node apps/e2e/chaos/ws-chaos.mjs --http http://localhost:8080 --ws http://localhost:8080/ws`.
- After a Playwright version bump, run `npx playwright install chromium`; the browser build is pinned per version.

## Lint, Format and Commits

```bash
npm run lint
npm run lint:fix
npm run format
npm run lint:commits
```

- `lint:commits` needs the `origin/main` ref; on a fresh clone run `git fetch origin main` first.
- `npm run format` writes files. `npx prettier --check <files>` only reports differences.

## Codacy and GitHub

Codacy analyses the default branch and pull requests through the GitHub app. The CLI reads that analysis:

```bash
codacy issues -n 200 --output json                    # repository findings, as JSON
codacy tools --output json                            # enabled tools and their settings
codacy patterns <provider> <org> <repo> <toolName>    # per-pattern state and parameters
```

- Re-analysis happens on push, so `codacy issues` shows the last analysed commit, not local edits.
- GitHub Actions runs CodeQL, dependency review, conventional commits and the release workflow (`.github/workflows/`); no workflow calls the `gh` CLI.
- Once the branch is pushed, `codacy pull-request <number>` shows its analysis.
