import { useState } from "react";
import { HabitsPanel } from "./components/HabitsPanel";
import { TimeBlocksPanel } from "./components/TimeBlocksPanel";
import { TodoPanel } from "./components/TodoPanel";
import { TopPrioritiesPanel } from "./components/TopPrioritiesPanel";
import { WeekBlocksBoard } from "./components/WeekBlocksBoard";
import { usePlannerData } from "./hooks/usePlannerData";
import type { DateKey } from "./types";
import {
  addDaysToDateKey,
  formatDateLabel,
  getWeekDateKeys,
  isValidDateKey,
  todayDateKey,
} from "./utils/date";

function App() {
  const planner = usePlannerData();
  const [selectedDate, setSelectedDate] = useState<DateKey>(todayDateKey());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const dayData = planner.getDayData(selectedDate);
  const weekDates = getWeekDateKeys(selectedDate, 1);
  const weekHabits = planner.getHabitsForWeek(selectedDate);

  const completedTodos = dayData.todos.filter((todo) => todo.completed).length;
  const completedHabits = planner.habits.filter(
    (habit) => dayData.habitChecks[habit.id],
  ).length;
  const completedBlocks = dayData.blocks.filter((block) => block.completed).length;

  const progressPercent = (() => {
    const total =
      dayData.blocks.length + dayData.todos.length + planner.habits.length;
    if (total === 0) {
      return 0;
    }
    const complete = completedBlocks + completedTodos + completedHabits;
    return Math.round((complete / total) * 100);
  })();

  const weekProgressPercent = (() => {
    let totalBlocks = 0;
    let doneBlocks = 0;
    let doneHabits = 0;

    weekDates.forEach((dateKey) => {
      const weekDay = planner.getDayData(dateKey);
      totalBlocks += weekDay.blocks.length;
      doneBlocks += weekDay.blocks.filter((block) => block.completed).length;
      doneHabits += weekHabits.filter((habit) => weekDay.habitChecks[habit.id]).length;
    });

    const totalHabits = weekHabits.length * weekDates.length;
    const total = totalBlocks + totalHabits;
    if (total === 0) {
      return 0;
    }
    return Math.round(((doneBlocks + doneHabits) / total) * 100);
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-sky-50 text-rose-950">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section className="mb-3 rounded-2xl border border-rose-200/80 bg-white/80 p-3 shadow-[0_10px_24px_-20px_rgba(132,87,114,0.58)] backdrop-blur-sm sm:p-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-rose-950 sm:text-2xl">
                Timebloxx
              </h1>
              <p className="truncate text-sm font-semibold text-rose-900/75">
                {formatDateLabel(selectedDate)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-900/65">
                {viewMode === "week" ? "Week Progress" : "Day Progress"}
              </p>
              <p className="font-display text-xl font-semibold text-rose-950">
                {viewMode === "week" ? weekProgressPercent : progressPercent}%
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-rose-200 bg-rose-50/55 px-2 py-1.5 text-center">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`mb-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                  viewMode === "day"
                    ? "bg-rose-300/70 text-rose-950"
                    : "bg-white text-rose-900 hover:bg-rose-50"
                }`}
              >
                Day View
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, -1))}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Previous
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    if (isValidDateKey(event.target.value)) {
                      setSelectedDate(event.target.value);
                    }
                  }}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-950 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, 1))}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/55 px-2 py-1.5 text-center">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`mb-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                  viewMode === "week"
                    ? "bg-rose-300/70 text-rose-950"
                    : "bg-white text-rose-900 hover:bg-rose-50"
                }`}
              >
                Week View
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, -7))}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Prev Week
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayDateKey())}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-900 hover:bg-rose-50"
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, 7))}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Next Week
                </button>
              </div>
            </div>
          </div>
        </section>

        {viewMode === "week" ? (
          <main className="mt-4">
            <WeekBlocksBoard
              selectedDate={selectedDate}
              weekDates={weekDates}
              templates={planner.templates}
              habits={weekHabits}
              getDayData={planner.getDayData}
              weeklyTasks={planner.getWeeklyTasks(selectedDate)}
              weeklyPlannedBlocks={planner.getWeeklyPlannedBlocks(selectedDate)}
              onSelectDate={setSelectedDate}
              onAddOneTimeBlock={planner.addOneTimeBlock}
              onScheduleTemplate={planner.scheduleTemplate}
              onToggleComplete={planner.toggleBlockComplete}
              onDeleteBlock={planner.deleteBlock}
              onEditBlock={planner.editBlock}
              onToggleHabit={planner.toggleHabitCheck}
              onAddHabit={planner.addHabit}
              onRenameHabit={planner.updateHabit}
              onDeleteHabit={planner.deleteHabit}
              onCreateReusableTemplate={planner.createReusableTemplate}
              onDeleteTemplate={planner.deleteTemplate}
              onUpdateTemplate={planner.updateTemplate}
              onMoveBlockPlacement={planner.setBlockPlacement}
              onAddTodo={planner.addTodo}
              onAddWeeklyTask={planner.addWeeklyTask}
              onToggleWeeklyTask={planner.toggleWeeklyTask}
              onDeleteWeeklyTask={planner.deleteWeeklyTask}
              onMoveWeeklyTaskWithinBench={planner.moveWeeklyTaskWithinBench}
              onMoveWeeklyTaskToDate={planner.moveWeeklyTaskToDate}
              onMoveWeeklyTaskToNextWeekBench={
                planner.moveWeeklyTaskToNextWeekBench
              }
              onMoveTodoToBench={planner.moveTodoToWeeklyBank}
              onMoveTodoToDate={planner.moveTodoToDate}
              onMoveBlockToBench={planner.moveBlockToWeeklyBench}
              onMoveBenchBlockToDate={planner.moveWeeklyBenchBlockToDate}
              onPlaceBenchBlock={planner.placeWeeklyBenchBlock}
              onAddTemplateToBench={planner.addTemplateToWeeklyBench}
              onToggleTodo={planner.toggleTodo}
              onMoveTodoWithinDay={planner.moveTodoWithinDay}
              onCarryForwardTodo={planner.carryForwardTodo}
              todoistConnected={planner.todoistConnected}
              onSetTodoistToken={planner.setTodoistApiToken}
              onImportTodoistTaggedTasks={planner.importTodoistTaggedTasks}
            />
          </main>
        ) : (
          <main className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <div className="space-y-4">
              <TimeBlocksPanel
                selectedDate={selectedDate}
                blocks={dayData.blocks}
                templates={planner.templates}
                onAddOneTimeBlock={(input) =>
                  planner.addOneTimeBlock(selectedDate, input)
                }
                onCreateReusableTemplate={planner.createReusableTemplate}
                onScheduleTemplate={(templateId, input) =>
                  planner.scheduleTemplate(selectedDate, templateId, input)
                }
                onUpdateTemplate={planner.updateTemplate}
                onDeleteTemplate={planner.deleteTemplate}
                onToggleComplete={(blockId) =>
                  planner.toggleBlockComplete(selectedDate, blockId)
                }
                onDeleteBlock={(blockId) =>
                  planner.deleteBlock(selectedDate, blockId)
                }
                onDuplicateBlock={(blockId) =>
                  planner.duplicateBlock(selectedDate, blockId)
                }
                onEditBlock={(blockId, input) =>
                  planner.editBlock(selectedDate, blockId, input)
                }
                onMoveBlock={(blockId, targetDate) =>
                  planner.moveBlock(selectedDate, blockId, targetDate)
                }
                onReorderUntimedBlock={(blockId, direction) =>
                  planner.reorderUntimedBlock(selectedDate, blockId, direction)
                }
              />

              <TodoPanel
                todos={dayData.todos}
                onAdd={(text) => planner.addTodo(selectedDate, text)}
                onToggle={(todoId) => planner.toggleTodo(selectedDate, todoId)}
                onEdit={(todoId, nextText) =>
                  planner.updateTodoText(selectedDate, todoId, nextText)
                }
                onDelete={(todoId) => planner.deleteTodo(selectedDate, todoId)}
                onCarryForward={(todoId) =>
                  planner.carryForwardTodo(selectedDate, todoId)
                }
                onReorder={(todoId, direction) =>
                  planner.reorderTodo(selectedDate, todoId, direction)
                }
              />
            </div>

            <div className="space-y-4">
              <TopPrioritiesPanel
                priorities={dayData.topPriorities}
                onChange={(index, value) =>
                  planner.setTopPriority(selectedDate, index, value)
                }
              />

              <HabitsPanel
                habits={planner.habits}
                checks={dayData.habitChecks}
                onToggle={(habitId) =>
                  planner.toggleHabitCheck(selectedDate, habitId)
                }
                onAdd={planner.addHabit}
                onEdit={planner.updateHabit}
                onDelete={planner.deleteHabit}
                onReorder={planner.reorderHabit}
              />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export default App;
