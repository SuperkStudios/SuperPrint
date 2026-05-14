import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TelemetryDashboard } from "./telemetry-dashboard";

describe("TelemetryDashboard", () => {
  it("renders compact live status details without the homepage hero visual", () => {
    const html = renderToStaticMarkup(
      <TelemetryDashboard
        queue={{
          current: null,
          nextJobs: [],
          printers: []
        } as any}
      />
    );

    expect(html).not.toContain("3D printer animation");
    expect(html).toContain("NOW PRINTING");
    expect(html).toContain("No active print");
    expect(html).toContain("Queue is clear");
  });
});
