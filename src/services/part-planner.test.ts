import { describe, expect, it } from "vitest";
import { getPartColorRequirements } from "./part-planner";

describe("getPartColorRequirements", () => {
  it("uses the part color slot pattern to avoid printing every part in every order color", () => {
    const requirements = getPartColorRequirements(
      { colorSlotIndex: 0, colorSlotPattern: [0, 1, 1], quantityPerUnit: 3 },
      ["Black", "White"],
      "Black"
    );

    expect(requirements).toEqual([
      { color: "Black", quantityPerProductColor: 1 },
      { color: "White", quantityPerProductColor: 2 }
    ]);
  });

  it("falls back to the part color slot when no explicit pattern exists", () => {
    const requirements = getPartColorRequirements(
      { colorSlotIndex: 1, colorSlotPattern: [], quantityPerUnit: 2 },
      ["Red", "Blue"],
      "Red"
    );

    expect(requirements).toEqual([{ color: "Blue", quantityPerProductColor: 2 }]);
  });
});
