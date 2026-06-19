export type CalendarToolbarCounts = {
  primaryLine: string;
  secondaryLine: string | null;
};

export function buildCalendarToolbarCounts(
  monthCount: number,
  monthLabel: string,
  totalMatchingCount: number,
): CalendarToolbarCounts {
  const primaryLine = `${monthCount.toLocaleString()} events in ${monthLabel}`;
  const secondaryLine =
    monthCount !== totalMatchingCount
      ? `${totalMatchingCount.toLocaleString()} matching events total`
      : null;

  return { primaryLine, secondaryLine };
}
