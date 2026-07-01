/** Map Postgres/Supabase edition write errors to admin-friendly messages. */
export function formatEditionWriteError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("slug") &&
    (lower.includes("unique") || lower.includes("duplicate key"))
  ) {
    return (
      "Slug already in use. Choose a distinct slug — include city or location in the " +
      "edition name when multiple editions share the same series and year."
    );
  }
  if (
    lower.includes("city_id must match") ||
    lower.includes("city_id is required when venue_id") ||
    lower.includes("venue_id references a missing venue")
  ) {
    return "The selected venue does not match this edition city. Clear the venue or choose one in the same city.";
  }
  if (lower.includes("cannot attach an archived venue")) {
    return "Archived venues cannot be attached to editions. Unarchive the venue or choose another.";
  }
  return message;
}
