import { describe, expect, it } from "vitest";
import { toPgDumpUrl } from "./postgres-url";

describe("pg_dump URL normalization", () => {
  it("removes Prisma-only schema query parameters", () => {
    expect(toPgDumpUrl("postgresql://postgres:postgres@postgres:5432/superprint?schema=public")).toBe(
      "postgresql://postgres:postgres@postgres:5432/superprint"
    );
  });
});
