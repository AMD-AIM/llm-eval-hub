FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /workspace
COPY tests/e2e/package.json tests/e2e/package-lock.json ./
RUN npm ci

COPY tests/e2e/playwright.config.ts ./tests/e2e/playwright.config.ts
COPY tests/e2e/specs ./tests/e2e/specs
COPY datasets/experiments/mvp-golden-v1 ./datasets/experiments/mvp-golden-v1

RUN groupadd --gid 1024 zihao && \
    useradd --uid 1024 --gid 1024 --create-home zihao && \
    chown -R zihao:zihao /workspace

USER zihao
ENV HOME=/home/zihao
CMD ["npx", "playwright", "test", "--config=tests/e2e/playwright.config.ts"]
