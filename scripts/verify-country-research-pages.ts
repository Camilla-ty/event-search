/**
 * Country-level Research Page verification.
 *
 * Creates exactly one DRAFT research page (Crypto & Blockchain + Singapore + 2026)
 * through the same server function the Admin API route calls, then verifies the
 * generated URL, the event set behind it, duplicate prevention, and that nothing
 * is published. Re-running reuses the existing draft instead of creating a second.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-country-research-pages.ts
 */
import { createClient } from "@supabase/supabase-js";

import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import {
  createResearchPageDraft,
  listResearchPagesAdmin,
} from "@/src/features/research-pages/server/researchPageAdmin";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";

const TOPIC_SLUG = "crypto-blockchain";
const COUNTRY_SLUG = "singapore";
const YEAR = 2026;

function readEnv(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") throw new Error(`Missing ${name}`);
  return value;
}

function report(label: string, ok: boolean, detail: unknown): boolean {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${JSON.stringify(detail)}`);
  return ok;
}

async function main(): Promise<void> {
  const results: boolean[] = [];

  const admin = createClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const anon = createClient(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: topic } = await admin
    .from("keyword")
    .select("id, name, slug")
    .eq("slug", TOPIC_SLUG)
    .single();
  const { data: country } = await admin
    .from("countries")
    .select("id, name, slug")
    .eq("slug", COUNTRY_SLUG)
    .single();
  if (!topic || !country) throw new Error("Missing topic or country row");

  // 1. Created through the Admin server path (same call the POST route makes).
  const existing = (await listResearchPagesAdmin()).find(
    (page) =>
      page.topicSlug === TOPIC_SLUG &&
      page.locationType === "country" &&
      page.locationSlug === COUNTRY_SLUG &&
      page.year === YEAR,
  );
  if (!existing) {
    await createResearchPageDraft({
      topicKeywordId: topic.id as string,
      locationType: "country",
      locationId: country.id as string,
      year: YEAR,
    });
  }

  const pages = await listResearchPagesAdmin();
  const page = pages.find(
    (p) =>
      p.topicSlug === TOPIC_SLUG &&
      p.locationType === "country" &&
      p.locationSlug === COUNTRY_SLUG &&
      p.year === YEAR,
  );
  results.push(
    report("1_created_from_admin_path", page !== undefined, {
      reusedExistingDraft: existing !== undefined,
      page: page
        ? {
            id: page.id,
            topic: page.topicName,
            locationType: page.locationType,
            location: page.locationName,
            year: page.year,
            status: page.status,
          }
        : null,
      totalResearchPages: pages.length,
    }),
  );
  if (!page) throw new Error("Draft page not found after create");

  // 2. Country URL shape.
  const path = formatResearchPagePublicPath(
    page.topicSlug,
    { type: page.locationType, slug: page.locationSlug },
    page.year,
  );
  results.push(
    report(
      "2_country_url",
      path === `/events/topics/${TOPIC_SLUG}/countries/${COUNTRY_SLUG}/years/${YEAR}`,
      path,
    ),
  );

  // 4. Event set behind the page: the loader's series → editions → country filter,
  //    replicated with the anon key to confirm public reachability of each read.
  const { data: links } = await anon
    .from("event_series_keyword")
    .select("series_id")
    .eq("keyword_id", topic.id as string);
  const seriesIds = [
    ...new Set((links ?? []).map((l) => String(l.series_id)).filter((s) => s !== "")),
  ];

  const { data: editions, error: editionsError } = await anon
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .in("series_id", seriesIds)
    .eq("year", YEAR);
  if (editionsError) throw new Error(editionsError.message);

  const readEmbedded = (value: unknown): Record<string, unknown> | null => {
    const row = Array.isArray(value) ? value[0] : value;
    return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
  };
  const countrySlugOf = (edition: Record<string, unknown>): string => {
    const country = readEmbedded(readEmbedded(edition.cities)?.countries);
    return typeof country?.slug === "string" ? country.slug : "";
  };
  const regionSlugOf = (edition: Record<string, unknown>): string => {
    const country = readEmbedded(readEmbedded(edition.cities)?.countries);
    const region = readEmbedded(country?.regions);
    return typeof region?.slug === "string" ? region.slug : "";
  };

  const rows = (editions ?? []) as unknown as Record<string, unknown>[];
  const matched = rows.filter((edition) => countrySlugOf(edition) === COUNTRY_SLUG);
  results.push(
    report("4_singapore_2026_events", matched.length > 0, {
      seriesLinkedToTopic: seriesIds.length,
      editionsInYear: rows.length,
      matchedSingapore: matched.length,
      events: matched.map((e) => ({
        name: e.name,
        region: regionSlugOf(e),
      })),
    }),
  );

  // The same edition rows still resolve by region, so the region filter is intact.
  const asiaRows = rows.filter((edition) => regionSlugOf(edition) === "asia");
  results.push(
    report(
      "5a_region_filter_still_resolves",
      asiaRows.length >= matched.length && matched.length > 0,
      {
        asia2026Editions: asiaRows.length,
        singapore2026Editions: matched.length,
      },
    ),
  );

  // 6. Duplicate Topic × Country × Year is rejected.
  let duplicateError = "";
  try {
    await createResearchPageDraft({
      topicKeywordId: topic.id as string,
      locationType: "country",
      locationId: country.id as string,
      year: YEAR,
    });
  } catch (error) {
    duplicateError = error instanceof Error ? error.message : String(error);
  }
  results.push(
    report(
      "6_duplicate_rejected",
      duplicateError.includes("already exists"),
      duplicateError || "(no error raised — duplicate was created!)",
    ),
  );

  // Exactly-one-location CHECK still holds for malformed writes.
  const bothNull = await admin
    .from("topic_region_research_pages")
    .insert({ topic_keyword_id: topic.id as string, year: 1991, status: "draft" })
    .select("id");
  const bothSet = await admin
    .from("topic_region_research_pages")
    .insert({
      topic_keyword_id: topic.id as string,
      region_id: (
        await admin.from("regions").select("id").limit(1).single()
      ).data?.id,
      country_id: country.id as string,
      year: 1992,
      status: "draft",
    })
    .select("id");
  results.push(
    report(
      "5b_exactly_one_location_enforced",
      bothNull.error !== null && bothSet.error !== null,
      {
        noLocation: bothNull.error?.code ?? "inserted!",
        bothLocations: bothSet.error?.code ?? "inserted!",
      },
    ),
  );

  // 7. Nothing published, and the published view is empty.
  const all = await listResearchPagesAdmin();
  const { data: publishedView, error: viewError } = await anon
    .from("topic_region_research_pages_published")
    .select("id, topic_slug, location_type, location_slug, year");
  if (viewError) throw new Error(viewError.message);
  results.push(
    report(
      "7_nothing_published",
      all.every((p) => p.status === "draft" && p.publishedAt === null) &&
        (publishedView ?? []).length === 0,
      {
        totalPages: all.length,
        statuses: all.map((p) => p.status),
        publishedViewRows: (publishedView ?? []).length,
      },
    ),
  );

  const failed = results.filter((ok) => !ok).length;
  console.log(
    `\n${results.length - failed}/${results.length} checks passed${
      failed > 0 ? ` — ${failed} FAILED` : ""
    }`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
