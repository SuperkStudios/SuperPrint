import Link from "next/link";
import { ArrowRight, Box, Eye, Radio, ShieldCheck } from "lucide-react";
import { LiveQueue } from "@/components/live-queue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicQueueState } from "@/services/queue";
import { listPublicEvents } from "@/services/events";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [queue, events] = await Promise.all([getPublicQueueState(), listPublicEvents(6)]);

  return (
    <main>
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-primary via-secondary to-accent" />
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <Badge className="bg-primary/10 text-primary">Observable manufacturing</Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              SuperPrint
            </h1>
            <p className="mt-5 max-w-2xl text-xl text-muted-foreground">
              A transparent print-on-demand platform where customers buy approved products or upload
              STL files, then watch their manufacturing slot move through a live queue.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="default">
                <Link href="/store">
                  Browse products
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/upload">Upload STL</Link>
              </Button>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ["Live queue", "Manufacturing status is visible before, during, and after print."],
                ["Approval gate", "Uploaded models are reviewed before checkout is enabled."],
                ["Video receipt", "Completed orders keep a downloadable print capture."]
              ].map(([title, copy]) => (
                <div key={title} className="border-l-2 border-primary pl-4">
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-zinc-950 p-5 text-white shadow-2xl shadow-primary/20">
            <div className="factory-grid rounded border border-white/10 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Factory cell A</span>
                <Badge className="border-emerald-300/30 bg-emerald-300/10 text-emerald-100">Live</Badge>
              </div>
              <div className="mt-12 grid grid-cols-[1fr_96px] items-end gap-6">
                <div className="space-y-4">
                  <div className="h-28 rounded border border-cyan-300/40 bg-cyan-300/10" />
                  <div className="h-8 rounded bg-emerald-300/20" />
                  <div className="h-8 rounded bg-amber-300/30" />
                </div>
                <div className="h-56 rounded bg-white/10 p-3">
                  <div className="h-full rounded bg-amber-300/70" />
                </div>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
                <Status icon={Radio} label="Stream" value="Public" />
                <Status icon={Eye} label="Queue" value="Visible" />
                <Status icon={ShieldCheck} label="Controls" value="Private" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <LiveQueue queue={queue} events={events} />
      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            ["Approved products", "Catalog SKUs are pre-priced, printable, and checkout-ready."],
            ["Custom uploads", "STLs enter review before price, ETA, and payment are unlocked."],
            ["Admin operations", "Queue, printer, filament, maintenance, and video workflows live behind roles."]
          ].map(([title, copy]) => (
            <div key={title} className="rounded-lg border p-6">
              <Box className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Status({ icon: Icon, label, value }: { icon: typeof Radio; label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.04] p-3">
      <Icon className="size-4 text-cyan-200" />
      <p className="mt-3 text-zinc-500">{label}</p>
      <p>{value}</p>
    </div>
  );
}
