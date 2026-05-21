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
  let geometry = sourceGeometry.clone();
  geometry.computeBoundingBox();

  const sourceBox = geometry.boundingBox;
  if (!sourceBox) throw new Error("Invalid STL bounds");

  const center = new THREE.Vector3();
  sourceBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry = orientGeometryFlatOnBuildPlate(geometry);
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

function orientGeometryFlatOnBuildPlate(sourceGeometry: THREE.BufferGeometry) {
  const rotations = [
    [0, 0, 0],
    [-Math.PI / 2, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, -Math.PI / 2, 0],
    [0, Math.PI / 2, 0],
    [0, 0, Math.PI / 2]
  ] as const;

  let bestGeometry: THREE.BufferGeometry | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const rotation of rotations) {
    const candidate = sourceGeometry.clone();
    candidate.rotateX(rotation[0]);
    candidate.rotateY(rotation[1]);
    candidate.rotateZ(rotation[2]);
    candidate.computeBoundingBox();
    const box = candidate.boundingBox;
    if (!box) {
      candidate.dispose();
      continue;
    }
    const size = new THREE.Vector3();
    box.getSize(size);
    const footprint = Math.max(1, size.x * size.z);
    const score = size.y - footprint * 0.000001;
    if (score < bestScore) {
      bestGeometry?.dispose();
      bestGeometry = candidate;
      bestScore = score;
    } else {
      candidate.dispose();
    }
  }

  return bestGeometry ?? sourceGeometry;
}
