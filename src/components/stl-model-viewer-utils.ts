import * as THREE from "three";

export type PreparedBuildPlateGeometry = {
  geometry: THREE.BufferGeometry;
  modelSizeMm: { width: number; height: number; depth: number };
  footprintMm: { width: number; depth: number };
  plateSizeMm: { width: number; depth: number };
};

export function prepareGeometryForBuildPlate(
  sourceGeometry: THREE.BufferGeometry,
  options: { targetSizeMm?: number; minPlateSizeMm?: number; platePaddingMm?: number } = {}
): PreparedBuildPlateGeometry {
  const geometry = sourceGeometry.clone();
  geometry.computeBoundingBox();

  const sourceBox = geometry.boundingBox;
  if (!sourceBox) throw new Error("Invalid STL bounds");

  const center = new THREE.Vector3();
  sourceBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();

  const rotatedBox = geometry.boundingBox;
  if (!rotatedBox) throw new Error("Invalid transformed STL bounds");

  const rotatedSize = new THREE.Vector3();
  rotatedBox.getSize(rotatedSize);
  const largest = Math.max(rotatedSize.x, rotatedSize.y, rotatedSize.z) || 1;
  const scale = (options.targetSizeMm ?? 120) / largest;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();

  const scaledBox = geometry.boundingBox;
  if (!scaledBox) throw new Error("Invalid scaled STL bounds");

  const scaledCenter = new THREE.Vector3();
  const scaledSize = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  scaledBox.getSize(scaledSize);
  geometry.translate(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
  geometry.computeBoundingBox();

  const finalBox = geometry.boundingBox;
  if (!finalBox) throw new Error("Invalid final STL bounds");

  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);
  const padding = options.platePaddingMm ?? 28;
  const minPlateSize = options.minPlateSizeMm ?? 180;

  return {
    geometry,
    modelSizeMm: {
      width: finalSize.x,
      height: finalSize.y,
      depth: finalSize.z
    },
    footprintMm: {
      width: finalSize.x,
      depth: finalSize.z
    },
    plateSizeMm: {
      width: Math.max(minPlateSize, Math.ceil(finalSize.x + padding)),
      depth: Math.max(minPlateSize, Math.ceil(finalSize.z + padding))
    }
  };
}
