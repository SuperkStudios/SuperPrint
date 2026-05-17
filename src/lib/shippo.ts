import { resolveShippoSettings, shippoSettingKeys } from "@/domain/shippo-settings";
import { prisma } from "@/lib/prisma";

const shippoApiBaseUrl = "https://api.goshippo.com";

export async function getShippoSettings() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: shippoSettingKeys() } }
  });
  return resolveShippoSettings({
    settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  });
}

export async function shippoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const settings = await getShippoSettings();
  if (!settings.apiToken) throw new Error("Shippo API token is not configured.");
  const response = await fetch(`${shippoApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${settings.apiToken}`,
      "Content-Type": "application/json",
      "SHIPPO-API-VERSION": "2018-02-08",
      ...init.headers
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body);
    throw new Error(`Shippo request failed (${response.status}): ${detail}`);
  }
  return body as T;
}
