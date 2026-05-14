import { describe, expect, it } from "vitest";
import { approveModelUpload, rejectModelUpload } from "./model-review";

const pendingUpload = {
  id: "upload_1",
  status: "PENDING",
  storageKey: "uploads/model.stl",
  fileName: "model.stl"
};

describe("model review transitions", () => {
  it("approves a pending upload and requests slicing with operator review fields", () => {
    expect(
      approveModelUpload(pendingUpload, {
        adminNotes: "Printable with supports",
        estimatedGrams: 84,
        estimatedPrintMinutes: 210,
        selectedMaterial: "PLA",
        selectedPrinterId: "printer_1"
      })
    ).toEqual({
      upload: {
        status: "APPROVED",
        adminNotes: "Printable with supports",
        estimatedGrams: 84,
        estimatedPrintMinutes: 210,
        selectedMaterial: "PLA",
        selectedPrinterId: "printer_1"
      },
      sliceJob: {
        uploadId: "upload_1",
        inputStorageKey: "uploads/model.stl",
        selectedMaterial: "PLA",
        selectedPrinterId: "printer_1",
        estimatedGrams: 84,
        estimatedPrintMinutes: 210
      }
    });
  });

  it("approves a pending STL without manual estimates so slicing can calculate them", () => {
    expect(
      approveModelUpload(pendingUpload, {
        selectedMaterial: "PLA",
        selectedPrinterId: "printer_1"
      })
    ).toEqual({
      upload: {
        status: "APPROVED",
        adminNotes: "",
        estimatedGrams: undefined,
        estimatedPrintMinutes: undefined,
        selectedMaterial: "PLA",
        selectedPrinterId: "printer_1"
      },
      sliceJob: {
        uploadId: "upload_1",
        inputStorageKey: "uploads/model.stl",
        selectedMaterial: "PLA",
        selectedPrinterId: "printer_1",
        estimatedGrams: undefined,
        estimatedPrintMinutes: undefined
      }
    });
  });

  it("rejects a pending upload with a customer-visible reason", () => {
    expect(rejectModelUpload(pendingUpload, "Wall thickness is too thin.")).toEqual({
      upload: {
        status: "REJECTED",
        rejectionReason: "Wall thickness is too thin."
      },
      customerStatus: "Rejected: Wall thickness is too thin."
    });
  });

  it("blocks review transitions once an upload is no longer pending", () => {
    expect(() =>
      approveModelUpload({ ...pendingUpload, status: "APPROVED" }, {
        estimatedGrams: 84,
        estimatedPrintMinutes: 210,
        selectedMaterial: "PLA",
        selectedPrinterId: "printer_1"
      })
    ).toThrow("Only pending uploads can be reviewed");
  });
});
