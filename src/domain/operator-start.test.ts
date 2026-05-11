import { describe, expect, it } from "vitest";
import { approveOperatorPrintStart } from "./operator-start";

const checklist = {
  correctFilamentLoaded: true,
  buildPlateClear: true,
  cameraVisible: true,
  printerAreaSafe: true,
  gcodeVerifiedOnNode: true
};

describe("operator print start gate", () => {
  it("moves a ready-on-node job to awaiting operator start with persisted approval facts", () => {
    expect(
      approveOperatorPrintStart(
        { id: "job_1", status: "READY_ON_NODE" },
        { operatorId: "operator_1", checklist },
        new Date("2026-05-11T23:45:00.000Z")
      )
    ).toEqual({
      status: "AWAITING_OPERATOR_START",
      operatorStartApprovedById: "operator_1",
      operatorStartApprovedAt: new Date("2026-05-11T23:45:00.000Z"),
      operatorStartChecklist: checklist
    });
  });

  it("blocks approval when any checklist item is missing", () => {
    expect(() =>
      approveOperatorPrintStart(
        { id: "job_1", status: "READY_ON_NODE" },
        { operatorId: "operator_1", checklist: { ...checklist, cameraVisible: false } }
      )
    ).toThrow("All operator safety checklist items must be confirmed");
  });

  it("only allows ready-on-node jobs to be approved", () => {
    expect(() =>
      approveOperatorPrintStart({ id: "job_1", status: "QUEUED" }, { operatorId: "operator_1", checklist })
    ).toThrow("Only ready-on-node jobs can be approved for physical start");
  });
});
