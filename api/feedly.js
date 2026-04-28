const FEEDLY_ENDPOINT = "https://api.feedly.com/v3/streams/contents";

const normalizeFeedlyItem = (item) => {
  const alternate = Array.isArray(item?.alternate) ? item.alternate : [];
  const firstAlt = alternate.find(
    (entry) => typeof entry?.href === "string" && entry.href.trim(),
  );

  const originTitle =
    typeof item?.origin?.title === "string" && item.origin.title.trim()
      ? item.origin.title
      : "Feedly";

  const published = Number.isFinite(item?.published)
    ? new Date(item.published).toISOString()
    : null;

  const title =
    typeof item?.title === "string" && item.title.trim() ? item.title : "Untitled";

  return {
    id:
      typeof item?.id === "string" && item.id.trim()
        ? item.id
        : `${title}-${published ?? Date.now()}`,
    source: originTitle,
    title,
    link: firstAlt?.href ?? null,
    publishedAt: published,
  };
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, streamId, count } = req.body ?? {};
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Missing Feedly token" });
    return;
  }
  if (!streamId || typeof streamId !== "string") {
    res.status(400).json({ error: "Missing Feedly streamId" });
    return;
  }

  const safeCount =
    typeof count === "number" && Number.isFinite(count)
      ? Math.max(1, Math.min(100, Math.floor(count)))
      : 20;

  try {
    const url = new URL(FEEDLY_ENDPOINT);
    url.searchParams.set("streamId", streamId);
    url.searchParams.set("count", String(safeCount));

    const response = await fetch(url, {
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
      res.status(response.status).json({
        error: details
          ? `Feedly sync failed (${response.status}): ${details}`
          : `Feedly sync failed (${response.status})`,
      });
      return;
    }

    const payload = await response.json();
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const items = rawItems.map(normalizeFeedlyItem);
    res.status(200).json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feedly sync failed";
    res.status(500).json({ error: message });
  }
}
