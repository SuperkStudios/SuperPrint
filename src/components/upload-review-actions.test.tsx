import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UploadReviewActions } from "./upload-review-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

describe("UploadReviewActions", () => {
  it("does not require admins to type slicer-calculated time or grams", () => {
    const html = renderToStaticMarkup(
      <UploadReviewActions
        uploadId="upload_1"
        printers={[{ id: "printer_1", publicName: "Centauri Carbon 1", modelName: "Centauri Carbon" }]}
      />
    );

    expect(html).toContain("Calculated grams");
    expect(html).toContain("Calculated time");
    expect(html).toContain("Calculated after slicing");
    expect(html).not.toContain('value="80"');
    expect(html).not.toContain('value="180"');
  });
});
