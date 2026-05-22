"use client";

import { useEffect, useState } from "react";
import type { PublicPrinterTelemetry } from "@/domain/printer-heartbeat";

export type PrinterFeedStatus = {
  online: boolean;
  printerName: string;
  health: string;
  streamUrl?: string | null;
  fallbackHlsUrl?: string | null;
  cameraSource?: string | null;
  heartbeatAt?: string | null;
  heartbeatLatencyMs?: number | null;
  telemetry: PublicPrinterTelemetry | { state: "WAITING_FOR_TELEMETRY" };
};

export function usePrinterFeedStatus() {
  const [status, setStatus] = useState<PrinterFeedStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/printer-feed/status", { cache: "no-store" });
        if (!response.ok) throw new Error(`Printer status failed with ${response.status}`);
        const nextStatus = (await response.json()) as PrinterFeedStatus;
        if (!cancelled) setStatus(nextStatus);
      } catch {
        if (!cancelled) setStatus(null);
      }
    };
    void load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return status;
}
