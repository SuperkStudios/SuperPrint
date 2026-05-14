import { BoxGeometry } from "three";
import { describe, expect, it } from "vitest";
import { prepareGeometryForBuildPlate } from "./stl-model-viewer-utils";

describe("STL model viewer geometry", () => {
  it("places the transformed model directly on the build plate", () => {
    const geometry = new BoxGeometry(20, 12, 8);

    const result = prepareGeometryForBuildPlate(geometry, { targetSizeMm: 120 });

    result.geometry.computeBoundingBox();
    expect(result.geometry.boundingBox?.min.y).toBeCloseTo(0, 5);
    expect(result.geometry.boundingBox?.max.y).toBeGreaterThan(0);
    expect(result.plateSizeMm.width).toBeGreaterThanOrEqual(result.footprintMm.width);
    expect(result.plateSizeMm.depth).toBeGreaterThanOrEqual(result.footprintMm.depth);
  });
});
