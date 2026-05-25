import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const getProductionLoopStateMock = vi.hoisted(() => vi.fn());
const runProductionLoopActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http", () => ({
  requireAdmin: vi.fn(() => Promise.resolve({ response: null, session: { user: { id: "admin_1" } } }))
}));

vi.mock("@/services/production-loop", () => ({
  getProductionLoopState: getProductionLoopStateMock,
  runProductionLoopAction: runProductionLoopActionMock
}));

describe("production loop admin route", () => {
  beforeEach(() => {
    getProductionLoopStateMock.mockReset();
    runProductionLoopActionMock.mockReset();
  });

  it("returns the current production loop state", async () => {
    getProductionLoopStateMock.mockResolvedValue({ nextAction: { type: "send_print" }, counts: { plates: 1 } });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ nextAction: { type: "send_print" } });
  });

  it("passes admin actions through with the actor id", async () => {
    runProductionLoopActionMock.mockResolvedValue({ state: { nextAction: { type: "printing" } } });

    const response = await POST(new Request("http://localhost/api/admin/production-loop", {
      method: "POST",
      body: JSON.stringify({ action: "sendPlateToPrinter", plateJobId: "plate_1" })
    }));

    expect(response.status).toBe(200);
    expect(runProductionLoopActionMock).toHaveBeenCalledWith({
      action: "sendPlateToPrinter",
      plateJobId: "plate_1",
      orderId: undefined,
      actorId: "admin_1"
    });
  });
});
