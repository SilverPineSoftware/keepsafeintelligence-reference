FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY server.js .
COPY index.html .
EXPOSE 3000
CMD ["node", "server.js"]
