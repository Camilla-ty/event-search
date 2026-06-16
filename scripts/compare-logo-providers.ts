/**
 * Local Logo.dev vs Brandfetch visual comparison (read-only).
 *
 * Does NOT write to Supabase or Storage. Does NOT change provider order.
 *
 * Run:
 *   tsx --env-file=.env.local scripts/compare-logo-providers.ts
 *
 * Optional:
 *   COMPARE_DELAY_MS=300
 *   COMPARE_OUTPUT_DIR=tmp/logo-comparison
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildLogoDevFetchUrl, fetchLogoDevImage } from "@/src/lib/companies/logoDevServer";

type ComparisonCategory = "large" | "crypto" | "startup" | "long-tail";

type CuratedDomain = {
  domain: string;
  category: ComparisonCategory;
  label?: string;
};

type FetchOutcome = {
  ok: boolean;
  fileName: string | null;
  embedUrl: string | null;
  displayMode: "local" | "embed" | "missing";
  contentType: string | null;
  byteLength: number | null;
  error: string | null;
  note: string | null;
};

type ComparisonRow = {
  domain: string;
  category: ComparisonCategory;
  label: string;
  slug: string;
  logoDev: FetchOutcome;
  brandfetch: FetchOutcome;
};

const CURATED_DOMAINS: readonly CuratedDomain[] = [
  // Large / mainstream (10)
  { domain: "apple.com", category: "large" },
  { domain: "microsoft.com", category: "large" },
  { domain: "google.com", category: "large" },
  { domain: "salesforce.com", category: "large" },
  { domain: "stripe.com", category: "large" },
  { domain: "amazon.com", category: "large" },
  { domain: "ibm.com", category: "large" },
  { domain: "oracle.com", category: "large" },
  { domain: "adobe.com", category: "large" },
  { domain: "nvidia.com", category: "large" },
  // Crypto / Web3 (10)
  { domain: "coinbase.com", category: "crypto" },
  { domain: "binance.com", category: "crypto" },
  { domain: "ethereum.org", category: "crypto" },
  { domain: "polygon.technology", category: "crypto" },
  { domain: "chainalysis.com", category: "crypto" },
  { domain: "consensys.io", category: "crypto" },
  { domain: "uniswap.org", category: "crypto" },
  { domain: "aave.com", category: "crypto" },
  { domain: "ledger.com", category: "crypto" },
  { domain: "opensea.io", category: "crypto" },
  // Startups / SaaS (10)
  { domain: "openai.com", category: "startup" },
  { domain: "notion.so", category: "startup" },
  { domain: "linear.app", category: "startup" },
  { domain: "vercel.com", category: "startup" },
  { domain: "figma.com", category: "startup" },
  { domain: "airtable.com", category: "startup" },
  { domain: "hubspot.com", category: "startup" },
  { domain: "intercom.com", category: "startup" },
  { domain: "ramp.com", category: "startup" },
  { domain: "brex.com", category: "startup" },
  // Long-tail / harder cases (10)
  { domain: "linktr.ee", category: "long-tail", label: "Linktree (aggregator)" },
  { domain: "substack.com", category: "long-tail" },
  { domain: "ghost.org", category: "long-tail" },
  { domain: "cal.com", category: "long-tail" },
  { domain: "plausible.io", category: "long-tail" },
  { domain: "posthog.com", category: "long-tail" },
  { domain: "supabase.com", category: "long-tail" },
  { domain: "render.com", category: "long-tail" },
  { domain: "fly.io", category: "long-tail" },
  { domain: "deno.com", category: "long-tail" },
];

function extensionFor(contentType: string): string {
  const value = contentType.toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("webp")) return "webp";
  if (value.includes("svg")) return "svg";
  if (value.includes("gif")) return "gif";
  if (value.includes("icon")) return "ico";
  return "bin";
}

function domainSlug(domain: string): string {
  return domain.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

function resolveLogoDevServerKey(): string | null {
  const serverKey = process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim();
  if (serverKey) return serverKey;
  return process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?.trim() || null;
}

function buildBrandfetchEmbedUrl(domain: string): string | null {
  const clientId = process.env.BRANDFETCH_CLIENT_ID?.trim();
  if (!clientId) return null;
  const normalized = domain.trim().toLowerCase();
  const params = new URLSearchParams({
    c: clientId,
    w: "128",
    h: "128",
  });
  return `https://cdn.brandfetch.io/domain/${encodeURIComponent(normalized)}/icon.png?${params.toString()}`;
}

function buildLogoDevEmbedUrl(domain: string): string | null {
  const previousKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  const key = resolveLogoDevServerKey();
  if (!key) return null;
  process.env.LOGO_DEV_PUBLISHABLE_KEY = key;
  const url = buildLogoDevFetchUrl(domain, { size: 128, format: "webp" });
  if (previousKey === undefined) {
    delete process.env.LOGO_DEV_PUBLISHABLE_KEY;
  } else {
    process.env.LOGO_DEV_PUBLISHABLE_KEY = previousKey;
  }
  return url;
}

async function saveProviderImage(params: {
  outputDir: string;
  slug: string;
  provider: "logo-dev" | "brandfetch";
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> {
  const ext = extensionFor(params.contentType);
  const fileName = `${params.provider}.${ext}`;
  const dir = path.join(params.outputDir, params.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), params.bytes);
  return fileName;
}

async function fetchLogoDev(domain: string, outputDir: string, slug: string): Promise<FetchOutcome> {
  const embedUrl = buildLogoDevEmbedUrl(domain);
  const key = resolveLogoDevServerKey();
  if (!key) {
    return {
      ok: false,
      fileName: null,
      embedUrl: null,
      displayMode: "missing",
      contentType: null,
      byteLength: null,
      error: "missing LOGO_DEV_PUBLISHABLE_KEY",
      note: null,
    };
  }

  const previousKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  process.env.LOGO_DEV_PUBLISHABLE_KEY = key;

  const image = await fetchLogoDevImage(domain);
  if (previousKey === undefined) {
    delete process.env.LOGO_DEV_PUBLISHABLE_KEY;
  } else {
    process.env.LOGO_DEV_PUBLISHABLE_KEY = previousKey;
  }

  if (!image) {
    return {
      ok: false,
      fileName: null,
      embedUrl,
      displayMode: embedUrl ? "embed" : "missing",
      contentType: null,
      byteLength: null,
      error: "fetch_failed",
      note: embedUrl ? "Server fetch failed; HTML uses live Logo.dev embed." : null,
    };
  }

  const fileName = await saveProviderImage({
    outputDir,
    slug,
    provider: "logo-dev",
    bytes: image.bytes,
    contentType: image.contentType,
  });

  return {
    ok: true,
    fileName,
    embedUrl,
    displayMode: "local",
    contentType: image.contentType,
    byteLength: image.bytes.byteLength,
    error: null,
    note: "Saved via server fetch (same path as auto-ingest).",
  };
}

async function resolveBrandfetch(domain: string): Promise<FetchOutcome> {
  const embedUrl = buildBrandfetchEmbedUrl(domain);
  if (!embedUrl) {
    return {
      ok: false,
      fileName: null,
      embedUrl: null,
      displayMode: "missing",
      contentType: null,
      byteLength: null,
      error: "missing BRANDFETCH_CLIENT_ID",
      note: null,
    };
  }

  return {
    ok: true,
    fileName: null,
    embedUrl,
    displayMode: "embed",
    contentType: "image/png (embed)",
    byteLength: null,
    error: null,
    note:
      "Brandfetch Logo API is embed-only. Images load in the browser when you open this report via a local web server (not file://).",
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function renderProviderCell(
  provider: "Logo.dev" | "Brandfetch",
  outcome: FetchOutcome,
  slug: string,
): string {
  const relPath =
    outcome.displayMode === "local" && outcome.fileName
      ? `${slug}/${outcome.fileName}`
      : null;

  const metaParts = [
    outcome.contentType ?? "unknown",
    outcome.byteLength !== null ? formatBytes(outcome.byteLength) : null,
    outcome.error,
    outcome.note,
  ].filter((part): part is string => Boolean(part && part.trim()));

  const imageHtml =
    relPath !== null
      ? `<img src="${escapeHtml(relPath)}" alt="${escapeHtml(provider)} logo for ${escapeHtml(slug)}" loading="lazy" referrerpolicy="origin" />`
      : outcome.embedUrl
        ? `<img src="${escapeHtml(outcome.embedUrl)}" alt="${escapeHtml(provider)} logo for ${escapeHtml(slug)}" loading="lazy" referrerpolicy="origin" />`
        : `<div class="missing">No image</div>`;

  return `
    <td class="provider">
      <div class="provider-name">${escapeHtml(provider)}</div>
      <div class="thumb">${imageHtml}</div>
      <div class="meta">${escapeHtml(metaParts.join(" · "))}</div>
    </td>`;
}

function renderRow(row: ComparisonRow): string {
  return `
    <tr data-category="${escapeHtml(row.category)}" data-domain="${escapeHtml(row.domain)}">
      <td class="domain">
        <div class="domain-name">${escapeHtml(row.label)}</div>
        <div class="domain-host">${escapeHtml(row.domain)}</div>
        <div class="category">${escapeHtml(row.category)}</div>
      </td>
      ${renderProviderCell("Logo.dev", row.logoDev, row.slug)}
      ${renderProviderCell("Brandfetch", row.brandfetch, row.slug)}
      <td class="notes">
        <label>Better</label>
        <select class="score-better">
          <option value="">—</option>
          <option value="logo-dev">Logo.dev</option>
          <option value="brandfetch">Brandfetch</option>
          <option value="tie">Tie</option>
          <option value="neither">Neither</option>
        </select>
        <label>Store in EventPixels</label>
        <select class="score-store">
          <option value="">—</option>
          <option value="logo-dev">Logo.dev</option>
          <option value="brandfetch">Brandfetch</option>
          <option value="manual">Manual only</option>
          <option value="monogram">Monogram</option>
        </select>
      </td>
    </tr>`;
}

function renderHtml(rows: ComparisonRow[], generatedAt: string): string {
  const bodyRows = rows.map(renderRow).join("\n");
  const counts = {
    logoDevOk: rows.filter((row) => row.logoDev.ok || row.logoDev.embedUrl).length,
    brandfetchOk: rows.filter((row) => row.brandfetch.embedUrl).length,
    bothOk: rows.filter(
      (row) => (row.logoDev.ok || row.logoDev.embedUrl) && row.brandfetch.embedUrl,
    ).length,
    neitherOk: rows.filter(
      (row) => !row.logoDev.ok && !row.logoDev.embedUrl && !row.brandfetch.embedUrl,
    ).length,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Logo.dev vs Brandfetch — EventPixels comparison</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      line-height: 1.4;
    }
    body { margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    .intro { max-width: 960px; margin-bottom: 20px; color: #475569; }
    .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
    .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .filters button {
      border: 1px solid #cbd5e1; background: #fff; border-radius: 999px;
      padding: 6px 12px; cursor: pointer;
    }
    .filters button.active { background: #0f172a; color: #fff; border-color: #0f172a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    th, td { border-bottom: 1px solid #e2e8f0; vertical-align: top; padding: 14px; }
    th { text-align: left; background: #f1f5f9; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
    tr:last-child td { border-bottom: 0; }
    .domain-name { font-weight: 600; }
    .domain-host, .category, .meta { font-size: 0.85rem; color: #64748b; }
    .provider-name { font-weight: 600; margin-bottom: 8px; }
    .thumb {
      width: 128px; height: 128px; border: 1px dashed #cbd5e1; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden;
    }
    .thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .missing { color: #94a3b8; font-size: 0.85rem; }
    .notes label { display: block; font-size: 0.75rem; color: #64748b; margin-top: 8px; }
    .notes select { width: 100%; margin-top: 4px; }
    .footer { margin-top: 16px; font-size: 0.85rem; color: #64748b; }
  </style>
</head>
<body>
  <h1>Logo.dev vs Brandfetch</h1>
  <p class="intro">
    Local comparison for EventPixels migration review. Generated ${escapeHtml(generatedAt)}.
    Open this page via a local web server (for example <code>npx serve tmp/logo-comparison -p 3456</code>)
    so Brandfetch embed images can load. Logo.dev images are saved locally when server fetch succeeds.
  </p>
  <div class="stats">
    <div class="stat"><strong>${rows.length}</strong> domains</div>
    <div class="stat">Logo.dev OK: <strong>${counts.logoDevOk}</strong></div>
    <div class="stat">Brandfetch OK: <strong>${counts.brandfetchOk}</strong></div>
    <div class="stat">Both OK: <strong>${counts.bothOk}</strong></div>
    <div class="stat">Neither OK: <strong>${counts.neitherOk}</strong></div>
  </div>
  <div class="filters">
    <button type="button" class="active" data-filter="all">All</button>
    <button type="button" data-filter="large">Large</button>
    <button type="button" data-filter="crypto">Crypto</button>
    <button type="button" data-filter="startup">Startup</button>
    <button type="button" data-filter="long-tail">Long-tail</button>
  </div>
  <table>
    <thead>
      <tr>
        <th>Domain</th>
        <th>Logo.dev</th>
        <th>Brandfetch</th>
        <th>Your review</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <p class="footer">Open this file from the generated folder so relative image paths resolve.</p>
  <script>
    const buttons = document.querySelectorAll(".filters button");
    const rows = document.querySelectorAll("tbody tr");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        const filter = button.dataset.filter;
        rows.forEach((row) => {
          const show = filter === "all" || row.dataset.category === filter;
          row.style.display = show ? "" : "none";
        });
      });
    });
  </script>
</body>
</html>`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const outputDir = path.resolve(
    process.cwd(),
    process.env.COMPARE_OUTPUT_DIR?.trim() || "tmp/logo-comparison",
  );
  const delayMs = Number(process.env.COMPARE_DELAY_MS ?? "250");
  const generatedAt = new Date().toISOString();

  await mkdir(outputDir, { recursive: true });

  console.log(`[compare-logos] output: ${outputDir}`);
  console.log(`[compare-logos] domains: ${CURATED_DOMAINS.length}`);

  if (!resolveLogoDevServerKey()) {
    console.warn(
      "[compare-logos] warning: set LOGO_DEV_PUBLISHABLE_KEY or NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY",
    );
  }
  if (!process.env.BRANDFETCH_CLIENT_ID?.trim()) {
    console.warn("[compare-logos] warning: BRANDFETCH_CLIENT_ID is not set");
  }

  const rows: ComparisonRow[] = [];

  for (let index = 0; index < CURATED_DOMAINS.length; index += 1) {
    const entry = CURATED_DOMAINS[index];
    const slug = domainSlug(entry.domain);
    const label = entry.label ?? entry.domain;

    console.log(`[compare-logos] (${index + 1}/${CURATED_DOMAINS.length}) ${entry.domain}`);

    const logoDev = await fetchLogoDev(entry.domain, outputDir, slug);
    const brandfetch = await resolveBrandfetch(entry.domain);

    rows.push({
      domain: entry.domain,
      category: entry.category,
      label,
      slug,
      logoDev,
      brandfetch,
    });

    if (Number.isFinite(delayMs) && delayMs > 0 && index < CURATED_DOMAINS.length - 1) {
      await delay(delayMs);
    }
  }

  const htmlPath = path.join(outputDir, "index.html");
  const jsonPath = path.join(outputDir, "results.json");

  await writeFile(htmlPath, renderHtml(rows, generatedAt), "utf8");
  await writeFile(jsonPath, JSON.stringify({ generatedAt, rows }, null, 2), "utf8");

  const logoDevOk = rows.filter((row) => row.logoDev.ok || row.logoDev.embedUrl).length;
  const brandfetchOk = rows.filter((row) => row.brandfetch.embedUrl).length;

  console.log("[compare-logos] done");
  console.log(`[compare-logos] Logo.dev OK: ${logoDevOk}/${rows.length}`);
  console.log(`[compare-logos] Brandfetch OK: ${brandfetchOk}/${rows.length}`);
  console.log(`[compare-logos] open: ${htmlPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[compare-logos] fatal:", message);
  process.exit(1);
});
