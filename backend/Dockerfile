FROM node:26-slim AS base
WORKDIR /app
COPY package*.json ./

# Dev: source is bind-mounted over /app; env comes from compose, so no --env-file.
FROM base AS dev
RUN npm ci
COPY . .
CMD ["sh", "-c", "npx prisma generate && npx tsx watch src/server.ts"]

FROM base AS build
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
