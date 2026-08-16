FROM node:22.20.0-bookworm-slim AS build
WORKDIR /workspace
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html ./apps/web/
COPY apps/web/src ./apps/web/src
RUN npm install --ignore-scripts
RUN npm run build --workspace @equity-atlas/web

FROM nginx:1.28.0-alpine
COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
