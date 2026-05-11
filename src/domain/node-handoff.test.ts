import { describe, expect, it } from "vitest";
import { acknowledgeJobReadyOnNode } from "./node-handoff";

describe("node handoff", () => {
  it("marks an assigned queued job ready on node without starting the print", () => {
    expect(
      acknowledgeJobReadyOnNode(
        { id: "job_1", status: "QUEUED", printerId: "printer_1" },
        { nodeId: "node_1", printerId: "printer_1", localJobPath: "/node/jobs/job_1.gcode" },
        new Date("2026-05-11T23:30:00.000Z")
      )
    ).toEqual({
      status: "READY_ON_NODE",
      readyOnNodeId: "node_1",
      nodeLocalJobPath: "/node/jobs/job_1.gcode",
      readyOnNodeAt: new Date("2026-05-11T23:30:00.000Z")
    });
  });

  it("blocks acknowledgements for the wrong printer or non-queued jobs", () => {
    expect(() =>
      acknowledgeJobReadyOnNode(
        { id: "job_1", status: "PRINTING", printerId: "printer_1" },
        { nodeId: "node_1", printerId: "printer_1", localJobPath: "/node/jobs/job_1.gcode" }
      )
    ).toThrow("Only queued assigned jobs can become ready on node");
    expect(() =>
      acknowledgeJobReadyOnNode(
        { id: "job_1", status: "QUEUED", printerId: "printer_2" },
        { nodeId: "node_1", printerId: "printer_1", localJobPath: "/node/jobs/job_1.gcode" }
      )
    ).toThrow("Node is not assigned to this printer");
  });
});
