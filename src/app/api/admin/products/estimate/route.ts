import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { estimatePrintFile } from "@/services/slicer-estimates";

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("printFile");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "printFile is required" }, { status: 400 });
  }

  const estimate = await estimatePrintFile({
    fileName: file.name,
    contentType: file.type,
    material: String(formData.get("material") ?? "PLA"),
    bytes: await file.arrayBuffer()
  });

  return NextResponse.json(estimate);
}
