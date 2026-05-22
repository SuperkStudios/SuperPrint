"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { Maximize2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePrinterFeedStatus } from "@/hooks/use-printer-feed-status";

export function LiveBedFeed({
  streamUrl = "/api/printer-feed/stream",
  printerName,
  currentPrint
}: {
  streamUrl?: string;
  printerName: string;
  currentPrint: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveStatus = usePrinterFeedStatus();
  const [state, setState] = useState<"loading" | "online" | "offline">("loading");
  const [retryToken, setRetryToken] = useState(0);
  const activeStreamUrl = liveStatus?.streamUrl || streamUrl;
  const activeCameraSource = liveStatus?.cameraSource ?? null;
  const isWebRtcPage = activeCameraSource === "mediamtx-webrtc";
  const isHls = activeStreamUrl.endsWith(".m3u8");
  const isMjpeg = !isWebRtcPage && !isHls;
  const mjpegSrc = `${activeStreamUrl}${activeStreamUrl.includes("?") ? "&" : "?"}r=${retryToken}`;

  useEffect(() => {
    let destroyed = false;
    let hls: Hls | null = null;

    async function connect() {
      const video = videoRef.current;
      if (!video || !isHls) return;
      setState("loading");
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = activeStreamUrl;
        } else {
          const HlsConstructor = (await import("hls.js")).default;
          if (!HlsConstructor.isSupported()) throw new Error("HLS unsupported");
          hls = new HlsConstructor({ lowLatencyMode: true, backBufferLength: 20 });
          hls.loadSource(activeStreamUrl);
          hls.attachMedia(video);
        }
        await video.play().catch(() => undefined);
        if (!destroyed) setState("online");
      } catch {
        if (!destroyed) setState("offline");
      }
    }

    connect();
    const retry = state === "offline"
      ? setTimeout(() => {
          if (destroyed) return;
          setState("loading");
          if (isMjpeg) setRetryToken((value) => value + 1);
          else void connect();
        }, 10000)
      : null;

    return () => {
      destroyed = true;
      if (retry) clearTimeout(retry);
      hls?.destroy();
    };
  }, [activeStreamUrl, state, isHls, isMjpeg]);

  async function fullscreen() {
    const element = videoRef.current ?? document.querySelector<HTMLImageElement>("[data-live-bed-feed]");
    await element?.requestFullscreen?.();
  }

  return (
    <div className="relative overflow-hidden rounded-[1rem] border border-cyan-300/20 bg-black shadow-[0_0_120px_rgba(34,211,238,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(34,211,238,0.18),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_40%)]" />
      {isWebRtcPage ? (
        <iframe
          data-live-bed-feed
          src={activeStreamUrl}
          title={`${printerName} live print bed`}
          allow="autoplay; fullscreen; picture-in-picture"
          className="relative aspect-video w-full border-0 bg-zinc-950"
          onLoad={() => setState("online")}
        />
      ) : isMjpeg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={retryToken}
          data-live-bed-feed
          src={mjpegSrc}
          alt={`${printerName} live print bed`}
          className="relative aspect-video w-full bg-zinc-950 object-cover"
          onLoad={() => setState("online")}
          onError={() => setState("offline")}
        />
      ) : (
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          controls={false}
          className="relative aspect-video w-full bg-zinc-950 object-cover"
        />
      )}
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
          <span>Relay: {activeCameraSource === "mediamtx-hls" ? "MediaMTX HLS" : activeCameraSource === "mediamtx-webrtc" ? "MediaMTX WebRTC" : "shared MJPEG"}</span>
          <span>Recording: armed</span>
          <span>Reconnect: on disconnect</span>
        </div>
      </div>
    </div>
  );
}
