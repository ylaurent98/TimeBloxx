const decodeXml = (value) =>
  String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const firstMatch = (content, pattern) => {
  const match = pattern.exec(content);
  if (!match) {
    return "";
  }
  return decodeXml(match[1] ?? "");
};

const parseRssItems = (xmlText) => {
  const itemBlocks = [...xmlText.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(
    (match) => match[0],
  );
  if (itemBlocks.length > 0) {
    return itemBlocks.map((block) => ({
      title:
        firstMatch(block, /<title>([\s\S]*?)<\/title>/i).trim() || "Untitled entry",
      link:
        firstMatch(block, /<link>([\s\S]*?)<\/link>/i).trim() ||
        firstMatch(block, /<guid[^>]*>([\s\S]*?)<\/guid>/i).trim() ||
        null,
      publishedAt:
        firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/i).trim() ||
        firstMatch(block, /<dc:date>([\s\S]*?)<\/dc:date>/i).trim() ||
        null,
    }));
  }

  const entryBlocks = [...xmlText.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(
    (match) => match[0],
  );
  return entryBlocks.map((block) => {
    const linkHref = firstMatch(
      block,
      /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i,
    ).trim();
    const updated =
      firstMatch(block, /<updated>([\s\S]*?)<\/updated>/i).trim() ||
      firstMatch(block, /<published>([\s\S]*?)<\/published>/i).trim();
    return {
      title:
        firstMatch(block, /<title[^>]*>([\s\S]*?)<\/title>/i).trim() ||
        "Untitled entry",
      link: linkHref || null,
      publishedAt: updated || null,
    };
  });
};

const toIsoOrNull = (dateLike) => {
  if (!dateLike || typeof dateLike !== "string") {
    return null;
  }
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { url, source, count } = req.body ?? {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing RSS url" });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid RSS url" });
    return;
  }

  const safeCount =
    typeof count === "number" && Number.isFinite(count)
      ? Math.max(1, Math.min(40, Math.floor(count)))
      : 10;

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
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
          ? `RSS fetch failed (${response.status}): ${details}`
          : `RSS fetch failed (${response.status})`,
      });
      return;
    }

    const xmlText = await response.text();
    const parsedItems = parseRssItems(xmlText).slice(0, safeCount);
    const safeSource =
      typeof source === "string" && source.trim() ? source.trim() : parsedUrl.host;

    const items = parsedItems.map((item, index) => ({
      id: `${safeSource}-${index}-${item.link ?? item.title}`,
      source: safeSource,
      title: item.title,
      link: item.link,
      publishedAt: toIsoOrNull(item.publishedAt),
    }));

    res.status(200).json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RSS fetch failed";
    res.status(500).json({ error: message });
  }
}
