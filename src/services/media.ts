import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { resolveLocalStoragePath } from "@/lib/storage";
import { recordPlatformEvent } from "./events";

export async function attachDemoOrderMedia(orderId: string, actorId?: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const videoKey = `videos/${order.orderNumber}-demo.mp4`;
  const timelapseKey = `timelapses/${order.orderNumber}-demo.mp4`;
  const thumbnailKey = `thumbnails/${order.orderNumber}-demo.svg`;

  await Promise.all([
    writePlaceholder(videoKey, `Demo print video for ${order.orderNumber}\n`),
    writePlaceholder(timelapseKey, `Demo timelapse for ${order.orderNumber}\n`),
    writePlaceholder(
      thumbnailKey,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#0f172a"/><text x="48" y="190" fill="#22d3ee" font-family="Arial" font-size="42">${order.orderNumber}</text></svg>`
    )
  ]);

  const media = await prisma.orderVideo.create({
    data: {
      orderId,
      title: `${order.orderNumber} local media package`,
      storageKey: videoKey,
      timelapseStorageKey: timelapseKey,
      thumbnailStorageKey: thumbnailKey,
      playbackUrl: "/api/media/local",
      durationSec: 30
    }
  });

  await recordPlatformEvent({
    type: "VIDEO_READY",
    actorId,
    payload: {
      orderNumber: order.orderNumber,
      videoKey,
      timelapseKey,
      thumbnailKey,
      localVolumePath: resolveLocalStoragePath(videoKey)
    }
  });

  return media;
}

async function writePlaceholder(storageKey: string, contents: string) {
  const localPath = resolveLocalStoragePath(storageKey);
  await mkdir(localPath.slice(0, localPath.lastIndexOf("/")), { recursive: true });
  await writeFile(localPath, contents);
}
