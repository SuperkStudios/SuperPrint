import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrinterHeroVisual } from "./printer-hero-visual";

describe("PrinterHeroVisual", () => {
  it("renders the homepage 3D printer animation with progress", () => {
    const html = renderToStaticMarkup(<PrinterHeroVisual progressPercent={42} />);

    expect(html).toContain("3D printer scroll animation");
    expect(html).toContain("/assets/generated/printer-sequence-v2/frame-01.png");
    expect(html).toContain("/assets/generated/printer-sequence-v2/frame-03.png");
    expect(html).toContain("Layer");
  });
});
