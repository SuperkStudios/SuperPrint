import { describe, expect, it } from "vitest";
import { buildModelReviewPayload, buildModelUploadedPayload, validateStlUploadInput } from "./uploads";

describe("validateStlUploadInput", () => {
  it("accepts safe STL uploads with common MIME fallbacks", () => {
    expect(
      validateStlUploadInput({
        fileName: "bracket-v2.stl",
        sizeBytes: 1024,
        contentType: "application/octet-stream"
      })
    ).toEqual({
      fileName: "bracket-v2.stl",
      sizeBytes: 1024,
      contentType: "application/octet-stream"
    });
  });

  it("rejects unsafe names, non-STL files, and oversized uploads", () => {
    expect(() =>
      validateStlUploadInput({ fileName: "../bracket.stl", sizeBytes: 1024, contentType: "model/stl" })
    ).toThrow("Unsafe file name");
    expect(() =>
      validateStlUploadInput({ fileName: "bracket.obj", sizeBytes: 1024, contentType: "model/obj" })
    ).toThrow("Only .stl files are supported");
    expect(() =>
      validateStlUploadInput({ fileName: "bracket.stl", sizeBytes: 151 * 1024 * 1024, contentType: "model/stl" })
    ).toThrow("STL upload exceeds");
  });
});

describe("buildModelUploadedPayload", () => {
  it("creates public event payload without raw filesystem paths", () => {
    expect(
      buildModelUploadedPayload({
        uploadId: "upload_1",
        fileName: "bracket.stl",
        sizeBytes: 2048,
        contentType: "model/stl",
        storageKey: "uploads/123-bracket.stl",
        localVolumePath: "/data/uploads/123-bracket.stl"
      })
    ).toEqual({
      uploadId: "upload_1",
      fileName: "bracket.stl",
      sizeBytes: 2048,
      contentType: "model/stl",
      localVolumeKey: "uploads/123-bracket.stl",
      localVolumePath: "/data/uploads/123-bracket.stl"
    });
  });
});

describe("buildModelReviewPayload", () => {
  it("creates approval and rejection event payloads", () => {
    expect(
      buildModelReviewPayload({
        uploadId: "upload_1",
        fileName: "bracket.stl",
        status: "APPROVED"
      })
    ).toEqual({ uploadId: "upload_1", fileName: "bracket.stl", status: "APPROVED" });

    expect(
      buildModelReviewPayload({
        uploadId: "upload_1",
        fileName: "bracket.stl",
        status: "REJECTED",
        rejectionReason: "Wall thickness too low"
      })
    ).toEqual({
      uploadId: "upload_1",
      fileName: "bracket.stl",
      status: "REJECTED",
      rejectionReason: "Wall thickness too low"
    });
  });
});
