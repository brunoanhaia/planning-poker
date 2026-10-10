## 1.0.0 (2026-10-10)

### Features

* add agent rules and skills for token usage optimization ([b98bd12](https://github.com/brunoanhaia/planning-poker/commit/b98bd12fac007b4992c7e8e257ac4c5e3be63013))
* add Playwright E2E test suite for room management and voting flows ([2615604](https://github.com/brunoanhaia/planning-poker/commit/2615604e372024e2309407fb0b0ead1b1d02990b))
* add requirements documentation for functional and non-functional criteria ([dbca896](https://github.com/brunoanhaia/planning-poker/commit/dbca8962effb45bcca7935437f0df4c3c9abe0cc))
* **admin:** implement complete administrator capabilities suite, permissions, live timer, and bulk backlog import ([a82a51c](https://github.com/brunoanhaia/planning-poker/commit/a82a51c3d2a55c05576c532ac2d901559397ef68))
* configure Vercel and Render deployment ([#2](https://github.com/brunoanhaia/planning-poker/issues/2)) ([3051ade](https://github.com/brunoanhaia/planning-poker/commit/3051adee13a3d881e632a3c260ad0d6a4ba4366d))
* **deploy:** containerize with Docker Compose and Nginx proxy ([#4](https://github.com/brunoanhaia/planning-poker/issues/4)) ([91fe74e](https://github.com/brunoanhaia/planning-poker/commit/91fe74e18d73030acb1a1f6697663ee1b7a6b55b))
* implement initial application structure with MainContent and App components while updating component architecture guidelines ([6a9fdf5](https://github.com/brunoanhaia/planning-poker/commit/6a9fdf5623d2cc05cb504d817026db37e2ca4b91))
* implement initial client-side UI components and structure for room management and estimation features ([d50c259](https://github.com/brunoanhaia/planning-poker/commit/d50c259dc2ef2e1cc7690318152eca6469486780))
* initial commit for real-time multi-user Planit Poker with React, MUI, Node, TS, Vitest ([b3e3fd1](https://github.com/brunoanhaia/planning-poker/commit/b3e3fd1320be485b9c0d1bb109c742cb3eb41f28))
* initialize project structure with ESLint configurations, MUI theme, base UI components, and agent-specific coding standards. ([84a6fe0](https://github.com/brunoanhaia/planning-poker/commit/84a6fe0b7585777344cadc7755aa838f79de394b))
* introduce agentic skill and rule configuration files to standardize development practices and project documentation ([1f64f4b](https://github.com/brunoanhaia/planning-poker/commit/1f64f4b744eb06b81e4e21d210ed582ad789b0eb))
* irefactor code to apply skills and prettier ([4e5a2d5](https://github.com/brunoanhaia/planning-poker/commit/4e5a2d537e18811e860b3e751cc0f0c9f6592a6c))
* **monorepo:** migrate codebase to npm workspaces with apps/ and packages/shared ([8563c0a](https://github.com/brunoanhaia/planning-poker/commit/8563c0a4910b5987a43224c98b04a25f42b7b8fd))
* restructure MainContent layout, remove PokerTable, and add Participants and Estimation panels ([0541738](https://github.com/brunoanhaia/planning-poker/commit/054173857a20ae4563d73f1ccd65159d5d4e7622))
* **security:** restrict vote revelation strictly to admin and co-host users ([87b2707](https://github.com/brunoanhaia/planning-poker/commit/87b270793a022521a8b0e3eef73a1f77c9c549ba))
* update WebSocket management to use native WebSockets and rename skill for clarity ([607c1a5](https://github.com/brunoanhaia/planning-poker/commit/607c1a5bb7fe62450ed9db0e4406fbaa3017f9d0))

### Bug Fixes

* **client:** prevent countdown timer from overlapping participant avatars ([72480aa](https://github.com/brunoanhaia/planning-poker/commit/72480aa5bd09afbbe2903638b7cafbab1607d454))
* current score had the wrong type and project build was failing ([5eae4c9](https://github.com/brunoanhaia/planning-poker/commit/5eae4c9b9aafd45070b732a8fb6a07d500837bd6))
* **security:** resolve critical and high severity issues ([#10](https://github.com/brunoanhaia/planning-poker/issues/10), [#11](https://github.com/brunoanhaia/planning-poker/issues/11), [#15](https://github.com/brunoanhaia/planning-poker/issues/15), [#18](https://github.com/brunoanhaia/planning-poker/issues/18)) ([#21](https://github.com/brunoanhaia/planning-poker/issues/21)) ([cbac89c](https://github.com/brunoanhaia/planning-poker/commit/cbac89c57c1c71773fe42a5325986a7d05c732fe))
* **security:** use cryptographically secure IDs in idGenerator ([#5](https://github.com/brunoanhaia/planning-poker/issues/5)) ([81d5fd4](https://github.com/brunoanhaia/planning-poker/commit/81d5fd40acd89c20bffc4aa04fac6e305010b2e5))
* **server:** harden WebSocket origin verification ([#14](https://github.com/brunoanhaia/planning-poker/issues/14)) ([#22](https://github.com/brunoanhaia/planning-poker/issues/22)) ([f3992da](https://github.com/brunoanhaia/planning-poker/commit/f3992da032553ddcca70f3fd425e9fcbb9b7aa6e))
* **sonar:** resolve all remaining Sonar code smells and bugs ([#6](https://github.com/brunoanhaia/planning-poker/issues/6)) ([a6e19e9](https://github.com/brunoanhaia/planning-poker/commit/a6e19e92dcfc95b89e3f2ca051bd40d99ca2c52a))
* **sonar:** resolve code smells, harden server, add devcontainer on Node 24 ([#9](https://github.com/brunoanhaia/planning-poker/issues/9)) ([b62adcc](https://github.com/brunoanhaia/planning-poker/commit/b62adcc325234d2eb59e992d75c2622236150091))
