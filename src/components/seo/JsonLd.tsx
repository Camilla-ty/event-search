/**
 * Server-rendered JSON-LD script tag.
 * Serializes with JSON.stringify and escapes `<` so values cannot break out of
 * the script element (e.g. `</script>` inside a string).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

type JsonLdProps = {
  data: unknown;
};

/** Renders a single `application/ld+json` script. Pass builder output only. */
export function JsonLd({ data }: JsonLdProps) {
  if (data === null || data === undefined) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      // Escaped via serializeJsonLd — not raw user HTML.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
