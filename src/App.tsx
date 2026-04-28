import { useEffect, useState } from "react";
import { HabitsPanel } from "./components/HabitsPanel";
import { TimeBlocksPanel } from "./components/TimeBlocksPanel";
import { TodoPanel } from "./components/TodoPanel";
import { TopPrioritiesPanel } from "./components/TopPrioritiesPanel";
import { WeekBlocksBoard } from "./components/WeekBlocksBoard";
import { IntegrationsDashboard } from "./components/IntegrationsDashboard";
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

type DashboardTheme = "juicy" | "citrus" | "bubblegum";
const DASHBOARD_THEME_KEY = "timebloxx.integrations.dashboard.theme.v1";
const SPECIAL_NAME_BY_EMAIL: Record<string, string> = {
  "laurentyolanda@googlemail.com": "Yoli",
};

const PlannerWorkspace = ({
  userEmail,
  userName,
  onSignOut,
  onSignInWithPassword,
  cloudUserId,
  cloudEnabled,
}: {
  userEmail?: string;
  userName?: string;
  onSignOut?: () => Promise<void>;
  onSignInWithPassword?: (email: string, password: string) => Promise<string | null>;
  cloudUserId?: string | null;
  cloudEnabled?: boolean;
}) => {
  const planner = usePlannerData({ cloudUserId, cloudEnabled });
  const [selectedDate, setSelectedDate] = useState<DateKey>(todayDateKey());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [workspaceMode, setWorkspaceMode] = useState<"planner" | "dashboard">(
    "planner",
  );
  const [currentPage, setCurrentPage] = useState<
    "weekly-planner" | "daily-index" | "daily-planner"
  >("daily-index");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [accountEmail, setAccountEmail] = useState(userEmail ?? "");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountAuthBusy, setAccountAuthBusy] = useState(false);
  const [accountAuthMessage, setAccountAuthMessage] = useState<string | null>(null);
  const userScope = cloudUserId ?? userEmail ?? "local";
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>("juicy");
  const accountLabel = userEmail ?? (cloudUserId ? `User ${cloudUserId.slice(0, 8)}` : "Account");
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

  useEffect(() => {
    setAccountEmail(userEmail ?? "");
  }, [userEmail]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const key = `${DASHBOARD_THEME_KEY}.${userScope}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as DashboardTheme;
      if (parsed === "juicy" || parsed === "citrus" || parsed === "bubblegum") {
        setDashboardTheme(parsed);
      }
    } catch {
      // no-op
    }
  }, [userScope]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const key = `${DASHBOARD_THEME_KEY}.${userScope}`;
    window.localStorage.setItem(key, JSON.stringify(dashboardTheme));
  }, [dashboardTheme, userScope]);

  useEffect(() => {
    if (currentPage === "daily-index") {
      setWorkspaceMode("dashboard");
      setSidebarCollapsed(true);
      return;
    }
    setWorkspaceMode("planner");
    setViewMode(currentPage === "weekly-planner" ? "week" : "day");
    setSidebarCollapsed(false);
  }, [currentPage]);

  const submitSidebarSignIn = async () => {
    const email = accountEmail.trim();
    const password = accountPassword.trim();
    if (!email || !password) {
      setAccountAuthMessage("Enter email and password.");
      return;
    }
    if (!onSignInWithPassword) {
      setAccountAuthMessage("Sign in is unavailable.");
      return;
    }
    setAccountAuthBusy(true);
    setAccountAuthMessage(null);
    const message = await onSignInWithPassword(email, password);
    if (message) {
      setAccountAuthMessage(message);
      setAccountAuthBusy(false);
      return;
    }
    setAccountPassword("");
    setAccountAuthMessage("Signed in.");
    setAccountAuthBusy(false);
  };

  return (
    <div
      className={`min-h-screen ${
        workspaceMode === "dashboard"
          ? "overflow-x-hidden bg-[#fff5e6] text-zinc-950"
          : "bg-gradient-to-br from-rose-50 via-orange-50 to-sky-50 text-rose-950"
      }`}
    >
      <div
        className={`w-full ${
          workspaceMode === "dashboard"
            ? "mx-auto max-w-[1680px] px-3 py-5 sm:px-4 sm:py-7 lg:px-6"
            : "mx-auto max-w-[1320px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
        }`}
      >
        <div className={`grid gap-4 ${sidebarCollapsed ? "grid-cols-1" : "lg:grid-cols-[220px_1fr]"}`}>
          {!sidebarCollapsed ? (
          <aside className="rounded-2xl border border-rose-200/80 bg-white/80 p-3 shadow-[0_10px_24px_-20px_rgba(132,87,114,0.58)] backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-900/65">
                Navigation
              </p>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                aria-label="Hide sidebar"
                title="Hide sidebar"
              >
                x
              </button>
            </div>
            <nav className="space-y-2">
              {[
                { id: "daily-index", label: "The Daily Index" },
                { id: "weekly-planner", label: "Timebloxx Weekly" },
                { id: "daily-planner", label: "Timebloxx Daily" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentPage(
                      item.id as "weekly-planner" | "daily-index" | "daily-planner",
                    );
                    setSidebarCollapsed(true);
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    currentPage === item.id
                      ? "bg-rose-200/70 text-rose-950"
                      : "bg-white/80 text-rose-900/80 hover:bg-rose-50"
                  }`}
                  title={item.label}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-3 rounded-xl border border-rose-200 bg-white/90 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-900/65">
                Account
              </p>
              <p className="mt-1 truncate text-[11px] font-semibold text-rose-900/75">
                {accountLabel}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-rose-900/70">
                Name: {userName || "Alex"}
              </p>
              <label className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-rose-900/60">
                Email
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-rose-900/60">
                Password
                <input
                  type="password"
                  value={accountPassword}
                  onChange={(event) => setAccountPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                  placeholder="Password"
                  autoComplete="current-password"
                />
              </label>
              {accountAuthMessage ? (
                <p className="mt-1 text-[10px] font-semibold text-rose-900/75">
                  {accountAuthMessage}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={accountAuthBusy}
                  onClick={() => {
                    void submitSidebarSignIn();
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-900 hover:bg-rose-200 disabled:opacity-60"
                >
                  {accountAuthBusy ? "Signing in..." : "Sign in"}
                </button>
                {onSignOut ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onSignOut();
                    }}
                    className="text-[11px] font-semibold text-rose-700 underline-offset-2 hover:underline"
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-rose-200 bg-white/90 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-900/65">
                Integrations Auth
              </p>
              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("timebloxx:auth:whoop"));
                  }}
                  className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-left text-[11px] font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Whoop auth
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("timebloxx:auth:outlook"));
                  }}
                  className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-left text-[11px] font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Outlook auth
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("timebloxx:sync:whoop"));
                  }}
                  className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-left text-[11px] font-semibold text-rose-900 hover:bg-rose-50"
                >
                  Whoop sync
                </button>
              </div>
            </div>
          </aside>
          ) : null}

          <div>
        <div className="mb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((previous) => !previous)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-white/90 text-rose-900 shadow-[0_8px_18px_-16px_rgba(122,68,98,0.6)] hover:bg-rose-50"
              aria-label={sidebarCollapsed ? "Open sidebar menu" : "Close sidebar menu"}
              title={sidebarCollapsed ? "Open menu" : "Close menu"}
            >
              <span className="sr-only">Menu</span>
              <span className="flex flex-col gap-1">
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
              </span>
            </button>
            <div className="rounded-xl border border-rose-200 bg-white/90 px-3 py-1.5 text-right">
              <p className="max-w-[260px] truncate text-[11px] font-semibold text-rose-900/75">
                {accountLabel}
              </p>
            </div>
          </div>
        </div>
        <section
          className={
            workspaceMode === "dashboard"
              ? "mb-3 p-0"
              : "relative mb-3 rounded-2xl border border-rose-200/80 bg-white/80 p-3 shadow-[0_10px_24px_-20px_rgba(132,87,114,0.58)] backdrop-blur-sm sm:p-3.5"
          }
        >
          {workspaceMode === "planner" ? (
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
          ) : null}

          {workspaceMode === "planner" ? (
            <div className="grid gap-2 md:grid-cols-2">
              {viewMode === "day" ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/55 px-2 py-1.5 text-center md:col-span-2">
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
              ) : null}

              {viewMode === "week" ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/55 px-2 py-1.5 text-center md:col-span-2">
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
              ) : null}
            </div>
          ) : null}
        </section>

        {workspaceMode === "dashboard" ? (
          <IntegrationsDashboard
            theme={dashboardTheme}
            onThemeChange={setDashboardTheme}
            userScope={userScope}
            userName={userName || "Alex"}
          />
        ) : viewMode === "week" ? (
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
      </div>
    </div>
  );
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(
    () => isSupabaseConfigured && Boolean(supabase),
  );
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
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
      const resolvedName =
        signupName.trim() ||
        SPECIAL_NAME_BY_EMAIL[email.trim().toLowerCase()] ||
        "";
      if (!resolvedName) {
        setAuthBusy(false);
        setAuthMessage("Please add your name.");
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: resolvedName,
          },
        },
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
      setSignupName("");
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
    setPassword("");
    setAuthMode("signin");
    setAuthMessage("Signed out.");
  };

  const handleInlineSignIn = async (loginEmail: string, loginPassword: string) => {
    if (!supabase) {
      return "Supabase is not configured.";
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    return error ? error.message : null;
  };

  useEffect(() => {
    if (!supabase || !session?.user) {
      return;
    }
    const email = (session.user.email ?? "").toLowerCase();
    const displayName =
      (session.user.user_metadata?.display_name as string | undefined) ?? "";
    const enforcedName = SPECIAL_NAME_BY_EMAIL[email];
    if (!enforcedName || displayName) {
      return;
    }
    void supabase.auth.updateUser({
      data: {
        display_name: enforcedName,
      },
    });
  }, [session]);

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

          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAuthSubmit();
            }}
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-1">
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
            {authMode === "signup" ? (
              <>
                <label className="mt-3 block text-sm font-semibold text-rose-900/80">
                  Name
                </label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </>
            ) : null}

            {authMessage ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-900/80">
                {authMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={authBusy}
              className="mt-4 w-full rounded-xl border border-rose-300 bg-rose-200/80 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {authBusy
                ? "Please wait..."
                : authMode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <PlannerWorkspace
      userEmail={session.user.email ?? undefined}
      userName={
        (session.user.user_metadata?.display_name as string | undefined) ??
        SPECIAL_NAME_BY_EMAIL[(session.user.email ?? "").toLowerCase()] ??
        undefined
      }
      onSignOut={handleSignOut}
      onSignInWithPassword={handleInlineSignIn}
      cloudUserId={session.user.id}
      cloudEnabled={isSupabaseConfigured}
    />
  );
}

export default App;
