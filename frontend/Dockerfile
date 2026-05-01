# Build context is the frontend/ directory:
#   docker build --build-arg PUBLIC_API_URL=https://... ./frontend
#
# PUBLIC_API_URL is baked into the static bundle at build time (Astro output: static),
# so it must be supplied here, not at container startup.

# ── Build ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL

RUN npm run build

# ── Serve ──────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
