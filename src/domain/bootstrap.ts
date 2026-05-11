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

export async function createBootstrapOwner(input: BootstrapInput, repo: BootstrapRepository) {
  if (isBootstrapLocked({ ownerOrAdminCount: await repo.ownerOrAdminCount() })) {
    throw new Error("Bootstrap is locked");
  }

  if (!input.security.mediaTokenSecretSet || !input.security.backupPassphraseSet) {
    throw new Error("Security settings must be confirmed");
  }

  const passwordHash = await repo.hashPassword(input.owner.password);
  return repo.transaction(async (tx) => {
    const owner = (await tx.createOwner({
      email: input.owner.email.toLowerCase(),
      name: input.owner.name,
      passwordHash,
      role: "OWNER"
    })) as { id?: string };

    await tx.upsertSetting("company.brandName", input.company.brandName);
    await tx.upsertSetting("bootstrap.completedAt", new Date().toISOString());
    await tx.createPrinter({
      name: input.printer.name,
      publicName: input.printer.publicName,
      internalIp: input.printer.internalIp,
      controlApiUrl: input.printer.controlApiUrl,
      status: "OFFLINE",
      healthDescription: "Registered during bootstrap; waiting for first printer agent check"
    });
    await tx.createFilament(input.filament);

    return { ownerId: owner.id ?? "owner" };
  });
}
