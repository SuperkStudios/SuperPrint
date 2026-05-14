export type PrintMaterialProfile = {
  material: "PLA" | "PETG" | "ABS" | "TPU" | "NYLON" | "RESIN";
  densityGPerCm3: number;
  lineWidthMm: number;
  wallLoops: number;
  topBottomLayers: number;
  layerHeightMm: number;
  infillDensity: number;
  flowRatio: number;
  speedFactor: number;
  supportWasteRatio: number;
};

export const printMaterialProfiles: Record<string, PrintMaterialProfile> = {
  PLA: {
    material: "PLA",
    densityGPerCm3: 1.24,
    lineWidthMm: 0.42,
    wallLoops: 3,
    topBottomLayers: 5,
    layerHeightMm: 0.2,
    infillDensity: 0.17,
    flowRatio: 0.98,
    speedFactor: 1,
    supportWasteRatio: 0.06
  },
  PETG: {
    material: "PETG",
    densityGPerCm3: 1.27,
    lineWidthMm: 0.42,
    wallLoops: 3,
    topBottomLayers: 5,
    layerHeightMm: 0.2,
    infillDensity: 0.2,
    flowRatio: 1,
    speedFactor: 0.78,
    supportWasteRatio: 0.08
  },
  ABS: {
    material: "ABS",
    densityGPerCm3: 1.04,
    lineWidthMm: 0.42,
    wallLoops: 3,
    topBottomLayers: 5,
    layerHeightMm: 0.2,
    infillDensity: 0.18,
    flowRatio: 0.99,
    speedFactor: 0.86,
    supportWasteRatio: 0.08
  },
  TPU: {
    material: "TPU",
    densityGPerCm3: 1.21,
    lineWidthMm: 0.42,
    wallLoops: 3,
    topBottomLayers: 5,
    layerHeightMm: 0.2,
    infillDensity: 0.18,
    flowRatio: 1.03,
    speedFactor: 0.34,
    supportWasteRatio: 0.09
  },
  NYLON: {
    material: "NYLON",
    densityGPerCm3: 1.14,
    lineWidthMm: 0.42,
    wallLoops: 3,
    topBottomLayers: 5,
    layerHeightMm: 0.2,
    infillDensity: 0.18,
    flowRatio: 1,
    speedFactor: 0.64,
    supportWasteRatio: 0.08
  },
  RESIN: {
    material: "RESIN",
    densityGPerCm3: 1.1,
    lineWidthMm: 0.05,
    wallLoops: 1,
    topBottomLayers: 0,
    layerHeightMm: 0.05,
    infillDensity: 1,
    flowRatio: 1,
    speedFactor: 0.42,
    supportWasteRatio: 0.18
  }
};

export function getPrintMaterialProfile(material = "PLA") {
  return printMaterialProfiles[String(material).trim().toUpperCase()] ?? printMaterialProfiles.PLA;
}
