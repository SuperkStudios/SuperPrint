import { z } from "zod";

export const operatorStartChecklistSchema = z.object({
  correctFilamentLoaded: z.literal(true),
  buildPlateClear: z.literal(true),
  cameraVisible: z.literal(true),
  printerAreaSafe: z.literal(true),
  gcodeVerifiedOnNode: z.literal(true)
});

export type OperatorStartChecklist = z.infer<typeof operatorStartChecklistSchema>;

export function approveOperatorPrintStart(
  job: { id: string; status: string },
  input: { operatorId: string; checklist: Record<string, unknown> },
  approvedAt = new Date()
) {
  if (job.status !== "READY_ON_NODE") {
    throw new Error("Only ready-on-node jobs can be approved for physical start");
  }
  const checklist = operatorStartChecklistSchema.safeParse(input.checklist);
  if (!checklist.success) {
    throw new Error("All operator safety checklist items must be confirmed");
  }

  return {
    status: "AWAITING_OPERATOR_START" as const,
    operatorStartApprovedById: input.operatorId,
    operatorStartApprovedAt: approvedAt,
    operatorStartChecklist: checklist.data
  };
}
