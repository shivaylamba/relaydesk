FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 openssh-client ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && mkdir -p .runtime && chown -R node:node /app
USER node
EXPOSE 3410
CMD ["sh", "scripts/container-start.sh"]
