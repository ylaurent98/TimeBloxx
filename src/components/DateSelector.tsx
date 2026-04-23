import type { DateKey } from "../types";
import { addDaysToDateKey, formatDateLabel } from "../utils/date";

interface DateSelectorProps {
  selectedDate: DateKey;
  onChange: (dateKey: DateKey) => void;
}

const navButtonClass =
  "rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-900 transition hover:border-rose-300 hover:bg-rose-50";

export const DateSelector = ({ selectedDate, onChange }: DateSelectorProps) => (
  <div className="rounded-3xl border border-rose-200/80 bg-white/75 p-4 shadow-[0_10px_28px_-20px_rgba(121,86,112,0.55)] backdrop-blur-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-900/60">
          Daily Dashboard
        </p>
        <p className="mt-1 font-display text-xl font-semibold text-rose-950 sm:text-2xl">
          {formatDateLabel(selectedDate)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={navButtonClass}
          onClick={() => onChange(addDaysToDateKey(selectedDate, -1))}
        >
          Previous
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-950 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
        <button
          type="button"
          className={navButtonClass}
          onClick={() => onChange(addDaysToDateKey(selectedDate, 1))}
        >
          Next
        </button>
      </div>
    </div>
  </div>
);
