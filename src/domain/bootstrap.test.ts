import { describe, expect, it } from "vitest";
import { createBootstrapOwner, isBootstrapLocked } from "./bootstrap";

describe("bootstrap lockout", () => {
  it("locks setup when an owner or admin already exists", () => {
    expect(isBootstrapLocked({ ownerOrAdminCount: 0 })).toBe(false);
    expect(isBootstrapLocked({ ownerOrAdminCount: 1 })).toBe(true);
  });
});

describe("createBootstrapOwner", () => {
  it("creates owner, company setting, printer, and filament in one transaction", async () => {
    const calls: string[] = [];
    const result = await createBootstrapOwner(
      {
        owner: {
          name: "Riley Owner",
          email: "owner@superprint.test",
          password: "correct-horse-battery-staple"
        },
        company: { brandName: "SuperPrint Denver" },
        printer: {
          name: "forge-alpha",
          publicName: "Forge Alpha",
          internalIp: "10.0.0.12",
          controlApiUrl: "http://10.0.0.12/api"
        },
        filament: {
          material: "PLA",
          color: "Matte Black",
          brand: "Polymaker",
          remainingGrams: 1000,
          thresholdGrams: 150,
          location: "Rack A1"
        },
        security: { mediaTokenSecretSet: true, backupPassphraseSet: true }
      },
      {
        ownerOrAdminCount: async () => 0,
        hashPassword: async () => "hashed-password",
        transaction: async (callback) => {
          calls.push("transaction");
          return callback({
            createOwner: async () => ({ id: "owner_1" }),
            upsertSetting: async () => ({}),
            createPrinter: async () => ({}),
            createFilament: async () => ({})
          });
        }
      }
    );

    expect(result).toEqual({ ownerId: "owner_1" });
    expect(calls).toEqual(["transaction"]);
  });

  it("rejects bootstrap after an owner or admin exists", async () => {
    await expect(
      createBootstrapOwner(
        {
          owner: { name: "Riley", email: "owner@test.com", password: "password" },
          company: { brandName: "SuperPrint" },
          printer: { name: "forge", publicName: "Forge", internalIp: "10.0.0.2", controlApiUrl: "http://10.0.0.2" },
          filament: { material: "PLA", color: "Black", brand: "Brand", remainingGrams: 1000, thresholdGrams: 100, location: "Rack" },
          security: { mediaTokenSecretSet: true, backupPassphraseSet: true }
        },
        {
          ownerOrAdminCount: async () => 1,
          hashPassword: async () => "hashed",
          transaction: async () => ({ ownerId: "never" })
        }
      )
    ).rejects.toThrow("Bootstrap is locked");
  });
});
