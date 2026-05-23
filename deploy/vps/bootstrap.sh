#!/usr/bin/env bash
# Однократная подготовка VPS (Ubuntu/Debian): Docker + каталог деплоя.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/couragegang}"

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
  echo "Docker installed. Re-login may be required for group docker."
fi

sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$USER":"$USER" "$DEPLOY_DIR"
echo "Deploy directory: $DEPLOY_DIR"
echo "Copy deploy/vps/docker-compose.yml and up.sh into $DEPLOY_DIR"
