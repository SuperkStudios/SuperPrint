import { estimateStlPrintFile, parseProductPrintFileEstimates } from "@/domain/products";

export type PrintEstimate = {
  estimatedPrintMinutes: number | null;
  estimatedGrams: number | null;
  source: "slicer" | "gcode" | "geometry";
  message?: string;
};

export async function estimatePrintFile(input: {
  fileName: string;
  contentType?: string;
  material?: string;
  bytes: Uint8Array | ArrayBuffer;
}): Promise<PrintEstimate> {
  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);

  if (/\.(gcode|gco|g)$/i.test(input.fileName)) {
    const estimate = parseProductPrintFileEstimates(Buffer.from(bytes).toString("utf8"), input.material);
    return { ...estimate, source: "gcode" };
  }

  const slicerEstimate = await requestHostSlicerEstimate({
    fileName: input.fileName,
    contentType: input.contentType,
    material: input.material,
    bytes
  });
  if (slicerEstimate) return slicerEstimate;

  return {
    ...estimateStlPrintFile(bytes, input.material),
    source: "geometry",
    message: "Host slicer bridge unavailable; used geometry fallback."
  };
}

async function requestHostSlicerEstimate(input: {
  fileName: string;
  contentType?: string;
  material?: string;
  bytes: Uint8Array;
}): Promise<PrintEstimate | null> {
  const endpoint = process.env.HOST_SLICER_ESTIMATE_URL;
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: input.fileName,
        contentType: input.contentType,
        material: input.material,
        dataBase64: Buffer.from(input.bytes).toString("base64")
      }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) return null;
    const body = await response.json() as Partial<PrintEstimate>;
    if (!body.estimatedPrintMinutes || !body.estimatedGrams) return null;
    return {
      estimatedPrintMinutes: body.estimatedPrintMinutes,
      estimatedGrams: body.estimatedGrams,
      source: "slicer",
      message: body.message
    };
  } catch {
    return null;
  }
}
