FROM node:22-alpine

RUN apk add --no-cache openssl postgresql-client tar

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
