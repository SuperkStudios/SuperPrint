import { describe, expect, it } from "vitest";
import { buildUserNavigation } from "./navigation";

describe("user navigation", () => {
  it("shows admin operations for owners and admins", () => {
    expect(buildUserNavigation("OWNER").map((item) => item.label)).toEqual(["Admin", "Uploads", "Products", "Queue", "Filament", "Settings"]);
    expect(buildUserNavigation("ADMIN").map((item) => item.label)).toEqual(["Admin", "Uploads", "Products", "Queue", "Filament", "Settings"]);
  });

  it("shows customer workspace links for signed-in customers", () => {
    expect(buildUserNavigation("CUSTOMER").map((item) => item.label)).toEqual(["Store", "Upload STL", "Orders", "Profile"]);
  });

  it("shows sign-in when no user is present", () => {
    expect(buildUserNavigation(undefined)).toEqual([{ href: "/login", label: "Sign in" }]);
  });
});
