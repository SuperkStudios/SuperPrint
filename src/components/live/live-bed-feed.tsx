"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { Maximize2, Radio, VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function LiveBedFeed({
  streamUrl = "/api/live/printer/main.m3u8",
  printerName,
  currentPrint
}: {
  streamUrl?: string;
  printerName: string;
  currentPrint: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "online" | "offline">("loading");

  useEffect(() => {
    let destroyed = false;
    let hls: Hls | null = null;

    async function connect() {
      const video = videoRef.current;
      if (!video) return;
      setState("loading");
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;
        } else {
          const HlsConstructor = (await import("hls.js")).default;
          if (!HlsConstructor.isSupported()) throw new Error("HLS unsupported");
          hls = new HlsConstructor({ lowLatencyMode: true, backBufferLength: 20 });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
        }
        await video.play().catch(() => undefined);
        if (!destroyed) setState("online");
      } catch {
        if (!destroyed) setState("offline");
      }
    }

    connect();
    const retry = setInterval(() => {
      if (!destroyed && state === "offline") connect();
    }, 10000);

    return () => {
      destroyed = true;
      clearInterval(retry);
      hls?.destroy();
    };
  }, [streamUrl, state]);

  async function fullscreen() {
    await videoRef.current?.requestFullscreen?.();
  }

  return (
    <div className="relative overflow-hidden rounded-[1rem] border border-cyan-300/20 bg-black shadow-[0_0_120px_rgba(34,211,238,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(34,211,238,0.18),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_40%)]" />
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        controls={false}
        className={`relative aspect-video w-full bg-zinc-950 object-cover ${state === "online" ? "opacity-100" : "opacity-0"}`}
      />
      {state !== "online" ? (
        <div className="absolute inset-0 grid place-items-center bg-zinc-950">
          <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent,rgba(34,211,238,0.12),transparent)]" />
          <div className="relative text-center">
            <VideoOff className="mx-auto size-9 text-cyan-200" />
            <p className="mt-3 font-medium text-white">{state === "loading" ? "Connecting to live bed feed" : "Camera stream offline"}</p>
            <p className="mt-1 text-sm text-zinc-400">Waiting for self-hosted HLS at {streamUrl}</p>
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <Badge className={state === "online" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-orange-300/30 bg-orange-300/10 text-orange-100"}>
          <Radio className="mr-1 size-3" />
          {state === "online" ? "LIVE" : "STREAM WAITING"}
        </Badge>
        <Button type="button" size="sm" variant="secondary" onClick={fullscreen}>
          <Maximize2 className="size-4" />
        </Button>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent p-4 text-white">
        <p className="text-sm text-zinc-300">{printerName}</p>
        <p className="text-xl font-semibold">{currentPrint}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
          <span>Latency: low-latency HLS</span>
          <span>Recording: armed</span>
          <span>Reconnect: 10s</span>
        </div>
      </div>
    </div>
  );
}
