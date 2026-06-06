FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc --noEmit
CMD ["npx", "ts-node", "src/main.ts"]
