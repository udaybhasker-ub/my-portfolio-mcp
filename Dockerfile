FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Secrets (oauth-credentials.json, tokens.json) are passed via env vars
# Do NOT copy them into the image

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
