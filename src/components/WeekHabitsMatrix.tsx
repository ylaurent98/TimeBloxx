import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DailyData, DateKey, Habit } from "../types";
import { formatShortWeekdayLabel } from "../utils/date";
import { SectionCard } from "./SectionCard";

interface WeekHabitsMatrixProps {
  selectedDate: DateKey;
  weekDates: DateKey[];
  habits: Habit[];
  getDayData: (dateKey: DateKey) => DailyData;
  onSelectDate: (dateKey: DateKey) => void;
  onToggle: (dateKey: DateKey, habitId: string) => void;
  onAddHabit: (name: string, category: string) => void;
}

const categoryLabel = (category: string) =>
  category.trim() ? category.trim() : "General";

export const WeekHabitsMatrix = ({
  selectedDate,
  weekDates,
  habits,
  getDayData,
  onSelectDate,
  onToggle,
  onAddHabit,
}: WeekHabitsMatrixProps) => {
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitCategory, setNewHabitCategory] = useState("");
  const [search, setSearch] = useState("");

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => a.order - b.order),
    [habits],
  );

  const filteredHabits = useMemo(() => {
    if (!search.trim()) {
      return sortedHabits;
    }
    const query = search.trim().toLowerCase();
    return sortedHabits.filter((habit) => {
      const category = categoryLabel(habit.category).toLowerCase();
      return (
        habit.name.toLowerCase().includes(query) || category.includes(query)
      );
    });
  }, [search, sortedHabits]);

  const dayCheckMaps = useMemo(
    () =>
      Object.fromEntries(
        weekDates.map((dateKey) => [dateKey, getDayData(dateKey).habitChecks]),
      ) as Record<DateKey, Record<string, boolean>>,
    [getDayData, weekDates],
  );

  const doneTotals = useMemo(
    () =>
      Object.fromEntries(
        weekDates.map((dateKey) => [
          dateKey,
          filteredHabits.filter((habit) => dayCheckMaps[dateKey]?.[habit.id]).length,
        ]),
      ) as Record<DateKey, number>,
    [dayCheckMaps, filteredHabits, weekDates],
  );

  const handleAddHabit = (event: FormEvent) => {
    event.preventDefault();
    if (!newHabitName.trim()) {
      return;
    }
    onAddHabit(newHabitName, newHabitCategory);
    setNewHabitName("");
    setNewHabitCategory("");
  };

  return (
    <SectionCard
      title="Week Habit Tracker"
      subtitle="Track habits for all 7 days in one grid."
    >
      <form className="mb-3 grid gap-2 sm:grid-cols-3" onSubmit={handleAddHabit}>
        <input
          value={newHabitName}
          onChange={(event) => setNewHabitName(event.target.value)}
          placeholder="New habit"
          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 sm:col-span-2"
        />
        <input
          value={newHabitCategory}
          onChange={(event) => setNewHabitCategory(event.target.value)}
          placeholder="Category"
          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
        <button
          type="submit"
          className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-300 sm:col-span-3 sm:w-fit"
        >
          Add habit
        </button>
      </form>

      <div className="mb-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search habits..."
          className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[840px]">
          <div className="mb-2 grid grid-cols-[2.2fr_repeat(7,minmax(0,1fr))] gap-1">
            <div className="rounded-lg bg-rose-50 px-2 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-900/70">
              Habit
            </div>
            {weekDates.map((dateKey) => (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDate(dateKey)}
                className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${
                  dateKey === selectedDate
                    ? "bg-rose-300/70 text-rose-950"
                    : "bg-rose-50 text-rose-900/85 hover:bg-rose-100"
                }`}
              >
                <div>{formatShortWeekdayLabel(dateKey)}</div>
                <div className="text-[11px] opacity-80">
                  {doneTotals[dateKey] ?? 0}/{filteredHabits.length}
                </div>
              </button>
            ))}
          </div>

          <div className="max-h-[30rem] space-y-1 overflow-y-auto pr-1 soft-scroll">
            {filteredHabits.length === 0 ? (
              <p className="rounded-xl border border-dashed border-rose-200 bg-white/70 px-3 py-4 text-sm text-rose-900/70">
                No habits matched.
              </p>
            ) : null}

            {filteredHabits.map((habit) => (
              <div
                key={habit.id}
                className="grid grid-cols-[2.2fr_repeat(7,minmax(0,1fr))] items-center gap-1 rounded-xl border border-rose-200/80 bg-white/75 p-1"
              >
                <div className="min-w-0 rounded-lg bg-white px-2 py-2">
                  <p className="truncate text-sm font-semibold text-rose-950">
                    {habit.name}
                  </p>
                  <p className="truncate text-xs text-rose-900/65">
                    {categoryLabel(habit.category)}
                  </p>
                </div>

                {weekDates.map((dateKey) => {
                  const checked = Boolean(dayCheckMaps[dateKey]?.[habit.id]);
                  return (
                    <button
                      key={`${habit.id}-${dateKey}`}
                      type="button"
                      onClick={() => onToggle(dateKey, habit.id)}
                      className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                        checked
                          ? "border-rose-800 bg-rose-800 text-white"
                          : "border-rose-200 bg-white text-rose-900 hover:bg-rose-50"
                      }`}
                    >
                      {checked ? "OK" : "-"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-rose-900/65">
        Tip: use Day View when you want full habit edit/delete/reorder controls.
      </p>
    </SectionCard>
  );
};
