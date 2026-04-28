const normalizeNote = (raw) => ({
  id:
    typeof raw?.id === "string" && raw.id.trim()
      ? raw.id
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title:
    typeof raw?.title === "string" && raw.title.trim() ? raw.title : "Untitled note",
  content: typeof raw?.content === "string" ? raw.content : "",
  updatedAt:
    typeof raw?.updatedAt === "string" && raw.updatedAt.trim()
      ? raw.updatedAt
      : new Date().toISOString(),
  tags: Array.isArray(raw?.tags)
    ? raw.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim())
    : [],
});

const buildHeaders = (apiKey) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (typeof apiKey === "string" && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
    headers["x-api-key"] = apiKey.trim();
  }

  return headers;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { action, endpointUrl, apiKey, note } = req.body ?? {};
  if (!endpointUrl || typeof endpointUrl !== "string") {
    res.status(400).json({ error: "Missing endpointUrl" });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(endpointUrl);
  } catch {
    res.status(400).json({ error: "Invalid endpointUrl" });
    return;
  }

  const headers = buildHeaders(apiKey);

  if (action === "read") {
    try {
      const response = await fetch(parsedUrl, {
        method: "GET",
        headers,
      });
      if (!response.ok) {
        let details = "";
        try {
          details = await response.text();
        } catch {
          // no-op
        }
        res.status(response.status).json({
          error: details
            ? `Obsidian read failed (${response.status}): ${details}`
            : `Obsidian read failed (${response.status})`,
        });
        return;
      }
      const payload = await response.json();
      const rawNotes = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.notes)
          ? payload.notes
          : [];
      const notes = rawNotes.map(normalizeNote);
      res.status(200).json({ notes });
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected Obsidian read error";
      res.status(500).json({ error: message });
      return;
    }
  }

  if (action === "write") {
    if (!note || typeof note !== "object") {
      res.status(400).json({ error: "Missing note payload" });
      return;
    }
    try {
      const response = await fetch(parsedUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          note: normalizeNote(note),
        }),
      });
      if (!response.ok) {
        let details = "";
        try {
          details = await response.text();
        } catch {
          // no-op
        }
        res.status(response.status).json({
          error: details
            ? `Obsidian write failed (${response.status}): ${details}`
            : `Obsidian write failed (${response.status})`,
        });
        return;
      }
      let payload = { ok: true };
      try {
        payload = await response.json();
      } catch {
        // no-op
      }
      res.status(200).json(payload);
      return;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected Obsidian write error";
      res.status(500).json({ error: message });
      return;
    }
  }

  res.status(400).json({ error: "Unsupported action" });
}
