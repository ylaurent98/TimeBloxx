import { supabase } from "./supabase";
import type { PlannerData, TimeBlock, TodoItem } from "../types";

const chunk = <T,>(items: T[], size = 500) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const normalizePlannerData = (data: PlannerData): PlannerData => ({
  version: data.version ?? 1,
  templates: Array.isArray(data.templates) ? data.templates : [],
  habits: Array.isArray(data.habits) ? data.habits : [],
  days: data.days ?? {},
  weeklyTaskBank: data.weeklyTaskBank ?? {},
  weeklyBlockBank: data.weeklyBlockBank ?? {},
  todoist: {
    apiToken: data.todoist?.apiToken ?? null,
    lastSyncAt: data.todoist?.lastSyncAt ?? null,
  },
});

export const resolveOwnerIdForUser = async (userId: string) => {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data: existing, error } = await supabase
    .from("planner_profiles")
    .select("owner_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing?.owner_id) {
    return existing.owner_id as string;
  }

  const ownerId = `user-${userId}`;
  const { error: insertError } = await supabase.from("planner_profiles").insert({
    owner_id: ownerId,
    auth_user_id: userId,
    display_name: ownerId,
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    throw insertError;
  }

  return ownerId;
};

export const linkOwnerToCurrentUser = async (ownerId: string, userId: string) => {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { error } = await supabase
    .from("planner_profiles")
    .update({
      auth_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId);

  if (error) {
    throw error;
  }
};

export const loadPlannerFromCloud = async (ownerId: string): Promise<PlannerData> => {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const [
    templatesRes,
    habitsRes,
    daysRes,
    dayBlocksRes,
    dayTodosRes,
    dayChecksRes,
    weeklyTasksRes,
    weeklyBlocksRes,
    todoistRes,
  ] = await Promise.all([
    supabase.from("time_block_templates").select("*").eq("owner_id", ownerId),
    supabase.from("habits").select("*").eq("owner_id", ownerId),
    supabase.from("planner_days").select("*").eq("owner_id", ownerId),
    supabase.from("day_time_blocks").select("*").eq("owner_id", ownerId),
    supabase.from("day_todos").select("*").eq("owner_id", ownerId),
    supabase.from("day_habit_checks").select("*").eq("owner_id", ownerId),
    supabase.from("weekly_task_bank_todos").select("*").eq("owner_id", ownerId),
    supabase.from("weekly_block_bank_blocks").select("*").eq("owner_id", ownerId),
    supabase.from("todoist_settings").select("*").eq("owner_id", ownerId).maybeSingle(),
  ]);

  const failures = [
    templatesRes.error,
    habitsRes.error,
    daysRes.error,
    dayBlocksRes.error,
    dayTodosRes.error,
    dayChecksRes.error,
    weeklyTasksRes.error,
    weeklyBlocksRes.error,
    todoistRes.error,
  ].filter(Boolean);
  if (failures.length > 0) {
    throw failures[0];
  }

  const daysMap: PlannerData["days"] = {};
  for (const row of daysRes.data ?? []) {
    daysMap[row.date_key] = {
      blocks: [],
      todos: [],
      topPriorities: [
        row.top_priority_1 ?? "",
        row.top_priority_2 ?? "",
        row.top_priority_3 ?? "",
      ],
      habitChecks: {},
    };
  }

  for (const row of dayBlocksRes.data ?? []) {
    if (!daysMap[row.date_key]) {
      daysMap[row.date_key] = {
        blocks: [],
        todos: [],
        topPriorities: ["", "", ""],
        habitChecks: {},
      };
    }
    daysMap[row.date_key].blocks.push({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      category: row.category ?? "General",
      durationMin: row.duration_min,
      startTime: row.start_time ?? null,
      actualDurationMin: row.actual_duration_min ?? null,
      actualStartTime: row.actual_start_time ?? null,
      color: row.color,
      completed: Boolean(row.completed),
      source: row.source,
      templateId: row.template_id ?? undefined,
      order: row.order ?? 0,
      createdAt: row.created_at,
    });
  }

  for (const row of dayTodosRes.data ?? []) {
    if (!daysMap[row.date_key]) {
      daysMap[row.date_key] = {
        blocks: [],
        todos: [],
        topPriorities: ["", "", ""],
        habitChecks: {},
      };
    }
    daysMap[row.date_key].todos.push({
      id: row.id,
      text: row.text,
      dueTime: row.due_time ?? null,
      completed: Boolean(row.completed),
      source: row.source ?? "local",
      externalId: row.external_id ?? null,
      labels: row.labels ?? [],
      order: row.order ?? 0,
      createdAt: row.created_at,
    });
  }

  for (const row of dayChecksRes.data ?? []) {
    if (!daysMap[row.date_key]) {
      daysMap[row.date_key] = {
        blocks: [],
        todos: [],
        topPriorities: ["", "", ""],
        habitChecks: {},
      };
    }
    if (row.checked) {
      daysMap[row.date_key].habitChecks[row.habit_id] = true;
    }
  }

  Object.values(daysMap).forEach((day) => {
    day.blocks.sort((a, b) => a.order - b.order);
    day.todos.sort((a, b) => a.order - b.order);
  });

  const weeklyTaskBank: PlannerData["weeklyTaskBank"] = {};
  for (const row of weeklyTasksRes.data ?? []) {
    if (!weeklyTaskBank[row.week_key]) {
      weeklyTaskBank[row.week_key] = [];
    }
    weeklyTaskBank[row.week_key].push({
      id: row.id,
      text: row.text,
      dueTime: row.due_time ?? null,
      completed: Boolean(row.completed),
      source: row.source ?? "local",
      externalId: row.external_id ?? null,
      labels: row.labels ?? [],
      order: row.order ?? 0,
      createdAt: row.created_at,
    });
  }

  Object.values(weeklyTaskBank).forEach((list) => list.sort((a, b) => a.order - b.order));

  const weeklyBlockBank: PlannerData["weeklyBlockBank"] = {};
  for (const row of weeklyBlocksRes.data ?? []) {
    if (!weeklyBlockBank[row.week_key]) {
      weeklyBlockBank[row.week_key] = [];
    }
    weeklyBlockBank[row.week_key].push({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      category: row.category ?? "General",
      durationMin: row.duration_min,
      startTime: row.start_time ?? null,
      actualDurationMin: row.actual_duration_min ?? null,
      actualStartTime: row.actual_start_time ?? null,
      color: row.color,
      completed: Boolean(row.completed),
      source: row.source,
      templateId: row.template_id ?? undefined,
      order: row.order ?? 0,
      createdAt: row.created_at,
    });
  }

  Object.values(weeklyBlockBank).forEach((list) => list.sort((a, b) => a.order - b.order));

  return normalizePlannerData({
    version: 1,
    templates: (templatesRes.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      defaultDurationMin: row.default_duration_min,
      category: row.category ?? "General",
      color: row.color,
      isVariableDuration: Boolean(row.is_variable_duration),
      createdAt: row.created_at,
    })),
    habits: (habitsRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category ?? "General",
      order: row.order ?? 0,
      createdAt: row.created_at,
      archivedAt: row.archived_at ?? null,
    })),
    days: daysMap,
    weeklyTaskBank,
    weeklyBlockBank,
    todoist: {
      apiToken: todoistRes.data?.api_token ?? null,
      lastSyncAt: todoistRes.data?.last_sync_at ?? null,
    },
  });
};

