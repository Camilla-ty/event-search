export const EVENT_LIFECYCLE_STATUSES = [
  "active",
  "discontinued",
  "rebranded",
  "merged",
] as const;

export type EventLifecycleStatus = (typeof EVENT_LIFECYCLE_STATUSES)[number];

export const EVENT_LIFECYCLE_STATUS_OPTIONS: ReadonlyArray<{
  value: "" | EventLifecycleStatus;
  label: string;
}> = [
  { value: "", label: "Not set" },
  { value: "active", label: "Active" },
  { value: "discontinued", label: "Discontinued" },
  { value: "rebranded", label: "Rebranded" },
  { value: "merged", label: "Merged" },
];

export function isEventLifecycleStatus(value: string): value is EventLifecycleStatus {
  return (EVENT_LIFECYCLE_STATUSES as readonly string[]).includes(value);
}

export function parseOptionalLifecycleStatus(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return null;
  return value;
}

export function formatEventLifecycleStatusLabel(
  status: string | null | undefined,
): string | null {
  const value = status?.trim() ?? "";
  if (value === "") return null;

  const option = EVENT_LIFECYCLE_STATUS_OPTIONS.find((entry) => entry.value === value);
  return option?.label ?? null;
}
