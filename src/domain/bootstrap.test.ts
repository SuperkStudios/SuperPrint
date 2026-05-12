import { describe, expect, it } from "vitest";
import {
  buildBootstrapSecuritySummary,
  createBootstrapOwner,
  getSafePrinterConnectionCheck,
  isBootstrapLocked,
  normalizeBootstrapInput
} from "./bootstrap";

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

describe("bootstrap wizard helpers", () => {
  it("auto-confirms bootstrap security settings when the wizard submits", () => {
    const input = normalizeBootstrapInput({
      owner: { name: "Riley", email: "owner@test.com", password: "correct-horse-battery-staple" },
      company: { brandName: "SuperPrint" },
      printer: { name: "forge", publicName: "Forge", internalIp: "192.168.10.125", controlApiUrl: "http://192.168.10.125/api" },
      filament: { material: "PLA", color: "Black", brand: "Brand", remainingGrams: 1000, thresholdGrams: 100, location: "Rack" }
    });

    expect(input.security).toEqual({ mediaTokenSecretSet: true, backupPassphraseSet: true });
  });

  it("checks printer connection config without claiming a real printer API connection", () => {
    expect(getSafePrinterConnectionCheck({ internalIp: "192.168.10.125", controlApiUrl: "http://192.168.10.125/api" })).toEqual({
      ok: true,
      status: "READY_FOR_SUPERNODE",
      message: "Address format looks valid. SuperPrint will wait for a signed SuperNode heartbeat before marking the printer online."
    });
  });

  it("builds a save-worthy security summary without secrets", () => {
    const summary = buildBootstrapSecuritySummary({
      ownerEmail: "owner@test.com",
      brandName: "SuperPrint",
      printerPublicName: "Forge",
      printerInternalIp: "192.168.10.125",
      storageRoot: "/data",
      storageClasses: ["uploads", "videos"]
    });

    expect(summary).toContain("Owner email: owner@test.com");
    expect(summary).toContain("Printer IP/host: 192.168.10.125");
    expect(summary).toContain("Real printer API calls: disabled");
    expect(summary).not.toContain("password");
  });
});
