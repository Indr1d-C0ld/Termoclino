# Termoclino — server di gioco.
# Si costruisce dalla radice del repo, perche' servono anche i moduli comuni:
#   docker compose -f server/compose.yaml build
FROM node:24-alpine

WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY shared ./shared
COPY server/src ./server/src

ENV NODE_ENV=production
USER node
EXPOSE 8095
CMD ["node", "server/src/main.js"]
