# Baked n8n: официальный образ + workflow из platform/n8n/workflows + env контура.
ARG DEPLOY_CONTOUR=prod

# docker.n8n.io hits unauthenticated rate limits in CI; Hub image is the same tag.
FROM docker.io/n8nio/n8n:1.121.0 AS runtime
ARG DEPLOY_CONTOUR
ENV DEPLOY_CONTOUR=${DEPLOY_CONTOUR}
LABEL org.opencontainers.image.contour="${DEPLOY_CONTOUR}"

USER root
COPY n8n/workflows/*.json /opt/workflows/
COPY docker/n8n/entrypoint.sh /docker-entrypoint-custom.sh
COPY docker/n8n/purge-managed-workflows.sh /opt/n8n/purge-managed-workflows.sh
RUN chmod +x /docker-entrypoint-custom.sh /opt/n8n/purge-managed-workflows.sh

USER node
WORKDIR /home/node

FROM runtime AS baked
COPY docker/n8n/runtime-baked.env /app/config/runtime-baked.env
ENTRYPOINT ["/docker-entrypoint-custom.sh"]

FROM runtime AS local
ENTRYPOINT ["n8n"]
