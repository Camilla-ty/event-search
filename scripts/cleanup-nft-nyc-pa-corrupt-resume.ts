import { createAdminClient } from "@/src/lib/supabase/admin";

const CATALOG_IDS = [
  "911c2d26-6942-483b-9dc1-c47cf13f91fa",
  "f024e025-a14d-4acf-8773-92d955fd534a",
  "560b1ee0-2435-4184-83cc-283d078d504e",
  "c2b62910-1a59-42b0-a8ff-249247ad0ffd",
];

async function fetchBogusIds(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, created_at")
    .gte("created_at", "2026-07-05")
    .lt("created_at", "2026-07-06");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => /^[0-9]+$/.test(String(row.name)))
    .map((row) => String(row.id));
}

async function countBogusBlockers(
  supabase: ReturnType<typeof createAdminClient>,
  bogusIds: string[],
): Promise<number> {
  const chunkSize = 100;
  let total = 0;
  for (let offset = 0; offset < bogusIds.length; offset += chunkSize) {
    const chunk = bogusIds.slice(offset, offset + chunkSize);
    const checks = await Promise.all([
      supabase.from("event_sponsors").select("id", { count: "exact", head: true }).in("company_id", chunk),
      supabase
        .from("event_edition_organizers")
        .select("id", { count: "exact", head: true })
        .in("company_id", chunk),
      supabase
        .from("event_partner_alumni_version_companies")
        .select("id", { count: "exact", head: true })
        .in("company_id", chunk),
      supabase.from("company_domains").select("id", { count: "exact", head: true }).in("company_id", chunk),
      supabase
        .from("sponsor_import_draft_links")
        .select("id", { count: "exact", head: true })
        .in("company_id", chunk),
    ]);
    for (const result of checks) {
      if (result.error) throw new Error(result.error.message);
      total += result.count ?? 0;
    }
  }
  return total;
}

async function main() {
  const supabase = createAdminClient();
  const bogusIds = await fetchBogusIds(supabase);
  console.log(JSON.stringify({ step: "resume before steps 4-5", bogus_ids: bogusIds.length }));

  const blockers = await countBogusBlockers(supabase, bogusIds);
  console.log(JSON.stringify({ step: "step 4 blocker guard", blockers }));
  if (blockers > 0) throw new Error(`Blocked: ${blockers} references remain`);

  let deletedTotal = 0;
  const chunkSize = 100;
  for (let offset = 0; offset < bogusIds.length; offset += chunkSize) {
    const chunk = bogusIds.slice(offset, offset + chunkSize);
    const { error, count } = await supabase.from("companies").delete({ count: "exact" }).in("id", chunk);
    if (error) throw new Error(`Step 5 failed: ${error.message}`);
    deletedTotal += count ?? 0;
  }
  console.log(JSON.stringify({ step: "step 5 deleted bogus companies", deleted: deletedTotal }));

  const remaining = await fetchBogusIds(supabase);
  console.log(JSON.stringify({ step: "after step 5 bogus remaining", count: remaining.length }));

  const { data: catalogCheck, error: catalogCheckError } = await supabase
    .from("companies")
    .select("id, name, domain, created_at")
    .in("id", CATALOG_IDS)
    .order("name");
  if (catalogCheckError) throw new Error(catalogCheckError.message);
  console.log(JSON.stringify({ step: "catalog sanity", companies: catalogCheck }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
