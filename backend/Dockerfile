# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# CA Firm ERP — Backend Production Image
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build:
#   base      — shared OS layer (Node LTS + dumb-init for signal handling)
#   deps      — full npm install (incl. devDependencies), needed to compile
#   build     — tsc + tsc-alias compile, then prune devDependencies in place
#   runtime   — final image: pruned node_modules + compiled dist only, non-root
#
# `npm run build` already runs `tsc -p tsconfig.json && tsc-alias -p tsconfig.json`
# (see backend/package.json) — tsc-alias rewrites the `@config/*`-style path
# aliases the compiled output would otherwise contain as literal `require()`
# calls Node can't resolve. See the "critical build blocker" fix this Dockerfile
# builds on top of.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
WORKDIR /app
# dumb-init becomes PID 1 so SIGTERM from `docker stop`/an orchestrator is
# actually forwarded to the Node process (which then runs its own graceful
# shutdown — see src/server.ts) instead of being swallowed by PID 1 semantics.
RUN apk add --no-cache dumb-init

# ─── deps: full install, used only to build ──────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ─── build: compile TypeScript, generate Prisma client, strip dev deps ──────
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build
# Removes devDependencies from node_modules in place (keeps the already-
# generated @prisma/client intact) — cheaper and more reliable than a second
# `npm ci --omit=dev`, which would need to re-run `prisma generate` without
# having the `prisma` CLI (a devDependency) available to do so.
RUN npm prune --omit=dev

# ─── runtime: final image ────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ARG COMMIT_SHA=
ENV COMMIT_SHA=${COMMIT_SHA}

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
# swagger-jsdoc (config/swagger.ts) parses JSDoc comments straight out of the
# route *source* files at runtime (`apis: ['./src/modules/**/routes/*.ts']`)
# rather than from compiled output — so those .ts files must physically exist
# in the image, not just their compiled dist/ counterparts.
COPY --from=build --chown=nodejs:nodejs /app/src/modules ./src/modules
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get({host:'localhost',port:process.env.APP_PORT||4000,path:'/health',timeout:4000},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
