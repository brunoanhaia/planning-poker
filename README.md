# PlanItPoker

A real-time planning poker application designed for agile teams to estimate tasks. This project is structured as an npm workspaces monorepo containing a React frontend, a Node.js backend, and a shared types package.

**Behavior documentation — features, roles, voting, limits, security, deployment — lives in the
[project wiki](https://github.com/brunoanhaia/planning-poker/wiki), written from the code and
stamped with the commit each page was verified against. This README is the landing page: the
quick start and the map of where everything lives.**

## Quick start

Prerequisites: Node.js 24 LTS and npm.

```bash
npm ci
npm run build:shared   # required: the apps consume @planitpoker/shared from dist/
npm run dev:server     # Express + ws on http://localhost:5000
npm run dev:client     # Vite on http://localhost:5173, proxying /ws to the server
```

There is no root `npm run dev` — the two processes are separate. The full command list,
including tests, lint, containers and chaos, is [`TOOLS.md`](./TOOLS.md).

```bash
npm run test           # every workspace with tests; e2e auto-starts both dev servers
```

The devcontainer gives the same environment in one command — Node 24 LTS, forwarded ports
5000/5173, the shared build and Playwright Chromium: open the folder in VS Code and choose
**Reopen in Container**.

### Run the full stack

```bash
cp .env.example .env
docker compose up --build   # client on :80, server on :5000 (loopback only)
```

The decisions behind the stack — proxy trust, TLS, the hosted split — are documented on the
wiki's [Deploy with Docker](https://github.com/brunoanhaia/planning-poker/wiki/Deploy-with-Docker)
page; the environment variables are documented inline in [`.env.example`](./.env.example).

## Monorepo structure

- **`apps/client`** — the frontend: React 19 + Vite + Ant Design 6, styled exclusively through
  design tokens.
- **`apps/server`** — the backend: Node + Express + native `ws`, rooms held in memory.
- **`apps/e2e`** — Playwright + Axe-core: end-to-end flows and the zero-violation accessibility
  gate.
- **`packages/shared`** — the contract: types, enums, limits and close codes consumed by both
  apps.

## Where everything lives

| I need…                                                                               | Where                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How the product behaves — features, roles, voting, security, deployment               | [`docs/`](./docs) — one source, written for agents and rendered by GitHub; start at [`docs/README.md`](./docs/README.md)                                           |
| Every command (build, test, lint, containers, chaos, skills)                          | [`TOOLS.md`](./TOOLS.md)                                                                                                                                           |
| Rules for coding agents — conventions, boundaries, gotchas                            | [`AGENTS.md`](./AGENTS.md)                                                                                                                                         |
| The contribution process — branches, commits, pull requests                           | [`CONTRIBUTING.md`](./CONTRIBUTING.md)                                                                                                                             |
| The numbered functional and non-functional contract                                   | [`requirements.md`](./requirements.md) — traced to docs pages in [`docs/requirements-trace.md`](./docs/requirements-trace.md)                                      |
| The penetration report, the release regression gate and the ideal-behaviour test plan | [`docs/security-review.md`](./docs/security-review.md), [`docs/regression-playbook.md`](./docs/regression-playbook.md), [`docs/test-plan.md`](./docs/test-plan.md) |
| The docs folder index — every page, one table                                         | [`docs/README.md`](./docs/README.md)                                                                                                                               |
