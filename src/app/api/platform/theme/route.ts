import { NextResponse } from "next/server";
import { normalizePrimaryColor } from "@/domain/theme";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["company.brandName", "company.primaryColor"] } }
  });
  const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  return NextResponse.json({
    brandName: typeof values["company.brandName"] === "string" ? values["company.brandName"] : "SuperPrint",
    primaryColor: normalizePrimaryColor(values["company.primaryColor"])
  });
}
