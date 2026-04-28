const FALLBACK_NOTE_PATH = "Timebloxx/Inbox.md";

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

const buildHeaders = (apiKey, contentType) => {
  const headers = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (typeof apiKey === "string" && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
    headers["x-api-key"] = apiKey.trim();
    headers["Api-Key"] = apiKey.trim();
  }
  return headers;
};

const parseEndpoint = (endpointUrl) => {
  const parsed = new URL(endpointUrl);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  const vaultIndex = pathname.indexOf("/vault");
  const isVaultEndpoint = vaultIndex >= 0;
  const basePath = isVaultEndpoint ? pathname.slice(0, vaultIndex) : pathname;
  const originPath = `${parsed.origin}${basePath}`;
  return {
    parsed,
    baseUrl: originPath,
    isVaultEndpoint,
  };
};

const encodeVaultPath = (path) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const cleanMarkdownPath = (value) => {
  const trimmed = String(value ?? "").trim().replace(/^\/+/, "");
  if (!trimmed) {
    return "";
  }
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
};

const inferNotePath = (note) => {
  const fromId = cleanMarkdownPath(note?.id);
  if (fromId) {
    return fromId;
  }
  const fromTitle = cleanMarkdownPath(note?.title?.replace(/[\\/:*?"<>|]/g, "-"));
  if (fromTitle) {
    return `Timebloxx/${fromTitle}`;
  }
  return FALLBACK_NOTE_PATH;
};

const readBridgeNotes = async (endpointUrl, apiKey) => {
  const response = await fetch(endpointUrl, {
    method: "GET",
    headers: buildHeaders(apiKey, "application/json"),
  });
  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      // no-op
    }
    const error = new Error(
      details
        ? `Obsidian read failed (${response.status}): ${details}`
        : `Obsidian read failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const rawNotes = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.notes)
      ? payload.notes
      : [];
  return rawNotes.map(normalizeNote);
};

const readLocalRestNotes = async (baseUrl, apiKey) => {
  const listResponse = await fetch(`${baseUrl}/vault/`, {
    method: "GET",
    headers: buildHeaders(apiKey),
  });

  if (!listResponse.ok) {
    let details = "";
    try {
      details = await listResponse.text();
    } catch {
      // no-op
    }
    const error = new Error(
      details
        ? `Obsidian read failed (${listResponse.status}): ${details}`
        : `Obsidian read failed (${listResponse.status})`,
    );
    error.status = listResponse.status;
    throw error;
  }

  let listed = [];
  try {
    listed = await listResponse.json();
  } catch {
    listed = [];
  }

  const paths = (Array.isArray(listed) ? listed : [])
    .filter((entry) => typeof entry === "string" && entry.toLowerCase().endsWith(".md"))
    .slice(0, 40);

  const noteResults = await Promise.all(
    paths.map(async (path) => {
      const url = `${baseUrl}/vault/${encodeVaultPath(path)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(apiKey, "text/markdown"),
      });
      if (!response.ok) {
        return null;
      }
      const content = await response.text();
      const title = path.split("/").pop()?.replace(/\.md$/i, "") || "Untitled note";
      return normalizeNote({
        id: path,
        title,
        content,
        updatedAt: new Date().toISOString(),
        tags: [],
      });
    }),
  );

  return noteResults.filter(Boolean);
};

const writeBridgeNote = async (endpointUrl, apiKey, note) => {
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: buildHeaders(apiKey, "application/json"),
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
    const error = new Error(
      details
        ? `Obsidian write failed (${response.status}): ${details}`
        : `Obsidian write failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }
  return true;
};

const writeLocalRestNote = async (baseUrl, apiKey, note) => {
  const normalized = normalizeNote(note);
  const notePath = inferNotePath(normalized);
  const response = await fetch(`${baseUrl}/vault/${encodeVaultPath(notePath)}`, {
    method: "PUT",
    headers: buildHeaders(apiKey, "text/markdown"),
    body: normalized.content ?? "",
  });
  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch {
      // no-op
    }
    const error = new Error(
      details
        ? `Obsidian write failed (${response.status}): ${details}`
        : `Obsidian write failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }
  return true;
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

  let endpointInfo;
  try {
    endpointInfo = parseEndpoint(endpointUrl);
  } catch {
    res.status(400).json({ error: "Invalid endpointUrl" });
    return;
  }

  const treatAsLocalRest =
    endpointInfo.isVaultEndpoint ||
    endpointInfo.parsed.hostname === "127.0.0.1" ||
    endpointInfo.parsed.hostname === "localhost";

  try {
    if (action === "read") {
      const notes = treatAsLocalRest
        ? await readLocalRestNotes(endpointInfo.baseUrl, apiKey)
        : await readBridgeNotes(endpointUrl, apiKey);
      res.status(200).json({ notes });
      return;
    }

    if (action === "write") {
      if (!note || typeof note !== "object") {
        res.status(400).json({ error: "Missing note payload" });
        return;
      }
      if (treatAsLocalRest) {
        await writeLocalRestNote(endpointInfo.baseUrl, apiKey, note);
      } else {
        await writeBridgeNote(endpointUrl, apiKey, note);
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Unsupported action" });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message =
      error instanceof Error ? error.message : "Unexpected Obsidian integration error";
    res.status(status).json({ error: message });
  }
}

