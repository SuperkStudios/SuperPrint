import { NextResponse } from "next/server";
import { z } from "zod";
import { runOwnerBootstrap } from "@/lib/bootstrap";

const schema = z.object({
  owner: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(12)
  }),
  company: z.object({
    brandName: z.string().min(1)
  }),
  printer: z.object({
    name: z.string().min(1),
    publicName: z.string().min(1),
    internalIp: z.string().min(1),
    controlApiUrl: z.string().url()
  }),
  filament: z.object({
    material: z.enum(["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"]),
    color: z.string().min(1),
    brand: z.string().min(1),
    remainingGrams: z.number().int().nonnegative(),
    thresholdGrams: z.number().int().nonnegative(),
    location: z.string().min(1)
  }),
  security: z.object({
    mediaTokenSecretSet: z.boolean(),
    backupPassphraseSet: z.boolean()
  })
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = await runOwnerBootstrap(input);
    return NextResponse.json({ ok: true, ownerId: result.ownerId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bootstrap failed" },
      { status: error instanceof Error && error.message === "Bootstrap is locked" ? 409 : 400 }
    );
  }
}
