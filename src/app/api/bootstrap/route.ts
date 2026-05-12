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
    brandName: z.string().min(1),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    lowFilamentThresholdGrams: z.number().int().nonnegative().optional()
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
    startingGrams: z.number().int().positive().optional(),
    remainingGrams: z.number().int().nonnegative(),
    rollCostCents: z.number().int().nonnegative().optional(),
    assignedPrinterHistory: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          gramsUsed: z.number().nonnegative(),
          materialCostCents: z.number().int().nonnegative().optional(),
          completedAt: z.string().optional()
        })
      )
      .optional(),
    ignoredPrinterHistory: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          gramsUsed: z.number().nonnegative(),
          completedAt: z.string().optional()
        })
      )
      .optional()
  }),
  security: z.object({
    mediaTokenSecretSet: z.boolean(),
    backupPassphraseSet: z.boolean()
  }).optional()
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
