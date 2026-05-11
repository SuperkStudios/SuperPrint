# SuperPrint MVP

SuperPrint is a transparent live 3D print-on-demand platform. Customers browse approved products or upload STL files, get approval, pay, join a live manufacturing queue, watch their print, and receive the finished print video afterward.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn-style UI primitives
- NextAuth credentials scaffolding with customer/admin roles
- PostgreSQL through Prisma
- Redis + BullMQ print queue scaffold
- Server-Sent Events for public platform events
- S3-compatible storage seams for STL/video objects

## Setup

```bash
npm install
cp .env.example .env
```

Update `.env` with PostgreSQL, Redis, auth, and S3-compatible values.

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

Public APIs sanitize events and queue state. They never expose internal printer IPs, printer API URLs, admin notes, S3 keys, payment provider IDs, or operational controls.

## Events

The platform event model supports:

- `ORDER_CREATED`
- `MODEL_UPLOADED`
- `MODEL_APPROVED`
- `MODEL_REJECTED`
- `PRINT_STARTED`
- `PRINT_COMPLETED`
- `PRINT_FAILED`
- `FILAMENT_LOW`
- `MAINTENANCE_DUE`
- `VIDEO_READY`

## Production TODO Seams

- Real printer agent: replace `src/workers/print-worker.ts` with a secure agent protocol that owns internal printer credentials, telemetry, and G-code dispatch.
- Payment provider: replace the checkout placeholder in `src/app/api/orders/route.ts` with Stripe/Adyen/etc. checkout sessions and webhook verification.
- Shipping: add rate shopping, label purchase, address validation, and fulfillment webhooks after payment success.
- S3 storage: replace `src/lib/storage.ts` demo URLs with multipart upload signing, virus/file validation, lifecycle policies, and private video delivery.

## Verification

```bash
npm test
npm run build
```
