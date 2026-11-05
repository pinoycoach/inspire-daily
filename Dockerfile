# Inspire Engine: one container that serves the built app and the server.
FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# tsx runs server.ts and the TypeScript modules it imports (server/, shared/, data/).
CMD ["npm", "start"]
