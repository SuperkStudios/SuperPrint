import { Prisma } from "@prisma/client";
import { buildOrcaSlicerCommand } from "../domain/orca-slicer";
import { approveModelUpload, rejectModelUpload, type ModelApprovalInput } from "../domain/model-review";
import { buildModelReviewPayload } from "../domain/uploads";
import { buildLocalStorageKey } from "../lib/storage";
import { enqueueSliceJob } from "../lib/queue-broker";
import { prisma } from "../lib/prisma";
import { recordPlatformEvent } from "./events";

export async function approveUploadForSlicing(uploadId: string, input: ModelApprovalInput & { estimatedPriceCents?: number }, actorId: string) {
  const upload = await prisma.modelUpload.findUniqueOrThrow({ where: { id: uploadId } });
  const transition = approveModelUpload(upload, input);
  const printer = await prisma.printer.findUniqueOrThrow({ where: { id: transition.sliceJob.selectedPrinterId } });
  const [slicerProfile, machineProfile, filamentProfile] = await Promise.all([
    getOrCreateSlicerProfile(),
    getOrCreateMachineProfile(printer.modelName),
    getOrCreateFilamentProfile(transition.sliceJob.selectedMaterial)
  ]);

  const outputStorageKey = buildLocalStorageKey("sliced", upload.fileName.replace(/\.stl$/i, ".gcode"));
  const commandPreview = buildOrcaSlicerCommand({
    executablePath: process.env.ORCA_SLICER_BIN ?? "/usr/local/bin/orca-slicer",
    inputPath: upload.storageKey,
    outputPath: outputStorageKey,
    slicerProfilePath: slicerProfile.profilePath,
    machineProfilePath: machineProfile.profilePath,
    filamentProfilePath: filamentProfile.profilePath
  });

  const result = await prisma.$transaction(async (tx) => {
    const updatedUpload = await tx.modelUpload.update({
      where: { id: uploadId },
      data: {
        ...transition.upload,
        approvedById: actorId,
        approvedAt: new Date(),
        estimatedPriceCents: input.estimatedPriceCents
      }
    });
    const sliceJob = await tx.sliceJob.create({
      data: {
        uploadId,
        inputStorageKey: transition.sliceJob.inputStorageKey,
        outputStorageKey,
        slicerProfileId: slicerProfile.id,
        machineProfileId: machineProfile.id,
        filamentProfileId: filamentProfile.id,
        estimatedGrams: transition.sliceJob.estimatedGrams,
        estimatedPrintMinutes: transition.sliceJob.estimatedPrintMinutes,
        commandPreview: commandPreview as unknown as Prisma.InputJsonObject
      }
    });
    return { upload: updatedUpload, sliceJob };
  });

  await recordPlatformEvent({
    type: "MODEL_APPROVED",
    actorId,
    payload: buildModelReviewPayload({
      uploadId: result.upload.id,
      fileName: result.upload.fileName,
      status: "APPROVED"
    })
  });
  await enqueueSliceJob(result.sliceJob.id);
  return result;
}

export async function rejectUploadForCustomer(uploadId: string, rejectionReason: string, actorId: string) {
  const upload = await prisma.modelUpload.findUniqueOrThrow({ where: { id: uploadId } });
  const transition = rejectModelUpload(upload, rejectionReason);
  const updated = await prisma.modelUpload.update({
    where: { id: uploadId },
    data: transition.upload
  });
  await recordPlatformEvent({
    type: "MODEL_REJECTED",
    actorId,
    payload: buildModelReviewPayload({
      uploadId: updated.id,
      fileName: updated.fileName,
      status: "REJECTED",
      rejectionReason: updated.rejectionReason
    })
  });
  return updated;
}

async function getOrCreateSlicerProfile() {
  return prisma.slicerProfile.findFirst({ where: { isDefault: true } }).then(
    (profile) =>
      profile ??
      prisma.slicerProfile.create({
        data: {
          name: "Default OrcaSlicer profile",
          description: "Bootstrap-safe default profile path used until a calibrated production profile is added.",
          profilePath: "/data/profiles/orca/default.json",
          isDefault: true
        }
      })
  );
}

async function getOrCreateMachineProfile(modelName: string) {
  const existing = await prisma.machineProfile.findFirst({ where: { modelName } });
  if (existing) return existing;
  return prisma.machineProfile.create({
    data: {
      name: modelName,
      modelName,
      profilePath: `/data/profiles/machines/${modelName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`
    }
  });
}

async function getOrCreateFilamentProfile(material: string) {
  const existing = await prisma.filamentProfile.findFirst({ where: { material: material as never } });
  if (existing) return existing;
  return prisma.filamentProfile.create({
    data: {
      name: `${material} default`,
      material: material as never,
      profilePath: `/data/profiles/filaments/${material.toLowerCase()}.json`
    }
  });
}
