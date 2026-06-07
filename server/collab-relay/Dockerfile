FROM node:20-alpine

WORKDIR /app

# Install only production deps (just `ws`).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./

ENV PORT=8787
EXPOSE 8787

# Basic container healthcheck hits the HTTP /healthz route.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "server.mjs"]
