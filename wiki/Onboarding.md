# Onboarding

> **Last verified:** 2026-11-26 against commit `4dd98ef`.
> The authoritative command list is [`TOOLS.md`](https://github.com/brunoanhaia/planning-poker/blob/main/TOOLS.md)
> and the contribution process is
> [`CONTRIBUTING.md`](https://github.com/brunoanhaia/planning-poker/blob/main/CONTRIBUTING.md);
> this page is the tour.

## First hour

1. **Prerequisites**: Node 24 (the repo is developed on the 24.x LTS line; the devcontainer
   pins it) and npm.
2. **Install and build the contract**: `npm ci`, then `npm run build:shared`. The apps consume
   `@planitpoker/shared` from its compiled `dist/` — skipping this build is the number-one
   source of "the types are wrong" confusion. (Type-checking reads the source through
   `paths`, so `tsc --noEmit` works without it; everything else does not.)
3. **Two dev servers** — there is no root `npm run dev`: `npm run dev:server` (Express + `ws`
   on :5000) and `npm run dev:client` (Vite on :5173, proxying `/ws` to the server).
4. **Run the suites once before touching anything**, so you know the baseline:
   `npm run test`, `npm run lint`.

The devcontainer gives you the same environment in one command: Node 24, forwarded ports
5000/5173, pinned `npm ci`, the shared build and Playwright Chromium with its OS dependencies
baked in.

## How the repo is wired

- The **layout and rules** for agents and humans live in
  [`AGENTS.md`](https://github.com/brunoanhaia/planning-poker/blob/main/AGENTS.md) — module
  boundaries, conventions, gotchas. When prose and config disagree, the config wins.
- **This wiki** documents behavior; the repository keeps what must match the code exactly
  (commands, requirements, changelog).
- Every user-visible string is a key in the i18n catalogs; every socket payload is a type in
  `packages/shared`. Nothing is redefined locally — see [[Real-Time Protocol]] and
  [[Adding a Language]] before touching either surface.

## Contributing a change

- **Branch**: from `main`, one concern per branch, prefixed with the commit type it will
  produce (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`).
- **Commits**: Conventional Commits, in English, enforced twice — the local `commit-msg` hook
  and the CI workflow that validates every commit in a pull request plus the pull request
  title (which becomes the squash message).
- **Before opening a pull request**: `npm run lint`, `npm run format`, `npm run test`. Note
  that CI itself runs the build and the unit suites — no workflow runs lint, so a green
  check alone does not mean lint passed.
- **Releases** are automatic: `release-please` keeps a release pull request open on `main`;
  `feat`/`fix`/`perf`/`revert` (and any breaking change) produce a release, maintenance types
  do not.

## The quality gates you will be held to

- Strict TypeScript with **no `any` anywhere** — ESLint rejects the explicit form on every
  package.
- React components are presentation-only; logic lives in colocated hooks, one component per
  folder, kebab-case.
- All styling through Ant Design tokens (`theme.useToken()`); no hand-rolled CSS, and colour
  contrast must clear WCAG AA — the e2e axe gate asserts it on every layout change (see
  [[Testing Strategy]]).
- Real-time code keeps business logic out of socket listeners; thin forwarding is the only
  exception.
