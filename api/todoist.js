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
    const response = await fetch("https://api.todoist.com/rest/v2/tasks", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      res
        .status(response.status)
        .json({ error: `Todoist import failed (${response.status})` });
      return;
    }
    const tasks = await response.json();
    res.status(200).json({ tasks });
    return;
  }

  if (action === "close" || action === "reopen") {
    if (!externalId || typeof externalId !== "string") {
      res.status(400).json({ error: "Missing externalId" });
      return;
    }
    const response = await fetch(
      `https://api.todoist.com/rest/v2/tasks/${externalId}/${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) {
      res
        .status(response.status)
        .json({ error: `Todoist ${action} failed (${response.status})` });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Unsupported action" });
}
