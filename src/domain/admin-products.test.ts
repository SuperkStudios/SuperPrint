import { describe, expect, it } from "vitest";
import { buildAdminProductCatalogStats } from "./admin-products";

describe("admin product catalog", () => {
  it("summarizes active, archived, and attached print-file products for the admin list", () => {
    expect(
      buildAdminProductCatalogStats([
        { status: "ACTIVE", productFileStorageKey: "uploads/test.stl" },
        { status: "ACTIVE", productFileStorageKey: null },
        { status: "ARCHIVED", productFileStorageKey: "uploads/old.gcode" }
      ])
    ).toEqual({
      total: 3,
      active: 2,
      archived: 1,
      withPrintFiles: 2
    });
  });
});
