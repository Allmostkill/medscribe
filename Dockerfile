ARG NODE_IMAGE=mirror.gcr.io/library/node:22-slim

# --- сборка фронтенда ---
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime: tsx server.ts + собранный фронтенд ---
FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production

# tsx и vite лежат в dependencies, поэтому --omit=dev их не убирает
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server.ts tsconfig.json ./
COPY src ./src
COPY scripts/init-secrets.mjs scripts/reset-password.ts scripts/fetch-guidelines.mjs ./scripts/

# код остаётся root:root (только чтение); пишем лишь в logs/. logs/ пишет src/server/errors/logger.ts в process.cwd()/logs
# secrets/: новый именованный том наследует владельца и права этого каталога; пишет в него только init (пользователь app),
# остальные читают (файлы 0444, каталог 0755)
RUN groupadd --system app && useradd --system --gid app --create-home app \
    && mkdir -p /app/logs /app/secrets \
    && chown app:app /app/logs /app/secrets \
    && chmod 0755 /app/secrets

USER app

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server.ts"]
