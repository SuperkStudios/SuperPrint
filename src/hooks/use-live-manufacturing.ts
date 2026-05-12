"use client";

import { useEffect, useMemo, useState } from "react";

export type LiveManufacturingSnapshot = {
  connected: boolean;
  updatedAt: string | null;
  queue: unknown | null;
  events: Array<{ id: string; type: string; createdAt: string; payload: Record<string, unknown> }>;
};

export function useLiveManufacturing(initialEvents: LiveManufacturingSnapshot["events"] = []) {
  const [events, setEvents] = useState(initialEvents);
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("snapshot", (event) => {
      setEvents(JSON.parse((event as MessageEvent).data));
      setConnected(true);
      setUpdatedAt(new Date().toISOString());
    });
    source.addEventListener("platform", (event) => {
      setEvents(JSON.parse((event as MessageEvent).data));
      setConnected(true);
      setUpdatedAt(new Date().toISOString());
    });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);

  return useMemo(
    () => ({ connected, updatedAt, queue: null, events }),
    [connected, events, updatedAt]
  );
}
