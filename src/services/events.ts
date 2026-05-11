import { prisma } from "@/lib/prisma";
import { sanitizePlatformEvent, type PlatformEventType } from "@/domain/events";

export async function recordPlatformEvent(input: {
  type: PlatformEventType;
  actorId?: string;
  payload: Record<string, unknown>;
}) {
  return prisma.platformEvent.create({
    data: {
      type: input.type,
      actorId: input.actorId,
      payload: input.payload
    }
  });
}

export async function listPublicEvents(limit = 20) {
  const events = await prisma.platformEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });

  return events.map((event) =>
    sanitizePlatformEvent({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      payload: event.payload as Record<string, unknown>
    })
  );
}
