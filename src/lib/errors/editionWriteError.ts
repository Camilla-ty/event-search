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
  return message;
}
