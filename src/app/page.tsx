const pillars = [
  {
    title: "Slice",
    body: "Run local slicer profiles and prepare print-ready artifacts without tying the workflow to one printer brand."
  },
  {
    title: "Dispatch",
    body: "Hand jobs to local SuperNode agents that can speak to printers, report readiness, and acknowledge print commands."
  },
  {
    title: "Observe",
    body: "Normalize queue state, telemetry, media, maintenance, and printer health into APIs other apps can build on."
  }
];

const systems = ["SuperNode", "SuperQueue", "SuperSlice", "SuperVision", "SuperMaintain", "Adapter APIs"];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-6 py-16 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">SuperPrint OS</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
            Open software for connecting slicers, printers, queues, and telemetry.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            This public repo is the manufacturing interconnect: local printer agents, slicing infrastructure, job dispatch,
            hardware adapters, live media plumbing, and observable production APIs. Product storefronts and company-specific
            customer experiences can live downstream or privately on top of it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {systems.map((system) => (
              <span key={system} className="rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                {system}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-12 sm:px-8 md:grid-cols-3">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="rounded border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">{pillar.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 sm:px-8">
        <div className="rounded border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Local API smoke check</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            After starting Docker, use <code className="rounded bg-muted px-1.5 py-0.5">/api/health</code> to verify the
            public interconnect service is responding.
          </p>
        </div>
      </section>
    </main>
  );
}
