// Health probe for the container healthcheck.
//
// It lives in its own file because a JavaScript expression passed through
// `CMD` is re-parsed by whatever shell the runtime uses: podman-compose turns
// the healthcheck array into one command string, and the parentheses of an
// arrow function then break `/bin/sh`. A file path survives both runtimes.

// The server reads PORT, so an operator override must not leave the container
// permanently unhealthy; the timeout keeps a hung server from holding the probe
// until the runtime's own healthcheck timeout fires. `||` (not `??`) mirrors the
// server's own parsing: an empty PORT means "use the default", and `??` would
// keep the empty string and probe port 80.
const port = process.env.PORT || '5000';

const response = await fetch(`http://localhost:${port}/api/health`, {
    signal: AbortSignal.timeout(4000),
}).catch(() => null);

process.exit(response?.ok ? 0 : 1);
