export const platformEventTypes = [
  "ORDER_CREATED",
  "MODEL_UPLOADED",
  "MODEL_APPROVED",
  "MODEL_REJECTED",
  "PRINT_STARTED",
  "PRINT_PAUSED",
  "PRINT_REQUEUED",
  "PRINT_COMPLETED",
  "PRINT_FAILED",
  "FILAMENT_LOW",
  "MAINTENANCE_DUE",
  "VIDEO_READY"
] as const;

export type PlatformEventType = (typeof platformEventTypes)[number];
export type ActorRole = "PUBLIC" | "CUSTOMER" | "ADMIN" | "SYSTEM";

export type PlatformEventInput = {
  id: string;
  type: PlatformEventType;
  actorRole?: ActorRole;
  createdAt: Date | string;
  payload: Record<string, unknown>;
};

export type PublicPlatformEvent = {
  id: string;
  type: PlatformEventType;
  createdAt: string;
  payload: Record<string, unknown>;
};

const privatePayloadKeys = new Set([
  "adminNotes",
  "internalNotes",
  "printerApiToken",
  "printerInternalIp",
  "printerControlUrl",
  "rawGcodeUrl",
  "customerEmail",
  "paymentProviderId",
  "localVolumePath",
  "localVolumeKey",
  "signedUrl"
]);

export function sanitizePlatformEvent(event: PlatformEventInput): PublicPlatformEvent {
  return {
    id: event.id,
    type: event.type,
    createdAt: new Date(event.createdAt).toISOString(),
    payload: Object.fromEntries(
      Object.entries(event.payload).filter(([key]) => !privatePayloadKeys.has(key))
    )
  };
}

export function buildEventPayload(payload: Record<string, unknown>) {
  return {
    ...payload,
    public: Object.fromEntries(
      Object.entries(payload).filter(([key]) => !privatePayloadKeys.has(key))
    )
  };
}
