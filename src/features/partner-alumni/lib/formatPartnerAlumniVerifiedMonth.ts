/** Month-precision display for Partner Alumni verified dates (e.g. "July 2026"). */
export function formatPartnerAlumniVerifiedMonth(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
