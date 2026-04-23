import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BlockEditInput,
  DailyData,
  DateKey,
  Habit,
  OneTimeBlockInput,
  ReusableTemplateInput,
  ScheduleTemplateInput,
  TimeBlock,
  TodoistTaskOption,
  TodoItem,
  TimeBlockTemplate,
} from "../types";
import { formatShortWeekdayLabel } from "../utils/date";
import { blockEndLabel, formatDuration, timeToMinutes } from "../utils/format";
import { SectionCard } from "./SectionCard";

interface WeekBlocksBoardProps {
  selectedDate: DateKey;
  weekDates: DateKey[];
  templates: TimeBlockTemplate[];
  habits: Habit[];
  weeklyTasks: TodoItem[];
  weeklyPlannedBlocks: TimeBlock[];
  getDayData: (dateKey: DateKey) => DailyData;
  onSelectDate: (dateKey: DateKey) => void;
  onAddOneTimeBlock: (dateKey: DateKey, input: OneTimeBlockInput) => void;
  onScheduleTemplate: (
    dateKey: DateKey,
    templateId: string,
    input?: ScheduleTemplateInput,
  ) => void;
  onToggleComplete: (dateKey: DateKey, blockId: string) => void;
  onDeleteBlock: (dateKey: DateKey, blockId: string) => void;
  onEditBlock: (dateKey: DateKey, blockId: string, input: BlockEditInput) => void;
  onToggleHabit: (dateKey: DateKey, habitId: string) => void;
  onAddHabit: (name: string, category: string) => void;
  onRenameHabit: (habitId: string, name: string, category: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onCreateReusableTemplate: (input: ReusableTemplateInput) => void;
  onDeleteTemplate: (templateId: string) => void;
  onUpdateTemplate: (
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
  ) => void;
  onMoveBlockPlacement: (
    sourceDate: DateKey,
    blockId: string,
    targetDate: DateKey,
    startTime: string | null,
  ) => void;
  onAddTodo: (dateKey: DateKey, text: string, dueTime?: string | null) => void;
  onAddWeeklyTask: (dateKey: DateKey, text: string) => void;
  onToggleWeeklyTask: (dateKey: DateKey, todoId: string) => void;
  onDeleteWeeklyTask: (dateKey: DateKey, todoId: string) => void;
  onMoveWeeklyTaskWithinBench: (
    dateKey: DateKey,
    todoId: string,
    targetTodoId: string,
  ) => void;
  onMoveWeeklyTaskToDate: (
    weekDate: DateKey,
    todoId: string,
    targetDate: DateKey,
  ) => void;
  onMoveWeeklyTaskToNextWeekBench: (weekDate: DateKey, todoId: string) => void;
  onMoveTodoToBench: (sourceDate: DateKey, todoId: string) => void;
  onMoveTodoToDate: (
    sourceDate: DateKey,
    todoId: string,
    targetDate: DateKey,
  ) => void;
  onMoveBlockToBench: (sourceDate: DateKey, blockId: string) => void;
  onMoveBenchBlockToDate: (
    weekDate: DateKey,
    blockId: string,
    targetDate: DateKey,
  ) => void;
  onPlaceBenchBlock: (
    weekDate: DateKey,
    blockId: string,
    targetDate: DateKey,
    startTime: string | null,
  ) => void;
  onAddTemplateToBench: (
    weekDate: DateKey,
    templateId: string,
    durationMin?: number,
  ) => void;
  onToggleTodo: (dateKey: DateKey, todoId: string) => void;
  onMoveTodoWithinDay: (
    dateKey: DateKey,
    todoId: string,
    targetTodoId: string,
  ) => void;
  onCarryForwardTodo: (dateKey: DateKey, todoId: string) => void;
  todoistConnected: boolean;
  onSetTodoistToken: (token: string | null) => void;
  onFetchTodoistTasks: () => Promise<TodoistTaskOption[]>;
  onImportSelectedTodoistTasks: (
    dateKey: DateKey,
    tasks: TodoistTaskOption[],
  ) => Promise<number>;
}

const parsePositive = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
};

const sortBlocks = (blocks: TimeBlock[]) =>
  [...blocks].sort((a, b) => {
    if (a.startTime && b.startTime) {
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    }
    if (a.startTime) {
      return -1;
    }
    if (b.startTime) {
      return 1;
    }
    return a.order - b.order;
  });

const sortTodos = (todos: TodoItem[]) =>
  [...todos].sort((a, b) => a.order - b.order);

const normalizeCategoryLabel = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) {
    return "General";
  }
  return cleaned
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};

const habitEmoji = (name: string) => {
  const value = name.toLowerCase();
  if (value.includes("water")) return "💧";
  if (value.includes("meditat")) return "🧘‍♀️";
  if (value.includes("walk") || value.includes("sunlight")) return "🚶‍♀️";
  if (value.includes("exercise")) return "💪";
  if (value.includes("sauna")) return "🔥";
  if (value.includes("shower")) return "🚿";
  if (value.includes("piano")) return "🎹";
  if (value.includes("breakfast")) return "🍳";
  if (value.includes("creatine")) return "❄️";
  if (value.includes("supplement")) return "💊";
  if (value.includes("skin") || value.includes("retinol") || value.includes("spf"))
    return "🧴";
  if (value.includes("teeth") || value.includes("brush")) return "🪥";
  if (value.includes("journal") || value.includes("affirmation"))
    return "📓";
  if (value.includes("read")) return "📚";
  if (value.includes("stretch")) return "🧎‍♀️";
  if (value.includes("moisturizer")) return "🧴";
  if (value.includes("minoxodil")) return "🧴";
  return "✅";
};

void habitEmoji;
const habitEmojiVisual = (name: string) => {
  const value = name.toLowerCase();
  if (value.includes("water")) return "\u{1F4A7}";
  if (value.includes("meditat")) return "\u{1F9D8}";
  if (value.includes("walk") || value.includes("sunlight")) return "\u{1F6B6}";
  if (value.includes("exercise")) return "\u{1F4AA}";
  if (value.includes("sauna")) return "\u{1F525}";
  if (value.includes("shower")) return "\u{1F6BF}";
  if (value.includes("piano")) return "\u{1F3B9}";
  if (value.includes("breakfast")) return "\u{1F373}";
  if (value.includes("creatine")) return "\u{2744}\u{FE0F}";
  if (value.includes("supplement")) return "\u{1F48A}";
  if (value.includes("skin") || value.includes("retinol") || value.includes("spf"))
    return "\u{1F9F4}";
  if (value.includes("teeth") || value.includes("brush")) return "\u{1FAA5}";
  if (value.includes("journal") || value.includes("affirmation")) return "\u{1F4D3}";
  if (value.includes("read")) return "\u{1F4DA}";
  if (value.includes("stretch")) return "\u{1F938}";
  if (value.includes("moisturizer")) return "\u{1F9F4}";
  if (value.includes("minoxodil")) return "\u{1F9F4}";
  return "\u{2705}";
};

const toTwemojiCodepoint = (emoji: string) =>
  Array.from(emoji)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter((codepoint): codepoint is string => Boolean(codepoint))
    .filter((codepoint) => codepoint !== "fe0f")
    .join("-");

