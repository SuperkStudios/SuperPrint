import { NextResponse } from "next/server";
import { z } from "zod";
import { probePrinterConnection } from "@/domain/bootstrap";
import { getBootstrapStatus } from "@/lib/bootstrap";

const schema = z.object({
  internalIp: z.string().min(1),
  controlApiUrl: z.string().url()
});

export async function POST(request: Request) {
  const status = await getBootstrapStatus();
  if (status.isComplete) {
    return NextResponse.json({ ok: false, status: "LOCKED", message: "Bootstrap is locked." }, { status: 409 });
  }

  const input = schema.parse(await request.json());
  const result = await probePrinterConnection(input);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
