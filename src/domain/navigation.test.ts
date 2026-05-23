import { describe, expect, it } from "vitest";
import { buildAdminNavigation, buildUserNavigation } from "./navigation";

describe("user navigation", () => {
  it("shows customer workspace links for signed-in users", () => {
    expect(buildUserNavigation("OWNER").map((item) => item.label)).toEqual(["Dashboard", "Upload STL", "Orders", "Rewards", "Support", "Profile"]);
    expect(buildUserNavigation("ADMIN").map((item) => item.label)).toEqual(["Dashboard", "Upload STL", "Orders", "Rewards", "Support", "Profile"]);
  });

  it("shows customer workspace links for signed-in customers", () => {
    expect(buildUserNavigation("CUSTOMER").map((item) => item.label)).toEqual(["Dashboard", "Upload STL", "Orders", "Rewards", "Support", "Profile"]);
  });

  it("shows sign-in when no user is present", () => {
    expect(buildUserNavigation(undefined)).toEqual([{ href: "/login", label: "Sign in" }]);
  });

  it("shows admin operations separately for owners and admins", () => {
    expect(buildAdminNavigation("OWNER").map((item) => item.label)).toEqual(["Dashboard", "Queue", "In-person POS", "Merchants", "Orders", "Support", "Uploads", "Products", "Parts", "Filament", "Printers", "Maintenance", "Factory Evolution", "History", "Staff", "Settings"]);
    expect(buildAdminNavigation("ADMIN").map((item) => item.label)).toEqual(["Dashboard", "Queue", "In-person POS", "Merchants", "Orders", "Support", "Uploads", "Products", "Parts", "Filament", "Printers", "Maintenance", "Factory Evolution", "History", "Staff", "Settings"]);
  });
});
