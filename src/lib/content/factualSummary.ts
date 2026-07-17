/**
 * EventPixels Factual Summary Engine (IR2).
 * Pure, server-safe text assembly from public structured fields only.
 * @see docs/plans/factual-summary-engine.md
 */

export type EventEditionTense = "past" | "current" | "future" | "tenseless";

export type EventEditionSummaryInput = {
  name: string;
  seriesName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  locationLabel?: string | null;
  venueName?: string | null;
  sponsorCount?: number;
  sponsorshipTierCount?: number;
  lastReviewedAt?: string | null;
  now?: Date;
};

export type SeriesEditionSummaryFact = {
  name: string;
  year?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  locationLabel?: string | null;
};

export type EventSeriesSummaryInput = {
  name: string;
  lifecycleStatus?: string | null;
  editions?: ReadonlyArray<SeriesEditionSummaryFact>;
  topics?: ReadonlyArray<string>;
  now?: Date;
};

export type CompanySummaryInput = {
  name: string;
  website?: string | null;
  domain?: string | null;
  sponsoredEditionCount?: number;
  sponsoredEditionCountUnknown?: boolean;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function trimText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : null;
}

function normalizeNonNegativeInt(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/** YYYY-MM-DD from a date string or ISO timestamp; null if unusable. */
export function parseDateOnlyKey(value: string | null | undefined): string | null {
  const trimmed = trimText(value);
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function utcTodayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function partsFromDateKey(key: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatLongDateFromKey(key: string): string | null {
  const parts = partsFromDateKey(key);
  if (!parts) return null;
  const monthName = MONTH_NAMES[parts.month - 1];
  if (!monthName) return null;
  return `${monthName} ${parts.day}, ${parts.year}`;
}

/**
 * Human-readable range for summaries, e.g. "September 16–17, 2026".
 * Uses an en dash between days/months.
 */
export function formatSummaryDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  const startKey = parseDateOnlyKey(startDate);
  const endKey = parseDateOnlyKey(endDate) ?? startKey;
  if (!startKey) return null;

  const start = partsFromDateKey(startKey);
  const end = endKey ? partsFromDateKey(endKey) : null;
  if (!start) return null;

  if (!end || startKey === endKey) {
    return formatLongDateFromKey(startKey);
  }

  const startMonth = MONTH_NAMES[start.month - 1];
  const endMonth = MONTH_NAMES[end.month - 1];
  if (!startMonth || !endMonth) return null;

  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}–${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${startMonth} ${start.day} – ${endMonth} ${end.day}, ${start.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year} – ${endMonth} ${end.day}, ${end.year}`;
}

export function formatSummaryReviewedDate(
  value: string | null | undefined,
): string | null {
  const key = parseDateOnlyKey(value);
  if (!key) return null;
  return formatLongDateFromKey(key);
}

export function resolveEventEditionTense(input: {
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}): EventEditionTense {
  const now = input.now ?? new Date();
  const today = utcTodayKey(now);
  const startKey = parseDateOnlyKey(input.startDate);
  const endKey = parseDateOnlyKey(input.endDate) ?? startKey;

  if (!startKey && !endKey) return "tenseless";

  const effectiveEnd = endKey ?? startKey;
  const effectiveStart = startKey ?? endKey;
  if (!effectiveStart || !effectiveEnd) return "tenseless";

  if (effectiveEnd < today) return "past";
  if (effectiveStart > today) return "future";
  return "current";
}

function locationClause(locationLabel: string | null | undefined): string {
  const location = trimText(locationLabel);
  return location ? ` in ${location}` : "";
}

function joinTopicNames(topics: ReadonlyArray<string>): string | null {
  const names = topics.map((t) => trimText(t)).filter((t): t is string => t !== null);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const head = names.slice(0, -1).join(", ");
  return `${head}, and ${names[names.length - 1]}`;
}

function yearFromEdition(edition: SeriesEditionSummaryFact): number | null {
  if (typeof edition.year === "number" && Number.isFinite(edition.year)) {
    return Math.trunc(edition.year);
  }
  const startKey = parseDateOnlyKey(edition.startDate);
  if (startKey) return Number(startKey.slice(0, 4));
  const endKey = parseDateOnlyKey(edition.endDate);
  if (endKey) return Number(endKey.slice(0, 4));
  return null;
}

function websiteLabel(input: {
  website?: string | null;
  domain?: string | null;
}): string | null {
  const domain = trimText(input.domain)?.toLowerCase() ?? null;
  if (domain) return domain;

  const website = trimText(input.website);
  if (!website) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const host = new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
    return host !== "" ? host : null;
  } catch {
    return null;
  }
}

/**
 * Distinct sponsorship tiers among sponsor links that have a tier_rank
 * and/or tier_label. Links with neither do not create a tier.
 */
export function countDistinctSponsorshipTiers(
  links: ReadonlyArray<{
    tier_rank?: number | null;
    tier_label?: string | null;
  }>,
): number {
  const keys = new Set<string>();
  for (const link of links) {
    const rank =
      typeof link.tier_rank === "number" && Number.isFinite(link.tier_rank)
        ? Math.trunc(link.tier_rank)
        : null;
    const label = trimText(link.tier_label);
    if (rank === null && label === null) continue;
    keys.add(rank !== null ? `rank:${rank}` : `label:${label}`);
  }
  return keys.size;
}

export function buildEventEditionSummary(
  input: EventEditionSummaryInput,
): string | null {
  const name = trimText(input.name);
  if (!name) return null;

  const seriesName = trimText(input.seriesName);
  const location = trimText(input.locationLabel);
  const venueName = trimText(input.venueName);
  const sponsorCount = normalizeNonNegativeInt(input.sponsorCount);
  const tierCount = normalizeNonNegativeInt(input.sponsorshipTierCount);
  const dateRange = formatSummaryDateRange(input.startDate, input.endDate);
  const reviewed = formatSummaryReviewedDate(input.lastReviewedAt);
  const tense = resolveEventEditionTense({
    startDate: input.startDate,
    endDate: input.endDate,
    now: input.now,
  });

  const fragments: string[] = [];

  if (seriesName) {
    fragments.push(`${name} is an event edition in the ${seriesName} series.`);
  } else {
    fragments.push(`${name} is an event edition on EventPixels.`);
  }

  if (dateRange) {
    const where = locationClause(location);
    if (tense === "past") {
      fragments.push(`It took place on ${dateRange}${where}.`);
    } else if (tense === "current") {
      fragments.push(`It is taking place ${dateRange}${where}.`);
    } else {
      fragments.push(`It will take place on ${dateRange}${where}.`);
    }
  } else if (location) {
    fragments.push(`It is held in ${location}.`);
  }

  if (venueName) {
    if (tense === "past") {
      fragments.push(`The venue was ${venueName}.`);
    } else {
      fragments.push(`The venue is ${venueName}.`);
    }
  }

  if (sponsorCount >= 1) {
    const sponsorNoun = sponsorCount === 1 ? "sponsor" : "sponsors";
    const verb = sponsorCount === 1 ? "is" : "are";
    const tierClause =
      tierCount >= 1
        ? ` across ${tierCount} sponsorship ${tierCount === 1 ? "tier" : "tiers"}`
        : "";
    fragments.push(
      `${sponsorCount} ${sponsorNoun} ${verb} recorded for this edition${tierClause} on EventPixels.`,
    );
  }

  if (reviewed) {
    fragments.push(`Sponsor information was last reviewed on ${reviewed}.`);
  }

  return fragments.join(" ");
}

export function buildEventSeriesSummary(
  input: EventSeriesSummaryInput,
): string | null {
  const name = trimText(input.name);
  if (!name) return null;

  const lifecycle = trimText(input.lifecycleStatus)?.toLowerCase() ?? null;
  if (lifecycle === "merged") return null;

  const now = input.now ?? new Date();
  const today = utcTodayKey(now);
  const editions = input.editions ?? [];
  const topics = input.topics ?? [];

  const fragments: string[] = [];

  if (lifecycle === "discontinued") {
    fragments.push(
      `${name} is an event series marked as discontinued on EventPixels.`,
    );
  } else {
    fragments.push(`${name} is an event series on EventPixels.`);
  }

  if (editions.length >= 1) {
    const years = editions
      .map(yearFromEdition)
      .filter((y): y is number => y !== null)
      .sort((a, b) => a - b);
    const editionNoun = editions.length === 1 ? "edition" : "editions";
    const verb = editions.length === 1 ? "is" : "are";

    let span = "";
    if (years.length === 1) {
      span = `, in ${years[0]}`;
    } else if (years.length >= 2) {
      const minYear = years[0]!;
      const maxYear = years[years.length - 1]!;
      if (minYear === maxYear) {
        span = `, in ${minYear}`;
      } else {
        span = `, from ${minYear} to ${maxYear}`;
      }
    }

    fragments.push(
      `${editions.length} ${editionNoun} ${verb} recorded${span}.`,
    );

    const upcoming = editions
      .filter((edition) => {
        const startKey = parseDateOnlyKey(edition.startDate);
        return startKey !== null && startKey > today;
      })
      .sort((a, b) => {
        const aKey = parseDateOnlyKey(a.startDate) ?? "";
        const bKey = parseDateOnlyKey(b.startDate) ?? "";
        return aKey.localeCompare(bKey);
      });

    const next = upcoming[0] ?? null;
    if (next) {
      const editionName = trimText(next.name);
      const dateRange = formatSummaryDateRange(next.startDate, next.endDate);
      if (editionName && dateRange) {
        fragments.push(
          `The next recorded edition, ${editionName}, will take place on ${dateRange}${locationClause(next.locationLabel)}.`,
        );
      }
    } else {
      const pastOrCurrent = [...editions].sort((a, b) => {
        const aKey =
          parseDateOnlyKey(a.endDate) ??
          parseDateOnlyKey(a.startDate) ??
          (yearFromEdition(a) !== null ? `${yearFromEdition(a)}-12-31` : "");
        const bKey =
          parseDateOnlyKey(b.endDate) ??
          parseDateOnlyKey(b.startDate) ??
          (yearFromEdition(b) !== null ? `${yearFromEdition(b)}-12-31` : "");
        return bKey.localeCompare(aKey);
      });
      const latest = pastOrCurrent[0] ?? null;
      if (latest) {
        const editionName = trimText(latest.name);
        const year = yearFromEdition(latest);
        const latestLocation = trimText(latest.locationLabel);
        if (editionName && year !== null) {
          // Avoid restating ", in {year}" when that is all S3 would add.
          const redundant =
            editions.length === 1 && !latestLocation && years.length <= 1;
          if (!redundant) {
            fragments.push(
              `The most recent recorded edition, ${editionName}, took place in ${year}${locationClause(latest.locationLabel)}.`,
            );
          }
        }
      }
    }
  }

  const topicList = joinTopicNames(topics);
  if (topicList) {
    const topicNoun = topics.filter((t) => trimText(t)).length === 1 ? "topic" : "topics";
    fragments.push(`The series is associated with the ${topicNoun} ${topicList}.`);
  }

  return fragments.join(" ");
}

export function buildCompanySummary(input: CompanySummaryInput): string | null {
  const name = trimText(input.name);
  if (!name) return null;

  const site = websiteLabel(input);
  const countUnknown = input.sponsoredEditionCountUnknown === true;
  const count = normalizeNonNegativeInt(input.sponsoredEditionCount);

  const fragments: string[] = [];

  if (site) {
    fragments.push(
      `${name} is a company profiled on EventPixels; its website is ${site}.`,
    );
  } else {
    fragments.push(`${name} is a company profiled on EventPixels.`);
  }

  if (!countUnknown && count >= 1) {
    const noun = count === 1 ? "event edition" : "event editions";
    fragments.push(
      `It has sponsored ${count} ${noun} recorded on EventPixels.`,
    );
    fragments.push(
      "The full list of sponsored events is available to logged-in users.",
    );
  }

  return fragments.join(" ");
}
