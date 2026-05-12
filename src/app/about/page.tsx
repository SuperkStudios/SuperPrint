import { redirect } from "next/navigation";
import { getBootstrapStatus } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  return (
    <main className="bg-white">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-primary">About us</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Transparent local manufacturing, one print at a time.</h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          SuperPrint is built around observable manufacturing: customers can browse approved products,
          submit custom STL files, and follow the real production queue without exposing printer controls
          or internal operations.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Queue-first", "The live queue is the customer experience, not an internal afterthought."],
            ["Operator-gated", "Physical print starts require an authenticated operator checklist."],
            ["Local-first", "Uploads, sliced files, videos, logs, and backups are handled through Docker-mounted local storage."]
          ].map(([title, copy]) => (
            <div key={title} className="rounded-lg border p-5">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
