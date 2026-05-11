import { z } from "zod";
import { filamentMaterials } from "./printer-profile";

type ReviewableUpload = {
  id: string;
  status: string;
  storageKey: string;
  fileName: string;
};

const approvalSchema = z.object({
  adminNotes: z.string().trim().optional().default(""),
  estimatedGrams: z.number().int().positive(),
  estimatedPrintMinutes: z.number().int().positive(),
  selectedMaterial: z.enum(filamentMaterials),
  selectedPrinterId: z.string().min(1)
});

export type ModelApprovalInput = z.input<typeof approvalSchema>;

export function approveModelUpload(upload: ReviewableUpload, input: ModelApprovalInput) {
  ensurePending(upload);
  const review = approvalSchema.parse(input);

  return {
    upload: {
      status: "APPROVED" as const,
      adminNotes: review.adminNotes,
      estimatedGrams: review.estimatedGrams,
      estimatedPrintMinutes: review.estimatedPrintMinutes,
      selectedMaterial: review.selectedMaterial,
      selectedPrinterId: review.selectedPrinterId
    },
    sliceJob: {
      uploadId: upload.id,
      inputStorageKey: upload.storageKey,
      selectedMaterial: review.selectedMaterial,
      selectedPrinterId: review.selectedPrinterId,
      estimatedGrams: review.estimatedGrams,
      estimatedPrintMinutes: review.estimatedPrintMinutes
    }
  };
}

export function rejectModelUpload(upload: ReviewableUpload, rejectionReason: string) {
  ensurePending(upload);
  const reason = rejectionReason.trim() || "Model needs revision before printing.";

  return {
    upload: {
      status: "REJECTED" as const,
      rejectionReason: reason
    },
    customerStatus: `Rejected: ${reason}`
  };
}

function ensurePending(upload: ReviewableUpload) {
  if (upload.status !== "PENDING") {
    throw new Error("Only pending uploads can be reviewed");
  }
}
