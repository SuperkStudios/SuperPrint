import { Layers3, PackageOpen } from "lucide-react";
import { PartInventoryForm } from "@/components/part-inventory-form";
import { ProductionPlateControls } from "@/components/production-plate-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-permissions";
import { getPartInventoryRows, getPartProductionPlanner } from "@/services/part-planner";
import { getProductionPlateDashboard } from "@/services/production-plates";

export const dynamic = "force-dynamic";

export default async function AdminPartsPage() {
  await requireAdminPage("products");
  const [parts, planner, production] = await Promise.all([getPartInventoryRows(), getPartProductionPlanner(), getProductionPlateDashboard()]);
  const toPrintCount = planner.reduce((total, row) => total + row.quantityToPrint, 0);
  const plateCount = planner.reduce((total, row) => total + row.suggestedPlateCount, 0);
  const nextPlate = production.next;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Parts and build plates</h2>
          <p className="mt-2 text-sm text-muted-foreground">Track stored product parts and group open paid orders by part and color.</p>
        </div>
        <ProductionPlateControls />
        <div className="grid gap-2 sm:grid-cols-2">
          <Metric icon={<PackageOpen className="h-4 w-4" />} label="Parts to print" value={toPrintCount} />
          <Metric icon={<Layers3 className="h-4 w-4" />} label="Suggested plates" value={plateCount} />
        </div>
      </div>

      {nextPlate ? (
        <Card>
          <CardHeader>
            <CardTitle>Next operator action</CardTitle>
            <p className="text-sm text-muted-foreground">
              Load {nextPlate.color} filament for {nextPlate.productPart.product.name} · {nextPlate.productPart.name}, plate {nextPlate.plateIndex} of {nextPlate.plateCount}.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid gap-2 md:grid-cols-4">
              <Metric icon={<PackageOpen className="h-4 w-4" />} label="Plate qty" value={nextPlate.quantityPlanned} />
              <Metric icon={<PackageOpen className="h-4 w-4" />} label="Stored used" value={nextPlate.inventoryUsedQuantity} />
              <Metric icon={<Layers3 className="h-4 w-4" />} label="Minutes" value={nextPlate.estimatedPrintMinutes ?? 0} />
              <Metric icon={<Layers3 className="h-4 w-4" />} label="Grams" value={nextPlate.estimatedGrams ?? 0} />
            </div>
            <ProductionPlateControls jobId={nextPlate.id} />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3">
        <h3 className="text-lg font-semibold">Build plate plan</h3>
        {planner.length ? (
          <div className="overflow-x-auto rounded-md border bg-card">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[1.2fr_1fr_110px_110px_110px_110px_1.4fr] gap-3 bg-muted px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
                <span>Product</span>
                <span>Part</span>
                <span>Color</span>
                <span>Needed</span>
                <span>Stored</span>
                <span>Print</span>
                <span>Orders</span>
              </div>
              {planner.map((row) => (
                <div key={row.key} className="grid grid-cols-[1.2fr_1fr_110px_110px_110px_110px_1.4fr] gap-3 border-t px-4 py-3 text-sm">
                  <span className="font-medium">{row.productName}</span>
                  <span>{row.partName}</span>
                  <span>{row.color}</span>
                  <span>{row.requiredQuantity}</span>
                  <span>{row.quantityOnHand}</span>
                  <span className="grid gap-1">
                    <span>
                      <Badge className={row.quantityToPrint ? "" : "bg-secondary"}>{row.quantityToPrint}</Badge>
                      {row.quantityToPrint ? <span className="ml-2 text-xs text-muted-foreground">{row.suggestedPlateCount} plate{row.suggestedPlateCount === 1 ? "" : "s"}</span> : null}
                    </span>
                    {row.plates.length ? (
                      <span className="text-xs text-muted-foreground">
                        {row.plates.map((plate) => `Plate ${plate.plateIndex}/${plate.plateCount}: ${plate.quantity}/${plate.maxPerPlate}${plate.isFull ? " full" : ""}`).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-muted-foreground">{row.orders.map((order) => `${order.orderNumber} (${order.quantity})`).join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : <Card><CardContent className="p-5 text-sm text-muted-foreground">No paid or deposited orders currently need product parts.</CardContent></Card>}
      </section>

      <section className="grid gap-3">
        <h3 className="text-lg font-semibold">Production plate jobs</h3>
        {production.plateJobs.length ? (
          <div className="overflow-x-auto rounded-md border bg-card">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[1fr_1fr_100px_90px_90px_100px_1.4fr] gap-3 bg-muted px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
                <span>Product</span>
                <span>Part</span>
                <span>Color</span>
                <span>Status</span>
                <span>Qty</span>
                <span>Estimate</span>
                <span>Controls</span>
              </div>
              {production.plateJobs.map((job) => (
                <div key={job.id} className="grid grid-cols-[1fr_1fr_100px_90px_90px_100px_1.4fr] gap-3 border-t px-4 py-3 text-sm">
                  <span className="font-medium">{job.productPart.product.name}</span>
                  <span>{job.productPart.name} · plate {job.plateIndex}/{job.plateCount}</span>
                  <span>{job.color}</span>
                  <span><Badge>{job.status}</Badge></span>
                  <span>{job.quantityPlanned}</span>
                  <span>{job.estimatedPrintMinutes ? `${job.estimatedPrintMinutes}m` : "-"} · {job.estimatedGrams ? `${job.estimatedGrams}g` : "-"}</span>
                  <ProductionPlateControls jobId={job.id} />
                </div>
              ))}
            </div>
          </div>
        ) : <Card><CardContent className="p-5 text-sm text-muted-foreground">No production plate jobs yet. Rebuild plate jobs after paid orders are entered.</CardContent></Card>}
      </section>

      <section className="grid gap-3">
        <h3 className="text-lg font-semibold">Part inventory</h3>
        {parts.length ? parts.map((part) => (
          <Card key={part.id}>
            <CardHeader>
              <CardTitle>{part.product.name} · {part.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{part.role} · slot {part.colorSlotIndex + 1} · {part.quantityPerUnit} per finished item</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {part.inventory.map((item) => (
                <PartInventoryForm
                  key={item.id}
                  productPartId={part.id}
                  initialColor={item.color}
                  initialQuantity={item.quantityOnHand}
                  initialLocation={item.location}
                  initialNotes={item.notes}
                />
              ))}
              <PartInventoryForm productPartId={part.id} />
            </CardContent>
          </Card>
        )) : <Card><CardContent className="p-5 text-sm text-muted-foreground">No product parts found. Add individual part files on a product first.</CardContent></Card>}
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="grid min-w-36 gap-1 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs uppercase">{label}</span></div>
      <strong className="text-xl">{value}</strong>
    </div>
  );
}
