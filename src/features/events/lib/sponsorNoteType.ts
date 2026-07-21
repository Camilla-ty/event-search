export const SPONSOR_NOTE_TYPES = ["upcoming_pending", "virtual_covid"] as const;

export type SponsorNoteType = (typeof SPONSOR_NOTE_TYPES)[number];

const SPONSOR_NOTE_TYPE_SET = new Set<string>(SPONSOR_NOTE_TYPES);

export const SPONSOR_NOTE_TYPE_OPTIONS: ReadonlyArray<{
  value: SponsorNoteType | "";
  label: string;
}> = [
  { value: "", label: "None" },
  { value: "upcoming_pending", label: "Upcoming / Pending" },
  { value: "virtual_covid", label: "Virtual / COVID Edition" },
];

const SPONSOR_NOTE_DISPLAY_MESSAGES: Record<SponsorNoteType, string> = {
  upcoming_pending:
    "Sponsor list is expected to be finalized after the event concludes.",
  virtual_covid:
    "COVID-19 virtual event. The official website does not provide a sponsor list.",
};

export function isSponsorNoteType(value: string): value is SponsorNoteType {
  return SPONSOR_NOTE_TYPE_SET.has(value);
}

export function parseSponsorNoteType(raw: unknown): SponsorNoteType | null {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return null;
  return isSponsorNoteType(value) ? value : null;
}

export function sponsorNoteDisplayMessage(type: SponsorNoteType): string {
  return SPONSOR_NOTE_DISPLAY_MESSAGES[type];
}
