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

type DateOnlyParts = {
  year: number;
  month: number;
  day: number;
  key: string;
};

function hasValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function parseDateOnlyParts(value: string | null | undefined): DateOnlyParts | null {
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

  return {
    year,
    month,
    day,
    key: `${match[1]}-${match[2]}-${match[3]}`,
  };
}

function formatFullDate(parts: DateOnlyParts): string {
  return `${MONTH_NAMES[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

function formatMonthAndDay(parts: DateOnlyParts): string {
  return `${MONTH_NAMES[parts.month - 1]} ${parts.day}`;
}

export function formatPublicEventDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  const startProvided = hasValue(startDate);
  const endProvided = hasValue(endDate);
  const start = parseDateOnlyParts(startDate);
  const end = parseDateOnlyParts(endDate);

  if ((startProvided && !start) || (endProvided && !end)) return null;
  if (!start && !end) return null;

  const first = start ?? end;
  if (!first) return null;
  if (!start || !end || start.key === end.key) return formatFullDate(first);

  if (start.year === end.year) {
    return `${formatMonthAndDay(start)} – ${formatMonthAndDay(end)}, ${start.year}`;
  }

  return `${formatFullDate(start)} – ${formatFullDate(end)}`;
}
