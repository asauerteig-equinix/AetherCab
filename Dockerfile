FROM node:25-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:25-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5500

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 5500

CMD ["npm", "run", "start"]
