# Build the Vinext front-end artifact with the Node.js version required by the
# project. The build stage is intentionally separate so source files and npm
# cache do not appear in the final image.
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build


# The application is intentionally a single deployable container: Supervisor
# runs the Vinext server and Express API, while Nginx presents one public port.
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    API_PORT=3001 \
    FRONTEND_PORT=3000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor \
    && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default

# vinext is currently a development dependency but is also the production
# front-end server invoked by `npm run start`, so copy the resolved modules.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY docker/nginx.conf /etc/nginx/conf.d/continental.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/continental.conf

EXPOSE 8080

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
