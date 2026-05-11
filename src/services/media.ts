import { prisma } from "@/lib/prisma";
import { resolveLocalStoragePath } from "@/lib/storage";
import { recordPlatformEvent } from "./events";

export async function attachExistingOrderMedia(
  orderId: string,
  media: {
    title: string;
    videoKey: string;
    timelapseKey?: string;
    thumbnailKey?: string;
    durationSec: number;
  },
  actorId?: string
) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  const record = await prisma.orderVideo.create({
    data: {
      orderId,
      title: media.title,
      storageKey: media.videoKey,
      timelapseStorageKey: media.timelapseKey,
      thumbnailStorageKey: media.thumbnailKey,
      playbackUrl: "/api/media/local",
      durationSec: media.durationSec
    }
  });

  await recordPlatformEvent({
    type: "VIDEO_READY",
    actorId,
    payload: {
      orderNumber: order.orderNumber,
      videoKey: media.videoKey,
      timelapseKey: media.timelapseKey,
      thumbnailKey: media.thumbnailKey,
      localVolumePath: resolveLocalStoragePath(media.videoKey)
    }
  });

  return record;
}
