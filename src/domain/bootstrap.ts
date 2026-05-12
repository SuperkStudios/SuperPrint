export type BootstrapInput = {
  owner: {
    name: string;
    email: string;
    password: string;
  };
  company: {
    brandName: string;
  };
  printer: {
    name: string;
    publicName: string;
    internalIp: string;
    controlApiUrl: string;
  };
  filament: {
    material: "PLA" | "PETG" | "ABS" | "TPU" | "NYLON" | "RESIN";
    color: string;
    brand: string;
    remainingGrams: number;
    thresholdGrams: number;
    location: string;
  };
  security: {
    mediaTokenSecretSet: boolean;
    backupPassphraseSet: boolean;
  };
};

export type BootstrapInputDraft = Omit<BootstrapInput, "security"> & {
  security?: Partial<BootstrapInput["security"]>;
};

export type BootstrapRepository = {
  ownerOrAdminCount: () => Promise<number>;
  hashPassword: (password: string) => Promise<string>;
  transaction: (callback: (tx: BootstrapTransaction) => Promise<{ ownerId: string }>) => Promise<{ ownerId: string }>;
};

export type BootstrapTransaction = {
  createOwner: (data: Record<string, unknown>) => Promise<unknown>;
  upsertSetting: (key: string, value: unknown) => Promise<unknown>;
  createPrinter: (data: Record<string, unknown>) => Promise<unknown>;
  createFilament: (data: Record<string, unknown>) => Promise<unknown>;
};

export function isBootstrapLocked({ ownerOrAdminCount }: { ownerOrAdminCount: number }) {
  return ownerOrAdminCount > 0;
}

export function normalizeBootstrapInput(input: BootstrapInputDraft): BootstrapInput {
  return {
    ...input,
    security: {
      mediaTokenSecretSet: input.security?.mediaTokenSecretSet ?? true,
      backupPassphraseSet: input.security?.backupPassphraseSet ?? true
    }
  };
}

export function getSafePrinterConnectionCheck(input: { internalIp: string; controlApiUrl: string }) {
  const host = input.internalIp.trim();
  if (!host) {
    return {
      ok: false,
      status: "NEEDS_PRINTER_ADDRESS",
      message: "Enter the printer IP address or hostname before continuing."
    };
  }

  try {
    const url = new URL(input.controlApiUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }
  } catch {
    return {
      ok: false,
      status: "NEEDS_CONTROL_URL",
      message: "Enter a valid HTTP or HTTPS control URL. SuperPrint will not call it during bootstrap."
    };
  }

  return {
    ok: true,
    status: "READY_FOR_SUPERNODE",
    message: "Address format looks valid. SuperPrint will wait for a signed SuperNode heartbeat before marking the printer online."
  };
}

export async function probePrinterConnection(
  input: { internalIp: string; controlApiUrl: string },
  options?: {
    timeoutMs?: number;
    fetcher?: (url: string, init: { method: "GET"; signal?: AbortSignal; cache: "no-store" }) => Promise<{ status: number; statusText: string }>;
  }
) {
  const shapeCheck = getSafePrinterConnectionCheck(input);
  if (!shapeCheck.ok) return shapeCheck;

  const timeoutMs = options?.timeoutMs ?? 3000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options?.fetcher ?? fetch)(input.controlApiUrl, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    return {
      ok: true,
      status: "CONNECTED",
      message: `Printer endpoint responded with HTTP ${response.status}${statusText}.`
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: isTimeout ? "TIMEOUT" : "UNREACHABLE",
      message: isTimeout
        ? `Printer endpoint did not respond within ${timeoutMs}ms.`
        : `Could not reach printer endpoint: ${error instanceof Error ? error.message : "network request failed"}.`
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildBootstrapSecuritySummary(input: {
  ownerEmail: string;
  brandName: string;
  printerPublicName: string;
  printerInternalIp: string;
  storageRoot: string;
  storageClasses: string[];
}) {
  return [
    "SuperPrint first-run setup summary",
    `Owner email: ${input.ownerEmail}`,
    `Public brand: ${input.brandName}`,
    `Printer: ${input.printerPublicName}`,
    `Printer IP/host: ${input.printerInternalIp}`,
    `Local storage root: ${input.storageRoot}`,
    `Mounted storage classes: ${input.storageClasses.join(", ")}`,
    "Security: owner credential is hashed before storage",
    "Bootstrap route: locks after owner/admin creation",
    "Real printer API calls: disabled",
    "Physical print start: requires operator checklist and SuperNode acknowledgement"
  ].join("\n");
}

export async function createBootstrapOwner(input: BootstrapInputDraft, repo: BootstrapRepository) {
  if (isBootstrapLocked({ ownerOrAdminCount: await repo.ownerOrAdminCount() })) {
    throw new Error("Bootstrap is locked");
  }

  const normalized = normalizeBootstrapInput(input);

  if (!normalized.security.mediaTokenSecretSet || !normalized.security.backupPassphraseSet) {
    throw new Error("Security settings must be confirmed");
  }

  const passwordHash = await repo.hashPassword(normalized.owner.password);
  return repo.transaction(async (tx) => {
    const owner = (await tx.createOwner({
      email: normalized.owner.email.toLowerCase(),
      name: normalized.owner.name,
      passwordHash,
      role: "OWNER"
    })) as { id?: string };

    await tx.upsertSetting("company.brandName", normalized.company.brandName);
    await tx.upsertSetting("bootstrap.completedAt", new Date().toISOString());
    await tx.createPrinter({
      name: normalized.printer.name,
      publicName: normalized.printer.publicName,
      internalIp: normalized.printer.internalIp,
      controlApiUrl: normalized.printer.controlApiUrl,
      status: "OFFLINE",
      healthDescription: "Registered during bootstrap; waiting for first printer agent check"
    });
    await tx.createFilament(normalized.filament);

    return { ownerId: owner.id ?? "owner" };
  });
}
