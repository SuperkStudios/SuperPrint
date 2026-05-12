import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { createBootstrapOwner, type BootstrapInputDraft } from "@/domain/bootstrap";
import { prisma } from "@/lib/prisma";
import { getDataRoot, storageClasses } from "@/lib/storage";

export async function getBootstrapStatus() {
  const ownerOrAdminCount = await prisma.user.count({
    where: { role: { in: ["OWNER", "ADMIN"] } }
  });

  return {
    isComplete: ownerOrAdminCount > 0,
    canBootstrap: ownerOrAdminCount === 0
  };
}

export async function requireBootstrapComplete() {
  const status = await getBootstrapStatus();
  return status.isComplete;
}

export async function runOwnerBootstrap(input: BootstrapInputDraft) {
  return createBootstrapOwner(input, {
    ownerOrAdminCount: async () =>
      prisma.user.count({
        where: { role: { in: ["OWNER", "ADMIN"] } }
      }),
    hashPassword: (password) => hash(password, 10),
    transaction: (callback) =>
      prisma.$transaction(async (tx) =>
        callback({
          createOwner: (data) => tx.user.create({ data: data as Prisma.UserCreateInput }),
          createAuthAccount: (data) => tx.account.create({ data: data as Prisma.AccountUncheckedCreateInput }),
          upsertSetting: (key, value) =>
            tx.systemSetting.upsert({
              where: { key },
              update: { value: value as Prisma.InputJsonValue },
              create: { key, value: value as Prisma.InputJsonValue }
            }),
          createPrinter: (data) => tx.printer.create({ data: data as Prisma.PrinterCreateInput }),
          createFilament: (data) => tx.filamentSpool.create({ data: data as Prisma.FilamentSpoolCreateInput })
        })
      )
  });
}

export function getStorageBootstrapChecks() {
  const root = getDataRoot();
  return storageClasses.map((storageClass) => ({
    storageClass,
    path: `${root}/${storageClass}`,
    configured: true
  }));
}
