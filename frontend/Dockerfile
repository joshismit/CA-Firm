# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# CA Firm ERP — Frontend Production Image
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage: compile the Vite/React SPA, then serve the static output with
# Nginx. `VITE_API_BASE_URL` is a build-time arg — Vite inlines `import.meta.env.*`
# values into the compiled JS at build time, so it cannot be changed by an
# environment variable at container start; rebuild the image to point at a
# different backend.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx's alpine image already ships an `nginx` user; running as non-root just
# needs the directories it writes to at runtime (pid file, client body temp,
# proxy/fastcgi caches, logs) to be owned by that user instead of root.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
  && touch /var/run/nginx.pid \
  && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
