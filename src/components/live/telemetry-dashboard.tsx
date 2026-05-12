"use client";

import { Activity, Clock, Cpu, Gauge, Layers3, Thermometer, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { usePrinterFeedStatus } from "@/hooks/use-printer-feed-status";

type PublicQueue = Awaited<ReturnType<typeof import("@/services/queue").getPublicQueueState>>;

export function TelemetryDashboard({ queue }: { queue: PublicQueue }) {
  const livePrinter = usePrinterFeedStatus();
  const current = queue.current;
  const printer = current?.printer ?? queue.printers[0] ?? null;
  const centauriTelemetry = livePrinter?.telemetry?.state === "LIVE" ? livePrinter.telemetry : null;
  const telemetry = centauriTelemetry ?? (current?.telemetry?.state === "LIVE" ? current.telemetry : null);
  const progressPercent = current?.progressPercent ?? telemetry?.progressPercent ?? 0;
  const printerStatus = livePrinter?.online ? centauriTelemetry?.machineStatusLabel ?? "Online" : current?.status ?? "IDLE";
  const health = livePrinter?.online ? livePrinter.health : printer?.healthDescription ?? "No printer online";
  const activePrintTitle = current?.orderNumber ?? (centauriTelemetry?.machineStatus === 1 ? "Printer active outside SuperPrint queue" : "No active print");
  const activePrintDetails = current?.filament
    ? `${current.filament.color} ${current.filament.material} · ETA ${current.etaMinutes}m`
    : centauriTelemetry?.machineStatus === 1
      ? `Live printer job · ${formatRemaining(centauriTelemetry.remainingSeconds)} remaining`
      : "Filament assignment pending · ETA 0m";

  return (
    <div className="grid gap-4">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100">NOW PRINTING</Badge>
          <span className="flex items-center gap-2 text-sm text-emerald-200">
            <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            {printerStatus}
          </span>
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-white">{activePrintTitle}</h3>
        <p className="mt-2 text-sm text-zinc-400">{activePrintDetails}</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.9)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
          />
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Tile icon={Layers3} label="Layer progress" value={telemetry?.progressPercent != null ? `${telemetry.progressPercent}%` : "No active layer"} />
        <Tile icon={Thermometer} label="Nozzle temp" value={formatTemp(telemetry?.nozzleTempC, centauriTelemetry?.nozzleTargetC)} />
        <Tile icon={Gauge} label="Bed temp" value={formatTemp(telemetry?.bedTempC, centauriTelemetry?.bedTargetC)} />
        <Tile icon={Clock} label="Remaining" value={telemetry?.remainingSeconds != null ? formatRemaining(telemetry.remainingSeconds) : `${current?.etaMinutes ?? 0}m`} />
        <Tile icon={Cpu} label="Printer health" value={health} />
        <Tile icon={Activity} label="Runtime speed" value={centauriTelemetry?.printSpeedPercent != null ? `${centauriTelemetry.printSpeedPercent}%` : "Operator governed"} />
      </div>

      <motion.div layout className="rounded-2xl border border-white/10 bg-black/35 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Next in queue</h3>
          <Zap className="size-4 text-orange-200" />
        </div>
        <div className="mt-4 space-y-3">
          {queue.nextJobs.length ? queue.nextJobs.slice(0, 3).map((job) => (
            <motion.div key={job.id} layout className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
              <span className="font-medium text-zinc-100">{job.orderNumber}</span>
              <span className="text-zinc-400">#{job.queuePosition ?? "?"} · {job.etaMinutes}m</span>
            </motion.div>
          )) : (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">Queue is clear. New approved jobs will appear here.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function formatTemp(current?: number | null, target?: number | null) {
  if (current == null) return "Waiting for printer";
  const currentRounded = Math.round(current);
  const targetRounded = target == null ? null : Math.round(target);
  return targetRounded != null && targetRounded > 0 ? `${currentRounded}C / ${targetRounded}C` : `${currentRounded}C`;
}

function formatRemaining(seconds: number | null) {
  if (seconds == null) return "Waiting";
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function Tile({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
      <Icon className="size-4 text-cyan-200" />
      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}
