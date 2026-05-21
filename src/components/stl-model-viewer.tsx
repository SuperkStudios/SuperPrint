"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { prepareGeometryForBuildPlate } from "./stl-model-viewer-utils";

export function StlModelViewer({
  src,
  file,
  color = "#26a69a",
  colors,
  parts,
  modelFormat,
  className = ""
}: {
  src?: string | null;
  file?: File | null;
  color?: string;
  colors?: string[];
  parts?: Array<{
    src?: string | null;
    file?: File | null;
    quantity?: number;
    colorIndex?: number;
    copyColorIndexes?: number[];
    modelFormat?: "stl" | "3mf";
  }>;
  modelFormat?: "stl" | "3mf";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const coloredMeshesRef = useRef<Array<{ mesh: THREE.Mesh; colorIndex: number }>>([]);
  const [status, setStatus] = useState("Loading model");

  useEffect(() => {
    materialRef.current?.color.set(color);
    const palette = colors?.length ? colors : [color];
    for (const item of coloredMeshesRef.current) {
      const material = item.mesh.material;
      const nextColor = palette[item.colorIndex % palette.length] ?? color;
      if (material instanceof THREE.MeshStandardMaterial) material.color.set(nextColor);
    }
  }, [color, colors]);

  useEffect(() => {
    const container = containerRef.current;
    const hasParts = Boolean(parts?.some((part) => part.file || part.src));
    if (!container || (!src && !file && !hasParts)) {
      setStatus("Upload an STL or add product parts to preview it");
      return;
    }

    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
    camera.position.set(150, 110, 190);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;

    scene.add(new THREE.HemisphereLight("#ffffff", "#94a3b8", 2.4));
    const keyLight = new THREE.DirectionalLight("#ffffff", 3);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.46,
      metalness: 0.08
    });
    materialRef.current = material;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.updateProjectionMatrix();
    };

    const render = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };

    const load = async () => {
      try {
        setStatus("Loading model");
        const palette = colors?.length ? colors : [color];
        const partInputs = parts?.filter((part) => part.file || part.src) ?? [];
        if (partInputs.length) {
          const preparedParts = await preparePartPreview(partInputs, palette);
          if (disposed) return;
          const prepared = preparedParts;
          addPlate(scene, prepared.plateSizeMm);
          scene.add(prepared.object);
          coloredMeshesRef.current = prepared.coloredMeshes;
          frameCamera(camera, controls, prepared.plateSizeMm, prepared.modelSizeMm.height);
          setStatus("");
          return;
        }

        const buffer = file ? await file.arrayBuffer() : await fetch(src!, { cache: "force-cache" }).then((response) => {
          if (!response.ok) throw new Error("Model not available");
          return response.arrayBuffer();
        });
        if (disposed) return;
        const format = modelFormat ?? inferModelFormat(file?.name ?? src ?? "");
        const prepared = format === "3mf"
          ? prepareLoadedObjectForBuildPlate(new ThreeMFLoader().parse(buffer), palette)
          : prepareLoadedStlForBuildPlate(buffer);

        addPlate(scene, prepared.plateSizeMm);

        if ("geometry" in prepared) {
          const mesh = new THREE.Mesh(prepared.geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
        } else {
          scene.add(prepared.object);
          coloredMeshesRef.current = prepared.coloredMeshes;
        }

        frameCamera(camera, controls, prepared.plateSizeMm, prepared.modelSizeMm.height);
        setStatus("");
      } catch {
        setStatus("3D preview unavailable");
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    load();
    render();

    return () => {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      material.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      materialRef.current = null;
      coloredMeshesRef.current = [];
    };
  }, [src, file, modelFormat, parts]);

  return (
    <div className={`relative overflow-hidden rounded-md border bg-muted/20 ${className}`}>
      <div ref={containerRef} className="h-full min-h-52 w-full" />
      {status ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
          {status}
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded border bg-background/85 px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          Drag to rotate
        </div>
      )}
    </div>
  );
}

