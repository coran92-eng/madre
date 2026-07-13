# MADRE — imagen de producción para self-hosting (Docker/VPS).
# Build multi-stage: dependencias → build → runtime mínimo.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL ficticia solo para que `prisma generate` (parte de `next build`)
# no falle por falta de la variable; no se usa ninguna conexión real en build.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV DOCKER_BUILD=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -S madre && adduser -S madre -G madre
ENV NODE_ENV=production
ENV STORAGE_DIR=/data/storage

COPY --from=builder /app/public ./public
COPY --from=builder --chown=madre:madre /app/.next/standalone ./
COPY --from=builder --chown=madre:madre /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN mkdir -p /data/storage && chown -R madre:madre /data
VOLUME ["/data/storage"]

USER madre
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
