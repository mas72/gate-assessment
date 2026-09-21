#!/usr/bin/env bash
# Install nginx vhost + Let's Encrypt for gate-assessment.apk-group.net.
# Requires root. Does not replace the nginx default site.
set -euo pipefail

DOMAIN="${DOMAIN:-gate-assessment.apk-group.net}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE_SRC="$APP_DIR/deploy/nginx-gate-assessment.conf"
SITE_DST="/etc/nginx/sites-available/gate-assessment"
WEBROOT="/var/www/certbot"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "This script must run as root (sudo $0)."
  echo "It needs to write /etc/nginx, bind :443, and run certbot."
  exit 1
fi

if [[ ! -f "$SITE_SRC" ]]; then
  echo "Missing $SITE_SRC"
  exit 1
fi

mkdir -p "$WEBROOT"
chown www-data:www-data "$WEBROOT"

# Internal LAN already maps this name to 172.25.7.28. Let's Encrypt validates
# against PUBLIC DNS (ArvanCloud for apk-group.net).
public_a="$(curl -fsS --max-time 15 "https://cloudflare-dns.com/dns-query?name=${DOMAIN}&type=A" -H 'accept: application/dns-json' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(",".join(a.get("data","") for a in d.get("Answer") or []) if d.get("Status")==0 else "NXDOMAIN")')"
echo "Public DNS A ${DOMAIN} => ${public_a}"

if [[ "$public_a" == "NXDOMAIN" || -z "$public_a" ]]; then
  echo
  echo "Let's Encrypt cannot issue yet: ${DOMAIN} is NXDOMAIN on public DNS."
  echo "Internal AD already points ${DOMAIN} -> 172.25.7.28 (this host)."
  echo
  echo "Create this record on ArvanCloud (public zone apk-group.net):"
  echo "  A  ${DOMAIN}  ->  <this machine's PUBLIC IPv4>"
  echo "and open TCP 80 and 443 from the internet to this host (HTTP-01)."
  echo "Alternatively use DNS-01 (TXT _acme-challenge.${DOMAIN}) via Arvan API."
  echo
  echo "Do not point the name at assessment-platform.apk-group.net (172.25.0.27)."
  echo "This host LAN address is 172.25.7.28; it has no public interface today."
  echo "Nginx vhost will NOT be enabled until a cert exists (avoids a broken 443)."
  exit 2
fi

install -m 0644 "$SITE_SRC" "$SITE_DST"
ln -sfn "$SITE_DST" /etc/nginx/sites-enabled/gate-assessment
nginx -t
systemctl reload nginx

CERTBOT_EMAIL_ARGS=(--register-unsafely-without-email)
if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
  CERTBOT_EMAIL_ARGS=(-m "$CERTBOT_EMAIL" --agree-tos)
fi

certbot certonly --nginx -d "$DOMAIN" "${CERTBOT_EMAIL_ARGS[@]}" --non-interactive --keep-until-expiry

nginx -t
systemctl reload nginx

ENV_FILE="$APP_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  grep -q '^PROXY_TLS=' "$ENV_FILE" && sed -i 's/^PROXY_TLS=.*/PROXY_TLS=true/' "$ENV_FILE" || echo 'PROXY_TLS=true' >> "$ENV_FILE"
  grep -q '^BIND_HOST=' "$ENV_FILE" && sed -i 's/^BIND_HOST=.*/BIND_HOST=127.0.0.1/' "$ENV_FILE" || echo 'BIND_HOST=127.0.0.1' >> "$ENV_FILE"
  grep -q '^HTTP_PORT=' "$ENV_FILE" && sed -i 's/^HTTP_PORT=.*/HTTP_PORT=0/' "$ENV_FILE" || echo 'HTTP_PORT=0' >> "$ENV_FILE"
  grep -q '^HTTPS=' "$ENV_FILE" && sed -i 's/^HTTPS=.*/HTTPS=true/' "$ENV_FILE" || echo 'HTTPS=true' >> "$ENV_FILE"
fi

echo "Nginx + cert installed. Restart the Node process as user mastor:"
echo "  (kill existing production node, then)"
echo "  cd $APP_DIR && NODE_ENV=production npm start"
echo "Then: curl -fsS https://${DOMAIN}/api/health"