async function preparePartPreview(parts: NonNullable<Parameters<typeof StlModelViewer>[0]["parts"]>, palette: string[]) {
  const loaded = await Promise.all(parts.map(async (part, partIndex) => {
    const buffer = part.file ? await part.file.arrayBuffer() : await fetch(part.src!, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error("Part model not available");
      return response.arrayBuffer();
    });
    const format = part.modelFormat ?? inferModelFormat(part.file?.name ?? part.src ?? "");
    const base = format === "3mf"
      ? prepareLoadedObjectForBuildPlate(new ThreeMFLoader().parse(buffer), [palette[part.colorIndex ?? partIndex] ?? palette[0] ?? "#26a69a"], { targetSizeMm: 58, normalize: true })
      : objectFromStl(buffer, palette[part.colorIndex ?? partIndex] ?? palette[0] ?? "#26a69a", 58);
    return {
      ...base,
      quantity: Math.max(1, Math.round(part.quantity ?? 1)),
      colorIndex: part.colorIndex ?? partIndex,
      copyColorIndexes: part.copyColorIndexes?.length ? part.copyColorIndexes : []
    };
  }));

  const group = new THREE.Group();
  const coloredMeshes: Array<{ mesh: THREE.Mesh; colorIndex: number }> = [];
  const total = loaded.reduce((sum, part) => sum + part.quantity, 0);
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
  const spacing = 72;
  let itemIndex = 0;

  for (const part of loaded) {
    for (let copyIndex = 0; copyIndex < part.quantity; copyIndex += 1) {
      const copyColorIndex = part.copyColorIndexes[copyIndex] ?? part.colorIndex;
      const copy = part.object.clone(true);
      const column = itemIndex % columns;
      const row = Math.floor(itemIndex / columns);
      copy.position.x += (column - (columns - 1) / 2) * spacing;
      copy.position.z += row * spacing;
      copy.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.material = new THREE.MeshStandardMaterial({
          color: palette[copyColorIndex % Math.max(1, palette.length)] ?? palette[0] ?? "#26a69a",
          roughness: 0.46,
          metalness: 0.08
        });
        coloredMeshes.push({ mesh: child, colorIndex: copyColorIndex });
      });
      group.add(copy);
      itemIndex += 1;
    }
  }

  centerPreparedPartsOnPlate(group, { targetSizeMm: Math.max(120, columns * 64) });
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  return {
    object: group,
    coloredMeshes,
    modelSizeMm: { width: size.x, height: size.y, depth: size.z },
    plateSizeMm: {
      width: Math.max(180, Math.ceil(size.x + 32)),
      depth: Math.max(180, Math.ceil(size.z + 32))
    }
  };
}

function objectFromStl(buffer: ArrayBuffer, color: string, targetSizeMm: number) {
  const loadedGeometry = new STLLoader().parse(buffer);
  loadedGeometry.computeVertexNormals();
  const prepared = prepareGeometryForBuildPlate(loadedGeometry, { targetSizeMm, minPlateSizeMm: targetSizeMm, platePaddingMm: 0 });
  loadedGeometry.dispose();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness: 0.08 });
  const mesh = new THREE.Mesh(prepared.geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const object = new THREE.Group();
  object.add(mesh);
  return {
    object,
    coloredMeshes: [{ mesh, colorIndex: 0 }],
    modelSizeMm: prepared.modelSizeMm,
    plateSizeMm: prepared.plateSizeMm
  };
}

function centerPreparedPartsOnPlate(object: THREE.Object3D, options: { targetSizeMm?: number } = {}) {
  object.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const largestFootprint = Math.max(size.x, size.z) || 1;
  const scale = (options.targetSizeMm ?? 120) / largestFootprint;
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  object.position.x -= center.x;
  object.position.y -= box.min.y;
  object.position.z -= center.z;
  object.updateMatrixWorld(true);
}

