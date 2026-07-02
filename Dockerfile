FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY web/package.json web/package-lock.json ./web/
WORKDIR /app/web
RUN npm install

WORKDIR /app
COPY . .

COPY scripts/docker-dev.sh /usr/local/bin/docker-dev.sh
RUN chmod +x /usr/local/bin/docker-dev.sh

WORKDIR /app/web
EXPOSE 3001

CMD ["docker-dev.sh"]
