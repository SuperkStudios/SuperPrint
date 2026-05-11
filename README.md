# SuperPrint MVP

SuperPrint is a transparent live 3D print-on-demand platform. Customers browse approved products or upload STL files, get approval, pay, join a live manufacturing queue, watch their print, and receive the finished print video afterward.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn-style UI primitives
- NextAuth credentials scaffolding with customer/admin roles
- PostgreSQL through Prisma
- Redis + BullMQ print queue scaffold
- Server-Sent Events for public platform events
- Docker volume storage for STL/model uploads, sliced files, videos, timelapses, thumbnails, logs, and backup staging

## Setup

### Local Node

```bash
npm install
cp .env.example .env
```

Update `.env` with PostgreSQL, Redis, auth, local storage, backup, and Social Blade bucket values.

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Optional worker:

```bash
npm run worker
```

Optional backup worker:

```bash
npm run backup
```

Docker MVP stack:

```bash
docker compose build
docker compose up
```

First-run Docker setup:

```bash
docker compose run --rm app npm run db:seed
```

Then open `http://localhost:3000`. The app service runs migrations automatically on startup with `prisma migrate deploy`.

## Demo Users

- Admin: `admin@superprint.test`
- Customer: `customer@superprint.test`
- Password for both: `superprint-demo`

## Main Routes

- `/` public homepage with hero and live factory queue centerpiece
- `/store` approved product store
- `/upload` STL approval request flow
- `/queue` public live queue
- `/orders` customer order history and videos
- `/admin` printer/admin dashboard
- `/admin/uploads` model approval
- `/admin/queue` queue reorder and print lifecycle controls
- `/admin/filament` filament inventory tracking
- `/admin/maintenance` maintenance queue tracking

## API Shape

- `GET /api/products`
- `POST /api/uploads`
- `GET|POST /api/orders`
- `GET /api/queue`
- `GET /api/events` SSE stream
- `GET|POST /api/admin/uploads`
- `GET|POST /api/admin/queue`
- `GET|POST /api/admin/filament`
- `GET|POST /api/admin/maintenance`
- `GET /api/mobile/queue`
- `GET /api/mobile/events`

Public APIs sanitize events and queue state. They never expose internal printer IPs, printer API URLs, admin notes, local volume paths, payment provider IDs, or operational controls.

## Events

The platform event model supports:

- `ORDER_CREATED`
- `MODEL_UPLOADED`
- `MODEL_APPROVED`
- `MODEL_REJECTED`
- `PRINT_STARTED`
- `PRINT_PAUSED`
- `PRINT_REQUEUED`
- `PRINT_COMPLETED`
- `PRINT_FAILED`
- `FILAMENT_LOW`
- `MAINTENANCE_DUE`
- `VIDEO_READY`

Order media links are served through signed local tokens at `/api/media/[token]`; customer-facing pages never render raw Docker volume paths.

## Production TODO Seams

- Real printer agent: replace `src/workers/print-worker.ts` with a secure agent protocol that owns internal printer credentials, telemetry, and G-code dispatch.
- Payment provider: replace the checkout placeholder in `src/app/api/orders/route.ts` with Stripe/Adyen/etc. checkout sessions and webhook verification.
- Shipping: add rate shopping, label purchase, address validation, and fulfillment webhooks after payment success.
- Local volume storage: replace demo upload targets with streamed file writes, MIME/STL validation, thumbnail generation, and private media authorization.
- Social Blade bucket upload: replace `SOCIAL_BLADE_UPLOAD_COMMAND` with the real bucket CLI/API once credentials and endpoint behavior are available.

## Local Docker Volumes

The MVP mounts separate volumes under `SUPERPRINT_DATA_ROOT`:

- `/data/uploads` for STL/model uploads
- `/data/sliced` for slicer outputs
- `/data/videos` for finished print videos
- `/data/timelapses` for timelapse captures
- `/data/thumbnails` for generated thumbnails
- `/data/logs` for worker and backup logs
- `/data/backup-staging` for temporary and encrypted backup bundles

## Backups And Restore

`npm run backup` creates a PostgreSQL custom-format dump, archives media volumes, writes a manifest, compresses/encrypts the bundle, and optionally uploads it to Social Blade buckets through `SOCIAL_BLADE_UPLOAD_COMMAND`.

Restore dry run:

```bash
npm run restore -- --bundle=/data/backup-staging/superprint-RUNID.tar.gz.enc
```

Execute disaster recovery:

```bash
npm run restore -- --bundle=/data/backup-staging/superprint-RUNID.tar.gz.enc --confirm=true
```

## Verification

```bash
npm test
npm run build
```
