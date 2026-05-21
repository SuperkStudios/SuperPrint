import { AlertTriangle, BadgeCheck, FileText, Lock, PackageCheck, Recycle, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { PageSection, PageShell } from "@/components/cyber-page";

export const dynamic = "force-dynamic";

const lastUpdated = "May 20, 2026";

const legalSections = [
  {
    id: "terms",
    label: "Terms of Service",
    icon: FileText,
    title: "Terms of Service",
    summary: "The baseline rules for using SuperPrint, placing orders, and interacting with our live manufacturing platform.",
    items: [
      "SuperPrint provides custom 3D printing, model intake, printability review, queue visibility, live production updates, pickup or shipping coordination, and related digital services.",
      "By using the site, uploading files, placing an order, joining the queue, creating an account, contributing to a factory goal, or using a supporter perk, you agree to these terms and any checkout terms shown at the time of purchase.",
      "You agree to provide accurate account, contact, model, material, sizing, shipping, pickup, and payment information. If information is missing or inaccurate, production may be delayed, paused, repriced, or cancelled.",
      "We may refuse, pause, cancel, refund, credit, reprint, or request changes to orders that are unsafe, unlawful, technically unsuitable, abusive, fraudulent, restricted by policy, or outside our production capability.",
      "Site features, materials, pricing, queue estimates, livestream access, supporter perks, factory goals, pickup windows, and production methods may change as the platform and factory evolve.",
      "You may not interfere with site security, attempt to access admin tools, scrape non-public systems, submit malicious files, overload the service, or use SuperPrint in a way that harms customers, operators, equipment, or the platform."
    ]
  },
  {
    id: "privacy",
    label: "Privacy Policy",
    icon: Lock,
    title: "Privacy Policy",
    summary: "What we collect, why we collect it, and how we protect customer and production data.",
    items: [
      "We collect information needed to operate SuperPrint, including account details, names, emails, shipping or pickup details, order records, uploaded model files, production notes, print events, payment status, support messages, and basic site usage data.",
      "We use this information to quote and process orders, review files, run the queue, slice models, reserve material, operate printers, provide livestream and telemetry features, prevent abuse, support customers, improve reliability, and maintain production records.",
      "Uploaded model files may be stored with your order history so we can manufacture the part, troubleshoot issues, support reprints, and document what was requested. We do not sell customer model files.",
      "Payment details are handled by payment providers. SuperPrint should not store full card numbers, security codes, or sensitive payment credentials.",
      "Public pages may display safe production information such as order status, queue position, printer state, public supporter names, upgrade progress, and activity events. We avoid exposing private customer data, payment internals, admin tools, printer controls, internal endpoints, or infrastructure secrets.",
      "We may use cookies, sessions, analytics, logs, and security tools to keep users signed in, understand site performance, measure conversion, detect abuse, and improve the platform.",
      "We may share limited information with service providers that help us operate the business, such as payment processors, hosting providers, email tools, analytics providers, shipping carriers, and support systems. They may only use the information for the services they provide to us.",
      "You may request help with account access, correction, deletion, or privacy questions through the site support channel. Some records may need to be retained for orders, accounting, security, legal compliance, dispute handling, or fraud prevention."
    ]
  },
  {
    id: "orders",
    label: "Orders & Print Review",
    icon: ShieldCheck,
    title: "Orders, Uploads, and Print Review",
    summary: "How uploads become real jobs, and why every job may need operator review before production.",
    items: [
      "Uploaded models may be reviewed for file integrity, scale, dimensions, wall thickness, printability, material fit, color availability, estimated runtime, content restrictions, and machine safety.",
      "A checkout price or queue estimate is not a guarantee that the model can be produced exactly as submitted. We may contact you for approval if the file requires meaningful changes, different material, different quantity, revised pricing, or a different production approach.",
      "We may modify orientation, support strategy, brim or raft use, slicing settings, layer height, infill, wall count, print temperature, speed, and other profile choices when needed for a practical print.",
      "Unless a specific tolerance is confirmed in writing for a custom job, 3D printed parts should be expected to have normal layer lines, minor surface variation, support marks, small dimensional variation, and material-specific finish differences.",
      "Queue position and ETA are estimates. Printer availability, material changes, failed prints, maintenance, power or network interruptions, operator holds, payment review, and safety checks can change timing.",
      "Customer-supplied files remain subject to technical limits. A model that can be uploaded is not automatically guaranteed to be printable, durable, functional, watertight, food-safe, heat-safe, child-safe, or suitable for regulated use.",
      "We may combine, split, nest, batch, or reschedule jobs to protect print quality, reduce waste, improve throughput, or handle printer maintenance."
    ]
  },
  {
    id: "refunds",
    label: "Refunds & Cancellations",
    icon: BadgeCheck,
    title: "Refunds, Cancellations, and Reprints",
    summary: "Plain rules for order changes, failed prints, cancelled jobs, and reprint decisions.",
    items: [
      "If an order is cancelled before production starts, we may refund the eligible order amount according to payment provider timing, checkout terms, and any non-refundable processing costs shown or charged by our providers.",
      "Once production has started, cancellation options may be limited because material, machine time, preparation work, and operator review may already have been used.",
      "If a print fails because of our machine, material, slicing, handling, or process issue, we may reprint, credit, remake, or refund the affected item at our discretion.",
      "If a part arrives damaged, visibly incorrect, or materially different from the approved order, contact us promptly with photos, order details, packaging photos when shipping is involved, and a description of the issue.",
      "Issues caused by inaccurate files, incorrect dimensions, fragile geometry, unsupported thin features, wrong customer instructions, unsuitable material selection, normal layer lines, expected support marks, or misuse after delivery may not qualify for a refund.",
      "Custom printed parts are made to order. We generally cannot take completed custom items back simply because a customer changed their mind after production began or after the item was completed as ordered.",
      "For multi-item orders, we may resolve only the affected item rather than the full order when the rest of the order was produced correctly."
    ]
  },
  {
    id: "shipping",
    label: "Shipping & Pickup",
    icon: Truck,
    title: "Shipping, Pickup, and Delivery",
    summary: "How completed prints leave the factory and what customers should expect.",
    items: [
      "Orders may be shipped or made available for pickup depending on available checkout options, local availability, part size, material, packaging needs, and customer selection.",
      "Shipping timelines are separate from print production timelines and may vary based on carrier, destination, weather, holidays, failed delivery attempts, or carrier delays.",
      "Customers are responsible for providing accurate delivery information. Incorrect addresses, missing apartment numbers, inaccessible delivery locations, or failed delivery attempts may cause delays or additional costs.",
      "Risk of delay or loss may shift once a package is handed to the carrier, but we will help provide available order and tracking information for carrier claims when appropriate.",
      "Pickup orders should be collected within a reasonable time after notification unless other arrangements are made. Unclaimed items may be held, recycled, discarded, or otherwise handled according to our storage capacity and customer communication history.",
      "We may choose packaging based on part geometry, fragility, material, destination, and sustainability goals. Very fragile geometry may still be vulnerable during shipping even with careful packaging."
    ]
  },
  {
    id: "content",
    label: "Model Content",
    icon: AlertTriangle,
    title: "Model Content and Prohibited Uses",
    summary: "What customers may upload and what SuperPrint will not produce.",
    items: [
      "You must have the legal right to upload, modify if needed for printing, and manufacture the model files you submit.",
      "Do not upload files that infringe someone else’s rights, violate privacy, contain malware, include hidden malicious data, impersonate another person or brand, or are intended for unlawful use.",
      "We may reject weapons, weapon components, regulated items, unsafe parts, deceptive products, bypass tools, harmful devices, or anything we determine creates unreasonable legal, safety, reputational, or operational risk.",
      "We may also reject hateful, harassing, sexually exploitative, invasive, or abusive content, and we may report activity when required or appropriate.",
      "SuperPrint does not certify customer designs for load-bearing, medical, dental, electrical, automotive, aerospace, food-contact, child-safety, fire-safety, pressure, protective, or life-safety use unless explicitly agreed in a separate written agreement.",
      "You are responsible for testing, validating, installing, and using printed parts safely. 3D printed parts can fail, deform, melt, crack, absorb moisture, wear down, or behave differently than injection molded, machined, cast, or certified parts.",
      "We may remove, restrict, or retain records related to files or orders when needed to review abuse, protect the platform, comply with law, or enforce these terms."
    ]
  },
  {
    id: "supporters",
    label: "Supporter Terms",
    icon: PackageCheck,
    title: "Factory Supporter and Upgrade Goal Terms",
    summary: "Rules for supporter tiers, community goals, badges, and factory contributions with no company stake or payout rights.",
    items: [
      "Factory supporter tiers, badges, queue flair, supporter walls, early feature access, priority windows, material previews, timelapse downloads, upgrade goals, and community recognition are optional platform perks.",
      "Factory contributions and supporter payments do not provide a company stake, voting control, payout rights, revenue share, resale right, or any promise of financial gain.",
      "Upgrade goals represent intended infrastructure improvements such as printers, materials, cameras, nozzles, dryers, lighting, monitoring tools, automation systems, and livestream upgrades. Availability, timing, pricing, vendors, specifications, and implementation may change.",
      "If a goal cannot be completed as originally described, we may redirect progress toward a similar factory capability, pause the goal, replace the goal, credit affected supporters where appropriate, or explain the change publicly on the platform.",
      "Supporter perks may be adjusted, renamed, paused, or replaced as the platform grows, as long as the system remains fair and operationally realistic.",
      "Queue boosts, priority windows, moderation review, and early material access must remain balanced with standard customer access. Supporter perks should never make normal customers unable to use the service.",
      "Public recognition may use your account name, display name, badge, message, contribution amount, or supporter tier when you choose a public option. Anonymous support will be shown without your public identity."
    ]
  },
  {
    id: "live",
    label: "Live Feed & Telemetry",
    icon: ShieldCheck,
    title: "Live Feed, Queue Data, and Telemetry",
    summary: "What may be public, what stays private, and how livestream features should be treated.",
    items: [
      "Public pages may show queue status, printer health summaries, safe telemetry, activity events, livestreams, print statistics, upgrade progress, milestone events, and public supporter recognition.",
      "We do not intentionally expose internal IPs, admin APIs, printer controls, node communication, infrastructure secrets, private credentials, payment internals, or other sensitive infrastructure details.",
      "Livestreams and telemetry are provided for transparency and may be delayed, unavailable, paused, edited, rate-limited, or inaccurate during maintenance, outages, safety checks, failed prints, operator review, or privacy review.",
      "Production media may be used for order records, support, quality checks, customer experience, public demos, social posts, and platform education when it does not reveal private customer information or restricted content.",
      "Queue data is informational. It may not reflect every operator action, internal hold, material reservation, failed attempt, test print, maintenance task, or admin decision.",
      "Do not rely on livestreams, progress bars, ETA estimates, or telemetry for safety-critical monitoring or time-sensitive commitments."
    ]
  },
  {
    id: "sustainability",
    label: "Sustainability",
    icon: Recycle,
    title: "Sustainability and Recycling",
    summary: "How SuperPrint talks about recycling, waste reduction, and material responsibility.",
    items: [
      "We aim to reduce waste through on-demand production, careful file review, print monitoring, material tracking, reusable packaging where practical, and separation of reusable or recyclable scrap where feasible.",
      "Recycling availability depends on material type, color, contamination, additives, local programs, supplier requirements, volume, and operational feasibility.",
      "Sustainability statements describe our operating goals and current processes. They are not guarantees that every print, support structure, purge line, spool, package, or failed part can be recycled.",
      "We may track filament usage, failed prints, scrap, packaging choices, and material recovery to improve operations and report factory progress.",
      "Future programs may include recycled filament, refill spools, waste reporting, biodegradable packaging, carbon tracking, customer take-back options, and better material recovery.",
      "When sustainability and part quality conflict, we may prioritize safety, durability, customer requirements, and print reliability."
    ]
  },
  {
    id: "ip",
    label: "IP & Rights",
    icon: FileText,
    title: "Intellectual Property and File Rights",
    summary: "How model file rights, brand assets, and production media are handled.",
    items: [
      "You keep the rights you already have in model files you upload, subject to the permission SuperPrint needs to review, quote, modify for manufacturability, slice, manufacture, store, document, support, and reprint your order.",
      "Submitting a file does not give us permission to sell that file as a standalone digital product or add it to a public catalog unless you separately agree.",
      "SuperPrint controls its brand assets, site design, software, factory dashboard, production workflow, generated platform media, and internal production systems.",
      "You are responsible for ensuring your uploaded files do not violate another person or company’s intellectual property, publicity, privacy, contract, or licensing rights.",
      "If you ask us to print a file from a marketplace, designer, open-source project, or third-party library, you are responsible for following that license, including commercial-use limits, attribution terms, and remix restrictions.",
      "We may remove, reject, restrict, or preserve files or products if we believe they create intellectual property, safety, compliance, or platform integrity concerns."
    ]
  },
  {
    id: "contact",
    label: "Contact",
    icon: BadgeCheck,
    title: "Questions and Contact",
    summary: "How to ask about orders, legal terms, privacy, or production concerns.",
    items: [
      "For order questions, use your account dashboard, order page, confirmation email, or the support channel available on the site.",
      "For privacy, legal, refund, safety, file-rights, supporter, or production concerns, contact SuperPrint through the site support channel or the contact method provided during checkout.",
      "If a dispute comes up, please contact us first so we can review order records, uploaded files, production notes, photos, telemetry, shipping information, and support messages.",
      "These terms may be updated as the platform, factory, materials, payment flow, privacy tools, supporter system, shipping process, or legal requirements change.",
      "The version posted on this page applies when you use the site after it is posted. Checkout-specific terms shown during an order may also apply to that order.",
      "This page is a practical operating policy for SuperPrint and is not a substitute for advice from a qualified attorney."
    ]
  }
];

export default function LegalPage() {
  return (
    <PageShell>
      <PageSection className="grid gap-8">
        <section id="top" className="relative overflow-hidden rounded-2xl border bg-card/65 p-6 md:p-8">
          <div className="brand-toolpath absolute inset-0 opacity-10" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Legal center</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">Clear terms for a transparent factory.</h1>
            <p className="mt-5 max-w-3xl text-muted-foreground">
              Review SuperPrint policies for orders, uploads, privacy, refunds, livestreams, sustainability, and factory supporter perks.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Legal sections" className="cyber-surface rounded-2xl p-3">
              {legalSections.map(({ id, label, icon: Icon }) => (
                <Link key={id} href={`#${id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  <Icon className="size-4 text-primary" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </aside>

          <main className="grid gap-4">
            {legalSections.map(({ id, title, summary, items, icon: Icon }) => (
              <section key={id} id={id} className="scroll-mt-24 rounded-2xl border bg-card/55 p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg border bg-background/55 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
                    </div>
                    <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{summary}</p>
                  </div>
                  <Link href="#top" className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">Top</Link>
                </div>
                <div className="mt-5 grid gap-3">
                  {items.map((item) => (
                    <div key={item} className="rounded-xl border bg-background/45 p-4">
                      <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </main>
        </div>
      </PageSection>
    </PageShell>
  );
}
