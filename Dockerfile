FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS production
RUN apk add --no-cache tini curl
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN mkdir -p /app/logs && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