const rowsForDayBlocks = (
  ownerId: string,
  days: PlannerData["days"],
  templateIds: Set<string>,
) => {
  const rows: Record<string, unknown>[] = [];
  Object.entries(days).forEach(([dateKey, day]) => {
    day.blocks.forEach((block: TimeBlock) => {
      const safeTemplateId =
        block.templateId && templateIds.has(block.templateId)
          ? block.templateId
          : null;
      rows.push({
        owner_id: ownerId,
        id: block.id,
        date_key: dateKey,
        title: block.title,
        description: block.description ?? "",
        category: block.category ?? "General",
        duration_min: block.durationMin,
        start_time: block.startTime ?? null,
        actual_duration_min: block.actualDurationMin ?? null,
        actual_start_time: block.actualStartTime ?? null,
        color: block.color,
        completed: block.completed,
        source: block.source,
        template_id: safeTemplateId,
        order: block.order,
        created_at: block.createdAt,
      });
    });
  });
  return rows;
};

const rowsForDayTodos = (ownerId: string, days: PlannerData["days"]) => {
  const rows: Record<string, unknown>[] = [];
  Object.entries(days).forEach(([dateKey, day]) => {
    day.todos.forEach((todo: TodoItem) => {
      rows.push({
        owner_id: ownerId,
        id: todo.id,
        date_key: dateKey,
        text: todo.text,
        due_time: todo.dueTime ?? null,
        completed: todo.completed,
        source: todo.source ?? "local",
        external_id: todo.externalId ?? null,
        labels: todo.labels ?? [],
        order: todo.order,
        created_at: todo.createdAt,
      });
    });
  });
  return rows;
};

