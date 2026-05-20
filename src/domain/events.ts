export const platformEventTypes = [
  "ORDER_CREATED",
  "MODEL_UPLOADED",
  "MODEL_APPROVED",
  "MODEL_REJECTED",
  "SLICING_BLOCKED",
  "SLICING_FAILED",
  "SLICING_COMPLETE",
  "QUEUE_ADMITTED",
  "JOB_READY_ON_NODE",
  "OPERATOR_PRINT_START_APPROVED",
  "PRINT_COMMAND_ACKNOWLEDGED",
  "PRINT_STARTED",
  "PRINT_PAUSED",
  "PRINT_REQUEUED",
  "MANUAL_PRINT_DETECTED",
  "PRINT_COMPLETED",
  "PRINT_STOPPED",
  "PRINT_FAILED",
  "FILAMENT_LOW",
  "MAINTENANCE_DUE",
  "VIDEO_READY",
  "FACTORY_CONTRIBUTION_CREATED",
  "FACTORY_GOAL_FUNDED",
  "FACTORY_GOAL_COMPLETED",
  "FACTORY_SUPPORTER_JOINED",
  "FACTORY_MILESTONE_COMPLETED",
  "FACTORY_UPGRADE_UNLOCKED"
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

export function isPublicPlatformEvent(event: Pick<PlatformEventInput, "type" | "payload">) {
  if (typeof event.payload.adminAction === "string" && event.payload.adminAction.startsWith("PRODUCT_")) return false;
  return true;
}

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
  "signedUrl",
  "nodeLocalJobPath",
  "internalNodeId",
  "gcodeLocalPath",
  "outputStorageKey"
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
