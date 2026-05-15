import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGcodeMetadataText, readGcodeMetadataText, resolveGcodeHistoryUsage } from "./centauri-history-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Centauri G-code history enrichment", () => {
  it("keeps Orca/Elegoo filament usage lines that appear after the header metadata", async () => {
    const gcode = [
      "; filament_density: 1.24",
      "; filament_diameter: 1.75",
      "G1 X0 Y0",
      "G1 X1 Y1\n".repeat(9000),
      "; filament used [g] = 10.66",
      "; total filament used [g] = 10.66"
    ].join("\n");

    const text = await readGcodeMetadataText(new Response(gcode));

    expect(text).toContain("; filament used [g] = 10.66");
  });

  it("fetches the G-code tail when Orca usage is not in the header range", async () => {
    const head = "; filament_density: 1.25\n;initial_filament:PLA\nG1 X0 Y0";
    const tail = "; filament used [g] = 65.56\n; total filament used [g] = 65.56";
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const range = init?.headers instanceof Headers ? init.headers.get("Range") : (init?.headers as Record<string, string> | undefined)?.Range;
      if (range?.startsWith("bytes=0-")) {
        return new Response(head, {
          status: 206,
          headers: {
            "content-range": "bytes 0-262143/9501433",
            "content-length": "262144"
          }
        });
      }
      return new Response(tail, {
        status: 206,
        headers: {
          "content-range": "bytes 7404273-9501432/9501433",
          "content-length": "2097152"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = await fetchGcodeMetadataText("http://printer.local/local/file.gcode");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(text).toContain(";initial_filament:PLA");
    expect(text).toContain("; filament used [g] = 65.56");
  });

  it("scales full G-code grams for stopped prints using printer layer progress", () => {
    expect(
      resolveGcodeHistoryUsage(
        {
          status: "STOPPED",
          printedLayers: 160,
          totalLayers: 340
        },
        55.7
      )
    ).toEqual({ gramsUsed: 26.21, gramsSource: "LAYER_ESTIMATE" });
  });
});
