import { useEffect, useMemo } from "react";
import { STARTER_HABITS } from "../data/starterHabits";
import { STARTER_TEMPLATES } from "../data/starterTemplates";
import type {
  BlockEditInput,
  DailyData,
  DateKey,
  Habit,
  OneTimeBlockInput,
  PlannerData,
  ReusableTemplateInput,
  ScheduleTemplateInput,
  TimeBlock,
  TimeBlockTemplate,
  TodoistSettings,
  TodoItem,
} from "../types";
import {
  addDaysToDateKey,
  isValidDateKey,
  startOfWeekDateKey,
  toDateKey,
} from "../utils/date";
import { useLocalStorageState } from "./useLocalStorageState";

const STORAGE_KEY = "timebloxx.planner.v1";
const DATA_VERSION = 1;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clampDuration = (value: number) => Math.max(1, Math.round(value));

const createEmptyDay = (): DailyData => ({
  blocks: [],
  todos: [],
  topPriorities: ["", "", ""],
  habitChecks: {},
});

const getNextOrder = (items: Array<{ order: number }>) =>
  items.length === 0 ? 0 : Math.max(...items.map((item) => item.order)) + 1;

const createInitialData = (): PlannerData => ({
  version: DATA_VERSION,
  templates: STARTER_TEMPLATES,
  habits: STARTER_HABITS,
  days: {},
  weeklyTaskBank: {},
  weeklyBlockBank: {},
  todoist: {
    apiToken: null,
    lastSyncAt: null,
  },
});

const normalizeCategory = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : "General";
};

const normalizeDescription = (value?: string | null) => value?.trim() ?? "";
const normalizeArchivedAt = (value?: string | null) => value ?? null;
const toLocalDateKeyFromIso = (value: string | null | undefined): DateKey | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toDateKey(parsed);
};

const createBlock = (
  partial: Omit<TimeBlock, "id" | "createdAt">,
): TimeBlock => ({
  ...partial,
  id: createId(),
  createdAt: new Date().toISOString(),
});

const createTodo = (partial: Omit<TodoItem, "id" | "createdAt">): TodoItem => ({
  ...partial,
  id: createId(),
  createdAt: new Date().toISOString(),
});

const createHabit = (partial: Omit<Habit, "id" | "createdAt">): Habit => ({
  ...partial,
  id: createId(),
  createdAt: new Date().toISOString(),
});

