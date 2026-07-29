const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Compact month-year label for Active Filter chips (`Jan 2027`). */
export function formatActiveFilterMonthYear(
  value: string | null | undefined,
): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed === "") return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Active Filters Date group label body (without the `Date:` prefix). */
export function formatActiveFilterDateChipBody(
  startDate: string,
  endDate: string,
): string | null {
  const start = formatActiveFilterMonthYear(startDate);
  const end = formatActiveFilterMonthYear(endDate);

  if (start !== null && end !== null) {
    return `${start} – ${end}`;
  }
  if (start !== null) {
    return `From ${start}`;
  }
  if (end !== null) {
    return `Until ${end}`;
  }
  return null;
}
