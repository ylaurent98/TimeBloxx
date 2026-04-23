import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Habit } from "../types";
import { SectionCard } from "./SectionCard";

interface HabitsPanelProps {
  habits: Habit[];
  checks: Record<string, boolean>;
  onToggle: (habitId: string) => void;
  onAdd: (name: string, category: string) => void;
  onEdit: (habitId: string, name: string, category: string) => void;
  onDelete: (habitId: string) => void;
  onReorder: (habitId: string, direction: -1 | 1) => void;
}

const actionButton =
  "rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";

const categoryLabel = (category: string) =>
  category.trim() ? category.trim() : "General";

export const HabitsPanel = ({
  habits,
  checks,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
}: HabitsPanelProps) => {
  const [newHabitName, setNewHabitName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  const groupedHabits = useMemo(() => {
    const map = new Map<string, Habit[]>();
    filteredHabits.forEach((habit) => {
      const category = categoryLabel(habit.category);
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)?.push(habit);
    });
    return Array.from(map.entries());
  }, [filteredHabits]);

  const doneCount = habits.filter((habit) => checks[habit.id]).length;

  const handleAddHabit = (event: FormEvent) => {
    event.preventDefault();
    if (!newHabitName.trim()) {
      return;
    }

    onAdd(newHabitName, newCategory);
    setNewHabitName("");
    setNewCategory("");
  };

  return (
    <SectionCard
      title="Habit Tracker"
      subtitle={`${doneCount}/${habits.length} done today`}
      className="h-full"
    >
      <form className="mb-3 grid gap-2 sm:grid-cols-3" onSubmit={handleAddHabit}>
        <input
          value={newHabitName}
          onChange={(event) => setNewHabitName(event.target.value)}
          placeholder="New habit"
          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 sm:col-span-2"
        />
        <input
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          placeholder="Category (optional)"
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

      <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1 soft-scroll">
        {groupedHabits.length === 0 ? (
          <p className="rounded-xl border border-dashed border-rose-200 bg-white/70 px-3 py-4 text-sm text-rose-900/70">
            No habits matched. Add one to start tracking.
          </p>
        ) : null}

        {groupedHabits.map(([category, categoryHabits]) => (
          <section
            key={category}
            className="rounded-2xl border border-rose-200/80 bg-white/75 p-2.5"
          >
            <button
              type="button"
              onClick={() =>
                setCollapsed((previous) => ({
                  ...previous,
                  [category]: !previous[category],
                }))
              }
              className="mb-2 flex w-full items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-left"
            >
              <span className="font-display text-lg font-semibold text-rose-950">
                {category}
              </span>
              <span className="text-xs font-semibold text-rose-900/70">
                {categoryHabits.length} items
              </span>
            </button>

            {collapsed[category] ? null : (
              <div className="space-y-1.5">
                {categoryHabits.map((habit, index) => (
                  <article
                    key={habit.id}
                    className="rounded-xl border border-rose-200/80 bg-white p-2"
                  >
                    {editingId === habit.id ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                        />
                        <input
                          value={editingCategory}
                          onChange={(event) =>
                            setEditingCategory(event.target.value)
                          }
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                        />
                        <div className="flex items-center gap-1 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!editingName.trim()) {
                                return;
                              }
                              onEdit(habit.id, editingName, editingCategory);
                              setEditingId(null);
                            }}
                            className={actionButton}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className={actionButton}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggle(habit.id)}
                          className={`h-6 w-6 rounded-full border text-xs font-bold transition ${
                            checks[habit.id]
                              ? "border-[#4ea79f] bg-[#67c2b6] text-white"
                              : "border-rose-400 bg-white text-rose-900 hover:bg-rose-100"
                          }`}
                        >
                          {checks[habit.id] ? "✓" : ""}
                        </button>
                        <p
                          className={`min-w-0 flex-1 text-sm text-rose-950 ${
                            checks[habit.id]
                              ? "line-through decoration-2 opacity-70"
                              : ""
                          }`}
                        >
                          {habit.name}
                        </p>

                        <button
                          type="button"
                          className={actionButton}
                          onClick={() => onReorder(habit.id, -1)}
                          disabled={index === 0}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={actionButton}
                          onClick={() => onReorder(habit.id, 1)}
                          disabled={index === categoryHabits.length - 1}
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={actionButton}
                          onClick={() => {
                            setEditingId(habit.id);
                            setEditingName(habit.name);
                            setEditingCategory(habit.category);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={actionButton}
                          onClick={() => onDelete(habit.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </SectionCard>
  );
};
