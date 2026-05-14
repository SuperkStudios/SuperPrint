import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const readFileMock = vi.hoisted(() => vi.fn());
const findUniqueMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: findUniqueMock
    }
  }
}));

vi.mock("@/lib/storage", () => ({
  resolveLocalStoragePath: (key: string) => `/data/${key}`
}));

describe("product STL model route", () => {
  beforeEach(() => {
    readFileMock.mockReset();
    findUniqueMock.mockReset();
  });

  it("returns 404 when a product STL storage key points at a missing file", async () => {
    findUniqueMock.mockResolvedValue({ productFileStorageKey: "uploads/missing.stl" });
    readFileMock.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));

    const response = await GET(new Request("http://localhost/api/products/product_1/model"), {
      params: Promise.resolve({ id: "product_1" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Product STL not found" });
  });
});
