import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { TodoItem } from "../types";
import { SectionCard } from "./SectionCard";

interface TodoPanelProps {
  todos: TodoItem[];
  onAdd: (text: string) => void;
  onToggle: (todoId: string) => void;
  onEdit: (todoId: string, text: string) => void;
  onDelete: (todoId: string) => void;
  onCarryForward: (todoId: string) => void;
  onReorder: (todoId: string, direction: -1 | 1) => void;
}

const actionButton =
  "rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";

export const TodoPanel = ({
  todos,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
  onCarryForward,
  onReorder,
}: TodoPanelProps) => {
  const [newTask, setNewTask] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const sortedTodos = useMemo(
    () => [...todos].sort((a, b) => a.order - b.order),
    [todos],
  );

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!newTask.trim()) {
      return;
    }

    onAdd(newTask);
    setNewTask("");
  };

  const doneCount = sortedTodos.filter((todo) => todo.completed).length;

  return (
    <SectionCard
      title="Daily To-Do"
      subtitle={`${doneCount}/${sortedTodos.length} complete`}
    >
      <form className="mb-3 flex gap-2" onSubmit={handleAdd}>
        <input
          value={newTask}
          onChange={(event) => setNewTask(event.target.value)}
          placeholder="Add a task..."
          className="flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
        <button
          type="submit"
          className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-300"
        >
          Add
        </button>
      </form>

      <div className="space-y-2">
        {sortedTodos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-rose-200 bg-white/70 px-3 py-4 text-sm text-rose-900/70">
            No tasks yet for this day.
          </p>
        ) : null}

        {sortedTodos.map((todo, index) => (
          <article
            key={todo.id}
            className="rounded-2xl border border-rose-200/80 bg-white/75 p-3"
          >
            {editingId === todo.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-rose-400"
                />
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => {
                    if (!editingText.trim()) {
                      return;
                    }
                    onEdit(todo.id, editingText);
                    setEditingId(null);
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(todo.id)}
                  className={`h-6 w-6 rounded-full border text-xs font-bold transition ${
                    todo.completed
                      ? "border-rose-900 bg-rose-900 text-white"
                      : "border-rose-400 bg-white text-rose-900 hover:bg-rose-100"
                  }`}
                >
                  {todo.completed ? "✓" : ""}
                </button>
                <p
                  className={`min-w-0 flex-1 text-sm text-rose-950 ${
                    todo.completed ? "line-through decoration-2 opacity-70" : ""
                  }`}
                >
                  {todo.dueTime ? `${todo.dueTime} ` : ""}
                  {todo.text}
                </p>

                <button
                  type="button"
                  className={actionButton}
                  onClick={() => {
                    setEditingId(todo.id);
                    setEditingText(todo.text);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => onCarryForward(todo.id)}
                  disabled={todo.completed}
                  title="Move to next day"
                >
                  →
                </button>
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => onReorder(todo.id, -1)}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => onReorder(todo.id, 1)}
                  disabled={index === sortedTodos.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => onDelete(todo.id)}
                >
                  Delete
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </SectionCard>
  );
};
