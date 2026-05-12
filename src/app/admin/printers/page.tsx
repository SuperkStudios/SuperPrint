import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { refreshAllPrinterHeartbeats } from "@/services/printer-heartbeat";

export const dynamic = "force-dynamic";

export default async function AdminPrintersPage() {
  const printers = await refreshAllPrinterHeartbeats();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/admin/printers/new">Add printer</Link>
        </Button>
      </div>
      {printers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No printers registered</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add the first printer profile before queue preparation can assign jobs.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {printers.map((printer) => (
            <Card key={printer.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{printer.publicName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{printer.modelName}</p>
                </div>
                <Badge className={printer.heartbeatStatus === "ONLINE" ? "bg-emerald-600" : "bg-zinc-500"}>
                  {printer.heartbeatStatus === "ONLINE" ? "Online" : "Offline"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Nozzle" value={`${printer.nozzleSizeMm}mm`} />
                  <Metric label="Build volume" value={`${printer.buildVolumeXmm} x ${printer.buildVolumeYmm} x ${printer.buildVolumeZmm}mm`} />
                  <Metric label="Runtime" value={`${printer.totalRuntimeMinutes}m`} />
                  <Metric label="Completed" value={String(printer.completedPrintCount)} />
                  <Metric label="Heartbeat" value={printer.lastHeartbeatAt ? new Date(printer.lastHeartbeatAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not checked"} />
                  <Metric label="Latency" value={printer.heartbeatLatencyMs != null ? `${printer.heartbeatLatencyMs}ms` : "n/a"} />
                </div>
                <p className="text-muted-foreground">{printer.healthDescription}</p>
                <p>
                  Active spool:{" "}
                  {printer.currentFilament
                    ? `${printer.currentFilament.color} ${printer.currentFilament.material}`
                    : "None assigned"}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/printers/${printer.id}/edit`}>Edit profile</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
