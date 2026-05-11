import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { buildOrcaSlicerCommand } from "../domain/orca-slicer";
import { resolveSliceExecution } from "../domain/slice-execution";
import { resolveLocalStoragePath } from "../lib/storage";
import { prisma } from "../lib/prisma";
import { recordPlatformEvent } from "./events";

export async function executeSliceJob(sliceJobId: string) {
  const sliceJob = await prisma.sliceJob.findUniqueOrThrow({
    where: { id: sliceJobId },
    include: {
      upload: true,
      slicerProfile: true,
      machineProfile: true,
      filamentProfile: true
    }
  });

  if (sliceJob.status !== "PENDING" && sliceJob.status !== "BLOCKED") {
    return sliceJob;
  }

  const executablePath = process.env.ORCA_SLICER_BIN ?? "/usr/local/bin/orca-slicer";
  const outputStorageKey = sliceJob.outputStorageKey ?? `sliced/${sliceJob.id}.gcode`;
  const inputPath = resolveLocalStoragePath(sliceJob.inputStorageKey);
  const outputPath = resolveLocalStoragePath(outputStorageKey);
  await mkdir(path.dirname(outputPath), { recursive: true });

  const cliAvailable = await isExecutable(executablePath);
  if (!cliAvailable) {
    const result = resolveSliceExecution({ cliAvailable: false });
    const updated = await prisma.sliceJob.update({
      where: { id: sliceJobId },
      data: { status: result.status, blockedReason: result.blockedReason, errorLog: result.blockedReason }
    });
    await recordPlatformEvent({
      type: "SLICING_BLOCKED",
      payload: {
        uploadId: sliceJob.uploadId,
        fileName: sliceJob.upload.fileName,
        blockedReason: result.blockedReason
      }
    });
    return updated;
  }

  const command = buildOrcaSlicerCommand({
    executablePath,
    inputPath,
    outputPath,
    slicerProfilePath: sliceJob.slicerProfile.profilePath,
    machineProfilePath: sliceJob.machineProfile.profilePath,
    filamentProfilePath: sliceJob.filamentProfile.profilePath
  });

  await prisma.sliceJob.update({
    where: { id: sliceJobId },
    data: { status: "RUNNING", startedAt: new Date(), commandPreview: command as unknown as Prisma.InputJsonObject }
  });

  const run = await runCommand(command.command, command.args);
  const result = resolveSliceExecution({
    cliAvailable: true,
    exitCode: run.exitCode,
    stdout: run.stdout,
    stderr: run.stderr,
    outputStorageKey,
    reviewEstimatedMinutes: sliceJob.estimatedPrintMinutes,
    reviewEstimatedGrams: sliceJob.estimatedGrams
  });

  const updated = await prisma.sliceJob.update({
    where: { id: sliceJobId },
    data:
      result.status === "READY"
        ? {
            status: "READY",
            outputStorageKey,
            estimatedPrintMinutes: result.estimatedPrintMinutes,
            estimatedGrams: result.estimatedGrams,
            warnings: result.warnings as Prisma.InputJsonValue,
            stdoutLog: result.stdoutLog,
            stderrLog: result.stderrLog,
            completedAt: new Date()
          }
        : {
            status: "FAILED",
            errorLog: result.errorLog,
            stdoutLog: result.stdoutLog,
            stderrLog: result.stderrLog,
            completedAt: new Date()
          }
  });

  await recordPlatformEvent({
    type: result.status === "READY" ? "SLICING_COMPLETE" : "SLICING_FAILED",
    payload: {
      uploadId: sliceJob.uploadId,
      sliceJobId,
      fileName: sliceJob.upload.fileName,
      status: result.status,
      estimatedPrintMinutes: result.status === "READY" ? result.estimatedPrintMinutes : undefined,
      estimatedGrams: result.status === "READY" ? result.estimatedGrams : undefined,
      outputStorageKey,
      gcodeLocalPath: outputPath
    }
  });

  return updated;
}

async function isExecutable(filePath: string) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }));
  });
}
