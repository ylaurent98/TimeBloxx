const getTodoistPageItems = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  if (Array.isArray(payload?.tasks)) {
    return payload.tasks;
  }
  if (Array.isArray(payload?.projects)) {
    return payload.projects;
  }
  return [];
};

const getTodoistNextCursor = (payload) =>
  typeof payload?.next_cursor === "string" && payload.next_cursor.trim()
    ? payload.next_cursor
    : null;

const fetchTodoistCollection = async (token, path) => {
  const allItems = [];
  let cursor = null;

  while (true) {
    const requestUrl = new URL(`https://api.todoist.com${path}`);
    if (cursor) {
      requestUrl.searchParams.set("cursor", cursor);
    }

    const response = await fetch(requestUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      let details = "";
      try {
        details = await response.text();
      } catch {
        // no-op
      }
      const error = new Error(`Todoist fetch failed (${response.status})`);
      error.status = response.status;
      error.details = details;
      throw error;
    }

    const payload = await response.json();
    allItems.push(...getTodoistPageItems(payload));
    const nextCursor = getTodoistNextCursor(payload);
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return allItems;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, action, externalId } = req.body ?? {};
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Missing Todoist token" });
    return;
  }

  if (action === "import") {
    try {
      const allTasks = await fetchTodoistCollection(token, "/api/v1/tasks");
      let allProjects = [];
      try {
        allProjects = await fetchTodoistCollection(token, "/api/v1/projects");
      } catch {
        allProjects = [];
      }

      const projectNameById = new Map();
      allProjects.forEach((project) => {
        const id = project?.id;
        const name =
          typeof project?.name === "string" ? project.name.trim() : "";
        if (id != null && name) {
          projectNameById.set(String(id), name);
        }
      });

      const tasks = allTasks.map((task) => {
        const existingProjectName =
          typeof task?.project_name === "string" ? task.project_name.trim() : "";
        const fallbackProjectName =
          task?.project_id != null
            ? projectNameById.get(String(task.project_id)) ?? null
            : null;
        return {
          ...task,
          project_name: existingProjectName || fallbackProjectName,
        };
      });

      res.status(200).json({ tasks });
      return;
    } catch (error) {
      const status = Number(error?.status) || 500;
      const details =
        typeof error?.details === "string" ? error.details : String(error);
      res
        .status(status)
        .json({ error: `Todoist import failed (${status})`, details });
      return;
    }
  }

  if (action === "close" || action === "reopen") {
    if (!externalId || typeof externalId !== "string") {
      res.status(400).json({ error: "Missing externalId" });
      return;
    }
    const response = await fetch(
      `https://api.todoist.com/api/v1/tasks/${externalId}/${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) {
      let details = "";
      try {
        details = await response.text();
      } catch {
        // no-op
      }
      res
        .status(response.status)
        .json({ error: `Todoist ${action} failed (${response.status})`, details });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Unsupported action" });
}
