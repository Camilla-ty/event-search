const LOGO_DEV_IMAGE_HOST = "https://img.logo.dev";

export type LogoDevImageOptions = {
  size?: number;
  format?: "jpg" | "png" | "webp";
};

export function getLogoDevPublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function buildLogoDevImageUrl(
  domain: string,
  options: LogoDevImageOptions = {},
): string | null {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) return null;

  const token = getLogoDevPublishableKey();
  if (!token) return null;

  const size = options.size ?? 128;
  const format = options.format ?? "webp";

  const params = new URLSearchParams({
    token,
    fallback: "404",
    size: String(size),
    format,
  });

  return `${LOGO_DEV_IMAGE_HOST}/${encodeURIComponent(normalizedDomain)}?${params.toString()}`;
}
