import { describe, expect, it } from "vitest";
import { buildThemeCssVariables, normalizePrimaryColor } from "./theme";

describe("platform theme", () => {
  it("normalizes hex colors and exposes Tailwind CSS variables", () => {
    expect(normalizePrimaryColor("#ff8800")).toBe("#ff8800");
    expect(buildThemeCssVariables("#ff8800")).toEqual({
      "--primary": "32 100% 50%",
      "--ring": "32 100% 50%",
      "--primary-foreground": "222 30% 12%"
    });
  });

  it("falls back to the SuperPrint primary color when input is invalid", () => {
    expect(normalizePrimaryColor("orange")).toBe("#0f8f7f");
    expect(buildThemeCssVariables("orange")["--primary"]).toBe("173 81% 31%");
  });
});
