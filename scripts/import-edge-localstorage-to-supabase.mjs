import fs from "node:fs";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerId = process.env.OWNER_ID ?? "edge-local-owner";
const authUserId = process.env.AUTH_USER_ID ?? null;
const inputPath = process.argv[2] ?? "planner-export.json";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const resolvedInputPath = path.resolve(process.cwd(), inputPath);
if (!fs.existsSync(resolvedInputPath)) {
  console.error(`Input file not found: ${resolvedInputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(resolvedInputPath, "utf8");
const planner = JSON.parse(raw);

const jsonHeaders = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
};

const restRequest = async (table, options = {}) => {
  const { method = "GET", query = new URLSearchParams(), body, prefer } = options;
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  if (query) {
    url.search = query.toString();
  }

  const headers = { ...jsonHeaders };
  if (prefer) {
    headers.prefer = prefer;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${table} failed: ${response.status} ${text}`);
  }
};

const ownerFilter = () => {
  const query = new URLSearchParams();
  query.set("owner_id", `eq.${ownerId}`);
  return query;
};

const upsertRows = async (table, onConflict, rows) => {
  if (!rows.length) {
    return;
  }

  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const query = new URLSearchParams();
    query.set("on_conflict", onConflict);
    await restRequest(table, {
      method: "POST",
      query,
      prefer: "resolution=merge-duplicates,return=minimal",
      body: chunk,
    });
  }
};

const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeObject = (value) => (value && typeof value === "object" ? value : {});

const normalizeDateString = (value) => (value ? value : new Date().toISOString());

const buildRows = () => {
  const templates = safeArray(planner.templates).map((template) => ({
    owner_id: ownerId,
    id: template.id,
    title: template.title ?? "",
    description: template.description ?? "",
    default_duration_min: Math.max(1, Math.round(template.defaultDurationMin ?? 1)),
    category: template.category ?? "General",
    color: template.color ?? "#6B7280",
    is_variable_duration: Boolean(template.isVariableDuration),
    created_at: normalizeDateString(template.createdAt),
  }));

  const habits = safeArray(planner.habits).map((habit) => ({
    owner_id: ownerId,
    id: habit.id,
    name: habit.name ?? "",
    category: habit.category ?? "General",
    order: Number.isFinite(habit.order) ? habit.order : 0,
    created_at: normalizeDateString(habit.createdAt),
    archived_at: habit.archivedAt ?? null,
  }));

  const days = safeObject(planner.days);
  const plannerDays = [];
  const dayBlocks = [];
  const dayTodos = [];
  const dayHabitChecks = [];

  for (const [dateKey, day] of Object.entries(days)) {
    const priorities = safeArray(day?.topPriorities);
    plannerDays.push({
      owner_id: ownerId,
      date_key: dateKey,
      top_priority_1: priorities[0] ?? "",
      top_priority_2: priorities[1] ?? "",
      top_priority_3: priorities[2] ?? "",
    });

    for (const block of safeArray(day?.blocks)) {
      dayBlocks.push({
        owner_id: ownerId,
        id: block.id,
        date_key: dateKey,
        title: block.title ?? "",
        description: block.description ?? "",
        category: block.category ?? "General",
        duration_min: Math.max(1, Math.round(block.durationMin ?? 1)),
        start_time: block.startTime ?? null,
        actual_duration_min:
          block.actualDurationMin == null
            ? null
            : Math.max(1, Math.round(block.actualDurationMin)),
        actual_start_time: block.actualStartTime ?? null,
        color: block.color ?? "#6B7280",
        completed: Boolean(block.completed),
        source: block.source === "template" ? "template" : "one-time",
        template_id: block.templateId ?? null,
        order: Number.isFinite(block.order) ? block.order : 0,
        created_at: normalizeDateString(block.createdAt),
      });
    }

    for (const todo of safeArray(day?.todos)) {
      dayTodos.push({
        owner_id: ownerId,
        id: todo.id,
        date_key: dateKey,
        text: todo.text ?? "",
        due_time: todo.dueTime ?? null,
        completed: Boolean(todo.completed),
        source: todo.source === "todoist" ? "todoist" : "local",
        external_id: todo.externalId ?? null,
        labels: safeArray(todo.labels),
        order: Number.isFinite(todo.order) ? todo.order : 0,
        created_at: normalizeDateString(todo.createdAt),
      });
    }

    const checks = safeObject(day?.habitChecks);
    for (const [habitId, checked] of Object.entries(checks)) {
      if (!checked) {
        continue;
      }
      dayHabitChecks.push({
        owner_id: ownerId,
        date_key: dateKey,
        habit_id: habitId,
        checked: true,
      });
    }
  }

  const weeklyTaskBank = safeObject(planner.weeklyTaskBank);
  const weeklyTasks = [];
  for (const [weekKey, tasks] of Object.entries(weeklyTaskBank)) {
    for (const todo of safeArray(tasks)) {
      weeklyTasks.push({
        owner_id: ownerId,
        id: todo.id,
        week_key: weekKey,
        text: todo.text ?? "",
        due_time: todo.dueTime ?? null,
        completed: Boolean(todo.completed),
        source: todo.source === "todoist" ? "todoist" : "local",
        external_id: todo.externalId ?? null,
        labels: safeArray(todo.labels),
        order: Number.isFinite(todo.order) ? todo.order : 0,
        created_at: normalizeDateString(todo.createdAt),
      });
    }
  }

  const weeklyBlockBank = safeObject(planner.weeklyBlockBank);
  const weeklyBlocks = [];
  for (const [weekKey, blocks] of Object.entries(weeklyBlockBank)) {
    for (const block of safeArray(blocks)) {
      weeklyBlocks.push({
        owner_id: ownerId,
        id: block.id,
        week_key: weekKey,
        title: block.title ?? "",
        description: block.description ?? "",
        category: block.category ?? "General",
        duration_min: Math.max(1, Math.round(block.durationMin ?? 1)),
        start_time: block.startTime ?? null,
        actual_duration_min:
          block.actualDurationMin == null
            ? null
            : Math.max(1, Math.round(block.actualDurationMin)),
        actual_start_time: block.actualStartTime ?? null,
        color: block.color ?? "#6B7280",
        completed: Boolean(block.completed),
        source: block.source === "template" ? "template" : "one-time",
        template_id: block.templateId ?? null,
        order: Number.isFinite(block.order) ? block.order : 0,
        created_at: normalizeDateString(block.createdAt),
      });
    }
  }

  const todoist = planner.todoist ?? {};
  const todoistSettings = [
    {
      owner_id: ownerId,
      api_token: todoist.apiToken ?? null,
      last_sync_at: todoist.lastSyncAt ?? null,
    },
  ];

  return {
    templates,
    habits,
    plannerDays,
    dayBlocks,
    dayTodos,
    dayHabitChecks,
    weeklyTasks,
    weeklyBlocks,
    todoistSettings,
  };
};

