/** Event Pixels — locked product identity (always this casing). */
export const BRAND_NAME = "Event Pixels";

/** Full logo (mark + wordmark) — served from /public/brand */
export const BRAND_LOGO_WORDMARK_SRC = "/brand/logo-wordmark.svg";

/** Icon-only mark (favicon) — Next.js file convention at src/app/icon.svg */
export const BRAND_LOGO_MARK_SRC = "/icon";

export const brandColors = {
  primary: "#1434CB",
  primaryHover: "#102da3",
  primaryMuted: "#E8EDFB",
  warning: "#FCAD16",
  success: "#29A661",
  accent: "#8533F3",
} as const;
