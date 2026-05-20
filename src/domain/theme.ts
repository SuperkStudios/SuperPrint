export const DEFAULT_PRIMARY_COLOR = "#00e5ff";

export function normalizePrimaryColor(value?: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : DEFAULT_PRIMARY_COLOR;
}

export function hexToHslCss(value: string) {
  const color = normalizePrimaryColor(value);
  const red = parseInt(color.slice(1, 3), 16) / 255;
  const green = parseInt(color.slice(3, 5), 16) / 255;
  const blue = parseInt(color.slice(5, 7), 16) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(lightness * 100)}%`;
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return `${Math.round(hue * 60)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function buildThemeCssVariables(primaryColor?: unknown) {
  const normalized = normalizePrimaryColor(primaryColor);
  const primary = hexToHslCss(normalized);
  const foreground = readableForegroundForHex(normalized);

  return {
    "--primary": primary,
    "--ring": primary,
    "--primary-foreground": foreground
  };
}

function readableForegroundForHex(value: string) {
  const color = normalizePrimaryColor(value);
  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 150 ? "222 30% 12%" : "0 0% 100%";
}