const main = async () => {
  await upsertRows("planner_profiles", "owner_id", [
    {
      owner_id: ownerId,
      auth_user_id: authUserId,
      display_name: ownerId,
      updated_at: new Date().toISOString(),
    },
  ]);

  await restRequest("day_habit_checks", { method: "DELETE", query: ownerFilter() });
  await restRequest("day_todos", { method: "DELETE", query: ownerFilter() });
  await restRequest("day_time_blocks", { method: "DELETE", query: ownerFilter() });
  await restRequest("planner_days", { method: "DELETE", query: ownerFilter() });
  await restRequest("weekly_task_bank_todos", {
    method: "DELETE",
    query: ownerFilter(),
  });
  await restRequest("weekly_block_bank_blocks", {
    method: "DELETE",
    query: ownerFilter(),
  });
  await restRequest("habits", { method: "DELETE", query: ownerFilter() });
  await restRequest("time_block_templates", { method: "DELETE", query: ownerFilter() });
  await restRequest("todoist_settings", { method: "DELETE", query: ownerFilter() });

  const rows = buildRows();

  await upsertRows("time_block_templates", "owner_id,id", rows.templates);
  await upsertRows("habits", "owner_id,id", rows.habits);
  await upsertRows("planner_days", "owner_id,date_key", rows.plannerDays);
  await upsertRows("day_time_blocks", "owner_id,id", rows.dayBlocks);
  await upsertRows("day_todos", "owner_id,id", rows.dayTodos);
  await upsertRows("day_habit_checks", "owner_id,date_key,habit_id", rows.dayHabitChecks);
  await upsertRows("weekly_task_bank_todos", "owner_id,id", rows.weeklyTasks);
  await upsertRows("weekly_block_bank_blocks", "owner_id,id", rows.weeklyBlocks);
  await upsertRows("todoist_settings", "owner_id", rows.todoistSettings);

  console.log("Import complete.");
  console.log(
    JSON.stringify(
      {
        ownerId,
        templates: rows.templates.length,
        habits: rows.habits.length,
        plannerDays: rows.plannerDays.length,
        dayBlocks: rows.dayBlocks.length,
        dayTodos: rows.dayTodos.length,
        dayHabitChecks: rows.dayHabitChecks.length,
        weeklyTasks: rows.weeklyTasks.length,
        weeklyBlocks: rows.weeklyBlocks.length,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
