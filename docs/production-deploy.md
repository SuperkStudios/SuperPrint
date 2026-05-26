# SuperPrint OS Production Deploy

This deployment model runs the public interconnect service on a server while keeping printers private on a local network.

## Architecture

- Server runs: Next.js API/app, Postgres, Redis, workers, backups, and HTTPS reverse proxy.
- Local machine runs: SuperNode, slicer access, printer LAN credentials, camera access, and printer dispatch.
- The server never opens a tunnel into the local printer network.
- SuperNode makes outbound HTTPS requests to the server, signs heartbeats, downloads queued artifacts, and reports status.
- Printer control URLs stay only on the local machine. Do not put printer LAN IPs in server env files.

## Server Firewall

Open only:

- `22/tcp` for SSH, ideally locked to your admin IP or VPN.
- `80/tcp` and `443/tcp` for HTTPS.

Do not expose:

- Postgres `5432`
- Redis `6379`
- App port `3000`
- Printer ports

The production compose binds the app to `127.0.0.1:3000`, so a reverse proxy publishes HTTPS.

## Server Setup

1. Point DNS at the server.
2. Install Docker and a TLS reverse proxy such as Caddy or Nginx.
3. Copy `.env.production.example` to `.env.production`.
4. Generate secrets:

```bash
openssl rand -base64 48
```

Use different values for `BETTER_AUTH_SECRET`, `NEXTAUTH_SECRET`, `MEDIA_TOKEN_SECRET`, `POSTGRES_PASSWORD`, `BACKUP_ENCRYPTION_PASSPHRASE`, `PRINTER_ALERT_WEBHOOK_TOKEN`, and `SUPERNODE_REGISTRATION_TOKEN`.

5. Start the server stack:

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

7. Check `https://your-domain.com/api/health`.

## Register The Local SuperNode

On the local machine, from the repo:

```bash
cp .env.supernode.example .env.supernode
SUPERPRINT_API_URL=https://your-domain.com \
SUPERNODE_REGISTRATION_TOKEN=the-token-from-server-env \
SUPERNODE_ID=supernode-local \
SUPERNODE_DISPLAY_NAME="Local SuperNode" \
SUPERNODE_PRINTER_ID=printer-id \
node scripts/register-supernode.mjs
```

Paste the returned secret into `.env.supernode` as `SUPERNODE_SECRET`.

After registration, rotate or clear `SUPERNODE_REGISTRATION_TOKEN` on the server and restart the app:

```bash
docker compose -f docker-compose.production.yml up -d app
```

## Local SuperNode

Set `.env.supernode`:

```bash
SUPERPRINT_API_URL=https://your-domain.com
SUPERNODE_ID=supernode-local
SUPERNODE_SECRET=returned-secret
SUPERNODE_PRINTER_ID=printer-id
SUPERNODE_PRINTER_CONTROL_URL=ws://LOCAL_PRINTER_IP:3030/websocket
SUPERNODE_PRINTER_CAMERA_URL=http://LOCAL_PRINTER_IP:3031/video
```

Run it:

```bash
docker compose -f docker-compose.supernode.yml up -d --build
docker compose -f docker-compose.supernode.yml logs -f supernode
```

The local machine only needs outbound HTTPS to the server and LAN access to the printer. Do not port-forward to the printer.

## Launch Checklist

- DNS points to the server.
- HTTPS works and redirects from HTTP.
- `/api/health` returns OK.
- Postgres and Redis are not reachable from the public internet.
- SuperNode is registered and heartbeat is online.
- Printer status, queue handoff, G-code download, telemetry, media, and completion events are verified.
- Backups are configured and a restore has been tested.
