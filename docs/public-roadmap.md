# SuperPrint OS Public Roadmap

This roadmap keeps useful code from the original live print business while moving the public project toward a hardware-agnostic manufacturing interconnect: slicing, printer adapters, queue dispatch, telemetry, livestream plumbing, maintenance, and local agent reliability.

SuperPrint's company-specific storefront, checkout, customer experience, and branded frontend can remain private or downstream. The public repo should expose the software layer those apps can build on.

## 1. Public Repo Foundation

- Keep Docker onboarding reliable for first-time contributors.
- Keep secrets and real printer endpoints out of committed examples.
- Document contribution, security, and hardware testing expectations.
- Preserve deploy paths that help real operators run the interconnect.
- Clearly separate reusable manufacturing infrastructure from private product/frontend concerns.

## 2. Hardware Adapter Layer

- Keep the Elegoo Centauri Carbon path working.
- Add adapter boundaries for Bambu Lab, Prusa, Creality, Klipper, Moonraker, OctoPrint, Voron, RatRig, and generic G-code workflows.
- Normalize printer telemetry, job state, camera feeds, material state, and failure reporting.
- Keep brand-specific behavior isolated behind printer profiles and adapters.

## 3. Observable Manufacturing Core

- Make queue state, plate planning, telemetry, live media, and maintenance available through reusable APIs without exposing private network details.
- Continue improving quantity-aware plate planning and assembly handoff.
- Add timelapse archives and live overlays as first-class production artifacts.
- Keep public status surfaces separate from operator controls.

## 4. SuperNode Reliability

- Harden registration, heartbeat, queue sync, camera relay, and local slicing.
- Add offline-safe job recovery and better reconnect behavior.
- Keep direct printer starts opt-in and auditable.
- Expand diagnostic logs without leaking secrets.

## 5. Integration APIs

- Add stable APIs for submitting models, requesting slices, dispatching print jobs, reading queue state, and subscribing to telemetry.
- Keep product-specific commerce, supporter, and customer experiences outside the public core.
- Support creators, print farms, schools, and small businesses without assuming one central shop or one SuperPrint-owned frontend.

## 6. Mobile Operator Tools

- Keep admin mobile aligned with the web operator workflow.
- Keep mobile operator tools focused on printer status, job control, alerts, media, and maintenance.
- Add hardware-agnostic alerts for queue movement, failed prints, maintenance due, and material changes.

## Near-Term Issues To File

- Create a public hardware adapter interface document.
- Add a Docker smoke-test workflow for pull requests.
- Add SuperNode registration docs with screenshots.
- Add sanitized sample telemetry payloads.
- Add issue templates for printer integration requests and bug reports.
