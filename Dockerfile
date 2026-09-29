FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite-dev

COPY package*.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/tmp/build-data
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

RUN apk add --no-cache sqlite-libs

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/data /data

EXPOSE 3000

CMD ["npm", "start"]
