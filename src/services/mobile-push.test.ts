import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMobilePush } from "./mobile-push";

const findManyMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const recordPlatformEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mobilePushToken: {
      findMany: findManyMock,
      updateMany: updateManyMock
    }
  }
}));

vi.mock("./events", () => ({
  recordPlatformEvent: recordPlatformEventMock
}));

describe("sendMobilePush", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    updateManyMock.mockReset();
    recordPlatformEventMock.mockReset();
    vi.restoreAllMocks();
  });

  it("sends Expo push payloads to enabled admin devices", async () => {
    findManyMock.mockResolvedValue([{ id: "token_1", token: "ExponentPushToken[abc]" }]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "ok" }] }), { status: 200 }));

    await expect(sendMobilePush({ title: "Print finished", body: "Remove the plate." })).resolves.toEqual({ sent: 1, failed: 0 });

    expect(fetchMock).toHaveBeenCalledWith("https://exp.host/--/api/v2/push/send", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("Print finished")
    }));
    expect(recordPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({ type: "MOBILE_PUSH_SENT" }));
  });

  it("disables tokens that Expo rejects", async () => {
    findManyMock.mockResolvedValue([{ id: "token_1", token: "bad-token" }]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "error", message: "DeviceNotRegistered" }] }), { status: 200 }));

    await expect(sendMobilePush({ title: "Blocked", body: "Review production." })).resolves.toEqual({ sent: 0, failed: 1 });

    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["token_1"] } },
      data: { enabled: false }
    }));
    expect(recordPlatformEventMock).toHaveBeenCalledWith(expect.objectContaining({ type: "MOBILE_PUSH_FAILED" }));
  });
});
