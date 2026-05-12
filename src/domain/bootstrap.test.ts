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
    const createdFilaments: Record<string, unknown>[] = [];
    const result = await createBootstrapOwner(
      {
        owner: {
          name: "Riley Owner",
          email: "owner@superprint.test",
          password: "correct-horse-battery-staple"
        },
        company: { brandName: "SuperPrint Denver", primaryColor: "#117766", lowFilamentThresholdGrams: 120 },
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
          startingGrams: 1000,
          remainingGrams: 1000,
          rollCostCents: 2499,
          assignedPrinterHistory: [],
          ignoredPrinterHistory: []
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
            createFilament: async (data) => {
              createdFilaments.push(data);
              return {};
            }
          });
        }
      }
    );

    expect(result).toEqual({ ownerId: "owner_1" });
    expect(calls).toEqual(["transaction"]);
    expect(createdFilaments).toHaveLength(1);
  });

  it("creates every bootstrap stock spool with the platform low threshold", async () => {
    const createdFilaments: Record<string, unknown>[] = [];

    await createBootstrapOwner(
      {
        owner: {
          name: "Riley Owner",
          email: "owner@superprint.test",
          password: "correct-horse-battery-staple"
        },
        company: { brandName: "SuperPrint Denver", primaryColor: "#117766", lowFilamentThresholdGrams: 90 },
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
          startingGrams: 1000,
          remainingGrams: 950,
          rollCostCents: 2499,
          assignedPrinterHistory: [{ id: "done-1", name: "dragon.gcode", gramsUsed: 50 }],
          ignoredPrinterHistory: []
        },
        filaments: [
          {
            material: "PLA",
            color: "Matte Black",
            brand: "Polymaker",
            startingGrams: 1000,
            remainingGrams: 950,
            rollCostCents: 2499,
            assignedPrinterHistory: [{ id: "done-1", name: "dragon.gcode", gramsUsed: 50 }],
            ignoredPrinterHistory: []
          },
          {
            material: "PETG",
            color: "Clear",
            brand: "Overture",
            startingGrams: 1000,
            remainingGrams: 1000,
            rollCostCents: 1999,
            assignedPrinterHistory: [],
            ignoredPrinterHistory: [{ id: "test-1", name: "test.gcode", gramsUsed: 10 }]
          }
        ],
        security: { mediaTokenSecretSet: true, backupPassphraseSet: true }
      },
      {
        ownerOrAdminCount: async () => 0,
        hashPassword: async () => "hashed-password",
        transaction: async (callback) =>
          callback({
            createOwner: async () => ({ id: "owner_1" }),
            upsertSetting: async () => ({}),
            createPrinter: async () => ({}),
            createFilament: async (data) => {
              createdFilaments.push(data);
              return {};
            }
          })
      }
    );

    expect(createdFilaments).toHaveLength(2);
    expect(createdFilaments.map((spool) => spool.thresholdGrams)).toEqual([90, 90]);
    expect(createdFilaments.map((spool) => spool.color)).toEqual(["Matte Black", "Clear"]);
  });

  it("rejects bootstrap after an owner or admin exists", async () => {
    await expect(
      createBootstrapOwner(
        {
          owner: { name: "Riley", email: "owner@test.com", password: "password" },
          company: { brandName: "SuperPrint" },
          printer: { name: "forge", publicName: "Forge", internalIp: "10.0.0.2", controlApiUrl: "http://10.0.0.2" },
          filament: { material: "PLA", color: "Black", brand: "Brand", remainingGrams: 1000 },
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
      filament: { material: "PLA", color: "Black", brand: "Brand" }
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
        },
        fetcher: async () => {
          throw new Error("connect ECONNREFUSED");
        }
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("UNREACHABLE");
    expect(result.message).toContain("Could not reach printer endpoint");
  });

  it("accepts the Centauri SDCP upgrade response when native WebSocket handshake is flaky", async () => {
    const result = await probePrinterConnection(
      { internalIp: "192.168.10.125", controlApiUrl: "ws://192.168.10.125:3030/websocket" },
      {
        timeoutMs: 100,
        webSocketConnector: async () => {
          throw new Error("Printer WebSocket handshake failed.");
        },
        fetcher: async () => ({
          status: 426,
          statusText: "Upgrade Required",
          text: async () => "WS upgrade expected"
        })
      }
    );

    expect(result).toEqual({
      ok: true,
      status: "CONNECTED",
      message: "Printer SDCP endpoint is reachable and requested a WebSocket upgrade."
    });
  });

  it("builds a save-worthy security summary without secrets", () => {
    const summary = buildBootstrapSecuritySummary({
      ownerEmail: "owner@test.com",
      brandName: "SuperPrint",
      primaryColor: "#0f8f7f",
      lowFilamentThresholdGrams: 150,
      printerPublicName: "Forge",
      printerInternalIp: "192.168.10.125",
      assignedPrintCount: 2,
      ignoredPrintCount: 1,
      remainingGrams: 950
    });

    expect(summary).toContain("Owner email: owner@test.com");
    expect(summary).toContain("Printer IP/host: 192.168.10.125");
    expect(summary).toContain("Primary color: #0f8f7f");
    expect(summary).toContain("Ignored completed prints: 1");
    expect(summary).toContain("Real printer API calls: disabled");
    expect(summary).not.toContain("password");
  });
});
