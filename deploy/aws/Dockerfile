# Turnout production image: React SPA + PHP API behind nginx/php-fpm.
FROM node:20-bookworm-slim AS frontend
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM php:8.3-fpm-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
      nginx supervisor curl unzip libzip-dev libonig-dev \
    && docker-php-ext-install pdo_mysql zip opcache \
    && (php -m | grep -qi mbstring || docker-php-ext-install mbstring) \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY deploy/aws/php.ini /usr/local/etc/php/conf.d/turnout.ini
COPY deploy/aws/nginx.conf /etc/nginx/sites-available/turnout.conf
COPY deploy/aws/supervisord.conf /etc/supervisor/supervisord.conf
RUN ln -sf /etc/nginx/sites-available/turnout.conf /etc/nginx/sites-enabled/turnout.conf

WORKDIR /var/www/app
COPY api ./api
COPY cpanel ./cpanel
COPY --from=frontend /src/dist /var/www/html

RUN mkdir -p /var/www/app/cpanel/api/uploads/banners \
             /var/www/app/cpanel/api/uploads/organizer-logos \
             /var/www/app/cpanel/api/uploads/organizer-docs \
             /var/www/app/cpanel/api/uploads/bank-transfer-slips \
    && chown -R www-data:www-data /var/www/app /var/www/html

ENV DB_DRIVER=mysql \
    APP_DEV_MODE=false \
    SESSION_COOKIE_SECURE=true

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://127.0.0.1/api/health >/dev/null || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
