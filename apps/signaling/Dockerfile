FROM node:20-alpine
WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npx tsc --noEmit false --outDir ./dist --esModuleInterop --declaration false --module commonjs --target es2020 --resolveJsonModule --skipLibCheck

# Expose port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Do not log private keys, messages, or files (enforced by code)
ENV NODE_ENV=production
ENV PORT=8080

USER node

CMD ["node", "dist/server.js"]
