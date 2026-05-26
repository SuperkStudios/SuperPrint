# Contributing to SuperPrint OS

SuperPrint OS is being built in public as the interoperability layer for observable manufacturing. The public project should help users slice models, connect printers, send jobs, observe telemetry, and coordinate fabrication across different hardware.

The current codebase still includes useful systems from the original live print shop: mobile apps, production deploy paths, SuperNode, queueing, slicing, telemetry, media, payments, and maintenance. Please improve reusable systems in place instead of removing working capability. Company-specific storefront, checkout, customer journey, and branded frontend work should be treated as downstream/private product surface unless it is needed as a reference implementation.

## Development Rules

- Use Docker for the app stack. Do not assume contributors have a local Node, PostgreSQL, or Redis setup that matches yours.
- Keep printer credentials, LAN addresses, private domains, API keys, and production tokens out of committed files.
- Prefer hardware-agnostic abstractions when adding printer support, while preserving real printer-specific integrations behind adapters.
- Keep public APIs sanitized. Do not expose internal printer IPs, local file paths, admin notes, payment provider IDs, or operational controls to customers.
- When touching operator workflows, keep the interface simple enough to use during real manufacturing work.
- Keep public contributions focused on printer connectivity, slicing, dispatch, telemetry, maintenance, media, and local-agent reliability.

## Local Docker Setup

```bash
cp .env.example .env
docker compose build
docker compose up -d postgres redis app worker slice-worker
curl http://localhost:3000/api/health
```

On a clean database, open `http://localhost:3000` and complete `/setup`.

SuperNode is opt-in because it talks to real hardware:

```bash
cp .env.supernode.example .env.supernode
docker compose --profile supernode up -d supernode
```

Register a node before setting `SUPERNODE_SECRET`. Do not commit the generated `.env.supernode` file.

## Verification

Use Docker-first checks whenever possible:

```bash
docker compose build
docker compose up -d postgres redis app
docker compose exec app npm test
```

For focused changes, run the smallest relevant test suite inside the container and mention what you ran in the pull request.

## Pull Requests

Good pull requests include:

- the problem being fixed
- the affected system, such as Core, SuperNode, SuperQueue, SuperVision, SuperSlice, SuperMaintain, or mobile
- Docker commands used for verification
- screenshots or short videos for UI changes
- printer model and firmware notes for hardware-specific behavior

Do not submit real customer data, private order details, production logs, or real secrets in issues or pull requests.
