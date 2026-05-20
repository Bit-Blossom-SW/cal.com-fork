FROM node:20-bullseye AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV YARN_ENABLE_IMMUTABLE_INSTALLS=false
ENV HUSKY=0

FROM base AS deps
COPY package.json yarn.lock .yarnrc.yml turbo.json i18n.json ./
COPY .yarn ./.yarn
COPY apps ./apps
COPY packages ./packages
COPY example-apps ./example-apps
RUN corepack enable && yarn install

FROM deps AS builder
ARG NEXT_PUBLIC_WEBAPP_URL
ARG NEXT_PUBLIC_WEBSITE_URL
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET=build-time-nextauth-secret
ARG CALENDSO_ENCRYPTION_KEY=12345678901234567890123456789012
ENV BUILD_STANDALONE=true
ENV NODE_ENV=production
ENV NEXT_PUBLIC_WEBAPP_URL=${NEXT_PUBLIC_WEBAPP_URL}
ENV NEXT_PUBLIC_WEBSITE_URL=${NEXT_PUBLIC_WEBSITE_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV CALENDSO_ENCRYPTION_KEY=${CALENDSO_ENCRYPTION_KEY}
RUN yarn workspace @calcom/prisma prisma generate --schema schema.prisma
RUN yarn workspace @calcom/web copy-static && yarn workspace @calcom/web next build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
