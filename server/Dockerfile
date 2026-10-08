# Termoclino — server di gioco.
# Si costruisce dalla radice del repo, perche' servono anche i moduli comuni:
#   docker compose -f server/compose.yaml build
FROM node:24-alpine

WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY shared ./shared
COPY server/src ./server/src

# Istantanee della verita' (replay): su un volume (vedi compose.yaml), perche'
# la radice del contenitore e' in sola lettura. La cartella nasce qui di
# proprieta' di node: Docker inizializza il volume con nome da questa.
RUN mkdir -p /var/lib/termoclino/istantanee && chown node:node /var/lib/termoclino/istantanee

ENV NODE_ENV=production
ENV TERMOCLINO_ISTANTANEE=/var/lib/termoclino/istantanee
USER node
EXPOSE 8095
CMD ["node", "server/src/main.js"]
