import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const connectionTokensCreateMock = vi.hoisted(() => vi.fn());
const getStripeSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http", () => ({
  requireAdmin: vi.fn(() => Promise.resolve({ response: null }))
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => Promise.resolve({
    terminal: {
      connectionTokens: {
        create: connectionTokensCreateMock
      }
    }
  })),
  getStripeSettings: getStripeSettingsMock
}));

describe("admin Terminal connection token route", () => {
  beforeEach(() => {
    connectionTokensCreateMock.mockReset();
    connectionTokensCreateMock.mockResolvedValue({ secret: "pst_test_secret" });
    getStripeSettingsMock.mockReset();
    getStripeSettingsMock.mockResolvedValue({
      terminalLocationId: "tml_platform_store"
    });
  });

  it("creates the token on the platform Stripe account without Connect options", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.secret).toBe("pst_test_secret");
    expect(connectionTokensCreateMock).toHaveBeenCalledWith({ location: "tml_platform_store" });
  });
});
