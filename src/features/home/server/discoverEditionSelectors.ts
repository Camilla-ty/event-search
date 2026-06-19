import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";

export const DISCOVER_MODULE_LIMIT = 6;

export type DiscoverEditionCandidate = PublicEditionSummary & {
  created_at: string | null;
};

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function readIsoDate(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed === "") return "";
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : "";
}

export function readEditionCreatedAt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

export function isUpcomingEdition(
  edition: Pick<PublicEditionSummary, "start_date" | "end_date">,
  today: string,
): boolean {
  const startDate = readIsoDate(edition.start_date);
  const endDate = readIsoDate(edition.end_date);

  if (startDate === "" && endDate === "") {
    return false;
  }

  if (startDate !== "" && startDate >= today) {
    return true;
  }

  if (
    startDate !== "" &&
    endDate !== "" &&
    startDate <= today &&
    endDate >= today
  ) {
    return true;
  }

  return false;
}

export function selectUpcomingEditions(
  editions: DiscoverEditionCandidate[],
  options?: { today?: string; limit?: number },
): PublicEditionSummary[] {
  const today = options?.today ?? new Date().toISOString().slice(0, 10);
  const limit = options?.limit ?? DISCOVER_MODULE_LIMIT;

  return editions
    .filter((edition) => isUpcomingEdition(edition, today))
    .sort((a, b) => {
      const startA = readIsoDate(a.start_date);
      const startB = readIsoDate(b.start_date);
      if (startA !== "" && startB !== "") {
        const byStart = compareStringsAsc(startA, startB);
        if (byStart !== 0) return byStart;
      } else if (startA !== "") {
        return -1;
      } else if (startB !== "") {
        return 1;
      }

      return compareStringsAsc(a.name, b.name);
    })
    .slice(0, limit)
    .map(stripCreatedAt);
}

export function selectRecentlyAddedEditions(
  editions: DiscoverEditionCandidate[],
  options?: { limit?: number },
): PublicEditionSummary[] {
  const limit = options?.limit ?? DISCOVER_MODULE_LIMIT;

  return editions
    .slice()
    .sort((a, b) => {
      const createdA = a.created_at;
      const createdB = b.created_at;
      if (createdA && createdB) {
        const byCreated = createdB.localeCompare(createdA);
        if (byCreated !== 0) return byCreated;
      } else if (createdA) {
        return -1;
      } else if (createdB) {
        return 1;
      }

      return compareStringsAsc(a.name, b.name);
    })
    .slice(0, limit)
    .map(stripCreatedAt);
}

function stripCreatedAt(edition: DiscoverEditionCandidate): PublicEditionSummary {
  const { created_at: _createdAt, ...summary } = edition;
  return summary;
}
