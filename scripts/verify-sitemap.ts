import sitemap from "@/src/app/sitemap";

async function main() {
  const entries = await sitemap();
  console.log("entry_count", entries.length);
  console.log(
    "static",
    entries.filter((entry) =>
      ["https://app.eventpx.com/", "https://app.eventpx.com/events", "https://app.eventpx.com/sponsors"].includes(
        entry.url,
      ),
    ),
  );
  console.log(
    "counts",
    {
      editions: entries.filter(
        (entry) =>
          entry.url.startsWith("https://app.eventpx.com/events/") &&
          !entry.url.startsWith("https://app.eventpx.com/events/series/"),
      ).length,
      series: entries.filter((entry) =>
        entry.url.startsWith("https://app.eventpx.com/events/series/"),
      ).length,
      sponsors: entries.filter((entry) =>
        entry.url.startsWith("https://app.eventpx.com/sponsors/"),
      ).length,
    },
  );
  console.log("sample", entries.slice(0, 3));
  console.log(
    "with_lastmod",
    entries.filter((entry) => entry.lastModified != null).length,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
