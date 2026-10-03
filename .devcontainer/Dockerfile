# PlanItPoker devcontainer — Node 24 + cached Playwright OS dependencies.
# Pre-installs Chromium system deps at image build time so `postCreateCommand`
# only downloads browser binaries (fast, version-locked to the e2e workspace).
FROM mcr.microsoft.com/devcontainers/javascript-node:5-24-bookworm

USER root

# Keep the github-cli feature's sudo setup intact; no extra sudoers tweaks needed.

# Install Playwright Chromium OS dependencies once in the image. Browser binaries
# are still fetched during postCreateCommand so they always match the workspace's
# @playwright/test version.
COPY package-lock.json /tmp/package-lock.json
RUN PLAYWRIGHT_VERSION=$(node -p "require('/tmp/package-lock.json').packages['node_modules/@playwright/test'].version") \
    && npm install -g @playwright/test@${PLAYWRIGHT_VERSION} --ignore-scripts \
    && playwright install-deps chromium \
    && npm uninstall -g @playwright/test \
    && rm /tmp/package-lock.json

USER node
