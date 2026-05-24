FROM node:22-alpine AS deps

WORKDIR /app
RUN npm install -g npm@11.15.0
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g npm@11.15.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN DATABASE_URL=postgresql://superprint:superprint@localhost:5432/superprint_build \
    BETTER_AUTH_SECRET=build-secret-change-me-build-secret-change-me \
    NEXTAUTH_SECRET=build-secret-change-me-build-secret-change-me \
    BETTER_AUTH_URL=http://localhost:3000 \
    NEXTAUTH_URL=http://localhost:3000 \
    npm run build

FROM node:22-alpine AS runner

RUN npm install -g npm@11.15.0
RUN apk add --no-cache openssl postgresql-client tar curl ffmpeg

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/supernode ./supernode
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/vitest.config.ts ./vitest.config.ts
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/tailwind.config.ts ./tailwind.config.ts

RUN chmod +x scripts/docker-start.sh

EXPOSE 3000
CMD ["npm", "run", "docker:start"]
