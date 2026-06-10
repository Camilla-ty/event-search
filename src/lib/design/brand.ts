/** EventPixels — locked product identity (always this casing). */
export const BRAND_NAME = "EventPixels";

/** Full logo (mark + wordmark) — served from /public/brand */
export const BRAND_LOGO_WORDMARK_SRC = "/brand/logo-wordmark.svg";

/** Icon-only mark — served from /public/brand (also used as src/app/icon.svg for favicon) */
export const BRAND_LOGO_MARK_SRC = "/brand/logo-mark.svg";

export const brandColors = {
  primary: "#1434CB",
  primaryHover: "#102da3",
  primaryMuted: "#E8EDFB",
  warning: "#FCAD16",
  success: "#29A661",
  accent: "#8533F3",
} as const;