export const savePlannerToCloud = async (ownerId: string, rawData: PlannerData) => {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const data = normalizePlannerData(rawData);
  const localDaysCount = Object.keys(data.days ?? {}).length;

  // Safety guard: avoid destructive wipes caused by transient empty state.
  // If cloud already has day data and local payload has zero days, abort sync.
  const { count: existingDayCount, error: countError } = await supabase
    .from("planner_days")
    .select("owner_id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (countError) {
    throw countError;
  }
  if ((existingDayCount ?? 0) > 0 && localDaysCount === 0) {
    throw new Error(
      "Cloud sync blocked: local payload has no day data while cloud has existing entries.",
    );
  }

  const deletes = [
    "day_habit_checks",
    "day_todos",
    "day_time_blocks",
    "planner_days",
    "weekly_task_bank_todos",
    "weekly_block_bank_blocks",
    "habits",
    "time_block_templates",
    "todoist_settings",
  ];

  for (const table of deletes) {
    const { error } = await supabase.from(table).delete().eq("owner_id", ownerId);
    if (error) {
      throw error;
    }
  }

  const templateRows = data.templates.map((template) => ({
    owner_id: ownerId,
    id: template.id,
    title: template.title,
    description: template.description ?? "",
    default_duration_min: template.defaultDurationMin,
    category: template.category ?? "General",
    color: template.color,
    is_variable_duration: template.isVariableDuration,
    created_at: template.createdAt,
  }));
  for (const c of chunk(templateRows)) {
    if (c.length === 0) continue;
    const { error } = await supabase
      .from("time_block_templates")
      .upsert(c, { onConflict: "owner_id,id" });
    if (error) throw error;
  }
  const templateIds = new Set(data.templates.map((template) => template.id));

  const habitRows = data.habits.map((habit) => ({
    owner_id: ownerId,
    id: habit.id,
    name: habit.name,
    category: habit.category ?? "General",
    order: habit.order,
    created_at: habit.createdAt,
    archived_at: habit.archivedAt ?? null,
  }));
  for (const c of chunk(habitRows)) {
    if (c.length === 0) continue;
    const { error } = await supabase.from("habits").upsert(c, { onConflict: "owner_id,id" });
    if (error) throw error;
  }
  const habitIds = new Set(data.habits.map((habit) => habit.id));

  const dayRows = Object.entries(data.days).map(([dateKey, day]) => ({
    owner_id: ownerId,
    date_key: dateKey,
    top_priority_1: day.topPriorities[0] ?? "",
    top_priority_2: day.topPriorities[1] ?? "",
    top_priority_3: day.topPriorities[2] ?? "",
  }));
  for (const c of chunk(dayRows)) {
    if (c.length === 0) continue;
    const { error } = await supabase
      .from("planner_days")
      .upsert(c, { onConflict: "owner_id,date_key" });
    if (error) throw error;
  }

  for (const c of chunk(rowsForDayBlocks(ownerId, data.days, templateIds))) {
    if (c.length === 0) continue;
    const { error } = await supabase
      .from("day_time_blocks")
      .upsert(c, { onConflict: "owner_id,id" });
    if (error) throw error;
  }

  for (const c of chunk(rowsForDayTodos(ownerId, data.days))) {
    if (c.length === 0) continue;
    const { error } = await supabase.from("day_todos").upsert(c, { onConflict: "owner_id,id" });
    if (error) throw error;
  }

  const dayChecks: Record<string, unknown>[] = [];
  Object.entries(data.days).forEach(([dateKey, day]) => {
    Object.entries(day.habitChecks).forEach(([habitId, checked]) => {
      if (checked && habitIds.has(habitId)) {
        dayChecks.push({
          owner_id: ownerId,
          date_key: dateKey,
          habit_id: habitId,
          checked: true,
        });
      }
    });
  });
  for (const c of chunk(dayChecks)) {
    if (c.length === 0) continue;
    const { error } = await supabase
      .from("day_habit_checks")
      .upsert(c, { onConflict: "owner_id,date_key,habit_id" });
    if (error) throw error;
  }

  const weeklyTaskRows: Record<string, unknown>[] = [];
  Object.entries(data.weeklyTaskBank).forEach(([weekKey, tasks]) => {
    tasks.forEach((todo) => {
      weeklyTaskRows.push({
        owner_id: ownerId,
        id: todo.id,
        week_key: weekKey,
        text: todo.text,
        due_time: todo.dueTime ?? null,
        completed: todo.completed,
        source: todo.source ?? "local",
        external_id: todo.externalId ?? null,
        labels: todo.labels ?? [],
        order: todo.order,
        created_at: todo.createdAt,
      });
    });
  });
  for (const c of chunk(weeklyTaskRows)) {
    if (c.length === 0) continue;
    const { error } = await supabase
      .from("weekly_task_bank_todos")
      .upsert(c, { onConflict: "owner_id,id" });
    if (error) throw error;
  }

  const weeklyBlockRows: Record<string, unknown>[] = [];
  Object.entries(data.weeklyBlockBank).forEach(([weekKey, blocks]) => {
    blocks.forEach((block) => {
      const safeTemplateId =
        block.templateId && templateIds.has(block.templateId)
          ? block.templateId
          : null;
      weeklyBlockRows.push({
        owner_id: ownerId,
        id: block.id,
        week_key: weekKey,
        title: block.title,
        description: block.description ?? "",
        category: block.category ?? "General",
        duration_min: block.durationMin,
        start_time: block.startTime ?? null,
        actual_duration_min: block.actualDurationMin ?? null,
        actual_start_time: block.actualStartTime ?? null,
        color: block.color,
        completed: block.completed,
        source: block.source,
        template_id: safeTemplateId,
        order: block.order,
        created_at: block.createdAt,
      });
    });
  });
  for (const c of chunk(weeklyBlockRows)) {
    if (c.length === 0) continue;
    const { error } = await supabase
      .from("weekly_block_bank_blocks")
      .upsert(c, { onConflict: "owner_id,id" });
    if (error) throw error;
  }

  const { error: todoistError } = await supabase.from("todoist_settings").upsert(
    {
      owner_id: ownerId,
      api_token: data.todoist.apiToken ?? null,
      last_sync_at: data.todoist.lastSyncAt ?? null,
    },
    { onConflict: "owner_id" },
  );
  if (todoistError) {
    throw todoistError;
  }
};
