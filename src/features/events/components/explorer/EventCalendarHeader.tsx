import { secondaryCtaClass } from "@/src/lib/design/classes";
import {
  addMonthsToMonthKey,
  formatCalendarMonthLabel,
  getCurrentMonthKey,
} from "@/src/features/events/lib/eventCalendarGrouping";

type EventCalendarHeaderProps = {
  month: string;
  onMonthChange: (month: string) => void;
};

const navButtonClass = `${secondaryCtaClass} h-9 px-3`;

export function EventCalendarHeader({ month, onMonthChange }: EventCalendarHeaderProps) {
  const previousMonth = addMonthsToMonthKey(month, -1);
  const nextMonth = addMonthsToMonthKey(month, 1);
  const todayMonth = getCurrentMonthKey();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={navButtonClass}
          disabled={previousMonth === null}
          onClick={() => {
            if (previousMonth !== null) onMonthChange(previousMonth);
          }}
        >
          Previous month
        </button>
        <button
          type="button"
          className={navButtonClass}
          disabled={nextMonth === null}
          onClick={() => {
            if (nextMonth !== null) onMonthChange(nextMonth);
          }}
        >
          Next month
        </button>
      </div>

      <h2 className="text-lg font-semibold text-slate-900">{formatCalendarMonthLabel(month)}</h2>

      <button
        type="button"
        className={navButtonClass}
        onClick={() => onMonthChange(todayMonth)}
      >
        Today
      </button>
    </div>
  );
}
