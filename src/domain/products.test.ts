import { describe, expect, it } from "vitest";
import { calculateProductMaterialCostCents, estimateStlPrintFile, normalizeProductInput, parseProductPrintFileEstimates } from "./products";

describe("product catalog", () => {
  it("normalizes product input for admin-created store items", () => {
    expect(
      normalizeProductInput({
        name: "Cable Clip XL",
        description: "A durable cable clip printed from approved material.",
        imageUrl: "/api/products/product_1/image",
        priceCents: 1299,
        estimatedPrintMinutes: 42,
        estimatedGrams: 64,
        materialCostCents: 153,
        defaultMaterial: "PLA"
      })
    ).toMatchObject({
      name: "Cable Clip XL",
      slug: "cable-clip-xl",
      priceCents: 1299,
      status: "ACTIVE"
    });
  });

  it("rejects products without customer-facing media and pricing", () => {
    expect(() =>
      normalizeProductInput({
        name: "X",
        description: "too short",
        imageUrl: "not-a-url",
        priceCents: 0,
        estimatedPrintMinutes: 0,
        estimatedGrams: 0,
        defaultMaterial: "PLA"
      })
    ).toThrow();
  });

  it("calculates material cost from grams and spool cost", () => {
    expect(calculateProductMaterialCostCents({ estimatedGrams: 72, rollCostCents: 2400, rollGrams: 1000 })).toBe(173);
  });

  it("parses safe G-code product estimates when comments are present", () => {
    expect(
      parseProductPrintFileEstimates("; estimated printing time: 2h 14m\n; filament used [g] = 81.4")
    ).toEqual({ estimatedPrintMinutes: 134, estimatedGrams: 81 });
  });

  it("parses slicer G-code comments from Elegoo and Orca output", () => {
    expect(
      parseProductPrintFileEstimates("; filament used [cm3] = 9.69\n; total filament used [g] = 0.00\n; estimated printing time (normal mode) = 1h 22m 19s", "PLA")
    ).toEqual({ estimatedPrintMinutes: 82, estimatedGrams: 12 });
  });

  it("converts slicer volume comments with the selected material density", () => {
    expect(
      parseProductPrintFileEstimates("; filament used [cm3] = 100\n; estimated printing time = 1h", "ABS")
    ).toEqual({ estimatedPrintMinutes: 60, estimatedGrams: 104 });
  });

  it("estimates grams and time directly from STL mesh volume", () => {
    const stl = asciiCubeStl(10);

    expect(estimateStlPrintFile(new TextEncoder().encode(stl), "PLA")).toEqual({
      estimatedPrintMinutes: 7,
      estimatedGrams: 1
    });
  });

  it("does not inflate ETA for high triangle-count meshes", () => {
    const singleCube = estimateStlPrintFile(new TextEncoder().encode(asciiCubeStl(10)), "PLA");
    const detailedCube = estimateStlPrintFile(new TextEncoder().encode(`${asciiCubeStl(10)}\n${degenerateFacets(2000)}`), "PLA");

    expect(detailedCube.estimatedGrams).toBe(singleCube.estimatedGrams);
    expect(detailedCube.estimatedPrintMinutes).toBe(singleCube.estimatedPrintMinutes);
  });

  it("adapts fallback STL estimates using slicer-like material settings", () => {
    const stl = new TextEncoder().encode(asciiCubeStl(40));

    const pla = estimateStlPrintFile(stl, "PLA");
    const tpu = estimateStlPrintFile(stl, "TPU");
    const abs = estimateStlPrintFile(stl, "ABS");

    expect(tpu.estimatedPrintMinutes).toBeGreaterThan(pla.estimatedPrintMinutes! * 2);
    expect(abs.estimatedGrams).toBeLessThan(pla.estimatedGrams!);
  });
});

function asciiCubeStl(size: number, repeats = 1) {
  const p = [
    [0, 0, 0],
    [size, 0, 0],
    [size, size, 0],
    [0, size, 0],
    [0, 0, size],
    [size, 0, size],
    [size, size, size],
    [0, size, size]
  ];
  const faces = [
    [p[0], p[3], p[2], p[1]],
    [p[4], p[5], p[6], p[7]],
    [p[0], p[1], p[5], p[4]],
    [p[1], p[2], p[6], p[5]],
    [p[2], p[3], p[7], p[6]],
    [p[3], p[0], p[4], p[7]]
  ] as const;

  const body = faces.flatMap(([a, b, c, d]) => subdivideQuad(a, b, c, d, repeats)).flatMap((face) => [
    "facet normal 0 0 0",
    "outer loop",
    ...face.map((vertex) => `vertex ${vertex.join(" ")}`),
    "endloop",
    "endfacet"
  ]);

  return [
    "solid cube",
    ...Array.from({ length: repeats }, () => body).flat(),
    "endsolid cube"
  ].join("\n");
}

function subdivideQuad(a: number[], b: number[], c: number[], d: number[], divisions: number) {
  const triangles: number[][][] = [];
  for (let y = 0; y < divisions; y += 1) {
    for (let x = 0; x < divisions; x += 1) {
      const p00 = pointOnQuad(a, b, c, d, x / divisions, y / divisions);
      const p10 = pointOnQuad(a, b, c, d, (x + 1) / divisions, y / divisions);
      const p11 = pointOnQuad(a, b, c, d, (x + 1) / divisions, (y + 1) / divisions);
      const p01 = pointOnQuad(a, b, c, d, x / divisions, (y + 1) / divisions);
      triangles.push([p00, p10, p11], [p00, p11, p01]);
    }
  }
  return triangles;
}

function pointOnQuad(a: number[], b: number[], c: number[], d: number[], x: number, y: number) {
  return [0, 1, 2].map((axis) => (
    a[axis] * (1 - x) * (1 - y) +
    b[axis] * x * (1 - y) +
    c[axis] * x * y +
    d[axis] * (1 - x) * y
  ));
}

function degenerateFacets(count: number) {
  return Array.from({ length: count }, () => [
    "facet normal 0 0 0",
    "outer loop",
    "vertex 0 0 0",
    "vertex 0 0 0",
    "vertex 0 0 0",
    "endloop",
    "endfacet"
  ].join("\n")).join("\n");
}
