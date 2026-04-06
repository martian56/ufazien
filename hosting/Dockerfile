FROM php:8.2-fpm-alpine

# Install required dependencies for mysqli
RUN docker-php-ext-install mysqli pdo pdo_mysql
COPY php/conf.d/zz-hardening.ini /usr/local/etc/php/conf.d/zz-hardening.ini