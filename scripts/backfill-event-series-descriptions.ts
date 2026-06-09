/**
 * Backfill: derive `event_series.description` via AI rewriting of factual metadata.
 *
 * STRICT POLICY:
 * - DO NOT scrape page body content.
 * - Only fetch HTML <title>, <meta name="description">, <meta property="og:description">.
 * - Use OpenAI to rewrite into 2-3 neutral, professional sentences.
 * - Never copy text verbatim. The system prompt enforces this.
 *
 * Idempotent: skips rows where `description` is already set.
 *
 * Run:
 *   npm run backfill:event-series-descriptions
 *
 * Required env (loaded via Node `--env-file=.env.local`):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *
 * Optional env knobs:
 *   OPENAI_MODEL          default: gpt-4o-mini
 *   BACKFILL_DRY_RUN      "1"/"true" to log without updating DB
 *   BACKFILL_LIMIT        max number of rows to process (test runs)
 *   BACKFILL_DELAY_MS     delay between OpenAI calls, default 500ms
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[backfill] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
  );
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("[backfill] Missing OPENAI_API_KEY env var.");
  process.exit(1);
}

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DRY_RUN =
  process.env.BACKFILL_DRY_RUN === "1" ||
  process.env.BACKFILL_DRY_RUN === "true";
const LIMIT = process.env.BACKFILL_LIMIT
  ? Math.max(0, Number(process.env.BACKFILL_LIMIT))
  : null;
const DELAY_MS = process.env.BACKFILL_DELAY_MS
  ? Math.max(0, Number(process.env.BACKFILL_DELAY_MS))
  : 500;

const HTML_FETCH_TIMEOUT_MS = 6000;
const OPENAI_TIMEOUT_MS = 30000;
const BATCH_SIZE = 50;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type EventSeriesRow = {
  id: string;
  name: string | null;
  website_url: string | null;
  description: string | null;
};

type ExtractedMetadata = {
  title: string | null;
  metaDescription: string | null;
  ogDescription: string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = HTML_FETCH_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      redirect: "follow",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const text = decodeHtmlEntities(match[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

function extractMetaContent(
  html: string,
  attrName: "name" | "property",
  target: string,
): string | null {
  const targetEsc = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta[^>]+${attrName}=["']${targetEsc}["'][^>]*content=["']([^"']+)["'][^>]*>` +
      `|<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${targetEsc}["'][^>]*>`,
    "i",
  );
  const match = html.match(re);
  if (!match) return null;
  const raw = match[1] ?? match[2] ?? "";
  const text = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

async function fetchHomepageMetadata(
  websiteUrl: string,
): Promise<ExtractedMetadata> {
  const empty: ExtractedMetadata = {
    title: null,
    metaDescription: null,
    ogDescription: null,
  };

  const trimmed = websiteUrl.trim();
  if (!trimmed) return empty;

  const url =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "EventPixelsMetadataBot/1.0 (+server-side metadata fetch; not a content scraper)",
    },
  });
  if (!response || !response.ok) return empty;

  const html = await response.text();
  return {
    title: extractTitleFromHtml(html),
    metaDescription: extractMetaContent(html, "name", "description"),
    ogDescription: extractMetaContent(html, "property", "og:description"),
  };
}

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function generateDescription(input: {
  name: string;
  websiteUrl: string;
  metadata: ExtractedMetadata;
}): Promise<string | null> {
  const { name, websiteUrl, metadata } = input;

  const factualLines = [
    `Name: ${name}`,
    `Website: ${websiteUrl}`,
    metadata.title ? `Page title: ${metadata.title}` : null,
    metadata.metaDescription
      ? `Meta description: ${metadata.metaDescription}`
      : null,
    metadata.ogDescription ? `OG description: ${metadata.ogDescription}` : null,
  ].filter(Boolean);

  const factualBlock = factualLines.join("\n");

  const systemPrompt = [
    "You write short, professional descriptions for industry events.",
    "Strict rules:",
    "1) Use ONLY the provided factual information.",
    "2) Do NOT copy any sentence verbatim from the source. Paraphrase in your own words.",
    "3) Be neutral, informative, and industry-focused.",
    "4) Output 2 to 3 sentences only.",
    "5) No marketing fluff, no hashtags, no emoji, no first-person.",
  ].join(" ");

  const userPrompt = [
    "Write a short professional description (2-3 sentences) for this event series.",
    "Use only the factual information below. Do not copy any text directly.",
    "",
    factualBlock,
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.5,
          max_tokens: 220,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(
        `[openai] non-OK ${response.status}: ${errText.slice(0, 200)}`,
      );
      return null;
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content?.trim() ?? null;
    return content && content.length > 0 ? content : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn(`[openai] request failed: ${message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllSeries(): Promise<EventSeriesRow[]> {
  const all: EventSeriesRow[] = [];
  let from = 0;
  while (true) {
    const to = from + BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from("event_series")
      .select("id, name, website_url, description")
      .order("name", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch event_series: ${error.message}`);
    }
    const rows = (data ?? []) as EventSeriesRow[];
    all.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }
  return all;
}

async function main() {
  console.log("[backfill] starting event_series description backfill");
  console.log("[backfill] config:", {
    model: OPENAI_MODEL,
    dryRun: DRY_RUN,
    limit: LIMIT,
    delayMs: DELAY_MS,
  });

  let rows: EventSeriesRow[];
  try {
    rows = await fetchAllSeries();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[backfill] fatal: cannot read event_series:", message);
    process.exit(1);
  }

  console.log(`[backfill] loaded ${rows.length} event_series rows`);

  let processed = 0;
  let updated = 0;
  let skippedExisting = 0;
  let skippedNoName = 0;
  let skippedNoSignal = 0;
  let failed = 0;

  for (const row of rows) {
    if (LIMIT !== null && processed >= LIMIT) {
      console.log(`[backfill] limit ${LIMIT} reached, stopping`);
      break;
    }
    processed += 1;
    const label = row.name ?? row.id;

    if (typeof row.description === "string" && row.description.trim() !== "") {
      skippedExisting += 1;
      console.log(`[skip] (${processed}) ${label} — already has description`);
      continue;
    }

    const name = row.name?.trim();
    if (!name) {
      skippedNoName += 1;
      console.warn(
        `[skip] (${processed}) ${row.id} — missing name, cannot generate description`,
      );
      continue;
    }

    const websiteUrl = row.website_url?.trim() ?? "";
    let metadata: ExtractedMetadata = {
      title: null,
      metaDescription: null,
      ogDescription: null,
    };
    if (websiteUrl) {
      try {
        metadata = await fetchHomepageMetadata(websiteUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        console.warn(
          `[meta] (${processed}) ${label} — fetch failed: ${message}`,
        );
      }
    }

    const hasAnySignal = Boolean(
      websiteUrl ||
        metadata.title ||
        metadata.metaDescription ||
        metadata.ogDescription,
    );
    if (!hasAnySignal) {
      skippedNoSignal += 1;
      console.warn(
        `[skip] (${processed}) ${label} — no website_url and no metadata, refusing to fabricate`,
      );
      continue;
    }

    let description: string | null = null;
    try {
      description = await generateDescription({
        name,
        websiteUrl: websiteUrl || "(not provided)",
        metadata,
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "unknown";
      console.error(
        `[fail] (${processed}) ${label} — openai threw: ${message}`,
      );
      continue;
    }

    if (!description) {
      failed += 1;
      console.error(
        `[fail] (${processed}) ${label} — empty description from OpenAI`,
      );
      continue;
    }

    if (DRY_RUN) {
      updated += 1;
      console.log(`[dry-run] (${processed}) ${label} -> ${description}`);
    } else {
      const { error: updateError } = await supabase
        .from("event_series")
        .update({ description })
        .eq("id", row.id);

      if (updateError) {
        failed += 1;
        console.error(
          `[fail] (${processed}) ${label} — update error: ${updateError.message}`,
        );
        continue;
      }
      updated += 1;
      const trimmedPreview =
        description.length > 120
          ? `${description.slice(0, 120)}...`
          : description;
      console.log(`[ok]  (${processed}) ${label} -> ${trimmedPreview}`);
    }

    if (DELAY_MS > 0) {
      await delay(DELAY_MS);
    }
  }

  console.log("[backfill] summary:", {
    processed,
    updated,
    skippedExisting,
    skippedNoName,
    skippedNoSignal,
    skippedTotal: skippedExisting + skippedNoName + skippedNoSignal,
    failed,
    dryRun: DRY_RUN,
  });

  if (failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[backfill] fatal:", message);
  process.exit(1);
});
