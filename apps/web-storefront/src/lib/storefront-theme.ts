import type { CSSProperties } from "react";
import type { PublicStorefrontStore } from "./storefront-context";

const FONT_MAP: Record<string, { display: string; body: string }> = {
  editorial: { display: "var(--font-cormorant)", body: "var(--font-manrope)" },
  modern:    { display: "var(--font-space-grotesk)", body: "var(--font-inter)" },
  organic:   { display: "var(--font-playfair)", body: "var(--font-lato)" },
  minimal:   { display: "var(--font-dm-sans)", body: "var(--font-dm-sans)" },
};

const RADIUS_MAP: Record<string, string> = {
  rounded: "16px",
  soft:    "26px",
  sharp:   "4px",
};

export function buildStorefrontThemeStyle(
  store?: Pick<PublicStorefrontStore, "theme"> | null
): CSSProperties {
  const theme = store?.theme;
  const fonts = FONT_MAP[theme?.fontPairing ?? "editorial"] ?? FONT_MAP.editorial;

  return {
    "--accent":       theme?.primaryColor ?? "#c45c2c",
    "--accent-strong": theme?.accentColor ?? "#8f3610",
    "--bg":           theme?.surfaceColor ?? "#f5f1e8",
    "--panel":        hexToRgba(theme?.surfaceColor ?? "#f5f1e8", 0.72),
    "--dark":         theme?.darkColor ?? "#241f1b",
    "--radius-base":  RADIUS_MAP[theme?.shapeStyle ?? "rounded"] ?? RADIUS_MAP.rounded,
    "--font-display": fonts.display,
    "--font-body":    fonts.body,
  } as CSSProperties;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
