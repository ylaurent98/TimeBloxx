import { useEffect, useState } from "react";
import { HabitsPanel } from "./components/HabitsPanel";
import { TimeBlocksPanel } from "./components/TimeBlocksPanel";
import { TodoPanel } from "./components/TodoPanel";
import { TopPrioritiesPanel } from "./components/TopPrioritiesPanel";
import { WeekBlocksBoard } from "./components/WeekBlocksBoard";
import { usePlannerData } from "./hooks/usePlannerData";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { DateKey } from "./types";
import {
  addDaysToDateKey,
  formatDateLabel,
  getWeekDateKeys,
  isValidDateKey,
  todayDateKey,
} from "./utils/date";
import type { Session } from "@supabase/supabase-js";

const PlannerWorkspace = ({
  userEmail,
  onSignOut,
  cloudUserId,
  cloudEnabled,
}: {
  userEmail?: string;
  onSignOut?: () => Promise<void>;
  cloudUserId?: string | null;
  cloudEnabled?: boolean;
}) => {
  const planner = usePlannerData({ cloudUserId, cloudEnabled });
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
            <div className="flex items-center gap-2">
              {userEmail && onSignOut ? (
                <div className="rounded-xl border border-rose-200 bg-white/80 px-3 py-1.5 text-right">
                  <p className="max-w-[220px] truncate text-[11px] font-semibold text-rose-900/70">
                    {userEmail}
                  </p>
                  {cloudEnabled ? (
                    <p className="text-[10px] font-semibold text-rose-900/60">
                      {planner.cloudSyncReady ? "Cloud synced" : "Syncing..."}
                    </p>
                  ) : null}
                  {planner.cloudSyncError ? (
                    <p className="max-w-[220px] truncate text-[10px] font-semibold text-rose-700">
                      Sync error: {planner.cloudSyncError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      void onSignOut();
                    }}
                    className="text-[11px] font-semibold text-rose-700 underline-offset-2 hover:underline"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-900/65">
                  {viewMode === "week" ? "Week Progress" : "Day Progress"}
                </p>
                <p className="font-display text-xl font-semibold text-rose-950">
                  {viewMode === "week" ? weekProgressPercent : progressPercent}%
                </p>
              </div>
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
              onFetchTodoistTasks={planner.fetchTodoistTasks}
              onImportSelectedTodoistTasks={planner.importSelectedTodoistTasks}
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
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }
      if (error) {
        setAuthMessage(error.message);
      }
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleAuthSubmit = async () => {
    if (!supabase) {
      return;
    }
    if (!email.trim() || !password.trim()) {
      setAuthMessage("Please enter both email and password.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);

    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      setAuthBusy(false);
      if (error) {
        setAuthMessage(error.message);
        return;
      }
      setAuthMessage(
        "Account created. Check your email confirmation link, then sign in.",
      );
      setAuthMode("signin");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthBusy(false);
    if (error) {
      setAuthMessage(error.message);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return <PlannerWorkspace />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-sky-50 px-6 py-10 text-rose-950">
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white/85 p-6 text-center">
          <h1 className="font-display text-2xl font-semibold">Timebloxx</h1>
          <p className="mt-2 text-sm font-semibold text-rose-900/70">
            Loading your account...
          </p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-sky-50 px-4 py-8 text-rose-950 sm:px-6">
        <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white/90 p-6 shadow-[0_10px_24px_-20px_rgba(132,87,114,0.58)]">
          <h1 className="font-display text-3xl font-semibold">Timebloxx</h1>
          <p className="mt-2 text-sm font-semibold text-rose-900/75">
            Sign in to use your account-based planner.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-1">
            <button
              type="button"
              onClick={() => setAuthMode("signin")}
              className={`rounded-lg py-2 text-sm font-semibold ${
                authMode === "signin"
                  ? "bg-white text-rose-950"
                  : "text-rose-900/80 hover:bg-white/70"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`rounded-lg py-2 text-sm font-semibold ${
                authMode === "signup"
                  ? "bg-white text-rose-950"
                  : "text-rose-900/80 hover:bg-white/70"
              }`}
            >
              Create account
            </button>
          </div>

          <label className="mt-4 block text-sm font-semibold text-rose-900/80">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label className="mt-3 block text-sm font-semibold text-rose-900/80">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
            placeholder="At least 6 characters"
            autoComplete={authMode === "signin" ? "current-password" : "new-password"}
          />

          {authMessage ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-900/80">
              {authMessage}
            </p>
          ) : null}

          <button
            type="button"
            disabled={authBusy}
            onClick={() => {
              void handleAuthSubmit();
            }}
            className="mt-4 w-full rounded-xl border border-rose-300 bg-rose-200/80 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {authBusy
              ? "Please wait..."
              : authMode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <PlannerWorkspace
      userEmail={session.user.email ?? undefined}
      onSignOut={handleSignOut}
      cloudUserId={session.user.id}
      cloudEnabled={isSupabaseConfigured}
    />
  );
}

export default App;