export const usePlannerData = () => {
  const [data, setData] = useLocalStorageState<PlannerData>(
    STORAGE_KEY,
    createInitialData,
  );

  useEffect(() => {
    if (
      data.habits.length > 0 &&
      data.version === DATA_VERSION &&
      data.weeklyTaskBank &&
      data.weeklyBlockBank &&
      data.todoist
    ) {
      return;
    }

    setData((previous) => {
      const nextVersioned =
        previous.version === DATA_VERSION
          ? previous
          : { ...previous, version: DATA_VERSION };

      if (nextVersioned.habits.length > 0) {
        return nextVersioned;
      }

      return {
        ...nextVersioned,
        habits: STARTER_HABITS,
        weeklyTaskBank: nextVersioned.weeklyTaskBank ?? {},
        weeklyBlockBank: nextVersioned.weeklyBlockBank ?? {},
        todoist: nextVersioned.todoist ?? {
          apiToken: null,
          lastSyncAt: null,
        },
      };
    });
  }, [data.habits.length, data.todoist, data.version, setData]);

  useEffect(() => {
    setData((previous) => {
      let changed = false;

      const nextTemplates = previous.templates.map((template) => {
        const normalizedCategory = normalizeCategory(template.category);
        const normalizedDescription = normalizeDescription(template.description);
        if (normalizedCategory === template.category) {
          if (normalizedDescription === template.description) {
            return template;
          }
        } else if (normalizedDescription === template.description) {
          changed = true;
          return { ...template, category: normalizedCategory };
        }
        changed = true;
        return {
          ...template,
          category: normalizedCategory,
          description: normalizedDescription,
        };
      });

      const nextHabits = previous.habits.map((habit) => {
        const archivedAt = normalizeArchivedAt(habit.archivedAt);
        if (habit.archivedAt === archivedAt) {
          return habit;
        }
        changed = true;
        return {
          ...habit,
          archivedAt,
        };
      });

      const nextDays = Object.fromEntries(
        Object.entries(previous.days).map(([dateKey, day]) => {
          let blockChanged = false;
          const nextBlocks = day.blocks.map((block) => {
            const normalizedCategory = normalizeCategory(block.category);
            const normalizedDescription = normalizeDescription(block.description);
            const nextActualDuration = block.actualDurationMin ?? null;
            const nextActualStart = block.actualStartTime ?? null;
            if (
              normalizedCategory === block.category &&
              normalizedDescription === block.description &&
              nextActualDuration === block.actualDurationMin &&
              nextActualStart === block.actualStartTime
            ) {
              return block;
            }
            changed = true;
            blockChanged = true;
            return {
              ...block,
              category: normalizedCategory,
              description: normalizedDescription,
              actualDurationMin: nextActualDuration,
              actualStartTime: nextActualStart,
            };
          });

          let todoChanged = false;
          const nextTodos = day.todos.map((todo) => {
            const nextDueTime = todo.dueTime ?? null;
            if (nextDueTime === todo.dueTime) {
              return todo;
            }
            changed = true;
            todoChanged = true;
            return {
              ...todo,
              dueTime: nextDueTime,
            };
          });

          if (!blockChanged && !todoChanged) {
            return [dateKey, day] as const;
          }
          return [
            dateKey,
            {
              ...day,
              blocks: nextBlocks,
              todos: nextTodos,
            },
          ] as const;
        }),
      );

      const nextWeeklyTaskBank = Object.fromEntries(
        Object.entries(previous.weeklyTaskBank ?? {}).map(([weekKey, tasks]) => {
          let taskChanged = false;
          const normalized = tasks.map((todo) => {
            const nextDueTime = todo.dueTime ?? null;
            if (nextDueTime === todo.dueTime) {
              return todo;
            }
            changed = true;
            taskChanged = true;
            return { ...todo, dueTime: nextDueTime };
          });
          return [weekKey, taskChanged ? normalized : tasks] as const;
        }),
      );

      const nextWeeklyBlockBank = Object.fromEntries(
        Object.entries(previous.weeklyBlockBank ?? {}).map(([weekKey, blocks]) => {
          let blockChanged = false;
          const normalized = blocks.map((block) => {
            const normalizedCategory = normalizeCategory(block.category);
            const normalizedDescription = normalizeDescription(block.description);
            const nextActualDuration = block.actualDurationMin ?? null;
            const nextActualStart = block.actualStartTime ?? null;
            if (
              normalizedCategory === block.category &&
              normalizedDescription === block.description &&
              nextActualDuration === block.actualDurationMin &&
              nextActualStart === block.actualStartTime
            ) {
              return block;
            }
            changed = true;
            blockChanged = true;
            return {
              ...block,
              category: normalizedCategory,
              description: normalizedDescription,
              actualDurationMin: nextActualDuration,
              actualStartTime: nextActualStart,
            };
          });
          return [weekKey, blockChanged ? normalized : blocks] as const;
        }),
      );

      const nextTodoist: TodoistSettings = {
        apiToken: previous.todoist?.apiToken ?? null,
        lastSyncAt: previous.todoist?.lastSyncAt ?? null,
      };
      if (
        nextTodoist.apiToken !== previous.todoist?.apiToken ||
        nextTodoist.lastSyncAt !== previous.todoist?.lastSyncAt
      ) {
        changed = true;
      }

      if (!changed) {
        return previous;
      }

      return {
        ...previous,
        templates: nextTemplates,
        habits: nextHabits,
        days: nextDays,
        weeklyTaskBank: nextWeeklyTaskBank,
        weeklyBlockBank: nextWeeklyBlockBank,
        todoist: nextTodoist,
      };
    });
  }, [setData]);

  const getDayData = (dateKey: DateKey): DailyData =>
    data.days[dateKey] ?? createEmptyDay();

  const updateDay = (
    dateKey: DateKey,
    updater: (currentDay: DailyData) => DailyData,
  ) => {
    setData((prev) => {
      const current = prev.days[dateKey] ?? createEmptyDay();
      const nextDay = updater(current);
      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: nextDay,
        },
      };
    });
  };

  const weekKeyFor = (dateKey: DateKey) => startOfWeekDateKey(dateKey, 1);
  const todoistToken = data.todoist?.apiToken ?? null;

  const setTodoistApiToken = (token: string | null) => {
    setData((prev) => ({
      ...prev,
      todoist: {
        ...(prev.todoist ?? { apiToken: null, lastSyncAt: null }),
        apiToken: token?.trim() ? token.trim() : null,
      },
    }));
  };

  const isTodoistLinkedTodo = (todo: TodoItem) =>
    Boolean(todo.externalId) &&
    (todo.source === "todoist" ||
      (todo.labels ?? []).some((label) => label.toLowerCase() === "from-todoist"));

  const syncTodoistCompletion = async (
    todo: TodoItem,
    shouldBeCompleted: boolean,
  ) => {
    if (!todoistToken || !isTodoistLinkedTodo(todo) || !todo.externalId) {
      return;
    }
    const endpoint = shouldBeCompleted ? "close" : "reopen";
    const response = await fetch(
      `https://api.todoist.com/rest/v2/tasks/${todo.externalId}/${endpoint}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${todoistToken}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Todoist ${endpoint} failed (${response.status})`);
    }
  };

  const getWeeklyTasks = (dateKey: DateKey): TodoItem[] =>
    [...((data.weeklyTaskBank ?? {})[weekKeyFor(dateKey)] ?? [])].sort(
      (a, b) => a.order - b.order,
    );

  const getWeeklyPlannedBlocks = (dateKey: DateKey): TimeBlock[] =>
    [...((data.weeklyBlockBank ?? {})[weekKeyFor(dateKey)] ?? [])].sort(
      (a, b) => a.order - b.order,
    );

  const getHabitsForWeek = (dateKey: DateKey): Habit[] => {
    const weekStart = startOfWeekDateKey(dateKey, 1);
    return [...data.habits]
      .filter((habit) => {
        const createdAtDateKey = toLocalDateKeyFromIso(habit.createdAt);
        if (createdAtDateKey && createdAtDateKey > weekStart) {
          return false;
        }
        const archivedAtDateKey = toLocalDateKeyFromIso(habit.archivedAt);
        if (!archivedAtDateKey) {
          return true;
        }
        return archivedAtDateKey > weekStart;
      })
      .sort((a, b) => a.order - b.order);
  };

  const addOneTimeBlock = (dateKey: DateKey, input: OneTimeBlockInput) => {
    if (!input.title.trim()) {
      return;
    }

    const durationMin = clampDuration(input.durationMin);
    updateDay(dateKey, (day) => ({
      ...day,
      blocks: [
        ...day.blocks,
        createBlock({
          title: input.title.trim(),
          description: normalizeDescription(input.description),
          category: normalizeCategory(input.category),
          durationMin,
          startTime: input.startTime?.trim() ? input.startTime : null,
          actualDurationMin: null,
          actualStartTime: null,
          color: input.color,
          completed: false,
          source: "one-time",
          order: getNextOrder(day.blocks),
        }),
      ],
    }));
  };

  const createReusableTemplate = (input: ReusableTemplateInput) => {
    if (!input.title.trim()) {
      return;
    }

    const templateId = createId();
    const template: TimeBlockTemplate = {
      id: templateId,
      title: input.title.trim(),
      description: normalizeDescription(input.description),
      category: normalizeCategory(input.category),
      defaultDurationMin: clampDuration(input.defaultDurationMin),
      color: input.color,
      isVariableDuration: input.isVariableDuration,
      createdAt: new Date().toISOString(),
    };

    setData((prev) => {
      let nextDays = prev.days;

      if (input.scheduleOnDate) {
        const dateKey = input.scheduleOnDate;
        const day = prev.days[dateKey] ?? createEmptyDay();
        const durationMin = clampDuration(
          input.scheduleDurationMin ?? template.defaultDurationMin,
        );

        const scheduledBlock = createBlock({
          title: template.title,
          description: template.description,
          category: template.category,
          durationMin,
          startTime: input.scheduleStartTime?.trim()
            ? input.scheduleStartTime
            : null,
          actualDurationMin: null,
          actualStartTime: null,
          color: template.color,
          completed: false,
          source: "template",
          templateId: template.id,
          order: getNextOrder(day.blocks),
        });

        nextDays = {
          ...prev.days,
          [dateKey]: {
            ...day,
            blocks: [...day.blocks, scheduledBlock],
          },
        };
      }

      return {
        ...prev,
        templates: [...prev.templates, template],
        days: nextDays,
      };
    });
  };

  const scheduleTemplate = (
    dateKey: DateKey,
    templateId: string,
    input?: ScheduleTemplateInput,
  ) => {
    setData((prev) => {
      const template = prev.templates.find((candidate) => candidate.id === templateId);
      if (!template) {
        return prev;
      }

      const day = prev.days[dateKey] ?? createEmptyDay();
      const durationMin = clampDuration(
        input?.durationMin ?? template.defaultDurationMin,
      );

      const block = createBlock({
        title: template.title,
        description: template.description,
        category: template.category,
        durationMin,
        startTime: input?.startTime?.trim() ? input.startTime : null,
        actualDurationMin: null,
        actualStartTime: null,
        color: template.color,
        completed: false,
        source: "template",
        templateId: template.id,
        order: getNextOrder(day.blocks),
      });

      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...day,
            blocks: [...day.blocks, block],
          },
        },
      };
    });
  };

  const updateTemplate = (
    templateId: string,
    updates: Pick<
      TimeBlockTemplate,
      | "title"
      | "description"
      | "category"
      | "defaultDurationMin"
      | "color"
      | "isVariableDuration"
    >,
  ) => {
    setData((prev) => ({
      ...prev,
      templates: prev.templates.map((template) =>
        template.id === templateId
          ? {
              ...template,
              title: updates.title.trim(),
              description: normalizeDescription(updates.description),
              category: normalizeCategory(updates.category),
              color: updates.color,
              isVariableDuration: updates.isVariableDuration,
              defaultDurationMin: clampDuration(updates.defaultDurationMin),
            }
          : template,
      ),
    }));
  };

  const deleteTemplate = (templateId: string) => {
    setData((prev) => ({
      ...prev,
      templates: prev.templates.filter((template) => template.id !== templateId),
    }));
  };

  const toggleBlockComplete = (dateKey: DateKey, blockId: string) => {
    updateDay(dateKey, (day) => ({
      ...day,
      blocks: day.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              completed: !block.completed,
              actualDurationMin:
                !block.completed && block.actualDurationMin == null
                  ? block.durationMin
                  : block.actualDurationMin,
              actualStartTime:
                !block.completed && block.actualStartTime == null
                  ? block.startTime
                  : block.actualStartTime,
            }
          : block,
      ),
    }));
  };

  const deleteBlock = (dateKey: DateKey, blockId: string) => {
    updateDay(dateKey, (day) => ({
      ...day,
      blocks: day.blocks.filter((block) => block.id !== blockId),
    }));
  };

  const duplicateBlock = (
    dateKey: DateKey,
    blockId: string,
    targetDate = dateKey,
  ) => {
    setData((prev) => {
      const sourceDay = prev.days[dateKey] ?? createEmptyDay();
      const sourceBlock = sourceDay.blocks.find((block) => block.id === blockId);
      if (!sourceBlock) {
        return prev;
      }

      const destination = prev.days[targetDate] ?? createEmptyDay();
      const copy = createBlock({
        ...sourceBlock,
        completed: false,
        actualDurationMin: null,
        actualStartTime: null,
        order: getNextOrder(destination.blocks),
      });

      return {
        ...prev,
        days: {
          ...prev.days,
          [targetDate]: {
            ...destination,
            blocks: [...destination.blocks, copy],
          },
        },
      };
    });
  };

  const editBlock = (dateKey: DateKey, blockId: string, input: BlockEditInput) => {
    const targetDate = isValidDateKey(input.targetDate) ? input.targetDate : dateKey;

    setData((prev) => {
      const sourceDay = prev.days[dateKey] ?? createEmptyDay();
      const sourceIndex = sourceDay.blocks.findIndex((block) => block.id === blockId);
      if (sourceIndex < 0) {
        return prev;
      }

      const currentBlock = sourceDay.blocks[sourceIndex];
      const updatedBlock: TimeBlock = {
        ...currentBlock,
        title: input.title.trim(),
        description: normalizeDescription(input.description),
        category: normalizeCategory(input.category),
        durationMin: clampDuration(input.durationMin),
        startTime: input.startTime?.trim() ? input.startTime : null,
        actualDurationMin:
          input.actualDurationMin == null
            ? null
            : clampDuration(input.actualDurationMin),
        actualStartTime: input.actualStartTime?.trim()
          ? input.actualStartTime
          : null,
        color: input.color,
      };

      if (targetDate === dateKey) {
        const nextBlocks = [...sourceDay.blocks];
        nextBlocks[sourceIndex] = updatedBlock;

        return {
          ...prev,
          days: {
            ...prev.days,
            [dateKey]: {
              ...sourceDay,
              blocks: nextBlocks,
            },
          },
        };
      }

      const targetDay = prev.days[targetDate] ?? createEmptyDay();
      const movedBlock: TimeBlock = {
        ...updatedBlock,
        order: getNextOrder(targetDay.blocks),
      };

      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...sourceDay,
            blocks: sourceDay.blocks.filter((block) => block.id !== blockId),
          },
          [targetDate]: {
            ...targetDay,
            blocks: [...targetDay.blocks, movedBlock],
          },
        },
      };
    });
  };

  const moveBlock = (dateKey: DateKey, blockId: string, targetDate: DateKey) => {
    setData((prev) => {
      if (!isValidDateKey(targetDate)) {
        return prev;
      }

      const sourceDay = prev.days[dateKey] ?? createEmptyDay();
      const block = sourceDay.blocks.find((candidate) => candidate.id === blockId);
      if (!block || targetDate === dateKey) {
        return prev;
      }

      const destination = prev.days[targetDate] ?? createEmptyDay();
      const moved = {
        ...block,
        order: getNextOrder(destination.blocks),
      };

      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...sourceDay,
            blocks: sourceDay.blocks.filter((candidate) => candidate.id !== blockId),
          },
          [targetDate]: {
            ...destination,
            blocks: [...destination.blocks, moved],
          },
        },
      };
    });
  };

  const setBlockPlacement = (
    sourceDate: DateKey,
    blockId: string,
    targetDate: DateKey,
    startTime: string | null,
  ) => {
    setData((prev) => {
      if (!isValidDateKey(targetDate)) {
        return prev;
      }

      const sourceDay = prev.days[sourceDate] ?? createEmptyDay();
      const sourceBlock = sourceDay.blocks.find((block) => block.id === blockId);
      if (!sourceBlock) {
        return prev;
      }

      const normalizedStart = startTime?.trim() ? startTime : null;

      if (sourceDate === targetDate) {
        return {
          ...prev,
          days: {
            ...prev.days,
            [sourceDate]: {
              ...sourceDay,
              blocks: sourceDay.blocks.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      startTime: normalizedStart,
                    }
                  : block,
              ),
            },
          },
        };
      }

      const destination = prev.days[targetDate] ?? createEmptyDay();
      const movedBlock: TimeBlock = {
        ...sourceBlock,
        startTime: normalizedStart,
        order: getNextOrder(destination.blocks),
      };

      return {
        ...prev,
        days: {
          ...prev.days,
          [sourceDate]: {
            ...sourceDay,
            blocks: sourceDay.blocks.filter((block) => block.id !== blockId),
          },
          [targetDate]: {
            ...destination,
            blocks: [...destination.blocks, movedBlock],
          },
        },
      };
    });
  };

  const reorderUntimedBlock = (
    dateKey: DateKey,
    blockId: string,
    direction: -1 | 1,
  ) => {
    updateDay(dateKey, (day) => {
      const untimed = day.blocks
        .filter((block) => !block.startTime)
        .sort((a, b) => a.order - b.order);
      const currentIndex = untimed.findIndex((block) => block.id === blockId);
      const targetIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= untimed.length
      ) {
        return day;
      }

      const reordered = [...untimed];
      [reordered[currentIndex], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[currentIndex],
      ];

      const orderMap = new Map<string, number>();
      reordered.forEach((block, index) => orderMap.set(block.id, index));

      return {
        ...day,
        blocks: day.blocks.map((block) =>
          block.startTime
            ? block
            : { ...block, order: orderMap.get(block.id) ?? block.order },
        ),
      };
    });
  };

  const addTodo = (dateKey: DateKey, text: string, dueTime?: string | null) => {
    if (!text.trim()) {
      return;
    }

    updateDay(dateKey, (day) => ({
      ...day,
      todos: [
        ...day.todos,
        createTodo({
          text: text.trim(),
          dueTime: dueTime?.trim() ? dueTime : null,
          completed: false,
          order: getNextOrder(day.todos),
        }),
      ],
    }));
  };

  const toggleTodo = (dateKey: DateKey, todoId: string) => {
    const todo = getDayData(dateKey).todos.find((entry) => entry.id === todoId);
    const nextCompleted = todo ? !todo.completed : false;
    updateDay(dateKey, (day) => ({
      ...day,
      todos: day.todos.map((todo) =>
        todo.id === todoId ? { ...todo, completed: !todo.completed } : todo,
      ),
    }));
    if (todo) {
      void syncTodoistCompletion(todo, nextCompleted).catch((error) => {
        console.error(error);
      });
    }
  };

  const updateTodoText = (dateKey: DateKey, todoId: string, nextText: string) => {
    updateDay(dateKey, (day) => ({
      ...day,
      todos: day.todos.map((todo) =>
        todo.id === todoId ? { ...todo, text: nextText.trim() } : todo,
      ),
    }));
  };

  const deleteTodo = (dateKey: DateKey, todoId: string) => {
    updateDay(dateKey, (day) => ({
      ...day,
      todos: day.todos.filter((todo) => todo.id !== todoId),
    }));
  };

  const carryForwardTodo = (dateKey: DateKey, todoId: string) => {
    const nextDate = addDaysToDateKey(dateKey, 1);
    setData((prev) => {
      const currentDay = prev.days[dateKey] ?? createEmptyDay();
      const todo = currentDay.todos.find((candidate) => candidate.id === todoId);
      if (!todo) {
        return prev;
      }

      const nextDay = prev.days[nextDate] ?? createEmptyDay();
      const movedTodo = createTodo({
        text: todo.text,
        dueTime: todo.dueTime ?? null,
        completed: false,
        order: getNextOrder(nextDay.todos),
      });

      return {
        ...prev,
        days: {
          ...prev.days,
          [dateKey]: {
            ...currentDay,
            todos: currentDay.todos.filter((candidate) => candidate.id !== todoId),
          },
          [nextDate]: {
            ...nextDay,
            todos: [...nextDay.todos, movedTodo],
          },
        },
      };
    });
  };

  const moveTodoToDate = (
    sourceDate: DateKey,
    todoId: string,
    targetDate: DateKey,
  ) => {
    setData((prev) => {
      if (!isValidDateKey(targetDate)) {
        return prev;
      }

      const currentDay = prev.days[sourceDate] ?? createEmptyDay();
      const todo = currentDay.todos.find((candidate) => candidate.id === todoId);
      if (!todo) {
        return prev;
      }

      if (sourceDate === targetDate) {
        return {
          ...prev,
          days: {
            ...prev.days,
            [sourceDate]: {
              ...currentDay,
              todos: currentDay.todos.map((candidate) =>
                candidate.id === todoId
                  ? { ...candidate, completed: false }
                  : candidate,
              ),
            },
          },
        };
      }

      const destinationDay = prev.days[targetDate] ?? createEmptyDay();
      const movedTodo = createTodo({
        text: todo.text,
        dueTime: todo.dueTime ?? null,
        completed: false,
        order: getNextOrder(destinationDay.todos),
      });

      return {
        ...prev,
        days: {
          ...prev.days,
          [sourceDate]: {
            ...currentDay,
            todos: currentDay.todos.filter((candidate) => candidate.id !== todoId),
          },
          [targetDate]: {
            ...destinationDay,
            todos: [...destinationDay.todos, movedTodo],
          },
        },
      };
    });
  };

  const addWeeklyTask = (dateKey: DateKey, text: string) => {
    if (!text.trim()) {
      return;
    }

    const weekKey = weekKeyFor(dateKey);
    setData((prev) => {
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const current = weeklyBank[weekKey] ?? [];
      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [weekKey]: [
            ...current,
            createTodo({
              text: text.trim(),
              dueTime: null,
              completed: false,
              order: getNextOrder(current),
            }),
          ],
        },
      };
    });
  };

  const toggleWeeklyTask = (dateKey: DateKey, todoId: string) => {
    const todo = getWeeklyTasks(dateKey).find((entry) => entry.id === todoId);
    const nextCompleted = todo ? !todo.completed : false;
    const weekKey = weekKeyFor(dateKey);
    setData((prev) => {
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const current = weeklyBank[weekKey] ?? [];
      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [weekKey]: current.map((todo) =>
            todo.id === todoId ? { ...todo, completed: !todo.completed } : todo,
          ),
        },
      };
    });
    if (todo) {
      void syncTodoistCompletion(todo, nextCompleted).catch((error) => {
        console.error(error);
      });
    }
  };

  const deleteWeeklyTask = (dateKey: DateKey, todoId: string) => {
    const weekKey = weekKeyFor(dateKey);
    setData((prev) => {
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const current = weeklyBank[weekKey] ?? [];
      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [weekKey]: current.filter((todo) => todo.id !== todoId),
        },
      };
    });
  };

  const moveWeeklyTaskWithinBench = (
    dateKey: DateKey,
    todoId: string,
    targetTodoId: string,
  ) => {
    const weekKey = weekKeyFor(dateKey);
    setData((prev) => {
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const current = weeklyBank[weekKey] ?? [];
      const sorted = [...current].sort((a, b) => a.order - b.order);
      const sourceIndex = sorted.findIndex((todo) => todo.id === todoId);
      const targetIndex = sorted.findIndex((todo) => todo.id === targetTodoId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return prev;
      }

      const reordered = [...sorted];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const orderMap = new Map<string, number>();
      reordered.forEach((todo, index) => orderMap.set(todo.id, index));

      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [weekKey]: current.map((todo) => ({
            ...todo,
            order: orderMap.get(todo.id) ?? todo.order,
          })),
        },
      };
    });
  };

  const moveWeeklyTaskToDate = (
    weekDate: DateKey,
    todoId: string,
    targetDate: DateKey,
  ) => {
    if (!isValidDateKey(targetDate)) {
      return;
    }

    const weekKey = weekKeyFor(weekDate);
    setData((prev) => {
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const weekly = weeklyBank[weekKey] ?? [];
      const todo = weekly.find((candidate) => candidate.id === todoId);
      if (!todo) {
        return prev;
      }

      const target = prev.days[targetDate] ?? createEmptyDay();
      const moved: TodoItem = {
        ...todo,
        dueTime: null,
        completed: false,
        order: getNextOrder(target.todos),
      };

      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [weekKey]: weekly.filter((candidate) => candidate.id !== todoId),
        },
        days: {
          ...prev.days,
          [targetDate]: {
            ...target,
            todos: [...target.todos, moved],
          },
        },
      };
    });
  };

  const moveWeeklyTaskToNextWeekBench = (weekDate: DateKey, todoId: string) => {
    const sourceWeekKey = weekKeyFor(weekDate);
    const targetWeekKey = addDaysToDateKey(sourceWeekKey, 7);
    setData((prev) => {
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const source = weeklyBank[sourceWeekKey] ?? [];
      const todo = source.find((candidate) => candidate.id === todoId);
      if (!todo) {
        return prev;
      }
      const target = weeklyBank[targetWeekKey] ?? [];
      const moved: TodoItem = {
        ...todo,
        dueTime: null,
        completed: false,
        order: getNextOrder(target),
      };

      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [sourceWeekKey]: source.filter((candidate) => candidate.id !== todoId),
          [targetWeekKey]: [...target, moved],
        },
      };
    });
  };

  const importTodoistTaggedTasks = async (dateKey: DateKey) => {
    if (!todoistToken) {
      return 0;
    }

    const response = await fetch("https://api.todoist.com/rest/v2/tasks", {
      headers: {
        Authorization: `Bearer ${todoistToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Todoist import failed (${response.status})`);
    }

    type TodoistTask = {
      id: string | number;
      content: string;
      labels?: string[];
    };

    const tasks = (await response.json()) as TodoistTask[];
    const taggedTasks = tasks.filter((task) =>
      (task.labels ?? []).some((label) => label.toLowerCase() === "from-todoist"),
    );

    let added = 0;
    const weekKey = weekKeyFor(dateKey);
    setData((prev) => {
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const current = weeklyBank[weekKey] ?? [];

      const existingExternalIds = new Set<string>();
      Object.values(prev.weeklyTaskBank ?? {}).forEach((todos) => {
        todos.forEach((todo) => {
          if (todo.externalId) {
            existingExternalIds.add(todo.externalId);
          }
        });
      });
      Object.values(prev.days).forEach((day) => {
        day.todos.forEach((todo) => {
          if (todo.externalId) {
            existingExternalIds.add(todo.externalId);
          }
        });
      });

      const baseOrder = getNextOrder(current);
      const imported = taggedTasks
        .filter((task) => !existingExternalIds.has(String(task.id)))
        .map((task, index) =>
          createTodo({
            text: task.content.trim(),
            dueTime: null,
            completed: false,
            source: "todoist",
            externalId: String(task.id),
            labels: task.labels ?? [],
            order: baseOrder + index,
          }),
        );

      added = imported.length;

      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [weekKey]: [...current, ...imported],
        },
        todoist: {
          ...(prev.todoist ?? { apiToken: null, lastSyncAt: null }),
          lastSyncAt: new Date().toISOString(),
        },
      };
    });

    return added;
  };

  const moveTodoToWeeklyBank = (sourceDate: DateKey, todoId: string) => {
    const weekKey = weekKeyFor(sourceDate);
    setData((prev) => {
      const source = prev.days[sourceDate] ?? createEmptyDay();
      const todo = source.todos.find((candidate) => candidate.id === todoId);
      if (!todo) {
        return prev;
      }
      const weeklyBank = prev.weeklyTaskBank ?? {};
      const weekly = weeklyBank[weekKey] ?? [];
      const moved: TodoItem = {
        ...todo,
        dueTime: null,
        completed: false,
        order: getNextOrder(weekly),
      };

      return {
        ...prev,
        weeklyTaskBank: {
          ...weeklyBank,
          [weekKey]: [...weekly, moved],
        },
        days: {
          ...prev.days,
          [sourceDate]: {
            ...source,
            todos: source.todos.filter((candidate) => candidate.id !== todoId),
          },
        },
      };
    });
  };

  const moveBlockToWeeklyBench = (sourceDate: DateKey, blockId: string) => {
    const weekKey = weekKeyFor(sourceDate);
    setData((prev) => {
      const source = prev.days[sourceDate] ?? createEmptyDay();
      const block = source.blocks.find((candidate) => candidate.id === blockId);
      if (!block) {
        return prev;
      }
      const weeklyBank = prev.weeklyBlockBank ?? {};
      const weekly = weeklyBank[weekKey] ?? [];
      const moved: TimeBlock = {
        ...block,
        startTime: null,
        completed: false,
        actualDurationMin: null,
        actualStartTime: null,
        order: getNextOrder(weekly),
      };

      return {
        ...prev,
        weeklyBlockBank: {
          ...weeklyBank,
          [weekKey]: [...weekly, moved],
        },
        days: {
          ...prev.days,
          [sourceDate]: {
            ...source,
            blocks: source.blocks.filter((candidate) => candidate.id !== blockId),
          },
        },
      };
    });
  };

  const moveWeeklyBenchBlockToDate = (
    weekDate: DateKey,
    blockId: string,
    targetDate: DateKey,
  ) => {
    placeWeeklyBenchBlock(weekDate, blockId, targetDate, null);
  };

  const placeWeeklyBenchBlock = (
    weekDate: DateKey,
    blockId: string,
    targetDate: DateKey,
    startTime: string | null,
  ) => {
    if (!isValidDateKey(targetDate)) {
      return;
    }
    const weekKey = weekKeyFor(weekDate);
    setData((prev) => {
      const weeklyBank = prev.weeklyBlockBank ?? {};
      const weekly = weeklyBank[weekKey] ?? [];
      const block = weekly.find((candidate) => candidate.id === blockId);
      if (!block) {
        return prev;
      }

      const target = prev.days[targetDate] ?? createEmptyDay();
      const moved: TimeBlock = {
        ...block,
        startTime: startTime?.trim() ? startTime : null,
        completed: false,
        actualDurationMin: null,
        actualStartTime: null,
        order: getNextOrder(target.blocks),
      };

      return {
        ...prev,
        weeklyBlockBank: {
          ...weeklyBank,
          [weekKey]: weekly.filter((candidate) => candidate.id !== blockId),
        },
        days: {
          ...prev.days,
          [targetDate]: {
            ...target,
            blocks: [...target.blocks, moved],
          },
        },
      };
    });
  };

  const addTemplateToWeeklyBench = (
    weekDate: DateKey,
    templateId: string,
    durationMin?: number,
  ) => {
    const weekKey = weekKeyFor(weekDate);
    setData((prev) => {
      const template = prev.templates.find((candidate) => candidate.id === templateId);
      if (!template) {
        return prev;
      }

      const weeklyBank = prev.weeklyBlockBank ?? {};
      const weekly = weeklyBank[weekKey] ?? [];
      const block = createBlock({
        title: template.title,
        description: template.description,
        category: template.category,
        durationMin: clampDuration(durationMin ?? template.defaultDurationMin),
        startTime: null,
        actualDurationMin: null,
        actualStartTime: null,
        color: template.color,
        completed: false,
        source: "template",
        templateId: template.id,
        order: getNextOrder(weekly),
      });

      return {
        ...prev,
        weeklyBlockBank: {
          ...weeklyBank,
          [weekKey]: [...weekly, block],
        },
      };
    });
  };

  const reorderTodo = (dateKey: DateKey, todoId: string, direction: -1 | 1) => {
    updateDay(dateKey, (day) => {
      const sorted = [...day.todos].sort((a, b) => a.order - b.order);
      const currentIndex = sorted.findIndex((todo) => todo.id === todoId);
      const targetIndex = currentIndex + direction;

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
        return day;
      }

      [sorted[currentIndex], sorted[targetIndex]] = [
        sorted[targetIndex],
        sorted[currentIndex],
      ];

      const orderMap = new Map<string, number>();
      sorted.forEach((todo, index) => orderMap.set(todo.id, index));

      return {
        ...day,
        todos: day.todos.map((todo) => ({
          ...todo,
          order: orderMap.get(todo.id) ?? todo.order,
        })),
      };
    });
  };

  const moveTodoWithinDay = (
    dateKey: DateKey,
    todoId: string,
    targetTodoId: string,
  ) => {
    updateDay(dateKey, (day) => {
      const sorted = [...day.todos].sort((a, b) => a.order - b.order);
      const sourceIndex = sorted.findIndex((todo) => todo.id === todoId);
      const targetIndex = sorted.findIndex((todo) => todo.id === targetTodoId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return day;
      }

      const reordered = [...sorted];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const orderMap = new Map<string, number>();
      reordered.forEach((todo, index) => orderMap.set(todo.id, index));

      return {
        ...day,
        todos: day.todos.map((todo) => ({
          ...todo,
          order: orderMap.get(todo.id) ?? todo.order,
        })),
      };
    });
  };

  const setTopPriority = (dateKey: DateKey, index: 0 | 1 | 2, value: string) => {
    updateDay(dateKey, (day) => {
      const next = [...day.topPriorities] as [string, string, string];
      next[index] = value;
      return {
        ...day,
        topPriorities: next,
      };
    });
  };

  const addHabit = (name: string, category: string) => {
    if (!name.trim()) {
      return;
    }

    setData((prev) => ({
      ...prev,
      habits: [
        ...prev.habits,
        createHabit({
          name: name.trim(),
          category: category.trim(),
          archivedAt: null,
          order: getNextOrder(prev.habits.filter((habit) => !habit.archivedAt)),
        }),
      ],
    }));
  };

  const updateHabit = (habitId: string, name: string, category: string) => {
    setData((prev) => ({
      ...prev,
      habits: prev.habits.map((habit) =>
        habit.id === habitId
          ? { ...habit, name: name.trim(), category: category.trim() }
          : habit,
      ),
    }));
  };

  const deleteHabit = (habitId: string) => {
    setData((prev) => ({
      ...prev,
      habits: prev.habits.map((habit) =>
        habit.id === habitId && !habit.archivedAt
          ? { ...habit, archivedAt: new Date().toISOString() }
          : habit,
      ),
    }));
  };

  const reorderHabit = (habitId: string, direction: -1 | 1) => {
    setData((prev) => {
      const sorted = [...prev.habits]
        .filter((habit) => !habit.archivedAt)
        .sort((a, b) => a.order - b.order);
      const currentIndex = sorted.findIndex((habit) => habit.id === habitId);
      const targetIndex = currentIndex + direction;

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
        return prev;
      }

      [sorted[currentIndex], sorted[targetIndex]] = [
        sorted[targetIndex],
        sorted[currentIndex],
      ];

      const orderMap = new Map<string, number>();
      sorted.forEach((habit, index) => orderMap.set(habit.id, index));

      return {
        ...prev,
        habits: prev.habits.map((habit) => ({
          ...habit,
          order: orderMap.get(habit.id) ?? habit.order,
        })),
      };
    });
  };

  const toggleHabitCheck = (dateKey: DateKey, habitId: string) => {
    updateDay(dateKey, (day) => {
      const nextChecks = { ...day.habitChecks };
      const nextValue = !nextChecks[habitId];

      if (nextValue) {
        nextChecks[habitId] = true;
      } else {
        delete nextChecks[habitId];
      }

      return {
        ...day,
        habitChecks: nextChecks,
      };
    });
  };

  const sortedTemplates = useMemo(
    () =>
      [...data.templates].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
    [data.templates],
  );

  const sortedHabits = useMemo(
    () =>
      [...data.habits]
        .filter((habit) => !habit.archivedAt)
        .sort((a, b) => a.order - b.order),
    [data.habits],
  );

  return {
    version: data.version,
    templates: sortedTemplates,
    habits: sortedHabits,
    todoistConnected: Boolean(todoistToken),
    setTodoistApiToken,
    importTodoistTaggedTasks,
    getHabitsForWeek,
    getDayData,
    getWeeklyTasks,
    getWeeklyPlannedBlocks,
    addOneTimeBlock,
    createReusableTemplate,
    scheduleTemplate,
    updateTemplate,
    deleteTemplate,
    toggleBlockComplete,
    deleteBlock,
    duplicateBlock,
    editBlock,
    moveBlock,
    setBlockPlacement,
    reorderUntimedBlock,
    addTodo,
    addWeeklyTask,
    toggleWeeklyTask,
    deleteWeeklyTask,
    moveWeeklyTaskWithinBench,
    moveWeeklyTaskToDate,
    moveWeeklyTaskToNextWeekBench,
    moveTodoToWeeklyBank,
    moveBlockToWeeklyBench,
    moveWeeklyBenchBlockToDate,
    addTemplateToWeeklyBench,
    placeWeeklyBenchBlock,
    toggleTodo,
    updateTodoText,
    deleteTodo,
    carryForwardTodo,
    moveTodoToDate,
    reorderTodo,
    moveTodoWithinDay,
    setTopPriority,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabit,
    toggleHabitCheck,
  };
};
