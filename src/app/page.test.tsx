import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("presents the real 3D printing workflow and operator entry point", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("One workflow from");
    expect(html).toContain("mesh");
    expect(html).toContain("Prepare");
    expect(html).toContain("Slice");
    expect(html).toContain("Dispatch");
    expect(html).toContain("Observe");
    expect(html).toContain('href="/operator"');
    expect(html).toContain("Launch operator console");
  });

  it("separates implemented connectivity from roadmap adapters", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("In the repository today");
    expect(html).toContain("Elegoo Centauri Carbon control through SDCP");
    expect(html).toContain("Generic G-code with operator-gated manual dispatch");
    expect(html).toContain("These ecosystems are named integration targets, not claims of completed hardware support.");
    expect(html).not.toContain("supports all printers");
  });
});
