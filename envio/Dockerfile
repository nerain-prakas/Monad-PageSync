# Envio HyperIndex indexer for Render (free Web Service).
# Resumes from the checkpoints stored in the configured PostgreSQL database.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY config.yaml schema.graphql envio-env.d.ts keepalive.mjs ./
COPY abis ./abis
COPY src ./src

# NODE_ENV is deliberately left unset: outside production mode Envio applies its
# documented defaults (HASURA_GRAPHQL_ROLE, throttle intervals), matching the
# verified local run.
# Envio's HTTP server (/healthz) must listen on Render's web port.
# The heap cap keeps the process inside the free plan's 512 MB.
ENV ENVIO_TUI=false \
    ENVIO_INDEXER_PORT=10000 \
    NODE_OPTIONS=--max-old-space-size=400

# `start` (never `dev`, never `-r`): resume existing state, do not reset it.
# keepalive.mjs is a tiny sidecar; envio is the main process (exec).
CMD ["sh", "-c", "node keepalive.mjs & exec node ./node_modules/envio/bin.mjs start"]
