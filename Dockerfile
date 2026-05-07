FROM node:20-alpine AS client-builder

WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=client-builder /build/client/dist ./public

RUN mkdir -p /data /uploads

EXPOSE 3000

CMD ["node", "server.js"]
