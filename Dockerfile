FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css runtime-config.js /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js
COPY data /usr/share/nginx/html/data
COPY deploy/runtime-config.js /usr/share/nginx/html/runtime-config.js

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
