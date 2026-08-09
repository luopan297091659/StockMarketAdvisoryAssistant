FROM node:22.20.0-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/market-identifiers/package.json packages/market-identifiers/tsconfig.json ./packages/market-identifiers/
COPY packages/market-identifiers/src ./packages/market-identifiers/src
COPY apps/product-api/package.json apps/product-api/tsconfig.json ./apps/product-api/
COPY apps/product-api/prisma ./apps/product-api/prisma
COPY apps/product-api/src ./apps/product-api/src
RUN npm install --ignore-scripts
RUN npx prisma generate --schema apps/product-api/prisma/schema.prisma
RUN npm run build --workspace @equity-atlas/market-identifiers && npm run build --workspace @equity-atlas/product-api

FROM node:22.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/market-identifiers/package.json ./packages/market-identifiers/package.json
COPY --from=build /workspace/packages/market-identifiers/dist ./packages/market-identifiers/dist
COPY --from=build /workspace/apps/product-api/package.json ./apps/product-api/package.json
COPY --from=build /workspace/apps/product-api/dist ./apps/product-api/dist
COPY --from=build /workspace/apps/product-api/prisma ./apps/product-api/prisma
USER node
EXPOSE 8000
CMD ["node", "apps/product-api/dist/main.js"]

