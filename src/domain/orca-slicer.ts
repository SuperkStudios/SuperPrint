export type SliceJobStatus = "PENDING" | "RUNNING" | "READY" | "FAILED" | "CANCELED";
export type SliceJobAction = "start" | "complete" | "fail" | "cancel";

export function buildOrcaSlicerCommand({
  executablePath,
  inputPath,
  outputPath,
  machineProfilePath,
  filamentProfilePath,
  slicerProfilePath
}: {
  executablePath: string;
  inputPath: string;
  outputPath: string;
  machineProfilePath: string;
  filamentProfilePath: string;
  slicerProfilePath: string;
}) {
  return {
    command: executablePath,
    args: [
      "--slice",
      "--load-settings",
      slicerProfilePath,
      "--load-machine",
      machineProfilePath,
      "--load-filament",
      filamentProfilePath,
      "--output",
      outputPath,
      inputPath
    ]
  };
}

export function resolveSlicedFileLifecycle(status: SliceJobStatus, action: SliceJobAction): SliceJobStatus {
  const transitions: Record<SliceJobStatus, Partial<Record<SliceJobAction, SliceJobStatus>>> = {
    PENDING: { start: "RUNNING", cancel: "CANCELED" },
    RUNNING: { complete: "READY", fail: "FAILED", cancel: "CANCELED" },
    READY: {},
    FAILED: {},
    CANCELED: {}
  };

  const next = transitions[status][action];
  if (!next) {
    throw new Error("Slice job transition is invalid");
  }
  return next;
}
