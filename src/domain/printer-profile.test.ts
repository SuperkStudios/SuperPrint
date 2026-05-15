import { describe, expect, it } from "vitest";
import { validatePrinterProfile } from "./printer-profile";

describe("printer profile validation", () => {
  it("normalizes a complete Elegoo Centauri Carbon profile", () => {
    expect(
      validatePrinterProfile({
        name: "centauri-01",
        publicName: "Centauri One",
        modelName: "Elegoo Centauri Carbon",
        nozzleSizeMm: 0.4,
        buildVolumeXmm: 256,
        buildVolumeYmm: 256,
        buildVolumeZmm: 256,
        supportedMaterials: ["PLA", "PETG", "PLA"],
        cameraSource: "rtsp://supernode.local/camera",
        maintenanceProfile: "Carbon motion system / enclosed FDM",
        internalIp: "10.0.0.41",
        controlApiUrl: "http://10.0.0.41/api"
      })
    ).toMatchObject({
      modelName: "Elegoo Centauri Carbon",
      nozzleSizeMm: 0.4,
      buildVolumeXmm: 256,
      supportedMaterials: ["PLA", "PETG"],
      heartbeatStatus: "UNKNOWN"
    });
  });

  it("accepts Centauri websocket control endpoints when assigning active filament", () => {
    expect(
      validatePrinterProfile({
        name: "centauri-01",
        publicName: "Centauri One",
        modelName: "Elegoo Centauri Carbon",
        nozzleSizeMm: 0.4,
        buildVolumeXmm: 256,
        buildVolumeYmm: 256,
        buildVolumeZmm: 256,
        supportedMaterials: ["PLA", "PETG"],
        currentFilamentId: "spool_1",
        cameraSource: null,
        maintenanceProfile: "Carbon motion system / enclosed FDM",
        internalIp: "192.168.10.125",
        controlApiUrl: "ws://192.168.10.125:3030/websocket"
      })
    ).toMatchObject({
      currentFilamentId: "spool_1",
      controlApiUrl: "ws://192.168.10.125:3030/websocket"
    });
  });

  it("rejects impossible machine dimensions and unsupported materials", () => {
    expect(() =>
      validatePrinterProfile({
        name: "bad",
        publicName: "Bad",
        modelName: "",
        nozzleSizeMm: 0,
        buildVolumeXmm: -1,
        buildVolumeYmm: 256,
        buildVolumeZmm: 256,
        supportedMaterials: ["WOOD"],
        cameraSource: "file:///private/camera",
        maintenanceProfile: "",
        internalIp: "",
        controlApiUrl: ""
      })
    ).toThrow("Printer profile is invalid");
  });
});
