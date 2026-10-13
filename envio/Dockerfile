# Envio HyperIndex indexer for Render (background worker).
# Resumes from the checkpoints stored in the configured PostgreSQL database.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY config.yaml schema.graphql envio-env.d.ts ./
COPY abis ./abis
COPY src ./src

# NODE_ENV is deliberately left unset: outside production mode Envio applies its
# documented defaults (HASURA_GRAPHQL_ROLE, throttle intervals), matching the
# verified local run.
ENV ENVIO_TUI=false

# `start` (never `dev`, never `-r`): resume existing state, do not reset it.
CMD ["node", "./node_modules/envio/bin.mjs", "start"]
