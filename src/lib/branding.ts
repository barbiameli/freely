/**
 * Per-quote branding choice, picked in the Quote wizard and applied
 * consistently to both the public HTML page (/q/[slug]) and the PDF
 * export, since they'd otherwise drift out of sync (one route resolving
 * brand colors one way, the other route another way).
 *
 * "freely" and "own" reuse the existing brand-color/logo styling on top of
 * whichever page template (classic/editorial/minimal) is chosen. The two
 * "mono" presets are deliberately generic, no color, no logo, so they
 * render through a dedicated flat black-and-white template instead
 * (see MonoTemplate in templates.tsx and MonoDocument in pdf.tsx).
 */
export type Branding = "freely" | "own" | "mono-light" | "mono-dark";

export const BRANDING_OPTIONS: { id: Branding; name: string; desc: string }[] = [
  { id: "freely", name: "Freely", desc: "Freely's own coral and violet, no logo." },
  { id: "own", name: "Your brand", desc: "Your saved colors and logo from Memory." },
  { id: "mono-light", name: "Minimal light", desc: "Black and white, light background." },
  { id: "mono-dark", name: "Minimal dark", desc: "Black and white, dark background." },
];

const FREELY_CORAL = "#F45B69";
const FREELY_VIOLET = "#6320EE";
export const MONO_LIGHT_INK = "#111111";
export const MONO_DARK_BG = "#0B0B0C";
export const MONO_DARK_INK = "#FFFFFF";

export interface ResolvedBrand {
  primary: string;
  accent: string;
  logoDataUrl: string | null;
  /** True for either mono preset, callers should render the dedicated
   * flat black-and-white template instead of Classic/Editorial/Minimal. */
  mono: boolean;
  /** Only meaningful when mono is true: light vs. dark background. */
  dark: boolean;
}

/** Whether this user has anything to show for "Your brand" — used to grey
 * that option out in the wizard until they've set at least a color or a
 * logo in Memory. */
export function hasOwnBranding(user: {
  brandPrimaryColor?: string | null;
  brandLogoDataUrl?: string | null;
}): boolean {
  return Boolean(user.brandPrimaryColor || user.brandLogoDataUrl);
}

/**
 * The saved brand on an account, as much of it as this needs.
 *
 * Named rather than written inline, so callers passing it around have
 * something to import. The preview and the public page both need to hand it
 * over and neither should be restating the shape.
 */
export interface BrandSource {
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
  brandLogoDataUrl?: string | null;
}

export function resolveBrand(
  branding: string | null | undefined,
  user: BrandSource
): ResolvedBrand {
  if (branding === "own") {
    return {
      primary: user.brandPrimaryColor || FREELY_CORAL,
      accent: user.brandAccentColor || FREELY_VIOLET,
      logoDataUrl: user.brandLogoDataUrl ?? null,
      mono: false,
      dark: false,
    };
  }
  if (branding === "mono-light") {
    return { primary: MONO_LIGHT_INK, accent: MONO_LIGHT_INK, logoDataUrl: null, mono: true, dark: false };
  }
  if (branding === "mono-dark") {
    return { primary: MONO_DARK_INK, accent: MONO_DARK_INK, logoDataUrl: null, mono: true, dark: true };
  }
  // "freely" (default/fallback) — Freely's own look, regardless of whatever
  // brand colors this user has saved elsewhere.
  return { primary: FREELY_CORAL, accent: FREELY_VIOLET, logoDataUrl: null, mono: false, dark: false };
}
