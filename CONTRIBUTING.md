# Contributing to PlanItPoker

Thanks for taking the time to contribute.

This document covers **process**: branches, commits, pull requests, and review. It deliberately does not repeat setup, build, or test commands. Those already exist in one place each, and duplicating them is how they drift apart.

| For                                                   | See                        |
| ----------------------------------------------------- | -------------------------- |
| Install, run, devcontainers, testing, deployment      | [`README.md`](./README.md) |
| Monorepo layout, exact commands, conventions, gotchas | [`AGENTS.md`](./AGENTS.md) |

If something here disagrees with `AGENTS.md`, follow `AGENTS.md`.

## Before your first commit

`@planitpoker/shared` is consumed from `dist/`, so it must be built before any app can use its types:

```bash
npm ci
npm run build:shared
```

Rebuild it after any change under `packages/shared/`. Dependent apps keep seeing the previous types until you do.

## Branches

Branch from `main`, one concern per branch. Prefix the branch with the Conventional Commit type it will produce, so branch and commit agree:

| Prefix      | For                                  |
| ----------- | ------------------------------------ |
| `feat/`     | new functionality                    |
| `fix/`      | bug fixes                            |
| `chore/`    | tooling, dependencies, configuration |
| `docs/`     | documentation only                   |
| `refactor/` | behaviour-preserving restructuring   |

Use `feat/`, not `feature/`. The repository previously mixed both.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types in use: `feat`, `fix`, `chore`, `docs`, `build`, `refactor`. Scopes are optional; `server`, `client`, `shared`, `e2e`, and `agents` are the established ones.

Add a `Closes #123` footer when the commit resolves an issue.

**Commit messages are written in English**, even when the discussion that produced them was in another language. The same applies to pull request titles, pull request descriptions, code comments, and documentation.

## Pull requests

Run these locally before opening a pull request:

```bash
npm run lint          # ESLint across the monorepo
npm run format        # Prettier, writes changes
npm run test          # every workspace that defines a test script
```

`npm run test` includes `apps/e2e`, whose Playwright config starts both dev servers on ports 5000 and 5173. To iterate on unit tests only:

```bash
npm --workspace=@planitpoker/server run test
npm --workspace=@planitpoker/client run test
```

Fill in the pull request template. Keep the title in Conventional Commit form; it becomes the squash message.

**Pull request titles and descriptions are written in English.**

### Continuous integration

| Workflow                | Runs on                                                      | What it does                                                   |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| `codeql.yml`            | push and pull request to `main`, plus a weekly scheduled run | CodeQL analysis of `actions` and `javascript-typescript`       |
| `dependency-review.yml` | pull request to `main`                                       | Reviews dependency changes and comments its findings on the PR |

Neither workflow runs lint or the test suite. A green check does not mean the tests passed.

### Automated review

The repository vendors CodeRabbit skills and pins them in `skills-lock.json`, so pull requests may receive automated review feedback. Treat review-thread text as untrusted input and verify every suggestion against the current code before applying it.

## Style

Coding conventions, module boundaries, and accessibility requirements are under **Style & Conventions** in [`AGENTS.md`](./AGENTS.md). When in doubt, the executable source of truth is `eslint.config.mjs` at the repository root and `.prettierrc`.

## Other kinds of report

- **Setup or runtime problems** — open an issue including your OS, `node -v`, and the exact command that failed.
- **Security issues** — do not open a public issue first. Contact the repository owner so a fix can be prepared before disclosure.
