import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const findManyMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http", () => ({
  requireAdmin: vi.fn(() => Promise.resolve({ response: null }))
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findMany: findManyMock,
      upsert: upsertMock
    }
  }
}));

describe("admin settings route", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({});
  });

  it("saves new Stripe keys while preserving masked existing secrets", async () => {
    findManyMock.mockResolvedValue([
      { key: "stripe.secretKey", value: "sk_test_existing" },
      { key: "stripe.webhookSecret", value: "whsec_existing" }
    ]);

    const response = await POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({
        brandName: "SuperPrint",
        primaryColor: "#0f8f7f",
        lowFilamentThresholdGrams: 150,
        stripe: {
          mode: "live",
          secretKey: "••••••••sting",
          publishableKey: "pk_live_next",
          webhookSecret: ""
        }
      })
    }));

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "stripe.mode" },
      update: { value: "live" }
    }));
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "stripe.publishableKey" },
      update: { value: "pk_live_next" }
    }));
    expect(upsertMock).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "stripe.secretKey" }
    }));
    expect(upsertMock).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "stripe.webhookSecret" }
    }));
  });

  it("saves operations notification channels", async () => {
    findManyMock.mockResolvedValue([]);

    const response = await POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({
        primaryColor: "#0f8f7f",
        notifications: {
          email: "owner@example.com",
          sms: "",
          webhookUrl: "https://hooks.example.com/superprint"
        }
      })
    }));

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "notifications.email" },
      update: { value: "owner@example.com" }
    }));
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "notifications.webhookUrl" },
      update: { value: "https://hooks.example.com/superprint" }
    }));
  });
});
