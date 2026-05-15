import { Prisma } from "@prisma/client";
import { isPublicPlatformEvent, sanitizePlatformEvent, type PlatformEventType } from "../domain/events";
import { prisma } from "../lib/prisma";

export async function recordPlatformEvent(input: {
  type: PlatformEventType;
  actorId?: string;
  payload: Record<string, unknown>;
}) {
  return prisma.platformEvent.create({
    data: {
      type: input.type,
      actorId: input.actorId,
      payload: input.payload as Prisma.InputJsonObject
    }
  });
}

export async function listPublicEvents(limit = 20) {
  const events = await prisma.platformEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit * 3
  });

  return events
    .filter((event) => isPublicPlatformEvent({ type: event.type, payload: event.payload as Record<string, unknown> }))
    .slice(0, limit)
    .map((event) =>
      sanitizePlatformEvent({
        id: event.id,
        type: event.type,
        createdAt: event.createdAt,
        payload: event.payload as Record<string, unknown>
      })
    );
}
