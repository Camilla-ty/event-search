import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";

/** One edition where the same-brand Company appeared as a sponsor (Series hub prototype). */
export type SeriesParticipatedEvent = {
  edition: PublicEditionSummary;
  /** Recorded sponsor role/tier for display (label preferred, else Tier N). */
  roleLabel: string | null;
  tierRank: number | null;
  tierLabel: string | null;
};
