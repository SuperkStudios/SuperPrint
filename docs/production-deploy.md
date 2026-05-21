# SuperPrint Production Deploy

This deployment model keeps the public website on the VPS and keeps the printer private on your local network.

## Architecture

- VPS runs: Next.js app, Postgres, Redis, workers, backups, HTTPS reverse proxy.
- Local PC runs: `supernode`, slicer/printer access, local printer LAN credentials.
- The VPS never opens a tunnel into your house.
- SuperNode makes outbound HTTPS requests to the VPS, signs heartbeats, downloads approved G-code, and reports status.
- Printer control URLs stay only on the local PC. Do not put printer LAN IPs in the VPS `.env.production`.

## VPS Firewall

Open only:

- `22/tcp` for SSH, ideally locked to your home IP or Tailscale/WireGuard.
- `80/tcp` and `443/tcp` for the public site.

Do not expose:

- Postgres `5432`
- Redis `6379`
- App port `3000`
- Printer ports

The production compose binds the app to `127.0.0.1:3000`, so a reverse proxy on the VPS must publish HTTPS.

## VPS Setup

1. Point DNS at the VPS.
2. Install Docker and a TLS reverse proxy such as Caddy or Nginx.
3. Copy `.env.production.example` to `.env.production`.
4. Generate secrets:

```bash
openssl rand -base64 48
```

Use different values for `BETTER_AUTH_SECRET`, `NEXTAUTH_SECRET`, `MEDIA_TOKEN_SECRET`, `POSTGRES_PASSWORD`, `BACKUP_ENCRYPTION_PASSPHRASE`, `PRINTER_ALERT_WEBHOOK_TOKEN`, and `SUPERNODE_REGISTRATION_TOKEN`.

5. Start the VPS stack:

```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d postgres redis
docker compose -f docker-compose.production.yml run --rm app npm run db:deploy
docker compose -f docker-compose.production.yml up -d postgres redis app worker slice-worker backup-worker
docker compose -f docker-compose.production.yml ps
```

6. Reverse proxy example with Caddy:

```caddyfile
your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
```

7. Open `https://your-domain.com/setup` and create the owner account.

## Register The Local SuperNode

On your local PC, from the repo:

```bash
cp .env.supernode.example .env.supernode
SUPERPRINT_API_URL=https://your-domain.com \
SUPERNODE_REGISTRATION_TOKEN=the-token-from-vps-env \
SUPERNODE_ID=supernode-local \
SUPERNODE_DISPLAY_NAME="Shop Mac Mini" \
SUPERNODE_PRINTER_ID=printer-id-from-admin \
node scripts/register-supernode.mjs
```

Paste the returned secret into `.env.supernode` as `SUPERNODE_SECRET`.

After registration, rotate or clear `SUPERNODE_REGISTRATION_TOKEN` on the VPS and restart the app. Treat this token as one-time bootstrap access only:

```bash
docker compose -f docker-compose.production.yml up -d app
```

## Local PC SuperNode

Set `.env.supernode`:

```bash
SUPERPRINT_API_URL=https://your-domain.com
SUPERNODE_ID=supernode-local
SUPERNODE_SECRET=returned-secret
SUPERNODE_PRINTER_ID=printer-id-from-admin
SUPERNODE_PRINTER_CONTROL_URL=ws://LOCAL_PRINTER_IP:3030/websocket
SUPERNODE_PRINTER_CAMERA_URL=http://LOCAL_PRINTER_IP:3031/video
```

Run it:

```bash
docker compose -f docker-compose.supernode.yml up -d --build
docker compose -f docker-compose.supernode.yml logs -f supernode
```

The local PC only needs outbound HTTPS to the VPS and LAN access to the printer. Your router should not port-forward to the printer.

## Printer Security Rules

- Never expose printer HTTP/WebSocket ports to the internet.
- Put the printer and local PC on your LAN or a locked-down VLAN.
- Keep printer credentials and printer IPs out of VPS env files.
- SuperNode should run as the only bridge between SuperPrint and the printer.
- Physical print starts remain operator-gated in the app.

## Backups

The backup worker writes encrypted bundles under `/data/backup-staging`. Configure `SOCIAL_BLADE_UPLOAD_COMMAND` or another offsite upload command before relying on production.

Test restore before launch:

```bash
docker compose -f docker-compose.production.yml exec app npm run restore -- --bundle=/data/backup-staging/YOUR-BUNDLE.tar.gz.enc
```

## Launch Checklist

- DNS points to VPS.
- HTTPS works and redirects from HTTP.
- `/api/health` returns OK.
- Owner account created.
- Stripe live keys and webhook secret set.
- Shippo token set if shipping labels are used.
- Postgres and Redis are not reachable from the public internet.
- SuperNode is registered and heartbeat is online.
- Printer shows healthy from admin.
- Test product checkout with a real small order.
- Test queue admission, G-code handoff, operator start, completion, media link, and invoice.
- Test backup and restore.
