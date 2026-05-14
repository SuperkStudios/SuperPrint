"use client";

import { useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";

const printerFrames = [
  "/assets/generated/printer-sequence-v2/frame-01.png",
  "/assets/generated/printer-sequence-v2/frame-02.png",
  "/assets/generated/printer-sequence-v2/frame-03.png"
] as const;

export function PrinterHeroVisual({ progressPercent }: { progressPercent: number }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const nextFrame = Math.min(printerFrames.length - 1, Math.max(0, Math.round(latest / 70)));
    setFrameIndex(nextFrame);
  });

  return (
    <div
      ref={sceneRef}
      aria-label="3D printer scroll animation"
      className="printer-sequence-scene relative min-h-[31rem] overflow-hidden rounded-[1.5rem] border bg-background/45"
    >
      <div className="printer-sequence-caption">Scroll to print layer by layer</div>
      <div className="printer-sequence-stage">
        {printerFrames.map((src, index) => (
          <img
            key={src}
            alt={index === frameIndex ? `3D printer printing frame ${index + 1}` : ""}
            aria-hidden={index === frameIndex ? undefined : true}
            className="printer-sequence-image"
            data-active={index === frameIndex}
            draggable={false}
            src={src}
          />
        ))}
      </div>
      <div className="printer-sequence-progress">Layer {frameIndex + 1}/3</div>
    </div>
  );
}
