import sitemap from "@/src/app/sitemap";

import { PRODUCTION_SITE_ORIGIN } from "@/src/lib/metadata/site";

async function main() {
  const entries = await sitemap();
  const base = PRODUCTION_SITE_ORIGIN;

  const editions = entries.filter(
    (entry) =>
      entry.url.startsWith(`${base}/events/`) &&
      !entry.url.startsWith(`${base}/events/series/`),
  );
  const series = entries.filter((entry) =>
    entry.url.startsWith(`${base}/events/series/`),
  );
  const sponsors = entries.filter((entry) =>
    entry.url.startsWith(`${base}/sponsors/`),
  );
  const topics = entries.filter((entry) =>
    entry.url.startsWith(`${base}/topics/`),
  );
  const research = entries.filter((entry) =>
    entry.url.includes("/research"),
  );
  const staticEntries = entries.filter((entry) =>
    [`${base}/`, `${base}/events`, `${base}/sponsors`].includes(entry.url),
  );

  console.log("entry_count", entries.length);
  console.log("counts", {
    static: staticEntries.length,
    editions: editions.length,
    series: series.length,
    sponsors: sponsors.length,
    topics: topics.length,
    research: research.length,
  });
  console.log(
    "with_lastmod",
    entries.filter((entry) => entry.lastModified != null).length,
  );
  console.log("sample_topics", topics.slice(0, 3).map((entry) => entry.url));
  console.log("sample_sponsors", sponsors.slice(0, 3).map((entry) => entry.url));
  console.log("sample_editions", editions.slice(0, 3).map((entry) => entry.url));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
