# SuperPrint OS

> Observable manufacturing infrastructure for the next generation of fabrication.

---

# Why SuperPrint Exists

Two weeks ago I bought my first serious 3D printer:

* **Elegoo Centauri Carbon**

At the same time, the entire 3D printing community was exploding over the Bambu Lab ecosystem drama.

Originally, SuperPrint was supposed to be:

```txt
a small live-printing business
```

The idea was simple:

* let people upload prints
* watch them get manufactured live
* make the manufacturing process transparent

But after seeing the state of the industry, it became obvious the problem is much bigger.

The 3D printing ecosystem is fragmented:

* closed systems
* disconnected software
* hidden manufacturing
* poor interoperability
* weak transparency
* limited community involvement

So the vision evolved.

SuperPrint is no longer just:

```txt
a 3D print shop
```

SuperPrint becomes:

```txt
the operating system for observable manufacturing
```

---

# The Mission

```txt
Manufacturing should be transparent.
```

People should be able to:

* watch products being made live
* understand where their order is
* participate in factory growth
* trust the production process
* connect any printer into a shared ecosystem

SuperPrint is designed to support:

* makers
* creators
* print farms
* schools
* businesses
* distributed manufacturing networks

regardless of printer brand.

---

# Core Philosophy

The future of fabrication should be:

* open
* observable
* community-powered
* hardware-agnostic
* software-defined

Not locked behind:

* closed ecosystems
* vendor restrictions
* isolated hardware platforms

---

# What This Public Repo Is

This public repository is the open software layer for connecting fabrication tools.

Its focus is:

* printers
* telemetry
* slicing
* maintenance
* queue handoff
* print dispatch
* local printer agents
* printer adapter interfaces
* hardware-agnostic manufacturing APIs
* livestream and timelapse plumbing

The private SuperPrint company frontend, commerce experience, customer storefront, and brand-specific business workflows can build on top of this layer without making this repository depend on them.

In short:

```txt
public repo = the manufacturing interconnect
private app = SuperPrint's own business frontend
```

---

# Supported Ecosystem

SuperPrint is designed to integrate with:

* Bambu Lab
* Elegoo
* Prusa
* Creality
* Voron
* RatRig
* Klipper
* Moonraker
* OctoPrint
* generic GCODE workflows

The goal is not to replace hardware manufacturers.

The goal is to build:

```txt
the software layer above them
```

---

# Observable Manufacturing

The queue itself becomes part of the product experience.

Users can:

* watch prints live
* monitor queue movement
* receive notifications
* track printer health
* view telemetry
* see filament inventory
* download timelapses
* participate in factory upgrades

Manufacturing becomes interactive instead of invisible.

---

# Core Systems

## SuperPrint Core

Hardware-agnostic orchestration APIs.

Handles:

* authentication
* queues
* APIs
* printer registry
* job state
* adapter contracts
* manufacturing events

---

## SuperNode

Local printer agent.

Handles:

* printer communication
* queue syncing
* telemetry
* local slicing
* livestream relays
* automation

---

## SuperQueue

Distributed manufacturing scheduler and handoff layer.

Handles:

* printer assignment
* material matching
* batch optimization
* priority systems
* distributed routing

---

## SuperVision

Livestream, timelapse, and telemetry infrastructure.

Handles:

* live streams
* timelapses
* overlays
* recording
* print archives

---

## SuperSlice

Automated slicing infrastructure.

Handles:

* slicer profiles
* material presets
* optimization
* support generation
* print validation

---

## SuperMaintain

Maintenance operating system.

Tracks:

* runtime hours
* print failures
* nozzle wear
* filament usage
* maintenance schedules
* printer health

---

## SuperFactory

Optional factory evolution primitives.

Supports:

* upgrade goals
* supporter systems
* infrastructure unlocks
* factory milestones
* community participation

---

# Factory Evolution

```txt
Every order upgrades the factory.
```

In SuperPrint's own private product, users do not simply buy prints.

They help unlock:

* new printers
* new materials
* automation systems
* better livestreams
* AI monitoring
* regional print nodes
* future fabrication infrastructure

This is NOT:

* investing
* equity
* ownership
* securities

This IS:

* community-powered infrastructure growth

For this public repo, factory evolution should stay modular. The open layer can expose capacity, milestones, telemetry, and production history, while product-specific supporter experiences can live in private or downstream apps.

---

# Long-Term Vision

SuperPrint eventually evolves into:

* distributed print nodes
* regional manufacturing hubs
* AI-assisted manufacturing
* autonomous print orchestration
* fabrication routing networks
* decentralized manufacturing infrastructure

The long-term goal is:

```txt
becoming the infrastructure layer for observable fabrication
```

---

# Design Direction

SuperPrint should feel like:

* industrial telemetry
* cyber manufacturing
* operations center software
* real-time infrastructure dashboards

NOT:

* generic e-commerce
* hobby printer software
* basic print farm tooling

---

# Open Community

This is being built in public.

The goal is to support:

* the printer ecosystem
* creators
* operators
* open manufacturing
* interoperable infrastructure

Community:
[SuperPrint Discord](https://discord.com/invite/Rh4ySUEYV4?utm_source=chatgpt.com)

---

# For Contributors

SuperPrint OS is public now. The direction of this repository is the software that lets people slice models, connect printers, send jobs, observe telemetry, and coordinate manufacturing across different hardware.

The repository still contains useful systems from the original live print shop:

* STL uploads and review
* print queues
* printer profiles
* SuperNode
* local slicing
* livestream and timelapse media
* maintenance tracking
* mobile operator apps
* production deployment docs

Those pieces are not throwaway MVP code. They are reference implementations and transition pieces for the broader OS. Do not remove working capabilities just because they came from the original SuperPrint business app.

New public work should push toward the reusable layer:

* printer adapters
* slicer integration
* queue dispatch
* job state synchronization
* telemetry normalization
* live media plumbing
* local agent reliability
* hardware-agnostic APIs

SuperPrint's company-specific storefront, checkout, customer journey, and branded frontend should be treated as downstream/private product surface.

Start here:

* [Contributing guide](CONTRIBUTING.md)
* [Security policy](SECURITY.md)
* [Public roadmap](docs/public-roadmap.md)
* [Production deploy notes](docs/production-deploy.md)
* [Live media relay notes](docs/live-media-relay.md)

## Docker Quick Start

Use Docker for local development:

```bash
cp .env.example .env
docker compose build
docker compose up -d postgres redis app worker slice-worker
curl http://localhost:3000/api/health
```

Then open:

```txt
http://localhost:3000
```

On a clean database, SuperPrint redirects to `/setup`.

SuperNode is opt-in because it talks to real printers:

```bash
cp .env.supernode.example .env.supernode
docker compose --profile supernode up -d supernode
```

Do not commit real `.env`, `.env.production`, `.env.supernode`, printer LAN addresses, node secrets, payment keys, signing assets, or production logs.

---

# Final Goal

```txt
Build the operating system that powers transparent manufacturing for the next generation of fabrication.
```
