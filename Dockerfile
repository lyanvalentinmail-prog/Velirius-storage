# Alternativa: despliegue como contenedor (Render > New Web Service > Docker).
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.mjs"]
