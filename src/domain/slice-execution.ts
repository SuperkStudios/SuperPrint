export function resolveSliceExecution(input: {
  cliAvailable: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  outputStorageKey?: string;
  reviewEstimatedMinutes?: number | null;
  reviewEstimatedGrams?: number | null;
}) {
  if (!input.cliAvailable) {
    return {
      status: "BLOCKED" as const,
      blockedReason: "OrcaSlicer CLI is unavailable or not executable"
    };
  }

  const stdout = input.stdout ?? "";
  const stderr = input.stderr ?? "";
  if (input.exitCode !== 0) {
    return {
      status: "FAILED" as const,
      errorLog: stderr || stdout || `OrcaSlicer exited with ${input.exitCode}`,
      stdoutLog: stdout,
      stderrLog: stderr
    };
  }

  return {
    status: "READY" as const,
    outputStorageKey: input.outputStorageKey,
    estimatedPrintMinutes: parsePrintMinutes(stdout) ?? input.reviewEstimatedMinutes ?? null,
    estimatedGrams: parseFilamentGrams(stdout) ?? input.reviewEstimatedGrams ?? null,
    warnings: stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^warn/i.test(line)),
    stdoutLog: stdout,
    stderrLog: stderr
  };
}

function parsePrintMinutes(stdout: string) {
  const match = stdout.match(/estimated printing time:\s*(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  if (!match) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

function parseFilamentGrams(stdout: string) {
  const match = stdout.match(/filament used \[g\]:\s*([0-9.]+)/i);
  if (!match) return null;
  return Math.round(Number(match[1]));
}
