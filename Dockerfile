# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Aprovechar caché de capas
COPY package*.json ./
RUN npm ci

COPY . .

# Dokploy pasará esta variable durante el build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Etapa 2: Producción con Nginx
FROM nginx:alpine

# Copiamos el build de la etapa anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiamos la configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]