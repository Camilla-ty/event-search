import Link from "next/link";

import {
  BRAND_LOGO_MARK_SRC,
  BRAND_LOGO_WORDMARK_SRC,
  BRAND_NAME,
} from "@/src/lib/design/brand";

export function BrandWordmark({
  href = "/",
  subtitle,
  compact = false,
}: {
  href?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const logoSrc = compact ? BRAND_LOGO_MARK_SRC : BRAND_LOGO_WORDMARK_SRC;
  const logoSize = compact
    ? { width: 32, height: 32, className: "h-8 w-8 shrink-0" }
    : { width: 658, height: 220, className: "h-9 w-auto max-w-full" };

  return (
    <Link href={href} className="block min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG from /public */}
      <img
        src={logoSrc}
        alt={BRAND_NAME}
        width={logoSize.width}
        height={logoSize.height}
        className={logoSize.className}
        decoding="async"
      />
      {subtitle ? (
        <span className="mt-1 block text-xs font-medium text-slate-500">{subtitle}</span>
      ) : null}
    </Link>
  );
}
