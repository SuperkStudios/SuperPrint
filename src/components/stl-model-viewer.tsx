"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { prepareGeometryForBuildPlate } from "./stl-model-viewer-utils";

export function StlModelViewer({
  src,
  file,
  color = "#26a69a",
  className = ""
}: {
  src?: string | null;
  file?: File | null;
  color?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const [status, setStatus] = useState("Loading model");

  useEffect(() => {
    materialRef.current?.color.set(color);
  }, [color]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || (!src && !file)) {
      setStatus("Upload an STL to preview it");
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
        const buffer = file ? await file.arrayBuffer() : await fetch(src!, { cache: "force-cache" }).then((response) => {
          if (!response.ok) throw new Error("Model not available");
          return response.arrayBuffer();
        });
        if (disposed) return;
        const loadedGeometry = new STLLoader().parse(buffer);
        loadedGeometry.computeVertexNormals();
        const prepared = prepareGeometryForBuildPlate(loadedGeometry);
        loadedGeometry.dispose();

        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(prepared.plateSizeMm.width, prepared.plateSizeMm.depth),
          new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.86, metalness: 0 })
        );
        plate.rotation.x = -Math.PI / 2;
        plate.position.y = -0.02;
        plate.receiveShadow = true;
        scene.add(plate);

        const grid = new THREE.GridHelper(
          Math.max(prepared.plateSizeMm.width, prepared.plateSizeMm.depth),
          12,
          "#94a3b8",
          "#cbd5e1"
        );
        grid.position.y = 0.01;
        scene.add(grid);

        const mesh = new THREE.Mesh(prepared.geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const frameSize = Math.max(prepared.plateSizeMm.width, prepared.plateSizeMm.depth, prepared.modelSizeMm.height);
        camera.position.set(frameSize * 0.72, frameSize * 0.58, frameSize * 0.9);
        controls.target.set(0, prepared.modelSizeMm.height * 0.38, 0);
        controls.maxDistance = frameSize * 2.4;
        controls.minDistance = frameSize * 0.28;
        controls.update();
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
    };
  }, [src, file]);

  return (
    <div className={`relative overflow-hidden rounded-md border bg-slate-50 ${className}`}>
      <div ref={containerRef} className="h-full min-h-52 w-full" />
      {status ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-50/80 text-sm text-muted-foreground">
          {status}
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/85 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm">
          Drag to rotate
        </div>
      )}
    </div>
  );
}
