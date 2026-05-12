import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePrimaryColor } from "@/domain/theme";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const settingsSchema = z.object({
  brandName: z.string().min(1).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lowFilamentThresholdGrams: z.number().int().nonnegative().optional()
});

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = settingsSchema.parse(await request.json());
  const updates = [
    upsertSetting("company.primaryColor", normalizePrimaryColor(body.primaryColor))
  ];

  if (body.brandName) {
    updates.push(upsertSetting("company.brandName", body.brandName));
  }
  if (typeof body.lowFilamentThresholdGrams === "number") {
    updates.push(upsertSetting("filament.lowThresholdGrams", body.lowFilamentThresholdGrams));
  }

  await Promise.all(updates);
  return NextResponse.json({ ok: true, primaryColor: normalizePrimaryColor(body.primaryColor) });
}

function upsertSetting(key: string, value: string | number) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}
