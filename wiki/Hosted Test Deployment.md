# Hosted Test Deployment

> **Last verified:** 2026-11-26 against commit `c557e49`.
> A public test instance, split across two free hosts, configured entirely from the repository
> (`vercel.json`, `render.yaml`): a push to `main` redeploys both halves.

## The shape

| Piece  | Host                          | Configuration                                                                                                                                                                                                                                                      |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client | Vercel (`planitpoker`)        | Static site: `vercel.json` runs `build:shared` + the client build, serves `apps/client/dist`, rewrites everything to `index.html`. `VITE_WS_URL=wss://<service>.onrender.com` is set per environment and baked into the bundle.                                    |
| Server | Render (`planitpoker-server`) | Docker from `apps/server/Dockerfile` with the repo root as context, `healthCheckPath: /api/health`, `TRUST_PROXY_HOPS=1` (Render terminates TLS in front), `CLIENT_ID_COOKIE_SECURE=true` (the API is reached over HTTPS), `ALLOWED_ORIGINS` set in the dashboard. |

Unlike the compose stack, the browser dials the server **directly** over `wss`, so the origin
allowlist genuinely matters here: it must list every hostname the client is served from.

## The gotchas that cost an afternoon if missed

- **Share the alias, not a deployment link.** A per-deployment URL
  (`<project>-<hash>-<team>.vercel.app`) is **not** accepted by the socket origin check — the
  allowlist carries the canonical `*.vercel.app` domain and the `<project>-<team>.vercel.app`
  alias.
- **Wake-up latency is real.** The free Render plan spins the single instance down after 15
  minutes without traffic and takes about a minute to wake. During that window the site is up
  but the socket cannot connect; the client keeps retrying (see [[Troubleshooting]]).
- **One instance, in memory.** No horizontal scaling on the free plan — which matches the
  product's single-writer model anyway: room state is memory, one process, one truth.
- **Both TLS settings are set for you by the blueprint**: the trusted hop is Render's
  terminator, and the identity cookie is `Secure` because the browser reaches the API over
  HTTPS.
