FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY dist ./dist

# Secrets (oauth-credentials.json, tokens.json) are passed via env vars
# Do NOT copy them into the image

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
