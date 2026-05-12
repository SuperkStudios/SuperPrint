import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchCentauriCompletedHistory } from "@/lib/centauri-history-client";
import { getBootstrapStatus } from "@/lib/bootstrap";

export const runtime = "nodejs";

const schema = z.object({
  controlApiUrl: z.string().url(),
  mainboardId: z.string().optional()
});

export async function POST(request: Request) {
  const status = await getBootstrapStatus();
  if (status.isComplete) {
    return NextResponse.json({ ok: false, completedPrints: [], message: "Bootstrap is locked." }, { status: 409 });
  }

  try {
    const input = schema.parse(await request.json());
    const completedPrints = await fetchCentauriCompletedHistory(input);
    return NextResponse.json({
      ok: true,
      completedPrints,
      message: completedPrints.length ? `Found ${completedPrints.length} completed print(s).` : "No completed printer-history entries with material usage were found."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        completedPrints: [],
        message: error instanceof Error ? error.message : "Could not read printer history."
      },
      { status: 400 }
    );
  }
}
