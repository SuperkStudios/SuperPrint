import type { CSSProperties } from "react";
import { buildThemeCssVariables, DEFAULT_PRIMARY_COLOR, normalizePrimaryColor } from "@/domain/theme";
import { prisma } from "@/lib/prisma";

export async function getPlatformTheme() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "company.primaryColor" } });
  const primaryColor = normalizePrimaryColor(setting?.value);

  return {
    primaryColor,
    cssVariables: buildThemeCssVariables(primaryColor) as CSSProperties
  };
}

export function getDefaultPlatformTheme() {
  return {
    primaryColor: DEFAULT_PRIMARY_COLOR,
    cssVariables: buildThemeCssVariables(DEFAULT_PRIMARY_COLOR) as CSSProperties
  };
}
