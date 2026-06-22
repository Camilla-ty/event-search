export function readConflictString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "—";
}

export function readConflictLink(
  row: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = row[key];
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function formatTier(link: Record<string, unknown> | null): string {
  if (!link) return "—";
  const rank = link.tier_rank;
  const label = link.tier_label;
  const rankText = typeof rank === "number" ? String(rank) : "—";
  const labelText = typeof label === "string" && label.trim() !== "" ? label : null;
  return labelText ? `${rankText} · ${labelText}` : rankText;
}

export function readFieldDiffDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? "—" : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const item of value) {
      if (typeof item === "string" && item.trim() !== "") {
        items.push(item.trim());
      }
    }
    return items.length > 0 ? items.join(", ") : "—";
  }
  return "—";
}

export function readFieldDiffPair(
  fieldDiffs: Record<string, unknown>,
  key: string,
): { canonical: unknown; duplicate: unknown } | null {
  const entry = fieldDiffs[key];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  return {
    canonical: record.canonical,
    duplicate: record.duplicate,
  };
}

export function fieldValuesDiffer(canonical: unknown, duplicate: unknown): boolean {
  const left = readFieldDiffDisplayValue(canonical);
  const right = readFieldDiffDisplayValue(duplicate);
  return left !== right;
}