function addPlate(scene: THREE.Scene, plateSizeMm: { width: number; depth: number }) {
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(plateSizeMm.width, plateSizeMm.depth),
    new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.86, metalness: 0 })
  );
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = -0.02;
  plate.receiveShadow = true;
  scene.add(plate);

  const grid = new THREE.GridHelper(
    Math.max(plateSizeMm.width, plateSizeMm.depth),
    12,
    "#94a3b8",
    "#cbd5e1"
  );
  grid.position.y = 0.01;
  scene.add(grid);
}

function frameCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, plateSizeMm: { width: number; depth: number }, modelHeight: number) {
  const frameSize = Math.max(plateSizeMm.width, plateSizeMm.depth, modelHeight);
  camera.position.set(frameSize * 0.72, frameSize * 0.58, frameSize * 0.9);
  controls.target.set(0, modelHeight * 0.38, 0);
  controls.maxDistance = frameSize * 2.4;
  controls.minDistance = frameSize * 0.28;
  controls.update();
}

function inferModelFormat(name: string): "stl" | "3mf" {
  return /\.3mf(?:$|\?)/i.test(name) ? "3mf" : "stl";
}

function prepareLoadedStlForBuildPlate(buffer: ArrayBuffer) {
  const loadedGeometry = new STLLoader().parse(buffer);
  loadedGeometry.computeVertexNormals();
  const prepared = prepareGeometryForBuildPlate(loadedGeometry);
  loadedGeometry.dispose();
  return prepared;
}

function prepareLoadedObjectForBuildPlate(sourceObject: THREE.Object3D, palette: string[], options: { targetSizeMm?: number; normalize?: boolean } = {}) {
  const object = sourceObject.clone(true);
  const coloredMeshes: Array<{ mesh: THREE.Mesh; colorIndex: number }> = [];
  let gearIndex = 0;
  let connectorIndex = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const role = `${child.name} ${child.parent?.name ?? ""}`.toLowerCase();
    const colorIndex = role.includes("gear")
      ? gearIndex++
      : role.includes("connector") || role.includes("bar")
        ? connectorIndex++
        : coloredMeshes.length;
    child.material = new THREE.MeshStandardMaterial({
      color: palette[colorIndex % Math.max(1, palette.length)] ?? "#26a69a",
      roughness: 0.46,
      metalness: 0.08
    });
    coloredMeshes.push({ mesh: child, colorIndex });
  });

  if (options.normalize ?? true) normalizeObjectToBuildPlate(object, { targetSizeMm: options.targetSizeMm });
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const padding = 28;
  const minPlateSize = 180;

  return {
    object,
    coloredMeshes,
    modelSizeMm: { width: size.x, height: size.y, depth: size.z },
    plateSizeMm: {
      width: Math.max(minPlateSize, Math.ceil(size.x + padding)),
      depth: Math.max(minPlateSize, Math.ceil(size.z + padding))
    }
  };
}

function normalizeObjectToBuildPlate(object: THREE.Object3D, options: { targetSizeMm?: number } = {}) {
  let box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  object.position.sub(center);
  orientObjectFlatOnBuildPlate(object);
  object.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const scale = (options.targetSizeMm ?? 120) / largest;
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(object);
  const postCenter = new THREE.Vector3();
  box.getCenter(postCenter);
  object.position.x -= postCenter.x;
  object.position.y -= box.min.y;
  object.position.z -= postCenter.z;
  object.updateMatrixWorld(true);
}

function orientObjectFlatOnBuildPlate(object: THREE.Object3D) {
  const rotations: Array<[number, number, number]> = [
    [0, 0, 0],
    [-Math.PI / 2, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, -Math.PI / 2, 0],
    [0, Math.PI / 2, 0],
    [0, 0, Math.PI / 2]
  ] as const;

  let bestRotation = rotations[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const rotation of rotations) {
    object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const footprint = Math.max(1, size.x * size.z);
    const score = size.y - footprint * 0.000001;
    if (score < bestScore) {
      bestScore = score;
      bestRotation = rotation;
    }
  }
  object.rotation.set(bestRotation[0], bestRotation[1], bestRotation[2]);
}
