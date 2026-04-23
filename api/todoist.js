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
    const allTasks = [];
    let cursor = null;

    while (true) {
      const requestUrl = new URL("https://api.todoist.com/api/v1/tasks");
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
        res
          .status(response.status)
          .json({ error: `Todoist import failed (${response.status})`, details });
        return;
      }

      const payload = await response.json();
      const pageTasks = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.tasks)
            ? payload.tasks
            : [];
      allTasks.push(...pageTasks);

      const nextCursor =
        typeof payload?.next_cursor === "string" && payload.next_cursor.trim()
          ? payload.next_cursor
          : null;
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    res.status(200).json({ tasks: allTasks });
    return;
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
