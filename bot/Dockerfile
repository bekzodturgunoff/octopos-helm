# Build from the Helm repo root, because the bot shares two files with Helm:
#   docker compose -f bot/docker-compose.yml up -d --build
# No npm install: Node 24 runs the TypeScript directly and the bot has no dependencies.
FROM node:24-alpine
WORKDIR /app
# "type": "module" for the shared file below.
COPY package.json ./
# Installation health, judged exactly as Helm judges it. The types import is erased at run time.
COPY src/lib/fleet.ts src/lib/fleet.ts
COPY bot/package.json bot/
COPY bot/src bot/src
RUN mkdir /data && chown node:node /data
USER node
WORKDIR /app/bot
ENV NODE_ENV=production DATA_FILE=/data/bot.json PORT=8787
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "src/main.ts"]
