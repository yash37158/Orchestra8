# The UI. Built from the workspace root so packages/contracts resolves — the
# contract is compiled into the app, not fetched at runtime.
#
# Build context is the repository root, not apps/web.
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /repo
# One tree: npm workspaces hoist to the root, so there is no per-workspace
# node_modules to copy.
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
# A build-time value would be baked into the bundle; this one is only read on
# the server at runtime, so a placeholder here is correct.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# 10001 to match the API image and the collector, so the chart can pin one
# numeric uid — Kubernetes cannot verify runAsNonRoot against a username.
RUN addgroup -g 10001 -S nodejs && adduser -S nextjs -u 10001 -G nodejs
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
