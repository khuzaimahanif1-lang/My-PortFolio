FROM node:24-alpine AS build
WORKDIR /srv
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-alpine
WORKDIR /srv
COPY --from=build /srv/dist/Frontend ./dist/Frontend
ENV PORT=4000
ENV API_URL=http://backend:8000
USER node
EXPOSE 4000
CMD ["node", "dist/Frontend/server/server.mjs"]

