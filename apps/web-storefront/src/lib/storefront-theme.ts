import type { CSSProperties } from "react";
import type { PublicStorefrontStore } from "./storefront-context";

export function buildStorefrontThemeStyle(
  store?: Pick<PublicStorefrontStore, "theme"> | null
): CSSProperties {
  const theme = store?.theme;

  return {
    "--accent": theme?.primaryColor ?? "#c45c2c",
    "--accent-strong": theme?.accentColor ?? "#8f3610",
    "--bg": theme?.surfaceColor ?? "#f5f1e8",
    "--panel": hexToRgba(theme?.surfaceColor ?? "#f5f1e8", 0.72)
  } as CSSProperties;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
