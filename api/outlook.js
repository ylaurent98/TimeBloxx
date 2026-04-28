const GRAPH_URL = "https://graph.microsoft.com/v1.0";

const asIsoRange = (dateKey, boundary) => {
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return `${dateKey}${suffix}`;
};

const normalizeEvent = (event) => ({
  id: String(event?.id ?? `${event?.subject ?? "event"}-${event?.start?.dateTime ?? ""}`),
  subject: typeof event?.subject === "string" && event.subject.trim() ? event.subject : "Untitled",
  start: event?.start?.dateTime ?? "",
  end: event?.end?.dateTime ?? "",
  location:
    typeof event?.location?.displayName === "string" &&
    event.location.displayName.trim()
      ? event.location.displayName
      : null,
  organizer:
    typeof event?.organizer?.emailAddress?.name === "string" &&
    event.organizer.emailAddress.name.trim()
      ? event.organizer.emailAddress.name
      : null,
  webLink:
    typeof event?.webLink === "string" && event.webLink.trim() ? event.webLink : null,
  isAllDay: Boolean(event?.isAllDay),
});

const fetchCalendarView = async ({ token, startDate, endDate, timezone }) => {
  const firstUrl = new URL(`${GRAPH_URL}/me/calendar/calendarView`);
  firstUrl.searchParams.set("startDateTime", asIsoRange(startDate, "start"));
  firstUrl.searchParams.set("endDateTime", asIsoRange(endDate, "end"));
  firstUrl.searchParams.set(
    "$select",
    "id,subject,start,end,location,organizer,webLink,isAllDay",
  );
  firstUrl.searchParams.set("$orderby", "start/dateTime");
  firstUrl.searchParams.set("$top", "100");

  const allEvents = [];
  let nextUrl = firstUrl.toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: `outlook.timezone="${timezone}"`,
      },
    });

    if (!response.ok) {
      let details = "";
      try {
        details = await response.text();
      } catch {
        // no-op
      }
      const error = new Error(`Outlook request failed (${response.status})`);
      error.status = response.status;
      error.details = details;
      throw error;
    }

    const payload = await response.json();
    const values = Array.isArray(payload?.value) ? payload.value : [];
    values.forEach((event) => allEvents.push(normalizeEvent(event)));
    nextUrl =
      typeof payload?.["@odata.nextLink"] === "string" &&
      payload["@odata.nextLink"].trim()
        ? payload["@odata.nextLink"]
        : "";
  }

  return allEvents;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, startDate, endDate, timezone } = req.body ?? {};
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Missing Outlook access token" });
    return;
  }

  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    res.status(400).json({ error: "Invalid startDate or endDate" });
    return;
  }

  const safeTimezone =
    typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC";

  try {
    const events = await fetchCalendarView({
      token,
      startDate,
      endDate,
      timezone: safeTimezone,
    });
    res.status(200).json({ events });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const details = typeof error?.details === "string" ? error.details : "";
    const message =
      status === 401
        ? "Outlook token is unauthorized or expired."
        : `Outlook sync failed (${status})`;
    res.status(status).json({
      error: details ? `${message} ${details}` : message,
    });
  }
}