const HabitEmojiIcon = ({
  emoji,
  className,
}: {
  emoji: string;
  className: string;
}) => (
  <img
    src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${toTwemojiCodepoint(
      emoji,
    )}.svg`}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={className}
  />
);

const toRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((part) => part + part)
          .join("")
      : clean;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return `rgba(248, 179, 207, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CALENDAR_START_HOUR = 6;
const CALENDAR_END_HOUR = 23;
const BASE_PIXELS_PER_MIN = 0.42;
const BENCH_MIN_BLOCK_HEIGHT_PX = 24;
const DRAG_SNAP_MINUTES = 5;
const EDGE_SNAP_THRESHOLD_MINUTES = 12;
const MIN_RESIZE_DURATION_MIN = 5;
const CALENDAR_RANGE_MIN = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60;
const DRAG_TEMPLATE_KEY = "timebloxx/template-id";
const DRAG_BLOCK_KEY = "timebloxx/block-ref";
const DRAG_TODO_KEY = "timebloxx/todo-ref";

type DraggedBlockRef =
  | {
      source: "day";
      sourceDate: DateKey;
      blockId: string;
      dragOffsetMin?: number;
    }
  | {
      source: "bench";
      blockId: string;
    };

type DraggedTodoRef =
  | {
      source: "bench";
      todoId: string;
    }
  | {
      source: "day";
      sourceDate: DateKey;
      todoId: string;
    };

type ResizeEdge = "top" | "bottom";

type ResizeState = {
  dateKey: DateKey;
  blockId: string;
  edge: ResizeEdge;
  originClientY: number;
  originStartMin: number;
  originDurationMin: number;
  blockSnapshot: TimeBlock;
};

const hourTicks = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
  (_, index) => CALENDAR_START_HOUR + index,
);

const toHourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const toTimeString = (totalMinutes: number) => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const WeekBlocksBoard = ({
  selectedDate,
  weekDates,
  templates,
  habits,
  weeklyTasks,
  weeklyPlannedBlocks,
  getDayData,
  onSelectDate,
  onAddOneTimeBlock,
  onScheduleTemplate,
  onToggleComplete,
  onDeleteBlock,
  onEditBlock,
  onToggleHabit,
  onAddHabit,
  onRenameHabit,
  onDeleteHabit,
  onCreateReusableTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  onMoveBlockPlacement,
  onAddTodo,
  onAddWeeklyTask,
  onToggleWeeklyTask,
  onDeleteWeeklyTask,
  onMoveWeeklyTaskWithinBench,
  onMoveWeeklyTaskToDate,
  onMoveWeeklyTaskToNextWeekBench,
  onMoveTodoToBench,
  onMoveTodoToDate,
  onMoveBlockToBench,
  onMoveBenchBlockToDate,
  onPlaceBenchBlock,
  onAddTemplateToBench,
  onToggleTodo,
  onMoveTodoWithinDay,
  onCarryForwardTodo,
  todoistConnected,
  onSetTodoistToken,
  onFetchTodoistTasks,
  onImportSelectedTodoistTasks,
}: WeekBlocksBoardProps) => {
  const [quickTargetDate, setQuickTargetDate] = useState<DateKey>(selectedDate);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickCategory, setQuickCategory] = useState("General");
  const [quickDuration, setQuickDuration] = useState("45");
  const [quickStart, setQuickStart] = useState("");
  const [quickTodoDate, setQuickTodoDate] = useState<string>("bench");
  const [quickTodoText, setQuickTodoText] = useState("");
  const [draggedTemplateId, setDraggedTemplateId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.6);
  const [activeAddForm, setActiveAddForm] = useState<"task" | "timeblock" | null>(
    null,
  );
  const [isPresetBlocksOpen, setIsPresetBlocksOpen] = useState(false);
  const [openTemplateMenuId, setOpenTemplateMenuId] = useState<string | null>(null);
  const [openBlockMenuKey, setOpenBlockMenuKey] = useState<string | null>(null);
  const [openDescriptionKey, setOpenDescriptionKey] = useState<string | null>(null);
  const [openHabitMenuId, setOpenHabitMenuId] = useState<string | null>(null);
  const [isStatsMenuOpen, setIsStatsMenuOpen] = useState(false);
  const [visibleStatCategories, setVisibleStatCategories] = useState<string[]>([
    "Exercise",
  ]);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    startMin: number;
    durationMin: number;
  } | null>(null);
  const [todoistPickerOpen, setTodoistPickerOpen] = useState(false);
  const [todoistLoading, setTodoistLoading] = useState(false);
  const [todoistError, setTodoistError] = useState<string | null>(null);
  const [todoistTasks, setTodoistTasks] = useState<TodoistTaskOption[]>([]);
  const [selectedTodoistTaskIds, setSelectedTodoistTaskIds] = useState<string[]>([]);
  const quickTaskInputRef = useRef<HTMLInputElement | null>(null);

  const weekData = useMemo(
    () =>
      weekDates.map((dateKey) => {
        const day = getDayData(dateKey);
        const blocks = sortBlocks(day.blocks);
        const todos = sortTodos(day.todos);
        const timedBlocks = blocks.filter((block) => block.startTime);
        const untimedBlocks = blocks.filter((block) => !block.startTime);
        return {
          dateKey,
          blocks,
          todos,
          timedBlocks,
          untimedBlocks,
          habitChecks: day.habitChecks,
        };
      }),
    [getDayData, weekDates],
  );

  const resolvedQuickTarget = weekDates.includes(quickTargetDate)
    ? quickTargetDate
    : selectedDate;
  const resolvedQuickTodoDate: DateKey | null = weekDates.includes(
    quickTodoDate as DateKey,
  )
    ? (quickTodoDate as DateKey)
    : null;
  const pixelsPerMin = BASE_PIXELS_PER_MIN * zoom;
  const calendarHeight = CALENDAR_RANGE_MIN * pixelsPerMin;
  const benchBlockSlots = useMemo(() => {
    let visualCursor = 0;
    return weeklyPlannedBlocks
      .map((block) => {
        const proportionalHeight = block.durationMin * pixelsPerMin;
        const height = Math.max(BENCH_MIN_BLOCK_HEIGHT_PX, proportionalHeight);
        const top = visualCursor;
        visualCursor += height;
        if (top >= calendarHeight) {
          return null;
        }
        const visibleHeight = Math.min(height, calendarHeight - top);
        return {
          block,
          top,
          height: visibleHeight,
        };
      })
      .filter((entry): entry is { block: TimeBlock; top: number; height: number } =>
        Boolean(entry),
      );
  }, [weeklyPlannedBlocks, pixelsPerMin, calendarHeight]);
  const categoryStats = useMemo(() => {
    const totals = new Map<
      string,
      { category: string; planned: number; completed: number }
    >();
    weekData.forEach((day) => {
      day.blocks.forEach((block) => {
        const category = normalizeCategoryLabel(block.category ?? "General");
        const key = category.toLowerCase();
        const current = totals.get(key) ?? {
          category,
          planned: 0,
          completed: 0,
        };
        current.planned += block.durationMin;
        if (block.completed) {
          current.completed += block.actualDurationMin ?? block.durationMin;
        }
        totals.set(key, current);
      });
    });

    return [...totals.values()].sort((a, b) => b.planned - a.planned);
  }, [weekData]);
  const statCategoryOptions = useMemo(() => {
    const categories = new Set(categoryStats.map((stat) => stat.category));
    categories.add(normalizeCategoryLabel("Exercise"));
    return [...categories];
  }, [categoryStats]);
  const visibleStats = useMemo(
    () =>
      visibleStatCategories.map((category) => {
        const found = categoryStats.find(
          (stat) => stat.category.toLowerCase() === category.toLowerCase(),
        );
        return (
          found ?? {
            category,
            planned: 0,
            completed: 0,
          }
        );
      }),
    [categoryStats, visibleStatCategories],
  );
  const maxVisibleStatMinutes = useMemo(() => {
    const values = visibleStats.flatMap((stat) => [stat.planned, stat.completed]);
    return Math.max(1, ...values);
  }, [visibleStats]);

  const knownTodoistExternalIds = useMemo(() => {
    const ids = new Set<string>();
    weeklyTasks.forEach((task) => {
      if (task.externalId) {
        ids.add(task.externalId);
      }
    });
    weekData.forEach((day) => {
      day.todos.forEach((todo) => {
        if (todo.externalId) {
          ids.add(todo.externalId);
        }
      });
    });
    return ids;
  }, [weekData, weeklyTasks]);

  const todoistTasksGroupedByTag = useMemo(() => {
    const grouped = new Map<string, TodoistTaskOption[]>();
    todoistTasks.forEach((task) => {
      const labels = task.labels.length > 0 ? task.labels : ["No tag"];
      labels.forEach((label) => {
        const key = label.trim() || "No tag";
        const current = grouped.get(key) ?? [];
        current.push(task);
        grouped.set(key, current);
      });
    });
    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, tasks]) => ({
        tag,
        tasks: tasks.sort((a, b) => a.content.localeCompare(b.content)),
      }));
  }, [todoistTasks]);

  const toggleVisibleCategory = (category: string) => {
    setVisibleStatCategories((previous) =>
      previous.some((entry) => entry.toLowerCase() === category.toLowerCase())
        ? previous.filter((entry) => entry.toLowerCase() !== category.toLowerCase())
        : [...previous, category],
    );
  };

  const toggleHabitMenu = (habitId: string) => {
    setOpenHabitMenuId((previous) => (previous === habitId ? null : habitId));
  };

  const handleAddHabit = () => {
    const nameAnswer = window.prompt("New habit name");
    if (!nameAnswer) {
      return;
    }
    const categoryAnswer = window.prompt("Habit category", "General");
    onAddHabit(nameAnswer.trim(), categoryAnswer?.trim() || "General");
  };

  const handleRenameHabit = (habit: Habit) => {
    const nameAnswer = window.prompt("Rename habit", habit.name);
    if (nameAnswer === null) {
      return;
    }
    const nextName = nameAnswer.trim();
    if (!nextName) {
      window.alert("Habit name cannot be empty.");
      return;
    }
    onRenameHabit(habit.id, nextName, habit.category);
    setOpenHabitMenuId(null);
  };

  const handleDeleteHabit = (habit: Habit) => {
    const shouldDelete = window.confirm(`Delete habit "${habit.name}"?`);
    if (!shouldDelete) {
      return;
    }
    onDeleteHabit(habit.id);
    setOpenHabitMenuId(null);
  };

  const handleQuickAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!quickTitle.trim()) {
      return;
    }
    const duration = parsePositive(quickDuration);
    if (!duration) {
      return;
    }
    onAddOneTimeBlock(resolvedQuickTarget, {
      title: quickTitle.trim(),
      description: "",
      category: quickCategory.trim() || "General",
      durationMin: duration,
      startTime: quickStart.trim() || null,
      color: "#f8a6bf",
    });
    setQuickTitle("");
    setQuickStart("");
  };

  const handleQuickTodoAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!quickTodoText.trim()) {
      return;
    }
    if (quickTodoDate === "bench") {
      onAddWeeklyTask(selectedDate, quickTodoText.trim());
    } else if (resolvedQuickTodoDate) {
      onAddTodo(resolvedQuickTodoDate, quickTodoText.trim(), null);
    }
    setQuickTodoText("");
    requestAnimationFrame(() => {
      quickTaskInputRef.current?.focus();
    });
  };

  const handleConnectTodoist = () => {
    const entered = window.prompt(
      "Paste Todoist API token",
      "",
    );
    if (entered === null) {
      return;
    }
    onSetTodoistToken(entered.trim() || null);
  };

  const handleImportTodoist = async () => {
    setTodoistLoading(true);
    setTodoistError(null);
    try {
      const tasks = await onFetchTodoistTasks();
      setTodoistTasks(tasks);
      const selectableIds = tasks
        .filter((task) => !knownTodoistExternalIds.has(task.id))
        .map((task) => task.id);
      setSelectedTodoistTaskIds(selectableIds);
      setTodoistPickerOpen(true);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Could not import from Todoist. Check token and network.";
      setTodoistError(message);
    } finally {
      setTodoistLoading(false);
    }
  };

  const toggleTodoistTaskSelection = (taskId: string) => {
    setSelectedTodoistTaskIds((previous) =>
      previous.includes(taskId)
        ? previous.filter((id) => id !== taskId)
        : [...previous, taskId],
    );
  };

  const selectAllTodoistTasks = () => {
    setSelectedTodoistTaskIds(
      todoistTasks
        .filter((task) => !knownTodoistExternalIds.has(task.id))
        .map((task) => task.id),
    );
  };

  const clearTodoistTaskSelection = () => {
    setSelectedTodoistTaskIds([]);
  };

  const handleImportSelectedTodoistTasks = async () => {
    const selected = todoistTasks.filter((task) =>
      selectedTodoistTaskIds.includes(task.id),
    );
    if (selected.length === 0) {
      window.alert("Select at least one Todoist task to import.");
      return;
    }

    setTodoistLoading(true);
    setTodoistError(null);
    try {
      const imported = await onImportSelectedTodoistTasks(selectedDate, selected);
      window.alert(
        imported > 0
          ? `Imported ${imported} Todoist task${imported === 1 ? "" : "s"}.`
          : "Selected tasks were already imported.",
      );
      setTodoistPickerOpen(false);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Could not import selected Todoist tasks.";
      setTodoistError(message);
      window.alert(message);
    } finally {
      setTodoistLoading(false);
    }
  };

  useEffect(() => {
    if (activeAddForm === "task") {
      requestAnimationFrame(() => {
        quickTaskInputRef.current?.focus();
      });
    }
  }, [activeAddForm]);

  const getBlockGeometry = (block: TimeBlock) => {
    if (!block.startTime) {
      return null;
    }
    const startFromMidnight = timeToMinutes(block.startTime);
    const start = startFromMidnight - CALENDAR_START_HOUR * 60;
    const end = start + block.durationMin;
    const visibleStart = Math.max(0, start);
    const visibleEnd = Math.min(CALENDAR_RANGE_MIN, end);
    if (visibleEnd <= 0 || visibleStart >= CALENDAR_RANGE_MIN) {
      return null;
    }
    const top = visibleStart * pixelsPerMin;
    const height = (visibleEnd - visibleStart) * pixelsPerMin;
    return { top, height };
  };

  const getGeometryFromMinutes = (startMin: number, durationMin: number) => {
    const end = startMin + durationMin;
    const visibleStart = Math.max(0, startMin);
    const visibleEnd = Math.min(CALENDAR_RANGE_MIN, end);
    if (visibleEnd <= 0 || visibleStart >= CALENDAR_RANGE_MIN) {
      return null;
    }
    const top = visibleStart * pixelsPerMin;
    const height = (visibleEnd - visibleStart) * pixelsPerMin;
    return { top, height };
  };

  const createBlockAt = (dateKey: DateKey, startTime: string | null) => {
    const titleAnswer = window.prompt("New block name");
    if (!titleAnswer) {
      return;
    }

    const durationAnswer = window.prompt("Block length in minutes", "45");
    if (!durationAnswer) {
      return;
    }
    const duration = parsePositive(durationAnswer);
    if (!duration) {
      window.alert("Length must be a positive number of minutes.");
      return;
    }

    const categoryAnswer = window.prompt("Category", "General");
    const category = categoryAnswer?.trim() || "General";
    const description = window.prompt("Description (optional)", "")?.trim() ?? "";

    onAddOneTimeBlock(dateKey, {
      title: titleAnswer.trim(),
      description,
      category,
      durationMin: duration,
      startTime,
      color: "#f8a6bf",
    });
  };

  const getSnappedStartTime = (
    dateKey: DateKey,
    rawMinuteFromStart: number,
    ignoreBlock?: { sourceDate: DateKey; blockId: string },
  ) => {
    const boundedMinute = Math.max(
      0,
      Math.min(CALENDAR_RANGE_MIN, rawMinuteFromStart),
    );
    let snappedMinute =
      Math.round(boundedMinute / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;

    const day = weekData.find((entry) => entry.dateKey === dateKey);
    const edgeAnchors = (day?.timedBlocks ?? [])
      .filter((block) => {
        if (!block.startTime) {
          return false;
        }
        if (!ignoreBlock) {
          return true;
        }
        return !(ignoreBlock.sourceDate === dateKey && ignoreBlock.blockId === block.id);
      })
      .flatMap((block) => {
        const start = timeToMinutes(block.startTime!) - CALENDAR_START_HOUR * 60;
        const end = start + block.durationMin;
        return [start, end];
      });

    let closestAnchor: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    edgeAnchors.forEach((anchor) => {
      const distance = Math.abs(anchor - boundedMinute);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestAnchor = anchor;
      }
    });

    if (closestAnchor !== null && closestDistance <= EDGE_SNAP_THRESHOLD_MINUTES) {
      snappedMinute = closestAnchor;
    }

    const clampedMinute = Math.max(0, Math.min(CALENDAR_RANGE_MIN, snappedMinute));
    const absoluteMinutes = CALENDAR_START_HOUR * 60 + clampedMinute;
    return toTimeString(absoluteMinutes);
  };

  const handleDropTemplateOnDay = (
    event: React.DragEvent<HTMLElement>,
    dateKey: DateKey,
  ) => {
    event.preventDefault();
    const blockRaw = event.dataTransfer.getData(DRAG_BLOCK_KEY);
    if (blockRaw) {
      try {
        const blockRef = JSON.parse(blockRaw) as DraggedBlockRef;
        if (blockRef.source === "day" && blockRef.blockId && blockRef.sourceDate) {
          onMoveBlockPlacement(blockRef.sourceDate, blockRef.blockId, dateKey, null);
          setDraggedTemplateId(null);
          return;
        }
      } catch {
        // ignore invalid dragged payload
      }
    }

    const templateId =
      event.dataTransfer.getData(DRAG_TEMPLATE_KEY) || draggedTemplateId;
    if (!templateId) {
      return;
    }
    onScheduleTemplate(dateKey, templateId);
    setDraggedTemplateId(null);
  };

  const handleDropTemplateOnTime = (
    event: React.DragEvent<HTMLDivElement>,
    dateKey: DateKey,
  ) => {
    event.preventDefault();
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const minuteFromStart = Math.floor(offsetY / pixelsPerMin);
    const dropStart = getSnappedStartTime(dateKey, minuteFromStart);

    const blockRaw = event.dataTransfer.getData(DRAG_BLOCK_KEY);
    if (blockRaw) {
      try {
        const blockRef = JSON.parse(blockRaw) as DraggedBlockRef;
        if (blockRef.source === "day" && blockRef.blockId && blockRef.sourceDate) {
          const adjustedMinuteFromStart = Math.max(
            0,
            minuteFromStart - (blockRef.dragOffsetMin ?? 0),
          );
          const adjustedStart = getSnappedStartTime(dateKey, adjustedMinuteFromStart, {
            sourceDate: blockRef.sourceDate,
            blockId: blockRef.blockId,
          });
          onMoveBlockPlacement(
            blockRef.sourceDate,
            blockRef.blockId,
            dateKey,
            adjustedStart,
          );
          setDraggedTemplateId(null);
          return;
        }
        if (blockRef.source === "bench" && blockRef.blockId) {
          onPlaceBenchBlock(selectedDate, blockRef.blockId, dateKey, dropStart);
          setDraggedTemplateId(null);
          return;
        }
      } catch {
        // ignore invalid dragged payload
      }
    }

    const templateId =
      event.dataTransfer.getData(DRAG_TEMPLATE_KEY) || draggedTemplateId;
    if (!templateId) {
      return;
    }
    onScheduleTemplate(dateKey, templateId, {
      startTime: dropStart,
    });
    setDraggedTemplateId(null);
  };

  const createTimedBlockFromPointer = (
    event: React.MouseEvent<HTMLDivElement>,
    dateKey: DateKey,
  ) => {
    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const minuteFromStart = Math.floor(offsetY / pixelsPerMin);
    const startTime = getSnappedStartTime(dateKey, minuteFromStart);
    createBlockAt(dateKey, startTime);
  };

  const startResize = (
    event: React.MouseEvent<HTMLDivElement>,
    dateKey: DateKey,
    block: TimeBlock,
    edge: ResizeEdge,
  ) => {
    if (!block.startTime) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const originStartMin = timeToMinutes(block.startTime) - CALENDAR_START_HOUR * 60;
    setResizeState({
      dateKey,
      blockId: block.id,
      edge,
      originClientY: event.clientY,
      originStartMin,
      originDurationMin: block.durationMin,
      blockSnapshot: block,
    });
    setResizePreview({
      startMin: originStartMin,
      durationMin: block.durationMin,
    });
  };

  useEffect(() => {
    if (!resizeState) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      const deltaPx = event.clientY - resizeState.originClientY;
      const rawDeltaMin = deltaPx / pixelsPerMin;
      const snappedDeltaMin =
        Math.round(rawDeltaMin / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;

      if (resizeState.edge === "bottom") {
        const durationMin = Math.max(
          MIN_RESIZE_DURATION_MIN,
          resizeState.originDurationMin + snappedDeltaMin,
        );
        setResizePreview({
          startMin: resizeState.originStartMin,
          durationMin,
        });
        return;
      }

      const originEndMin = resizeState.originStartMin + resizeState.originDurationMin;
      const nextStartMin = Math.max(
        0,
        Math.min(originEndMin - MIN_RESIZE_DURATION_MIN, resizeState.originStartMin + snappedDeltaMin),
      );
      const nextDurationMin = Math.max(
        MIN_RESIZE_DURATION_MIN,
        originEndMin - nextStartMin,
      );
      setResizePreview({
        startMin: nextStartMin,
        durationMin: nextDurationMin,
      });
    };

    const handleUp = () => {
      if (resizePreview) {
        const startTime = toTimeString(
          CALENDAR_START_HOUR * 60 + resizePreview.startMin,
        );
        const block = resizeState.blockSnapshot;
        onEditBlock(resizeState.dateKey, resizeState.blockId, {
          title: block.title,
          description: block.description,
          category: block.category,
          durationMin: resizePreview.durationMin,
          startTime,
          actualDurationMin: block.actualDurationMin,
          actualStartTime: block.actualStartTime,
          color: block.color,
          targetDate: resizeState.dateKey,
        });
      }
      setResizeState(null);
      setResizePreview(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onEditBlock, pixelsPerMin, resizePreview, resizeState]);

  const handleDropTodoToBench = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const todoRaw = event.dataTransfer.getData(DRAG_TODO_KEY);
    if (!todoRaw) {
      return;
    }
    try {
      const todoRef = JSON.parse(todoRaw) as DraggedTodoRef;
      if (todoRef.source === "day") {
        onMoveTodoToBench(todoRef.sourceDate, todoRef.todoId);
      }
    } catch {
      // ignore invalid payload
    }
  };

  const handleDropBlockToBench = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const blockRaw = event.dataTransfer.getData(DRAG_BLOCK_KEY);
    if (!blockRaw) {
      return;
    }
    try {
      const blockRef = JSON.parse(blockRaw) as DraggedBlockRef;
      if (blockRef.source === "day" && blockRef.blockId && blockRef.sourceDate) {
        onMoveBlockToBench(blockRef.sourceDate, blockRef.blockId);
      }
    } catch {
      // ignore invalid payload
    }
  };

  const handleDropTodoToDay = (
    event: React.DragEvent<HTMLElement>,
    targetDate: DateKey,
  ) => {
    event.preventDefault();
    const todoRaw = event.dataTransfer.getData(DRAG_TODO_KEY);
    if (!todoRaw) {
      return;
    }
    try {
      const todoRef = JSON.parse(todoRaw) as DraggedTodoRef;
      if (todoRef.source === "bench") {
        onMoveWeeklyTaskToDate(selectedDate, todoRef.todoId, targetDate);
        return;
      }
      if (todoRef.sourceDate === targetDate) {
        return;
      }
      onMoveTodoToDate(todoRef.sourceDate, todoRef.todoId, targetDate);
    } catch {
      // ignore invalid payload
    }
  };

  const handleDropTodoOnBenchItem = (
    event: React.DragEvent<HTMLElement>,
    targetTodoId: string,
  ) => {
    event.preventDefault();
    const todoRaw = event.dataTransfer.getData(DRAG_TODO_KEY);
    if (!todoRaw) {
      return;
    }
    try {
      const todoRef = JSON.parse(todoRaw) as DraggedTodoRef;
      if (todoRef.source === "bench") {
        onMoveWeeklyTaskWithinBench(selectedDate, todoRef.todoId, targetTodoId);
      }
    } catch {
      // ignore invalid payload
    }
  };

  const handleDropTodoOnDayItem = (
    event: React.DragEvent<HTMLElement>,
    targetDate: DateKey,
    targetTodoId: string,
  ) => {
    event.preventDefault();
    const todoRaw = event.dataTransfer.getData(DRAG_TODO_KEY);
    if (!todoRaw) {
      return;
    }
    try {
      const todoRef = JSON.parse(todoRaw) as DraggedTodoRef;
      if (todoRef.source === "day" && todoRef.sourceDate === targetDate) {
        onMoveTodoWithinDay(targetDate, todoRef.todoId, targetTodoId);
        return;
      }
      if (todoRef.source === "bench") {
        onMoveWeeklyTaskToDate(selectedDate, todoRef.todoId, targetDate);
        return;
      }
      onMoveTodoToDate(todoRef.sourceDate, todoRef.todoId, targetDate);
    } catch {
      // ignore invalid payload
    }
  };

  const toggleBlockMenu = (dateKey: DateKey, blockId: string) => {
    const key = `${dateKey}:${blockId}`;
    setOpenBlockMenuKey((previous) => (previous === key ? null : key));
  };

  const isBlockMenuOpen = (dateKey: DateKey, blockId: string) =>
    openBlockMenuKey === `${dateKey}:${blockId}`;

  const isDescriptionOpen = (dateKey: DateKey, blockId: string) =>
    openDescriptionKey === `${dateKey}:${blockId}`;

  const saveBlockEdit = (
    dateKey: DateKey,
    block: TimeBlock,
    updates: Partial<
      Pick<TimeBlock, "title" | "description" | "category" | "durationMin">
    >,
  ) => {
    onEditBlock(dateKey, block.id, {
      title: updates.title ?? block.title,
      description: updates.description ?? block.description,
      category: updates.category ?? block.category,
      durationMin: updates.durationMin ?? block.durationMin,
      startTime: block.startTime,
      actualDurationMin: block.actualDurationMin,
      actualStartTime: block.actualStartTime,
      color: block.color,
      targetDate: dateKey,
    });
    setOpenBlockMenuKey(null);
  };

  const addBlockToDefaults = (block: TimeBlock) => {
    onCreateReusableTemplate({
      title: block.title,
      description: block.description,
      category: block.category,
      defaultDurationMin: block.durationMin,
      color: block.color,
      isVariableDuration: false,
    });
    setOpenBlockMenuKey(null);
  };

  const handleEditBlockName = (dateKey: DateKey, block: TimeBlock) => {
    const titleAnswer = window.prompt("Edit block name", block.title);
    if (titleAnswer === null) {
      return;
    }
    const normalizedTitle = titleAnswer.trim() || block.title;
    saveBlockEdit(dateKey, block, { title: normalizedTitle });
  };

  const handleEditBlockCategory = (dateKey: DateKey, block: TimeBlock) => {
    const categoryAnswer = window.prompt("Edit category", block.category);
    if (categoryAnswer === null) {
      return;
    }
    const normalizedCategory = categoryAnswer.trim() || "General";
    saveBlockEdit(dateKey, block, { category: normalizedCategory });
  };

  const handleEditBlockDescription = (dateKey: DateKey, block: TimeBlock) => {
    const descriptionAnswer = window.prompt(
      "Edit block description",
      block.description,
    );
    if (descriptionAnswer === null) {
      return;
    }
    saveBlockEdit(dateKey, block, { description: descriptionAnswer.trim() });
  };

  const handleEditBlockDuration = (dateKey: DateKey, block: TimeBlock) => {
    const durationAnswer = window.prompt(
      "Edit block length in minutes",
      String(block.durationMin),
    );
    if (durationAnswer === null) {
      return;
    }
    const parsed = parsePositive(durationAnswer);
    if (!parsed) {
      window.alert("Length must be a positive number of minutes.");
      return;
    }
    saveBlockEdit(dateKey, block, { durationMin: parsed });
  };

  const saveTemplateEdit = (
    template: TimeBlockTemplate,
    updates: Partial<
      Pick<
        TimeBlockTemplate,
        "title" | "description" | "category" | "defaultDurationMin"
      >
    >,
  ) => {
    onUpdateTemplate(template.id, {
      title: updates.title ?? template.title,
      description: updates.description ?? template.description,
      category: updates.category ?? template.category,
      defaultDurationMin:
        updates.defaultDurationMin ?? template.defaultDurationMin,
      color: template.color,
      isVariableDuration: template.isVariableDuration,
    });
    setOpenTemplateMenuId(null);
  };

  const handleEditTemplateName = (template: TimeBlockTemplate) => {
    const titleAnswer = window.prompt("Edit default block name", template.title);
    if (titleAnswer === null) {
      return;
    }
    const normalizedTitle = titleAnswer.trim() || template.title;
    saveTemplateEdit(template, { title: normalizedTitle });
  };

  const handleEditTemplateCategory = (template: TimeBlockTemplate) => {
    const categoryAnswer = window.prompt("Edit default category", template.category);
    if (categoryAnswer === null) {
      return;
    }
    const normalizedCategory = categoryAnswer.trim() || "General";
    saveTemplateEdit(template, { category: normalizedCategory });
  };

  const handleEditTemplateDescription = (template: TimeBlockTemplate) => {
    const descriptionAnswer = window.prompt(
      "Edit default description",
      template.description,
    );
    if (descriptionAnswer === null) {
      return;
    }
    saveTemplateEdit(template, { description: descriptionAnswer.trim() });
  };

  const handleEditTemplateDuration = (template: TimeBlockTemplate) => {
    const durationAnswer = window.prompt(
      "Edit default block length in minutes",
      String(template.defaultDurationMin),
    );
    if (durationAnswer === null) {
      return;
    }
    let nextDuration = template.defaultDurationMin;
    const parsed = parsePositive(durationAnswer);
    if (!parsed) {
      window.alert("Length must be a positive number of minutes.");
      return;
    }
    nextDuration = parsed;
    saveTemplateEdit(template, { defaultDurationMin: nextDuration });
  };

  return (
    <SectionCard
      title="Week Planner Grid"
      subtitle="Double-click on a time lane to create a block where you clicked. Drag preset blocks to place quickly."
      className="p-3 sm:p-3"
    >
      <div className="mb-2 rounded-xl border border-rose-200 bg-white/75 p-2">
        <button
          type="button"
          onClick={() => setIsPresetBlocksOpen((previous) => !previous)}
          className="flex w-full items-center justify-between rounded-md border border-rose-200 bg-white px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-900/80 hover:bg-rose-50"
          title="Show or hide preset blocks"
        >
          <span>Preset blocks</span>
          <span>{isPresetBlocksOpen ? "−" : "+"}</span>
        </button>
        {isPresetBlocksOpen ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {templates.map((template) => (
            <div
              key={template.id}
              className="relative inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1 py-0.5"
              onMouseLeave={() =>
                setOpenTemplateMenuId((previous) =>
                  previous === template.id ? null : previous,
                )
              }
            >
              <button
                type="button"
                draggable
                onClick={() => onAddTemplateToBench(selectedDate, template.id)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_TEMPLATE_KEY, template.id);
                  setDraggedTemplateId(template.id);
                }}
                onDragEnd={() => setDraggedTemplateId(null)}
                className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-900 hover:bg-rose-100"
              >
                {template.title}
              </button>
              <span className="rounded-full border border-rose-200 bg-white px-1 py-0 text-[10px] font-semibold text-rose-900">
                {formatDuration(template.defaultDurationMin)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setOpenTemplateMenuId((previous) =>
                    previous === template.id ? null : template.id,
                  )
                }
                className="rounded border border-rose-200 bg-white px-1 py-0 text-[10px] font-bold text-rose-900"
                title="More options"
              >
                ⋮
              </button>
              {openTemplateMenuId === template.id ? (
                <div className="absolute right-0 top-6 z-20 flex min-w-[110px] origin-top-right flex-col gap-1 rounded-md border border-rose-200 bg-white/95 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleEditTemplateName(template)}
                    className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                    title="Edit default block name"
                  >
                    Edit name
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTemplateCategory(template)}
                    className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                    title="Edit default block category"
                  >
                    Edit category
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTemplateDescription(template)}
                    className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                    title="Edit default block description"
                  >
                    Edit description
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTemplateDuration(template)}
                    className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                    title="Edit default block duration"
                  >
                    Edit duration
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteTemplate(template.id);
                      setOpenTemplateMenuId(null);
                    }}
                    className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                    title="Delete default block"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        ) : null}
      </div>

      {categoryStats.length > 0 ? (
        <div className="mb-2 rounded-xl border border-rose-200 bg-white/75 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-900/70">
              Weekly Category Stats
            </p>
            <div className="relative" onMouseLeave={() => setIsStatsMenuOpen(false)}>
              <button
                type="button"
                onClick={() => setIsStatsMenuOpen((previous) => !previous)}
                className="rounded border border-rose-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-rose-900"
                title="Choose categories shown as bars"
              >
                Bars
              </button>
              {isStatsMenuOpen ? (
                <div className="absolute right-0 top-6 z-20 min-w-[130px] rounded-md border border-rose-200 bg-white p-1 shadow-sm">
                  {statCategoryOptions.map((category) => {
                    const checked = visibleStatCategories.some(
                      (entry) => entry.toLowerCase() === category.toLowerCase(),
                    );
                    return (
                      <label
                        key={`stats-option-${category}`}
                        className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold text-rose-900 hover:bg-rose-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleVisibleCategory(category)}
                        />
                        {category}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold text-rose-900/75">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-300" />
              Planned
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
              Completed
            </span>
          </div>
          <div className="space-y-1">
            {visibleStats.map((stat) => (
              <div
                key={`stats-bar-${stat.category}`}
                className="rounded-lg border border-rose-200 bg-rose-50/50 px-2 py-1"
              >
                <div className="mb-0.5 flex items-center justify-between text-[10px] font-semibold text-rose-900">
                  <span>{stat.category}</span>
                  <span>
                    {formatDuration(stat.completed)} / {formatDuration(stat.planned)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="h-1.5 overflow-hidden rounded bg-rose-100">
                    <div
                      className="h-full rounded bg-rose-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (stat.planned / maxVisibleStatMinutes) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-emerald-100">
                    <div
                      className="h-full rounded bg-emerald-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (stat.completed / maxVisibleStatMinutes) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {visibleStats.length === 0 ? (
              <p className="rounded-lg border border-dashed border-rose-200 bg-white px-2 py-1 text-[10px] font-semibold text-rose-900/70">
                Select at least one category from Bars.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mb-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-white/75 px-2 py-1.5">
        <label className="text-xs font-semibold text-rose-900">Grid zoom</label>
        <input
          type="range"
          min={0.7}
          max={4}
          step={0.1}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="w-40"
        />
        <span className="text-xs font-semibold text-rose-900/80">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setActiveAddForm("task")}
          className="ml-auto rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
        >
          Add task
        </button>
        <button
          type="button"
          onClick={() => setActiveAddForm("timeblock")}
          className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
        >
          Add time block
        </button>
      </div>

      <div className="mb-2 rounded-xl border border-rose-200 bg-white/75 p-2">
        {activeAddForm === "timeblock" ? (
          <form
            className="grid gap-1 rounded-xl border border-rose-200 bg-rose-50/45 p-2 sm:grid-cols-6"
            onSubmit={handleQuickAdd}
          >
            <select
              value={resolvedQuickTarget}
              onChange={(event) => setQuickTargetDate(event.target.value)}
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
            >
              {weekDates.map((dateKey) => (
                <option key={dateKey} value={dateKey}>
                  {formatShortWeekdayLabel(dateKey)}
                </option>
              ))}
            </select>
            <input
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
              placeholder="Quick block title"
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
            />
            <input
              value={quickCategory}
              onChange={(event) => setQuickCategory(event.target.value)}
              placeholder="Category"
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
            />
            <input
              type="number"
              min={1}
              value={quickDuration}
              onChange={(event) => setQuickDuration(event.target.value)}
              placeholder="min"
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
            />
            <div className="flex gap-1">
              <input
                type="time"
                value={quickStart}
                onChange={(event) => setQuickStart(event.target.value)}
                className="w-full rounded-md border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
              />
              <button
                type="submit"
                className="rounded-md bg-rose-400 px-2 py-1 text-xs font-semibold text-rose-950 hover:bg-rose-300"
              >
                Add
              </button>
            </div>
          </form>
        ) : null}

        {activeAddForm === "task" ? (
          <form
            className="grid gap-1 rounded-xl border border-rose-200 bg-rose-50/45 p-2 sm:grid-cols-[120px_1fr_auto]"
            onSubmit={handleQuickTodoAdd}
          >
            <select
              value={quickTodoDate}
              onChange={(event) => setQuickTodoDate(event.target.value)}
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
            >
              <option value="bench">Bench</option>
              {weekDates.map((dateKey) => (
                <option key={dateKey} value={dateKey}>
                  {formatShortWeekdayLabel(dateKey)}
                </option>
              ))}
            </select>
            <input
              ref={quickTaskInputRef}
              value={quickTodoText}
              onChange={(event) => setQuickTodoText(event.target.value)}
              placeholder="Add weekly task..."
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs outline-none focus:border-rose-400"
            />
            <button
              type="submit"
              className="rounded-md bg-rose-400 px-2 py-1 text-xs font-semibold text-rose-950 hover:bg-rose-300"
            >
              Add
            </button>
          </form>
        ) : null}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-white/75 px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-900/70">
          Todoist
        </span>
        <button
          type="button"
          onClick={handleConnectTodoist}
          className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
        >
          {todoistConnected ? "Update token" : "Connect"}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleImportTodoist();
          }}
          disabled={!todoistConnected || todoistLoading}
          className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Fetch Todoist tasks and choose which ones to import"
        >
          {todoistLoading ? "Loading..." : "Choose tasks to import"}
        </button>
      </div>

      {todoistError ? (
        <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-900/85">
          Todoist: {todoistError}
        </p>
      ) : null}

      {todoistPickerOpen ? (
        <div className="mb-2 rounded-xl border border-rose-200 bg-white/85 p-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-rose-900">
              Pick Todoist tasks to import ({selectedTodoistTaskIds.length} selected)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllTodoistTasks}
                className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearTodoistTaskSelection}
                className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setTodoistPickerOpen(false)}
                className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {todoistTasksGroupedByTag.length === 0 ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50/60 px-2 py-2 text-xs font-semibold text-rose-900/80">
                No Todoist tasks found.
              </p>
            ) : (
              todoistTasksGroupedByTag.map((group) => (
                <div
                  key={group.tag}
                  className="rounded-lg border border-rose-200 bg-rose-50/45 p-2"
                >
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-900/80">
                    {group.tag}
                  </p>
                  <div className="space-y-1">
                    {group.tasks.map((task) => {
                      const alreadyImported = knownTodoistExternalIds.has(task.id);
                      const checked = selectedTodoistTaskIds.includes(task.id);
                      return (
                        <label
                          key={`${group.tag}-${task.id}`}
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1 text-xs ${
                            alreadyImported
                              ? "border-rose-200 bg-white/70 text-rose-900/55"
                              : "border-rose-200 bg-white text-rose-900"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={alreadyImported}
                            onChange={() => toggleTodoistTaskSelection(task.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{task.content}</span>
                            {task.labels.length > 0 ? (
                              <span className="block truncate text-[10px] text-rose-900/70">
                                #{task.labels.join(" #")}
                              </span>
                            ) : null}
                          </span>
                          {alreadyImported ? (
                            <span className="shrink-0 text-[10px] font-semibold text-rose-900/60">
                              already imported
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                void handleImportSelectedTodoistTasks();
              }}
              disabled={todoistLoading || selectedTodoistTaskIds.length === 0}
              className="rounded-md border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {todoistLoading ? "Importing..." : "Import selected tasks"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-rose-200/80 bg-white/65 p-1">
        <div className="grid grid-cols-[52px_repeat(8,minmax(0,1fr))] gap-1">
          <div />
          <div className="rounded-md bg-rose-50 px-1.5 py-1 text-left text-[11px] font-semibold text-rose-900/80">
            Time block bench
          </div>
          {weekData.map((day) => (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => {
                onSelectDate(day.dateKey);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropTemplateOnDay(event, day.dateKey)}
              className={`rounded-md px-1.5 py-1 text-left ${
                day.dateKey === selectedDate
                  ? "bg-rose-300/70 text-rose-950"
                  : "bg-rose-50 text-rose-900 hover:bg-rose-100"
              }`}
            >
              <p className="text-[11px] font-semibold">
                {formatShortWeekdayLabel(day.dateKey)}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-[52px_repeat(8,minmax(0,1fr))] gap-1">
          <div />
          <div
            className="rounded-md border border-rose-200 bg-white/80 p-1"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDropTodoToBench}
          >
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-900/70">
              Task Bench
            </p>
            <div className="space-y-0.5">
              {weeklyTasks.map((todo, index) => (
                <div
                  key={`bench-todo-${todo.id}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      DRAG_TODO_KEY,
                      JSON.stringify({
                        source: "bench",
                        todoId: todo.id,
                      } satisfies DraggedTodoRef),
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDropTodoOnBenchItem(event, todo.id)}
                  className={`flex items-center gap-[1px] rounded border pl-0.5 pr-1 pb-0.5 pt-0 ${
                    index < 3
                      ? "border-amber-300 bg-amber-100/90"
                      : "border-rose-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleWeeklyTask(selectedDate, todo.id)}
                    className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                      todo.completed
                        ? "border-rose-900 bg-rose-900 text-white"
                        : "border-rose-400 bg-white text-rose-900"
                    }`}
                    title="Complete task"
                  >
                    <span className="sr-only">
                      {todo.completed ? "Completed" : "Not completed"}
                    </span>
                  </button>
                  <span
                    className={`min-w-0 flex-1 truncate text-[9px] font-semibold leading-tight text-rose-950 ${
                      todo.completed ? "line-through opacity-70" : ""
                    }`}
                    title={todo.text}
                  >
                    {todo.text}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onMoveWeeklyTaskToNextWeekBench(selectedDate, todo.id)
                    }
                    className="rounded border border-rose-200 bg-white px-1 py-0 text-[8px] font-semibold text-rose-900"
                    title="Move to next week bench"
                  >
                    {">>"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteWeeklyTask(selectedDate, todo.id)}
                    className="rounded border border-rose-200 bg-white px-1 py-0 text-[8px] font-semibold text-rose-900"
                    title="Delete task"
                  >
                    x
                  </button>
                </div>
              ))}
              {weeklyTasks.length === 0 ? (
                <p className="rounded border border-dashed border-rose-200 bg-white px-1 py-1 text-[9px] text-rose-900/70">
                  No bench tasks
                </p>
              ) : null}
            </div>
          </div>
          {weekData.map((day) => (
            <div
              key={`tasks-${day.dateKey}`}
              className="rounded-md border border-rose-200 bg-white/80 p-1"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropTodoToDay(event, day.dateKey)}
            >
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-900/70">
                Tasks
              </p>
              <div className="space-y-0.5">
                {day.todos.map((todo, index) => (
                  <div
                    key={`${day.dateKey}-top-todo-${todo.id}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        DRAG_TODO_KEY,
                        JSON.stringify({
                          source: "day",
                          sourceDate: day.dateKey,
                          todoId: todo.id,
                        } satisfies DraggedTodoRef),
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) =>
                      handleDropTodoOnDayItem(event, day.dateKey, todo.id)
                    }
                    className={`flex items-center gap-[1px] rounded border pl-0.5 pr-1 pb-0.5 pt-0 ${
                      index < 3
                        ? "border-amber-300 bg-amber-100/90"
                        : "border-rose-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTodo(day.dateKey, todo.id)}
                      className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                        todo.completed
                          ? "border-rose-900 bg-rose-900 text-white"
                          : "border-rose-400 bg-white text-rose-900"
                      }`}
                      title="Complete task"
                    >
                      <span className="sr-only">
                        {todo.completed ? "Completed" : "Not completed"}
                      </span>
                    </button>
                    <span
                      className={`min-w-0 flex-1 truncate text-[9px] font-semibold leading-tight text-rose-950 ${
                        todo.completed ? "line-through opacity-70" : ""
                      }`}
                      title={todo.text}
                    >
                      {todo.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => onMoveTodoToBench(day.dateKey, todo.id)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-rose-200 bg-white text-rose-900"
                      title="Send to bench"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-rose-700"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 7.5h10" />
                        <path d="M4 7.5V5.5h8v2" />
                        <path d="M4 7.5v3" />
                        <path d="M12 7.5v3" />
                        <path d="M2.5 10.5h11" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCarryForwardTodo(day.dateKey, todo.id)}
                      className="rounded border border-rose-200 bg-white px-1 py-0 text-[8px] font-semibold text-rose-900"
                      title="Send to next day"
                    >
                      {">"}
                    </button>
                  </div>
                ))}
                {day.todos.length === 0 ? (
                  <p className="rounded border border-dashed border-rose-200 bg-white px-1 py-1 text-[9px] text-rose-900/70">
                    No tasks
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-[52px_repeat(8,minmax(0,1fr))] gap-1">
          <div className="relative" style={{ height: calendarHeight }}>
            {hourTicks.map((hour) => {
              const top = (hour - CALENDAR_START_HOUR) * 60 * pixelsPerMin;
              return (
                <span
                  key={`axis-${hour}`}
                  className="absolute left-0 text-[10px] font-semibold text-rose-900/70"
                  style={{ top: top - 6 }}
                >
                  {toHourLabel(hour)}
                </span>
              );
            })}
          </div>

          <section
            className="rounded-md border border-rose-200 bg-white/65 p-1"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDropBlockToBench}
          >
            <p className="mb-1 px-1 py-0.5 text-[10px] font-semibold text-rose-900/70">
              Time block bench
            </p>
            <div
              className="relative overflow-hidden rounded-md border border-dashed border-rose-200/80 bg-rose-50/30"
              style={{ height: calendarHeight }}
            >
              {benchBlockSlots.map(({ block, top, height }) => {
                const canShowText = height >= 20;
                return (
                  <button
                    key={`bench-block-${block.id}`}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        DRAG_BLOCK_KEY,
                        JSON.stringify({
                          source: "bench",
                          blockId: block.id,
                        } satisfies DraggedBlockRef),
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => {
                      const targetDate = window.prompt(
                        "Assign block to date (YYYY-MM-DD)",
                        selectedDate,
                      );
                      if (!targetDate) {
                        return;
                      }
                      onMoveBenchBlockToDate(selectedDate, block.id, targetDate);
                    }}
                    className="absolute left-0.5 right-0.5 rounded border border-rose-300 bg-rose-100/95 px-1 text-left"
                    style={{ top, height }}
                    title={`${block.title} (${formatDuration(block.durationMin)})`}
                  >
                    {canShowText ? (
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-[9px] font-semibold text-rose-950">
                          {block.title}
                        </p>
                        <p className="shrink-0 text-[8px] font-semibold text-rose-900/75">
                          {formatDuration(block.durationMin)}
                        </p>
                      </div>
                    ) : null}
                  </button>
                );
              })}

              {weeklyPlannedBlocks.length === 0 ? (
                <p className="absolute left-1 right-1 top-8 rounded border border-dashed border-rose-200 bg-white px-1 py-1 text-[9px] text-rose-900/70">
                  No planned blocks
                </p>
              ) : null}
            </div>
          </section>

          {weekData.map((day) => (
            <section key={`grid-${day.dateKey}`} className="rounded-md border border-rose-200 bg-white/75 p-1">
              <div
                className="relative overflow-visible rounded-md border border-rose-100 bg-rose-50/40"
                style={{ height: calendarHeight }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDropTemplateOnTime(event, day.dateKey)}
                onDoubleClick={(event) => createTimedBlockFromPointer(event, day.dateKey)}
              >
                {hourTicks.map((hour) => {
                  const top = (hour - CALENDAR_START_HOUR) * 60 * pixelsPerMin;
                  return (
                    <div
                      key={`${day.dateKey}-line-${hour}`}
                      className="absolute left-0 right-0 border-t border-rose-200/70"
                      style={{ top }}
                    />
                  );
                })}

                {day.timedBlocks.map((block) => {
                  const isResizingThisBlock =
                    resizeState?.dateKey === day.dateKey &&
                    resizeState.blockId === block.id &&
                    Boolean(resizePreview);
                  const previewStartMin = isResizingThisBlock
                    ? resizePreview!.startMin
                    : null;
                  const previewDurationMin = isResizingThisBlock
                    ? resizePreview!.durationMin
                    : null;
                  const geometry =
                    previewStartMin !== null && previewDurationMin !== null
                      ? getGeometryFromMinutes(previewStartMin, previewDurationMin)
                      : getBlockGeometry(block);
                  if (!geometry) {
                    return null;
                  }
                  const displayDurationMin =
                    previewDurationMin ?? block.durationMin;
                  const displayStartTime =
                    previewStartMin !== null
                      ? toTimeString(CALENDAR_START_HOUR * 60 + previewStartMin)
                      : block.startTime;
                  const descriptionText = block.description.trim();
                  const endTime = displayStartTime
                    ? blockEndLabel(displayStartTime, displayDurationMin)
                    : "";
                  const canShowDetails = geometry.height >= 22;
                  const charsPerLine = 22;
                  const availableTextHeight = Math.max(0, geometry.height - 24);
                  const maxDescriptionLines = Math.floor(availableTextHeight / 10);
                  const requiredDescriptionLines = Math.ceil(
                    descriptionText.length / charsPerLine,
                  );
                  const canShowDescriptionInline =
                    Boolean(descriptionText) &&
                    geometry.height >= 36 &&
                    maxDescriptionLines >= requiredDescriptionLines;
                  const shouldShowDescriptionArrow =
                    Boolean(descriptionText) && !canShowDescriptionInline;
                  const canShowBlockMenuButton =
                    geometry.height >= (shouldShowDescriptionArrow ? 22 : 16);
                  const canShowAnyText = geometry.height >= 12;

                  return (
                    <article
                      key={block.id}
                      draggable={!isResizingThisBlock}
                      onDragStart={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const offsetPx = Math.max(
                          0,
                          Math.min(rect.height, event.clientY - rect.top),
                        );
                        const dragOffsetMin = Math.floor(offsetPx / pixelsPerMin);
                        event.dataTransfer.setData(
                          DRAG_BLOCK_KEY,
                          JSON.stringify({
                            source: "day",
                            sourceDate: day.dateKey,
                            blockId: block.id,
                            dragOffsetMin,
                          } satisfies DraggedBlockRef),
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className="absolute left-0.5 right-0.5 overflow-visible rounded border px-1 py-0.5"
                      onMouseLeave={() =>
                        {
                          setOpenBlockMenuKey((previous) =>
                            previous === `${day.dateKey}:${block.id}`
                              ? null
                              : previous,
                          );
                          setOpenDescriptionKey((previous) =>
                            previous === `${day.dateKey}:${block.id}`
                              ? null
                              : previous,
                          );
                        }
                      }
                      style={{
                        top: geometry.top,
                        height: geometry.height,
                        borderColor: toRgba(block.color, block.completed ? 0.98 : 0.56),
                        backgroundColor: toRgba(
                          block.color,
                          block.completed ? 0.8 : 0.2,
                        ),
                      }}
                      title={`${block.title} (${block.durationMin} min)`}
                    >
                      <div
                        className="absolute left-0 right-0 top-[-2px] z-30 h-2 cursor-ns-resize"
                        onMouseDown={(event) =>
                          startResize(event, day.dateKey, block, "top")
                        }
                        title="Resize block"
                      />
                      <div
                        className="absolute bottom-[-2px] left-0 right-0 z-30 h-2 cursor-ns-resize"
                        onMouseDown={(event) =>
                          startResize(event, day.dateKey, block, "bottom")
                        }
                        title="Resize block"
                      />
                      <div className="absolute right-0.5 top-0.5 z-20 flex items-center gap-0.5">
                        {shouldShowDescriptionArrow ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenDescriptionKey((previous) =>
                                previous === `${day.dateKey}:${block.id}`
                                  ? null
                                  : `${day.dateKey}:${block.id}`,
                              );
                            }}
                            className="rounded border border-rose-200 bg-white/90 px-1 py-0 text-[9px] font-bold text-rose-900"
                            title="Show description"
                          >
                            ▾
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => toggleBlockMenu(day.dateKey, block.id)}
                          className={`rounded border border-rose-200 bg-white/90 px-1 py-0 text-[9px] font-bold text-rose-900 ${
                            canShowBlockMenuButton
                              ? ""
                              : "invisible pointer-events-none"
                          }`}
                          title="More options"
                        >
                          ⋮
                        </button>
                        {canShowBlockMenuButton &&
                        isBlockMenuOpen(day.dateKey, block.id) ? (
                          <div className="absolute right-0 top-5 flex min-w-[110px] origin-top-right flex-col gap-1 rounded-md border border-rose-200 bg-white/95 p-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => handleEditBlockName(day.dateKey, block)}
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Edit block name"
                            >
                              Edit name
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditBlockCategory(day.dateKey, block)
                              }
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Edit block category"
                            >
                              Edit category
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditBlockDescription(day.dateKey, block)
                              }
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Edit block description"
                            >
                              Edit description
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditBlockDuration(day.dateKey, block)
                              }
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Edit block duration"
                            >
                              Edit duration
                            </button>
                            <button
                              type="button"
                              onClick={() => addBlockToDefaults(block)}
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Add block to default blocks"
                            >
                              Add to defaults
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveBlockToBench(day.dateKey, block.id)}
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Send block to bench planned list"
                            >
                              Send to bench
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onToggleComplete(day.dateKey, block.id);
                                setOpenBlockMenuKey(null);
                              }}
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Toggle block complete"
                            >
                              Toggle complete
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteBlock(day.dateKey, block.id);
                                setOpenBlockMenuKey(null);
                              }}
                              className="rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-rose-900 transition hover:bg-rose-50"
                              title="Delete block"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {shouldShowDescriptionArrow &&
                      isDescriptionOpen(day.dateKey, block.id) ? (
                        <div className="absolute left-1 right-1 top-full z-20 mt-1 rounded-md border border-rose-200 bg-white/95 px-1.5 py-1 text-[9px] text-rose-900 shadow-sm">
                          {block.description}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onToggleComplete(day.dateKey, block.id)}
                        className={`relative z-10 flex h-full w-full flex-col justify-start pr-6 pt-0 text-left ${
                          canShowDetails ? "overflow-hidden" : "overflow-visible"
                        }`}
                      >
                        {canShowDetails ? (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <p
                                className={`truncate text-[10px] font-semibold leading-tight text-rose-950 ${
                                  block.completed ? "line-through opacity-70" : ""
                                }`}
                              >
                                {block.title}
                              </p>
                              <span className="shrink-0 text-[8px] font-semibold text-rose-900/80">
                                {formatDuration(displayDurationMin)}
                              </span>
                            </div>
                            <p className="text-[9px] text-rose-900/80">
                              {displayStartTime} - {endTime}
                            </p>
                            {canShowDescriptionInline ? (
                              <p
                                className="mt-0.5 break-words text-justify text-[8px] leading-tight text-rose-900/75"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {descriptionText}
                              </p>
                            ) : null}
                          </>
                        ) : canShowAnyText ? (
                          <div className="flex items-center gap-1">
                            <p
                              className={`min-w-0 flex-1 truncate text-[9px] font-semibold leading-tight text-rose-950 ${
                                block.completed ? "line-through opacity-70" : ""
                              }`}
                              title={block.title}
                            >
                              {block.title}
                            </p>
                            {block.title.trim().length <= 12 ? (
                              <span className="shrink-0 text-[8px] font-semibold text-rose-900/80">
                                {formatDuration(displayDurationMin)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="sr-only">
                            {block.title} {block.startTime} - {endTime}
                          </span>
                        )}
                      </button>
                    </article>
                  );
                })}

              </div>

              {day.untimedBlocks.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {day.untimedBlocks.map((block) => (
                    <div
                      key={`untimed-${block.id}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          DRAG_BLOCK_KEY,
                          JSON.stringify({
                            source: "day",
                            sourceDate: day.dateKey,
                            blockId: block.id,
                            dragOffsetMin: 0,
                          } satisfies DraggedBlockRef),
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className="relative flex items-center justify-between gap-1 rounded border border-rose-200 bg-white px-1 py-0.5"
                      onMouseLeave={() =>
                        {
                          setOpenBlockMenuKey((previous) =>
                            previous === `${day.dateKey}:${block.id}`
                              ? null
                              : previous,
                          );
                          setOpenDescriptionKey((previous) =>
                            previous === `${day.dateKey}:${block.id}`
                              ? null
                              : previous,
                          );
                        }
                      }
                    >
                      <button
                        type="button"
                        onClick={() => onToggleComplete(day.dateKey, block.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p
                          className={`truncate text-[10px] font-semibold text-rose-950 ${
                            block.completed ? "line-through opacity-70" : ""
                          }`}
                        >
                          {block.title}
                        </p>
                        {block.description.trim() ? (
                          <p className="mt-0.5 break-words text-justify text-[9px] leading-tight text-rose-900/75">
                            {block.description}
                          </p>
                        ) : null}
                      </button>
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-1 py-0 text-[8px] font-semibold text-rose-900">
                        {formatDuration(block.durationMin)}
                      </span>
                      <button
                        type="button"
                        className="rounded border border-rose-200 bg-white px-1 py-0 text-[10px] font-bold text-rose-900"
                        onClick={() => toggleBlockMenu(day.dateKey, block.id)}
                        title="More options"
                      >
                        ⋮
                      </button>
                      {isBlockMenuOpen(day.dateKey, block.id) ? (
                        <div className="absolute right-1 top-6 z-20 flex min-w-[110px] origin-top-right flex-col gap-1 rounded-md border border-rose-200 bg-white/95 p-1 shadow-sm">
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() => handleEditBlockName(day.dateKey, block)}
                            title="Edit block name"
                          >
                            Edit name
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() =>
                              handleEditBlockCategory(day.dateKey, block)
                            }
                            title="Edit block category"
                          >
                            Edit category
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() =>
                              handleEditBlockDescription(day.dateKey, block)
                            }
                            title="Edit block description"
                          >
                            Edit description
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() =>
                              handleEditBlockDuration(day.dateKey, block)
                            }
                            title="Edit block duration"
                          >
                            Edit duration
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() => addBlockToDefaults(block)}
                            title="Add block to default blocks"
                          >
                            Add to defaults
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() => onMoveBlockToBench(day.dateKey, block.id)}
                            title="Send block to bench planned list"
                          >
                            Send to bench
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() => {
                              onToggleComplete(day.dateKey, block.id);
                              setOpenBlockMenuKey(null);
                            }}
                            title="Toggle block complete"
                          >
                            Toggle complete
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 transition hover:bg-rose-50"
                            onClick={() => {
                              onDeleteBlock(day.dateKey, block.id);
                              setOpenBlockMenuKey(null);
                            }}
                            title="Delete block"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

            </section>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-[52px_repeat(8,minmax(0,1fr))] gap-1">
          <div />
          <div className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white/80 px-2 py-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-900/75">
              Habit tracker
            </p>
            <button
              type="button"
              onClick={handleAddHabit}
              className="rounded border border-rose-200 bg-white px-1 py-0 text-[10px] font-semibold text-rose-900 hover:bg-rose-50"
              title="Add new habit"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-1 grid grid-cols-[52px_repeat(8,minmax(0,1fr))] gap-1">
          <div />
          <div className="rounded-md border border-rose-200 bg-white/80 p-1">
            <div className="space-y-0.5">
              {habits.map((habit) => (
                <div
                  key={`habit-legend-${habit.id}`}
                  className="relative flex h-6 items-center gap-1 rounded border border-rose-200 bg-white px-1"
                  onMouseLeave={() =>
                    setOpenHabitMenuId((previous) =>
                      previous === habit.id ? null : previous,
                    )
                  }
                >
                  <span
                    className="inline-flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold text-rose-900"
                    title={habit.name}
                  >
                    <HabitEmojiIcon
                      emoji={habitEmojiVisual(habit.name)}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="truncate">{habit.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleHabitMenu(habit.id)}
                    className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded border border-rose-200 bg-white text-[10px] font-bold text-rose-900"
                    title="Habit options"
                  >
                    ⋮
                  </button>
                  {openHabitMenuId === habit.id ? (
                    <div className="absolute right-1 top-5 z-20 flex min-w-[96px] origin-top-right flex-col gap-1 rounded-md border border-rose-200 bg-white/95 p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => handleRenameHabit(habit)}
                        className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 hover:bg-rose-50"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHabit(habit)}
                        className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-rose-900 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {weekData.map((day) => (
            <div
              key={`habit-grid-${day.dateKey}`}
              className="rounded-md border border-rose-200 bg-white/80 p-1"
            >
              <div className="space-y-0.5">
                {habits.map((habit) => {
                  const checked = Boolean(day.habitChecks[habit.id]);
                  return (
                    <button
                      key={`${day.dateKey}-habit-row-${habit.id}`}
                      type="button"
                      onClick={() => onToggleHabit(day.dateKey, habit.id)}
                      className={`relative flex h-6 w-full items-center justify-center rounded border px-1.5 ${
                        checked
                          ? "border-[#4ea79f] bg-[#67c2b6] text-white"
                          : "border-rose-200 bg-white text-rose-900"
                      }`}
                      title={habit.name}
                    >
                      <HabitEmojiIcon
                        emoji={habitEmojiVisual(habit.name)}
                        className="h-4 w-4"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
};
