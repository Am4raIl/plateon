FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
FROM dependencies AS dev
ENV NODE_ENV=development
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM dependencies AS build-production
COPY . .
ARG PLATEON_API_ORIGIN=http://app:8081
ENV PLATEON_API_ORIGIN=${PLATEON_API_ORIGIN}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build-production /app/.next ./.next
COPY --from=build-production /app/public ./public
COPY --from=build-production /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
