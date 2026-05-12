import { describe, expect, it } from "vitest";
import {
  buildBootstrapSecuritySummary,
  createBootstrapOwner,
  getSafePrinterConnectionCheck,
  probePrinterConnection,
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
    expect(getSafePrinterConnectionCheck({ internalIp: "192.168.10.125", controlApiUrl: "ws://192.168.10.125:3030/websocket" })).toEqual({
      ok: true,
      status: "READY_FOR_SUPERNODE",
      message: "Connection target looks valid. SuperPrint will test the printer endpoint before continuing."
    });
  });

  it("performs a real non-control WebSocket probe through the supplied connector", async () => {
    const result = await probePrinterConnection(
      { internalIp: "192.168.10.125", controlApiUrl: "ws://192.168.10.125:3030/websocket" },
      {
        timeoutMs: 100,
        webSocketConnector: async () => undefined
      }
    );

    expect(result).toEqual({
      ok: true,
      status: "CONNECTED",
      message: "Printer SDCP WebSocket endpoint accepted a connection."
    });
  });

  it("does not accept HTTP 404 as a successful printer connection", async () => {
    const result = await probePrinterConnection(
      { internalIp: "192.168.10.125", controlApiUrl: "http://192.168.10.125/api" },
      {
        timeoutMs: 100,
        fetcher: async () => ({ status: 404, statusText: "Not Found" })
      }
    );

    expect(result).toEqual({
      ok: false,
      status: "HTTP_NOT_OK",
      message: "Printer endpoint responded with HTTP 404 Not Found. Use the Centauri Carbon SDCP endpoint ws://192.168.10.125:3030/websocket for control connectivity."
    });
  });

  it("reports unreachable printer endpoints without pretending setup is connected", async () => {
    const result = await probePrinterConnection(
      { internalIp: "192.168.10.125", controlApiUrl: "ws://192.168.10.125:3030/websocket" },
      {
        timeoutMs: 100,
        webSocketConnector: async () => {
          throw new Error("connect ECONNREFUSED");
        }
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("UNREACHABLE");
    expect(result.message).toContain("Could not reach printer endpoint");
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
