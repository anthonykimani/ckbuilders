#!/usr/bin/env bash
# Deploys the repair inbox to a server running node, pm2, nginx and certbot.
#   inbox/deploy.sh root@host [passport-api.example.com]
# Without a domain it only (re)starts the service on 127.0.0.1:4310.
set -euo pipefail
host=$1 domain=${2:-}
dir=/opt/living-passport-inbox
cd "$(dirname "$0")/.."
ssh "$host" "mkdir -p $dir/src $dir/inbox $dir/public-web /var/lib/living-passport"
scp -q src/chain-codec.js src/public-chain.js src/public-repair.js "$host:$dir/src/"
scp -q inbox/server.mjs "$host:$dir/inbox/"
scp -q public-web/deployment.testnet.json "$host:$dir/public-web/"
ccc=$(node -p "require('./package.json').dependencies['@ckb-ccc/core']")
ssh "$host" bash -s <<REMOTE
set -euo pipefail
cd $dir
printf '{"name":"living-passport-inbox","private":true,"type":"module","dependencies":{"@ckb-ccc/core":"%s"}}\n' "$ccc" > package.json
npm install --omit=dev --no-audit --no-fund --silent
export PORT=4310 INBOX_DATA=/var/lib/living-passport/inbox.json
pm2 restart living-passport-inbox --update-env >/dev/null 2>&1 || pm2 start inbox/server.mjs --name living-passport-inbox
pm2 save >/dev/null
sleep 2; curl -fsS http://127.0.0.1:4310/health; echo
if [ -n "$domain" ]; then
  cat > /etc/nginx/sites-available/living-passport-inbox <<NGINX
server {
    server_name $domain;
    client_max_body_size 64k;
    location / {
        proxy_pass http://127.0.0.1:4310;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
    }
    listen 80;
}
NGINX
  ln -sf /etc/nginx/sites-available/living-passport-inbox /etc/nginx/sites-enabled/living-passport-inbox
  nginx -t && systemctl reload nginx
  certbot --nginx -d $domain --non-interactive --agree-tos --redirect --register-unsafely-without-email || certbot --nginx -d $domain --non-interactive --redirect
  curl -fsS https://$domain/health; echo
fi
REMOTE
