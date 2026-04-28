import { useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "./SectionCard";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import {
  endOfWeekDateKey,
  formatDateLabel,
  formatShortWeekdayLabel,
  startOfWeekDateKey,
  todayDateKey,
} from "../utils/date";
import type { DateKey } from "../types";

type MediaType = "podcast" | "article" | "book" | "movie" | "video";
type MediaStatus = "started" | "reading" | "read";
type KanbanColumnId = "idea" | "active" | "blocked" | "done";
type QuickListKey = "buy" | "presents" | "brainstorm";
type DashboardTheme = "juicy" | "citrus" | "bubblegum";
type DashboardCardSize = "small" | "medium" | "large";

interface OAuthBundle {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string | null;
}

interface WhoopDailyMetric {
  id: string;
  dateKey: DateKey;
  recoveryScore: number | null;
  sleepPerformance: number | null;
  strain: number | null;
  hrv: number | null;
  steps: number | null;
  calories: number | null;
  restingHeartRate: number | null;
  sleepHours: number | null;
}

interface OutlookEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location: string | null;
  organizer: string | null;
  webLink: string | null;
  isAllDay: boolean;
}

interface ObsidianNote {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  tags: string[];
}

interface KanbanCard {
  id: string;
  title: string;
  project: string;
  column: KanbanColumnId;
  dueDate: DateKey | null;
}

interface QuoteItem {
  id: string;
  text: string;
  author: string;
}

interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  creator: string;
  startedOn: DateKey | null;
  finishedOn: DateKey | null;
  notes: string;
}

interface FeedItem {
  id: string;
  source: string;
  title: string;
  link: string | null;
  publishedAt: string | null;
}

interface SubstackFeed {
  id: string;
  name: string;
  feedUrl: string;
}

interface QuickListItem {
  id: string;
  text: string;
  done: boolean;
}

interface StickyNoteItem {
  id: string;
  text: string;
  x: number;
  y: number;
  style: "yellow-square" | "pink-heart";
}

interface IntegrationsDashboardData {
  whoop: {
    token: string;
    refreshToken?: string;
    tokenExpiresAt?: string | null;
    scope?: string;
    metrics: WhoopDailyMetric[];
    lastSyncedAt: string | null;
  };
  outlook: {
    token: string;
    refreshToken?: string;
    tokenExpiresAt?: string | null;
    scope?: string;
    events: OutlookEvent[];
    timezone: string;
    lastSyncedAt: string | null;
  };
  obsidian: {
    endpointUrl: string;
    apiKey: string;
    notes: ObsidianNote[];
    selectedNoteId: string | null;
    lastSyncedAt: string | null;
  };
  kanban: {
    cards: KanbanCard[];
  };
  quotes: QuoteItem[];
  media: {
    entries: MediaItem[];
  };
  feedly: {
    token: string;
    streamId: string;
    items: FeedItem[];
    lastSyncedAt: string | null;
  };
  substack: {
    feeds: SubstackFeed[];
    items: FeedItem[];
    lastSyncedAt: string | null;
  };
  quickLists: {
    buy: QuickListItem[];
    presents: QuickListItem[];
    brainstorm: QuickListItem[];
  };
  stickyNotes: StickyNoteItem[];
}

interface WhoopResponse {
  metrics: Array<{
    dateKey: DateKey;
    recoveryScore: number | null;
    sleepPerformance: number | null;
    strain: number | null;
    hrv: number | null;
    steps: number | null;
    calories: number | null;
    restingHeartRate: number | null;
    sleepHours: number | null;
  }>;
  tokens?: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    scope: string | null;
  } | null;
}

interface OutlookResponse {
  events: OutlookEvent[];
}

interface FeedlyResponse {
  items: FeedItem[];
}

interface RssResponse {
  items: FeedItem[];
}

type OAuthPopupMessage =
  | {
      type: "oauth-success";
      provider: "whoop" | "outlook";
      tokens: OAuthBundle;
    }
  | {
      type: "oauth-error";
      provider: "whoop" | "outlook";
      error: string;
    };

const STORAGE_KEY = "timebloxx.integrations.dashboard.v1";
const DASHBOARD_CARD_SIZE_KEY = "timebloxx.integrations.dashboard.cardSize.v1";
const DASHBOARD_THEMES: Record<
  DashboardTheme,
  { label: string; swatch: [string, string, string] }
> = {
  juicy: { label: "Juicy", swatch: ["#ffd5b8", "#4a1a5e", "#00a896"] },
  citrus: { label: "Seaside", swatch: ["#fff4d6", "#0b4a8f", "#ff7a1a"] },
  bubblegum: { label: "Bubblegum", swatch: ["#ffd6e8", "#1a3a52", "#ff4d9d"] },
};

const KANBAN_COLUMNS: Array<{
  id: KanbanColumnId;
  title: string;
  accent: string;
}> = [
  { id: "idea", title: "Idea", accent: "border-sky-200 bg-sky-50/70" },
  { id: "active", title: "Active", accent: "border-emerald-200 bg-emerald-50/70" },
  { id: "blocked", title: "Blocked", accent: "border-amber-200 bg-amber-50/80" },
  { id: "done", title: "Done", accent: "border-rose-200 bg-rose-50/70" },
];

const MEDIA_TYPES: MediaType[] = ["podcast", "article", "book", "movie", "video"];
const MEDIA_STATUSES: MediaStatus[] = ["started", "reading", "read"];

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseUrlOrNull = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isLocalObsidianEndpoint = (endpointUrl: string) => {
  const parsed = parseUrlOrNull(endpointUrl);
  if (!parsed) {
    return false;
  }
  return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
};

const buildObsidianHeaders = (apiKey: string) => {
  const key = apiKey.trim();
  const headers: Record<string, string> = {};
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers["x-api-key"] = key;
    headers["Api-Key"] = key;
  }
  return headers;
};

const encodeVaultPath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const extractMarkdownPathsFromListing = (payload: unknown): string[] => {
  const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const candidates = [
    ...asArray(payload),
    ...asArray((payload as { files?: unknown[] } | null)?.files),
    ...asArray((payload as { items?: unknown[] } | null)?.items),
    ...asArray((payload as { data?: unknown[] } | null)?.data),
  ];

  const paths = candidates
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object") {
        const maybePath =
          (entry as { path?: unknown }).path ??
          (entry as { filename?: unknown }).filename ??
          (entry as { name?: unknown }).name;
        if (typeof maybePath === "string") {
          return maybePath;
        }
      }
      return "";
    })
    .map((path) => path.trim().replace(/^\/+/, ""))
    .filter((path) => path.toLowerCase().endsWith(".md"));

  return [...new Set(paths)];
};

const inferNotePath = (note: ObsidianNote) => {
  const cleanedId = (note.id || "").trim().replace(/^\/+/, "");
  if (cleanedId) {
    return cleanedId.toLowerCase().endsWith(".md") ? cleanedId : `${cleanedId}.md`;
  }
  const fromTitle = note.title.trim().replace(/[\\/:*?"<>|]/g, "-");
  if (fromTitle) {
    return `Timebloxx/${fromTitle}.md`;
  }
  return `Timebloxx/note-${Date.now()}.md`;
};

const todayAsDateKey = (): DateKey => todayDateKey();

const weekRangeForToday = () => {
  const today = todayAsDateKey();
  return {
    start: startOfWeekDateKey(today, 1),
    end: endOfWeekDateKey(today, 1),
  };
};

const toInputDateTime = (isoString: string | null | undefined) => {
  if (!isoString) {
    return "n/a";
  }
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDayNumber = (dateKey: DateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

const toStatusClass = (status: MediaStatus) => {
  if (status === "read") {
    return "bg-emerald-100 text-emerald-900";
  }
  if (status === "reading") {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-sky-100 text-sky-900";
};

const createInitialData = (): IntegrationsDashboardData => ({
  whoop: {
    token: "",
    refreshToken: "",
    tokenExpiresAt: null,
    scope: "",
    metrics: [],
    lastSyncedAt: null,
  },
  outlook: {
    token: "",
    refreshToken: "",
    tokenExpiresAt: null,
    scope: "",
    events: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    lastSyncedAt: null,
  },
  obsidian: {
    endpointUrl: "",
    apiKey: "",
    selectedNoteId: null,
    lastSyncedAt: null,
    notes: [],
  },
  kanban: {
    cards: [
      {
        id: "card-1",
        title: "Ship integration dashboard v2",
        project: "Timebloxx",
        column: "active",
        dueDate: todayAsDateKey(),
      },
      {
        id: "card-2",
        title: "Complete OAuth app setup",
        project: "Integrations",
        column: "idea",
        dueDate: null,
      },
    ],
  },
  quotes: [
    {
      id: "quote-1",
      text: "Focus is saying no to the hundred other good ideas.",
      author: "Steve Jobs",
    },
    {
      id: "quote-2",
      text: "Consistency compounds faster than intensity.",
      author: "James Clear",
    },
  ],
  media: {
    entries: [
      {
        id: "media-1",
        title: "The Almanack of Naval Ravikant",
        type: "book",
        status: "reading",
        creator: "Eric Jorgenson",
        startedOn: todayAsDateKey(),
        finishedOn: null,
        notes: "Great mental models to revisit monthly.",
      },
      {
        id: "media-2",
        title: "Acquired podcast - Costco episode",
        type: "podcast",
        status: "started",
        creator: "Acquired",
        startedOn: todayAsDateKey(),
        finishedOn: null,
        notes: "",
      },
    ],
  },
  feedly: {
    token: "",
    streamId: "",
    items: [],
    lastSyncedAt: null,
  },
  substack: {
    feeds: [],
    items: [],
    lastSyncedAt: null,
  },
  quickLists: {
    buy: [],
    presents: [],
    brainstorm: [],
  },
  stickyNotes: [
    {
      id: "sticky-1",
      text: "Add your first sticky note idea here.",
      x: 80,
      y: 360,
      style: "yellow-square",
    },
  ],
});

const formatEventTimeRange = (event: OutlookEvent) => {
  if (event.isAllDay) {
    return "All day";
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Time unavailable";
  }
  return `${start.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const openOAuthPopup = (provider: "whoop" | "outlook") => {
  const route = provider === "whoop" ? "/api/oauth-whoop?action=start" : "/api/oauth-outlook?action=start";
  const popup = window.open(
    route,
    `${provider}-oauth`,
    "popup=yes,width=580,height=760,menubar=no,toolbar=no,status=no,scrollbars=yes",
  );
  if (!popup) {
    return false;
  }
  popup.focus();
  return true;
};

export const IntegrationsDashboard = ({
  theme,
  onThemeChange,
  userScope,
  userName,
}: {
  theme: DashboardTheme;
  onThemeChange: (theme: DashboardTheme) => void;
  userScope: string;
  userName: string;
}) => {
  const [data, setData] = useLocalStorageState<IntegrationsDashboardData>(
    `${STORAGE_KEY}.${userScope}`,
    createInitialData,
  );
  const [{ start: outlookStart, end: outlookEnd }, setOutlookRange] = useState(() =>
    weekRangeForToday(),
  );
  const [whoopMetricFilter, setWhoopMetricFilter] = useState<
    "steps" | "calories" | "strain" | "recovery"
  >("recovery");
  const [whoopBusy, setWhoopBusy] = useState(false);
  const [outlookBusy, setOutlookBusy] = useState(false);
  const [feedlyBusy, setFeedlyBusy] = useState(false);
  const [substackBusy, setSubstackBusy] = useState(false);
  const [obsidianBusy, setObsidianBusy] = useState(false);
  const [cardSize] = useLocalStorageState<DashboardCardSize>(
    `${DASHBOARD_CARD_SIZE_KEY}.${userScope}`,
    () => "medium",
  );
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null);
  const [newKanbanTitle, setNewKanbanTitle] = useState("");
  const [newKanbanProject, setNewKanbanProject] = useState("");
  const [newMediaTitle, setNewMediaTitle] = useState("");
  const [newMediaCreator, setNewMediaCreator] = useState("");
  const [newMediaType, setNewMediaType] = useState<MediaType>("article");
  const [newMediaStatus, setNewMediaStatus] = useState<MediaStatus>("started");
  const [newMediaNotes, setNewMediaNotes] = useState("");
  const [mediaView, setMediaView] = useState<"table" | "cards" | "status">(
    "table",
  );
  const [mediaFilterType, setMediaFilterType] = useState<MediaType | "all">("all");
  const [mediaFilterStatus, setMediaFilterStatus] = useState<MediaStatus | "all">("all");
  const [mediaQuery, setMediaQuery] = useState("");
  const [newSubstackName, setNewSubstackName] = useState("");
  const [newSubstackFeedUrl, setNewSubstackFeedUrl] = useState("");
  const [quickListDrafts, setQuickListDrafts] = useState({
    buy: "",
    presents: "",
    brainstorm: "",
  });
  const [draggedStickyId, setDraggedStickyId] = useState<string | null>(null);
  const [stickyDragOffset, setStickyDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [placingStickyStyle, setPlacingStickyStyle] = useState<
    StickyNoteItem["style"] | null
  >(null);
  const [draggedKanbanCardId, setDraggedKanbanCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null);
  const autoSyncBusy = whoopBusy || outlookBusy || feedlyBusy || substackBusy;
  const stickyNotes = data.stickyNotes ?? [];
  const boardRef = useRef<HTMLElement | null>(null);
  const mastheadRef = useRef<HTMLElement | null>(null);
  const mastheadStorageKey = `timebloxx.integrations.mastheadSize.${userScope}`;
  const skipFirstMastheadResizePersistRef = useRef(true);
  const [mastheadSize, setMastheadSize] = useState<{ width?: number; height?: number }>(() => {
    try {
      const raw = window.localStorage.getItem(mastheadStorageKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as { width?: number; height?: number };
      return {
        width: Number.isFinite(parsed.width) ? Number(parsed.width) : undefined,
        height: Number.isFinite(parsed.height) ? Number(parsed.height) : undefined,
      };
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent<OAuthPopupMessage>) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const payload = event.data;
      if (!payload || typeof payload !== "object") {
        return;
      }

      if (payload.type === "oauth-error") {
        setIntegrationMessage(
          `${payload.provider === "whoop" ? "Whoop" : "Outlook"} connect failed: ${payload.error}`,
        );
        return;
      }

      if (payload.type === "oauth-success") {
        const tokenBundle = payload.tokens;
        if (!tokenBundle.accessToken) {
          return;
        }
        if (payload.provider === "whoop") {
          setData((previous) => ({
            ...previous,
            whoop: {
              ...previous.whoop,
              token: tokenBundle.accessToken,
              refreshToken: tokenBundle.refreshToken ?? "",
              tokenExpiresAt: tokenBundle.expiresAt,
              scope: tokenBundle.scope ?? previous.whoop.scope ?? "",
            },
          }));
          setIntegrationMessage("Whoop connected via OAuth.");
          return;
        }
        setData((previous) => ({
          ...previous,
          outlook: {
            ...previous.outlook,
            token: tokenBundle.accessToken,
            refreshToken: tokenBundle.refreshToken ?? "",
            tokenExpiresAt: tokenBundle.expiresAt,
            scope: tokenBundle.scope ?? previous.outlook.scope ?? "",
          },
        }));
        setIntegrationMessage("Outlook connected via OAuth.");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setData]);

  useEffect(() => {
    const onWhoopAuth = () => {
      const opened = openOAuthPopup("whoop");
      setIntegrationMessage(
        opened
          ? "Complete Whoop login in the popup window."
          : "Popup blocked. Please allow popups and try again.",
      );
    };
    const onOutlookAuth = () => {
      const opened = openOAuthPopup("outlook");
      setIntegrationMessage(
        opened
          ? "Complete Outlook login in the popup window."
          : "Popup blocked. Please allow popups and try again.",
      );
    };
    window.addEventListener("timebloxx:auth:whoop", onWhoopAuth as EventListener);
    window.addEventListener("timebloxx:auth:outlook", onOutlookAuth as EventListener);
    return () => {
      window.removeEventListener("timebloxx:auth:whoop", onWhoopAuth as EventListener);
      window.removeEventListener("timebloxx:auth:outlook", onOutlookAuth as EventListener);
    };
  }, []);

  const selectedNote = useMemo(
    () =>
      data.obsidian.notes.find((note) => note.id === data.obsidian.selectedNoteId) ??
      data.obsidian.notes[0] ??
      null,
    [data.obsidian.notes, data.obsidian.selectedNoteId],
  );

  const quoteOfTheDay = useMemo(() => {
    if (data.quotes.length === 0) {
      return null;
    }
    const index = toDayNumber(todayAsDateKey()) % data.quotes.length;
    return data.quotes[index];
  }, [data.quotes]);
  const activeKanbanCount = useMemo(
    () => data.kanban.cards.filter((card) => card.column === "active").length,
    [data.kanban.cards],
  );
  const dueTodayCount = useMemo(
    () => data.kanban.cards.filter((card) => card.dueDate === todayAsDateKey()).length,
    [data.kanban.cards],
  );

  const whoopSummary = useMemo(() => {
    const metrics = data.whoop.metrics;
    const onlyNumbers = (values: Array<number | null>) =>
      values.filter((value): value is number => typeof value === "number");
    const avg = (values: number[]) =>
      values.length === 0
        ? null
        : Number(
            (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1),
          );

    return {
      recovery: avg(onlyNumbers(metrics.map((metric) => metric.recoveryScore))),
      strain: avg(onlyNumbers(metrics.map((metric) => metric.strain))),
      sleep: avg(onlyNumbers(metrics.map((metric) => metric.sleepPerformance))),
      hrv: avg(onlyNumbers(metrics.map((metric) => metric.hrv))),
      rhr: avg(onlyNumbers(metrics.map((metric) => metric.restingHeartRate))),
      sleepHours: avg(onlyNumbers(metrics.map((metric) => metric.sleepHours))),
      calories: avg(onlyNumbers(metrics.map((metric) => metric.calories))),
      steps: avg(onlyNumbers(metrics.map((metric) => metric.steps))),
    };
  }, [data.whoop.metrics]);

  const whoopLatestNight = useMemo(() => {
    if (data.whoop.metrics.length === 0) {
      return null;
    }
    return [...data.whoop.metrics].sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];
  }, [data.whoop.metrics]);

  const whoopWeekBars = useMemo(() => {
    const sorted = [...data.whoop.metrics].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const values = sorted.map((entry) => {
      if (whoopMetricFilter === "steps") {
        return entry.steps ?? 0;
      }
      if (whoopMetricFilter === "calories") {
        return entry.calories ?? 0;
      }
      if (whoopMetricFilter === "strain") {
        return entry.strain ?? 0;
      }
      return entry.recoveryScore ?? 0;
    });
    const max = Math.max(1, ...values);
    return sorted.map((entry, index) => ({
      id: entry.id,
      dateKey: entry.dateKey,
      label: formatShortWeekdayLabel(entry.dateKey).split(" ")[0],
      value: values[index],
      heightPct: Math.max(8, Math.round((values[index] / max) * 100)),
    }));
  }, [data.whoop.metrics, whoopMetricFilter]);

  const filteredMedia = useMemo(() => {
    const query = mediaQuery.trim().toLowerCase();
    return data.media.entries.filter((entry) => {
      if (mediaFilterType !== "all" && entry.type !== mediaFilterType) {
        return false;
      }
      if (mediaFilterStatus !== "all" && entry.status !== mediaFilterStatus) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.creator.toLowerCase().includes(query) ||
        entry.notes.toLowerCase().includes(query)
      );
    });
  }, [data.media.entries, mediaFilterStatus, mediaFilterType, mediaQuery]);

  const mediaByStatus = useMemo(
    () => ({
      started: filteredMedia.filter((entry) => entry.status === "started"),
      reading: filteredMedia.filter((entry) => entry.status === "reading"),
      read: filteredMedia.filter((entry) => entry.status === "read"),
    }),
    [filteredMedia],
  );
  const dashboardLocalTime = useMemo(
    () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );
  const dashboardTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const whoopSync = async () => {
    if (!data.whoop.token.trim()) {
      setIntegrationMessage("Connect Whoop first or paste a token.");
      return;
    }
    setWhoopBusy(true);
    setIntegrationMessage("Syncing Whoop weekly metrics...");
    const week = weekRangeForToday();
    try {
      const response = await fetch("/api/whoop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "weeklyMetrics",
          token: data.whoop.token.trim(),
          refreshToken: data.whoop.refreshToken?.trim() || "",
          startDate: week.start,
          endDate: week.end,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Whoop sync failed (${response.status})`);
      }
      const payload = (await response.json()) as WhoopResponse;
      setData((previous) => ({
        ...previous,
        whoop: {
          ...previous.whoop,
          token: payload.tokens?.accessToken ?? previous.whoop.token,
          refreshToken: payload.tokens?.refreshToken ?? previous.whoop.refreshToken ?? "",
          tokenExpiresAt: payload.tokens?.expiresAt ?? previous.whoop.tokenExpiresAt ?? null,
          scope: payload.tokens?.scope ?? previous.whoop.scope ?? "",
          metrics: (payload.metrics ?? []).map((metric) => ({
            ...metric,
            id: createId(),
          })),
          lastSyncedAt: new Date().toISOString(),
        },
      }));
      setIntegrationMessage("Whoop sync complete.");
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error ? error.message : "Whoop sync failed unexpectedly.",
      );
    } finally {
      setWhoopBusy(false);
    }
  };

  const outlookSync = async () => {
    if (!data.outlook.token.trim()) {
      setIntegrationMessage("Connect Outlook first or paste a token.");
      return;
    }
    setOutlookBusy(true);
    setIntegrationMessage("Syncing Outlook calendar...");
    try {
      const response = await fetch("/api/outlook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.outlook.token.trim(),
          startDate: outlookStart,
          endDate: outlookEnd,
          timezone: data.outlook.timezone,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Outlook sync failed (${response.status})`);
      }
      const payload = (await response.json()) as OutlookResponse;
      setData((previous) => ({
        ...previous,
        outlook: {
          ...previous.outlook,
          events: payload.events ?? [],
          lastSyncedAt: new Date().toISOString(),
        },
      }));
      setIntegrationMessage("Outlook sync complete.");
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error ? error.message : "Outlook sync failed unexpectedly.",
      );
    } finally {
      setOutlookBusy(false);
    }
  };

  const feedlySync = async () => {
    if (!data.feedly.token.trim() || !data.feedly.streamId.trim()) {
      setIntegrationMessage("Set both Feedly token and stream id first.");
      return;
    }
    setFeedlyBusy(true);
    setIntegrationMessage("Syncing Feedly stream...");
    try {
      const response = await fetch("/api/feedly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.feedly.token.trim(),
          streamId: data.feedly.streamId.trim(),
          count: 20,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Feedly sync failed (${response.status})`);
      }
      const payload = (await response.json()) as FeedlyResponse;
      setData((previous) => ({
        ...previous,
        feedly: {
          ...previous.feedly,
          items: payload.items ?? [],
          lastSyncedAt: new Date().toISOString(),
        },
      }));
      setIntegrationMessage("Feedly sync complete.");
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error ? error.message : "Feedly sync failed unexpectedly.",
      );
    } finally {
      setFeedlyBusy(false);
    }
  };

  const refreshSubstackFeeds = async () => {
    if (data.substack.feeds.length === 0) {
      setIntegrationMessage("Add at least one Substack feed first.");
      return;
    }
    setSubstackBusy(true);
    setIntegrationMessage("Refreshing Substack feeds...");
    try {
      const results = await Promise.all(
        data.substack.feeds.map(async (feed) => {
          const response = await fetch("/api/rss", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: feed.feedUrl,
              source: feed.name,
              count: 10,
            }),
          });
          if (!response.ok) {
            return [] as FeedItem[];
          }
          const payload = (await response.json()) as RssResponse;
          return (payload.items ?? []).map((item) => ({
            ...item,
            source: feed.name,
          }));
        }),
      );
      const allItems = results
        .flat()
        .sort((a, b) => {
          const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 40);

      setData((previous) => ({
        ...previous,
        substack: {
          ...previous.substack,
          items: allItems,
          lastSyncedAt: new Date().toISOString(),
        },
      }));
      setIntegrationMessage("Substack feeds refreshed.");
    } catch (error) {
      setIntegrationMessage(
        error instanceof Error ? error.message : "Substack refresh failed.",
      );
    } finally {
      setSubstackBusy(false);
    }
  };

  const obsidianPull = async () => {
    if (!data.obsidian.endpointUrl.trim()) {
      setIntegrationMessage("Set an Obsidian bridge endpoint first.");
      return;
    }
    setObsidianBusy(true);
    setIntegrationMessage("Pulling notes from Obsidian bridge...");
    try {
      const endpoint = data.obsidian.endpointUrl.trim();
      let notes: ObsidianNote[] = [];
      if (isLocalObsidianEndpoint(endpoint)) {
        const normalized = endpoint.replace(/\/+$/, "");
        const listResponse = await fetch(
          normalized.endsWith("/vault") ? `${normalized}/` : `${normalized}/vault/`,
          {
            method: "GET",
            headers: buildObsidianHeaders(data.obsidian.apiKey),
          },
        );
        if (!listResponse.ok) {
          throw new Error(`Obsidian read failed (${listResponse.status}).`);
        }
        const listed = (await listResponse.json().catch(() => [])) as unknown;
        const paths = extractMarkdownPathsFromListing(listed).slice(0, 40);
        const base = normalized.endsWith("/vault")
          ? normalized
          : normalized.endsWith("/vault/")
            ? normalized.slice(0, -1)
            : `${normalized}/vault`;
        const noteResults = await Promise.all(
          paths.map(async (path) => {
            const response = await fetch(`${base}/${encodeVaultPath(path)}`, {
              method: "GET",
              headers: buildObsidianHeaders(data.obsidian.apiKey),
            });
            if (!response.ok) {
              return null;
            }
            const content = await response.text();
            const title = path.split("/").pop()?.replace(/\.md$/i, "") || "Untitled";
            const note: ObsidianNote = {
              id: path,
              title,
              content,
              updatedAt: new Date().toISOString(),
              tags: [] as string[],
            };
            return note;
          }),
        );
        notes = noteResults.filter((note): note is ObsidianNote => note !== null);
      } else {
        const response = await fetch("/api/obsidian", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "read",
            endpointUrl: endpoint,
            apiKey: data.obsidian.apiKey.trim() || null,
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? `Obsidian read failed (${response.status})`);
        }
        const payload = (await response.json()) as { notes?: ObsidianNote[] };
        notes = payload.notes ?? [];
      }
      setData((previous) => ({
        ...previous,
        obsidian: {
          ...previous.obsidian,
          notes,
          selectedNoteId: notes[0]?.id ?? null,
          lastSyncedAt: new Date().toISOString(),
        },
      }));
      setIntegrationMessage("Obsidian notes pulled.");
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? error.message : "Obsidian pull failed.");
    } finally {
      setObsidianBusy(false);
    }
  };

  const obsidianPushSelected = async () => {
    if (!selectedNote) {
      setIntegrationMessage("No selected note to push.");
      return;
    }
    if (!data.obsidian.endpointUrl.trim()) {
      setIntegrationMessage("Set an Obsidian bridge endpoint first.");
      return;
    }
    setObsidianBusy(true);
    setIntegrationMessage("Pushing selected note...");
    try {
      const endpoint = data.obsidian.endpointUrl.trim();
      if (isLocalObsidianEndpoint(endpoint)) {
        const normalized = endpoint.replace(/\/+$/, "");
        const base = normalized.endsWith("/vault")
          ? normalized
          : normalized.endsWith("/vault/")
            ? normalized.slice(0, -1)
            : `${normalized}/vault`;
        const notePath = inferNotePath(selectedNote);
        const response = await fetch(`${base}/${encodeVaultPath(notePath)}`, {
          method: "PUT",
          headers: {
            ...buildObsidianHeaders(data.obsidian.apiKey),
            "Content-Type": "text/markdown",
          },
          body: selectedNote.content ?? "",
        });
        if (!response.ok) {
          throw new Error(`Obsidian write failed (${response.status}).`);
        }
      } else {
        const response = await fetch("/api/obsidian", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "write",
            endpointUrl: endpoint,
            apiKey: data.obsidian.apiKey.trim() || null,
            note: selectedNote,
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? `Obsidian write failed (${response.status})`);
        }
      }
      setData((previous) => ({
        ...previous,
        obsidian: { ...previous.obsidian, lastSyncedAt: new Date().toISOString() },
      }));
      setIntegrationMessage("Selected note pushed.");
    } catch (error) {
      setIntegrationMessage(error instanceof Error ? error.message : "Obsidian push failed.");
    } finally {
      setObsidianBusy(false);
    }
  };

  const addKanbanCard = () => {
    const title = newKanbanTitle.trim();
    if (!title) {
      return;
    }
    setData((previous) => ({
      ...previous,
      kanban: {
        cards: [
          ...previous.kanban.cards,
          {
            id: createId(),
            title,
            project: newKanbanProject.trim() || "General",
            column: "idea",
            dueDate: null,
          },
        ],
      },
    }));
    setNewKanbanTitle("");
    setNewKanbanProject("");
  };

  const updateKanbanCard = (cardId: string, updates: Partial<KanbanCard>) => {
    setData((previous) => ({
      ...previous,
      kanban: {
        cards: previous.kanban.cards.map((card) =>
          card.id === cardId ? { ...card, ...updates } : card,
        ),
      },
    }));
  };

  const deleteKanbanCard = (cardId: string) => {
    setData((previous) => ({
      ...previous,
      kanban: {
        cards: previous.kanban.cards.filter((card) => card.id !== cardId),
      },
    }));
  };

  const moveKanbanCardToColumn = (cardId: string, targetColumn: KanbanColumnId) => {
    updateKanbanCard(cardId, { column: targetColumn });
  };

  const addQuote = (textRaw: string, authorRaw?: string) => {
    const text = textRaw.trim();
    if (!text) {
      return;
    }
    setData((previous) => ({
      ...previous,
      quotes: [
        ...previous.quotes,
        { id: createId(), text, author: authorRaw?.trim() || "Unknown" },
      ],
    }));
  };

  const addMediaItem = () => {
    const title = newMediaTitle.trim();
    if (!title) {
      return;
    }
    setData((previous) => ({
      ...previous,
      media: {
        entries: [
          {
            id: createId(),
            title,
            type: newMediaType,
            status: newMediaStatus,
            creator: newMediaCreator.trim(),
            startedOn: todayAsDateKey(),
            finishedOn: newMediaStatus === "read" ? todayAsDateKey() : null,
            notes: newMediaNotes.trim(),
          },
          ...previous.media.entries,
        ],
      },
    }));
    setNewMediaTitle("");
    setNewMediaCreator("");
    setNewMediaType("article");
    setNewMediaStatus("started");
    setNewMediaNotes("");
  };

  const updateMediaEntry = (id: string, updates: Partial<MediaItem>) => {
    setData((previous) => ({
      ...previous,
      media: {
        entries: previous.media.entries.map((entry) =>
          entry.id === id ? { ...entry, ...updates } : entry,
        ),
      },
    }));
  };

  const deleteMediaEntry = (id: string) => {
    setData((previous) => ({
      ...previous,
      media: { entries: previous.media.entries.filter((entry) => entry.id !== id) },
    }));
  };

  const addSubstackFeed = () => {
    const name = newSubstackName.trim();
    const feedUrl = newSubstackFeedUrl.trim();
    if (!name || !feedUrl) {
      return;
    }
    setData((previous) => ({
      ...previous,
      substack: {
        ...previous.substack,
        feeds: [...previous.substack.feeds, { id: createId(), name, feedUrl }],
      },
    }));
    setNewSubstackName("");
    setNewSubstackFeedUrl("");
  };

  const updateSubstackFeed = (id: string, updates: Partial<SubstackFeed>) => {
    setData((previous) => ({
      ...previous,
      substack: {
        ...previous.substack,
        feeds: previous.substack.feeds.map((feed) =>
          feed.id === id ? { ...feed, ...updates } : feed,
        ),
      },
    }));
  };

  const deleteSubstackFeed = (id: string) => {
    setData((previous) => ({
      ...previous,
      substack: {
        ...previous.substack,
        feeds: previous.substack.feeds.filter((feed) => feed.id !== id),
      },
    }));
  };

  const addQuickListItem = (list: QuickListKey) => {
    const text = quickListDrafts[list].trim();
    if (!text) {
      return;
    }
    setData((previous) => ({
      ...previous,
      quickLists: {
        ...previous.quickLists,
        [list]: [...previous.quickLists[list], { id: createId(), text, done: false }],
      },
    }));
    setQuickListDrafts((previous) => ({ ...previous, [list]: "" }));
  };

  const updateQuickListItem = (
    list: QuickListKey,
    itemId: string,
    updates: Partial<QuickListItem>,
  ) => {
    setData((previous) => ({
      ...previous,
      quickLists: {
        ...previous.quickLists,
        [list]: previous.quickLists[list].map((item) =>
          item.id === itemId ? { ...item, ...updates } : item,
        ),
      },
    }));
  };

  const deleteQuickListItem = (list: QuickListKey, itemId: string) => {
    setData((previous) => ({
      ...previous,
      quickLists: {
        ...previous.quickLists,
        [list]: previous.quickLists[list].filter((item) => item.id !== itemId),
      },
    }));
  };

  const addStickyNote = (
    style: StickyNoteItem["style"],
    x = 32,
    y = 32,
  ) => {
    setData((previous) => ({
      ...previous,
      stickyNotes: [
        ...(previous.stickyNotes ?? []),
        {
          id: createId(),
          text: "",
          x,
          y,
          style,
        },
      ],
    }));
  };

  const updateStickyNote = (id: string, updates: Partial<StickyNoteItem>) => {
    setData((previous) => ({
      ...previous,
      stickyNotes: (previous.stickyNotes ?? []).map((note) =>
        note.id === id ? { ...note, ...updates } : note,
      ),
    }));
  };

  const deleteStickyNote = (id: string) => {
    setData((previous) => ({
      ...previous,
      stickyNotes: (previous.stickyNotes ?? []).filter((note) => note.id !== id),
    }));
  };

  const placeStickyFromClientPoint = (clientX: number, clientY: number) => {
    if (!placingStickyStyle || !boardRef.current) {
      return false;
    }
    const bounds = boardRef.current.getBoundingClientRect();
    addStickyNote(
      placingStickyStyle,
      Math.max(0, Math.round(clientX - bounds.left - 105)),
      Math.max(0, Math.round(clientY - bounds.top - 70)),
    );
    setPlacingStickyStyle(null);
    return true;
  };

  const updateSelectedObsidianNote = (updates: Partial<ObsidianNote>) => {
    if (!selectedNote) {
      return;
    }
    setData((previous) => ({
      ...previous,
      obsidian: {
        ...previous.obsidian,
        notes: previous.obsidian.notes.map((note) =>
          note.id === selectedNote.id
            ? { ...note, ...updates, updatedAt: new Date().toISOString() }
            : note,
        ),
      },
    }));
  };

  const addObsidianNote = () => {
    const id = createId();
    const note: ObsidianNote = {
      id,
      title: "New note",
      content: "",
      updatedAt: new Date().toISOString(),
      tags: [],
    };
    setData((previous) => ({
      ...previous,
      obsidian: {
        ...previous.obsidian,
        selectedNoteId: id,
        notes: [note, ...previous.obsidian.notes],
      },
    }));
  };

  const deleteObsidianNote = (id: string) => {
    setData((previous) => {
      const remaining = previous.obsidian.notes.filter((note) => note.id !== id);
      return {
        ...previous,
        obsidian: {
          ...previous.obsidian,
          notes: remaining,
          selectedNoteId:
            previous.obsidian.selectedNoteId === id
              ? (remaining[0]?.id ?? null)
              : previous.obsidian.selectedNoteId,
        },
      };
    });
  };

  const updateOutlookEvent = (id: string, updates: Partial<OutlookEvent>) => {
    setData((previous) => ({
      ...previous,
      outlook: {
        ...previous.outlook,
        events: previous.outlook.events.map((event) =>
          event.id === id ? { ...event, ...updates } : event,
        ),
      },
    }));
  };

  const deleteOutlookEvent = (id: string) => {
    setData((previous) => ({
      ...previous,
      outlook: {
        ...previous.outlook,
        events: previous.outlook.events.filter((event) => event.id !== id),
      },
    }));
  };

  useEffect(() => {
    if (!data.whoop.token.trim()) {
      return;
    }
    const timer = window.setTimeout(() => {
      void whoopSync();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [data.whoop.token]);

  useEffect(() => {
    if (!data.outlook.token.trim()) {
      return;
    }
    const timer = window.setTimeout(() => {
      void outlookSync();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [data.outlook.token, outlookStart, outlookEnd, data.outlook.timezone]);

  useEffect(() => {
    if (!data.feedly.token.trim() || !data.feedly.streamId.trim()) {
      return;
    }
    const timer = window.setTimeout(() => {
      void feedlySync();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [data.feedly.token, data.feedly.streamId]);

  useEffect(() => {
    if (data.substack.feeds.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshSubstackFeeds();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data.substack.feeds]);

  useEffect(() => {
    if (!data.obsidian.endpointUrl.trim()) {
      return;
    }
    const timer = window.setTimeout(() => {
      void obsidianPull();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data.obsidian.endpointUrl, data.obsidian.apiKey]);

  useEffect(() => {
    if (!mastheadRef.current || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      if (skipFirstMastheadResizePersistRef.current) {
        skipFirstMastheadResizePersistRef.current = false;
        return;
      }
      const element = entry.target as HTMLElement;
      const nextSize = {
        width: Math.round(element.offsetWidth),
        height: Math.round(element.offsetHeight),
      };
      if (nextSize.width === mastheadSize.width && nextSize.height === mastheadSize.height) {
        return;
      }
      setMastheadSize(nextSize);
      window.localStorage.setItem(mastheadStorageKey, JSON.stringify(nextSize));
    });
    observer.observe(mastheadRef.current);
    return () => observer.disconnect();
  }, [mastheadSize.height, mastheadSize.width, mastheadStorageKey]);

  return (
    <main
      ref={boardRef}
      onClick={(event) => {
        if (!placingStickyStyle || !boardRef.current) {
          return;
        }
        const target = event.target as HTMLElement;
        if (target.closest("button, input, textarea, select, a, label")) {
          return;
        }
        void placeStickyFromClientPoint(event.clientX, event.clientY);
      }}
      className={`direction-a-reference dirA-theme-${theme} dirA-size-${cardSize} relative mt-2 space-y-4 overflow-x-hidden`}
    >
      <div className="mb-3 text-center">
        <h2
          className={`daily-index-hero-title direction-a-hero-title font-display font-semibold text-rose-950 ${
            theme === "bubblegum"
              ? "daily-index-hero-title--bubblegum"
              : theme === "citrus"
                ? "daily-index-hero-title--citrus"
                : "daily-index-hero-title--juicy"
          }`}
        >
          The Daily Index
        </h2>
        <div
          className={`daily-index-hero-rule mt-3 h-[3px] w-full rounded-full ${
            theme === "bubblegum"
              ? "daily-index-hero-rule--bubblegum"
              : theme === "citrus"
                ? "daily-index-hero-rule--citrus"
                : "daily-index-hero-rule--juicy"
          }`}
        />
      </div>
      <div className="direction-a-themebar">
        <span className="direction-a-themebar-label">Theme</span>
        {(
          Object.entries(DASHBOARD_THEMES) as Array<
            [DashboardTheme, (typeof DASHBOARD_THEMES)[DashboardTheme]]
          >
        ).map(([key, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => onThemeChange(key)}
            className={`direction-a-themechip ${theme === key ? "is-active" : ""}`}
            title={value.label}
          >
            <span
              className="direction-a-themechip-bg"
              style={{ background: value.swatch[0] }}
            />
            <span
              className="direction-a-themechip-fg"
              style={{ background: value.swatch[1] }}
            />
            <span
              className="direction-a-themechip-ac"
              style={{ background: value.swatch[2] }}
            />
          </button>
        ))}
        <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-900/80">
          {autoSyncBusy ? "Auto-syncing..." : "Auto-sync on"}
        </span>
        <button
          type="button"
          onClick={() => setPlacingStickyStyle("yellow-square")}
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
            placingStickyStyle === "yellow-square"
              ? "border-amber-400 bg-amber-200 text-amber-900"
              : "border-rose-300 bg-amber-100 text-rose-900"
          }`}
        >
          Yellow Sticky
        </button>
        <button
          type="button"
          onClick={() => setPlacingStickyStyle("pink-heart")}
          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
            placingStickyStyle === "pink-heart"
              ? "border-pink-500 bg-pink-200 text-pink-900"
              : "border-rose-300 bg-pink-100 text-rose-900"
          }`}
        >
          Pink Heart
        </button>
        {placingStickyStyle ? (
          <span className="rounded-full border border-rose-300 bg-white px-2 py-1 text-[10px] font-semibold text-rose-900/80">
            Click anywhere on canvas to place
          </span>
        ) : null}
      </div>
      <section
        ref={mastheadRef}
        onClick={(event) => {
          if (!placingStickyStyle || !boardRef.current) {
            return;
          }
          const target = event.target as HTMLElement;
          if (target.closest("button, input, textarea, select, a, label")) {
            return;
          }
          event.stopPropagation();
          void placeStickyFromClientPoint(event.clientX, event.clientY);
        }}
        className="direction-a-masthead resize overflow-auto min-h-[220px] min-w-[240px] rounded-2xl border border-rose-200/70 bg-white/80 p-4 shadow-[0_12px_30px_-22px_rgba(122,68,98,0.52)]"
        style={
          mastheadSize.width || mastheadSize.height
            ? {
                width: mastheadSize.width ? `${mastheadSize.width}px` : undefined,
                height: mastheadSize.height ? `${mastheadSize.height}px` : undefined,
              }
            : undefined
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="direction-a-greet font-display text-2xl font-semibold text-rose-950">
              Morning, {userName}.
            </p>
            <p className="mt-2 text-sm text-rose-900/80">
              {activeKanbanCount} projects in progress, {dueTodayCount} due today, and
              latest recovery is <strong>{whoopLatestNight?.recoveryScore ?? "--"}%</strong>.
            </p>
          </div>
          <div className="direction-a-meta">
            <div>
              <span className="direction-a-label">Date</span> {formatDateLabel(todayAsDateKey())}
            </div>
            <div>
              <span className="direction-a-label">Local</span> {dashboardLocalTime}{" "}
              {dashboardTimezone}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {quoteOfTheDay ? (
            <blockquote className="rounded-2xl border border-rose-200 bg-rose-50/65 px-3 py-2">
              <p
                className="direction-a-quote-text text-base font-semibold italic text-rose-950"
                style={{ fontStyle: "italic" }}
              >
                "{quoteOfTheDay.text}"
              </p>
              <footer
                className="direction-a-quote-author mt-1 text-sm italic text-rose-900/70"
                style={{ fontStyle: "italic" }}
              >
                - {quoteOfTheDay.author}
              </footer>
            </blockquote>
          ) : (
            <p className="text-sm text-rose-900/70">No quote saved yet.</p>
          )}
          <button
            type="button"
            onClick={() => {
              const text = window.prompt("Add quote text");
              if (!text?.trim()) {
                return;
              }
              const author = window.prompt("Author (optional)") ?? "";
              addQuote(text, author);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-200"
          >
            <span className="text-base leading-none">+</span>
            <span>Add new quote</span>
          </button>
        </div>
        {integrationMessage &&
        integrationMessage !== "Complete Whoop login in the popup window." ? (
          <p className="direction-a-notice mt-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-1.5 text-xs font-semibold text-rose-900/80">
            {integrationMessage}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <SectionCard resizable movable storageScope={userScope}
            title="Whoop Weekly Metrics"
            subtitle="OAuth connect + weekly recovery, strain, sleep, and HRV"
          >
            <p className="mt-2 text-xs font-semibold text-rose-900/60">
              Last synced: {toInputDateTime(data.whoop.lastSyncedAt)} | token expiry:{" "}
              {toInputDateTime(data.whoop.tokenExpiresAt)}
            </p>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-900/65">
                  Last Night Rings
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Recovery",
                      value: whoopLatestNight?.recoveryScore ?? 0,
                      suffix: "%",
                    },
                    {
                      label: "Strain",
                      value: Math.round((whoopLatestNight?.strain ?? 0) * 5),
                      suffix: "%",
                    },
                    {
                      label: "Sleep",
                      value: whoopLatestNight?.sleepPerformance ?? 0,
                      suffix: "%",
                    },
                  ].map((ring) => (
                    <div key={ring.label} className="text-center">
                      <div
                        className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-rose-300 bg-white"
                        style={{
                          background: `conic-gradient(#ff4d9d ${Math.max(
                            0,
                            Math.min(100, ring.value),
                          )}%, #f4e6ee ${Math.max(0, Math.min(100, ring.value))}% 100%)`,
                        }}
                      >
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-xs font-semibold text-rose-950">
                          {Math.round(ring.value)}
                          {ring.suffix}
                        </div>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-900/70">
                        {ring.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-rose-200 bg-white p-2">
                    <p className="font-semibold text-rose-900/70">HRV</p>
                    <p className="text-sm font-semibold text-rose-950">
                      Last: {whoopLatestNight?.hrv ?? "--"} | Avg:{" "}
                      {whoopSummary.hrv ?? "--"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-white p-2">
                    <p className="font-semibold text-rose-900/70">RHR</p>
                    <p className="text-sm font-semibold text-rose-950">
                      Last: {whoopLatestNight?.restingHeartRate ?? "--"} | Avg:{" "}
                      {whoopSummary.rhr ?? "--"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-white p-2">
                    <p className="font-semibold text-rose-900/70">Sleep Hrs</p>
                    <p className="text-sm font-semibold text-rose-950">
                      Last: {whoopLatestNight?.sleepHours ?? "--"} | Avg:{" "}
                      {whoopSummary.sleepHours ?? "--"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-white p-2">
                    <p className="font-semibold text-rose-900/70">Calories</p>
                    <p className="text-sm font-semibold text-rose-950">
                      Last: {whoopLatestNight?.calories ?? "--"} | Avg:{" "}
                      {whoopSummary.calories ?? "--"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-900/65">
                    Current Week Trend
                  </p>
                  <select
                    value={whoopMetricFilter}
                    onChange={(event) =>
                      setWhoopMetricFilter(
                        event.target.value as "steps" | "calories" | "strain" | "recovery",
                      )
                    }
                    className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-950 outline-none"
                  >
                    <option value="steps">Steps</option>
                    <option value="calories">Calories</option>
                    <option value="strain">Strain</option>
                    <option value="recovery">Recovery</option>
                  </select>
                </div>
                <div className="grid grid-cols-7 items-end gap-2 rounded-xl border border-rose-200 bg-white p-2">
                  {whoopWeekBars.map((bar) => (
                    <div key={bar.id} className="text-center">
                      <div className="mx-auto flex h-28 w-7 items-end">
                        <div
                          className="direction-a-bar-fill w-full rounded-t-md"
                          style={{ height: `${bar.heightPct}%` }}
                          title={`${bar.label}: ${Math.round(bar.value)}`}
                        />
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-rose-900/70">
                        {bar.label}
                      </p>
                      <p className="text-[10px] text-rose-900/65">
                        {Math.round(bar.value)}
                      </p>
                    </div>
                  ))}
                </div>
                {whoopWeekBars.length === 0 ? (
                  <p className="mt-2 text-xs text-rose-900/65">
                    No data for this week yet. Connect and sync.
                  </p>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard resizable movable storageScope={userScope}
            title="Outlook Calendar"
            subtitle="OAuth connect + week window event list"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-rose-900/70">
                Access token
                <input
                  type="password"
                  value={data.outlook.token}
                  onChange={(event) =>
                    setData((previous) => ({
                      ...previous,
                      outlook: { ...previous.outlook, token: event.target.value },
                    }))
                  }
                  placeholder="Microsoft Graph access token"
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </label>
              <label className="text-xs font-semibold text-rose-900/70">
                Timezone
                <input
                  type="text"
                  value={data.outlook.timezone}
                  onChange={(event) =>
                    setData((previous) => ({
                      ...previous,
                      outlook: { ...previous.outlook, timezone: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs font-semibold text-rose-900/70 sm:col-span-2">
                Start date
                <input
                  type="date"
                  value={outlookStart}
                  onChange={(event) =>
                    setOutlookRange((previous) => ({
                      ...previous,
                      start: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-2 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </label>
              <label className="text-xs font-semibold text-rose-900/70 sm:col-span-2">
                End date
                <input
                  type="date"
                  value={outlookEnd}
                  onChange={(event) =>
                    setOutlookRange((previous) => ({
                      ...previous,
                      end: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-2 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </label>
            </div>
            <p className="mt-2 text-xs font-semibold text-rose-900/60">
              Last synced: {toInputDateTime(data.outlook.lastSyncedAt)} | token expiry:{" "}
              {toInputDateTime(data.outlook.tokenExpiresAt)}
            </p>

            <div className="mt-3 space-y-2">
              {data.outlook.events.slice(0, 14).map((event) => (
                <article
                  key={event.id}
                  className="rounded-xl border border-rose-200 bg-rose-50/60 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <input
                      type="text"
                      value={event.subject}
                      onChange={(entry) =>
                        updateOutlookEvent(event.id, { subject: entry.target.value })
                      }
                      className="min-w-[220px] flex-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-semibold text-rose-950 outline-none"
                    />
                    <div className="flex gap-2">
                      {event.webLink ? (
                        <a
                          className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          href={event.webLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteOutlookEvent(event.id)}
                        className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-rose-900/65">
                    {formatEventTimeRange(event)}
                  </p>
                  <input
                    type="text"
                    value={event.location ?? ""}
                    onChange={(entry) =>
                      updateOutlookEvent(event.id, {
                        location: entry.target.value || null,
                      })
                    }
                    placeholder="Location"
                    className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                  />
                </article>
              ))}
              {data.outlook.events.length === 0 ? (
                <p className="text-xs text-rose-900/65">
                  No events yet. Connect and sync.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard resizable movable storageScope={userScope}
            title="Obsidian Workspace"
            subtitle="Read/write notes via your bridge endpoint"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void obsidianPull();
                  }}
                  disabled={obsidianBusy}
                  className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Pull Notes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void obsidianPushSelected();
                  }}
                  disabled={obsidianBusy}
                  className="rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Push Selected
                </button>
                <button
                  type="button"
                  onClick={addObsidianNote}
                  className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                >
                  New Note
                </button>
              </div>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-rose-900/70">
                Bridge endpoint URL
                <input
                  type="url"
                  value={data.obsidian.endpointUrl}
                  onChange={(event) =>
                    setData((previous) => ({
                      ...previous,
                      obsidian: { ...previous.obsidian, endpointUrl: event.target.value },
                    }))
                  }
                  placeholder="https://your-obsidian-bridge.example.com/notes"
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </label>
              <label className="text-xs font-semibold text-rose-900/70">
                Bridge API key (optional)
                <input
                  type="password"
                  value={data.obsidian.apiKey}
                  onChange={(event) =>
                    setData((previous) => ({
                      ...previous,
                      obsidian: { ...previous.obsidian, apiKey: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                />
              </label>
            </div>
            <p className="mt-2 text-xs font-semibold text-rose-900/60">
              Last bridge sync: {toInputDateTime(data.obsidian.lastSyncedAt)}
            </p>

            <div className="mt-3 grid gap-3 lg:grid-cols-[250px_1fr]">
              <div className="max-h-[300px] space-y-2 overflow-auto rounded-2xl border border-rose-200 bg-rose-50/55 p-2 soft-scroll">
                {data.obsidian.notes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-rose-200 bg-white p-2">
                    <button
                      type="button"
                      onClick={() =>
                        setData((previous) => ({
                          ...previous,
                          obsidian: { ...previous.obsidian, selectedNoteId: note.id },
                        }))
                      }
                      className="w-full text-left"
                    >
                      <p className="truncate text-sm font-semibold text-rose-950">{note.title}</p>
                      <p className="text-[11px] text-rose-900/60">
                        {toInputDateTime(note.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteObsidianNote(note.id)}
                      className="mt-2 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {data.obsidian.notes.length === 0 ? (
                  <p className="text-xs text-rose-900/60">No notes yet.</p>
                ) : null}
              </div>
              <div className="space-y-2 rounded-2xl border border-rose-200 bg-white/90 p-3">
                {selectedNote ? (
                  <>
                    <input
                      type="text"
                      value={selectedNote.title}
                      onChange={(event) =>
                        updateSelectedObsidianNote({ title: event.target.value })
                      }
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                    />
                    <textarea
                      rows={9}
                      value={selectedNote.content}
                      onChange={(event) =>
                        updateSelectedObsidianNote({ content: event.target.value })
                      }
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                    />
                    <input
                      type="text"
                      value={selectedNote.tags.join(", ")}
                      onChange={(event) =>
                        updateSelectedObsidianNote({
                          tags: event.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="tags, separated, by, commas"
                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                    />
                  </>
                ) : (
                  <p className="text-sm text-rose-900/70">No note selected.</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard resizable movable storageScope={userScope}
            title="Media Database"
            subtitle="Notion-style media tracker with full inline edit and filters"
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input
                type="text"
                value={newMediaTitle}
                onChange={(event) => setNewMediaTitle(event.target.value)}
                placeholder="Title"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
              <input
                type="text"
                value={newMediaCreator}
                onChange={(event) => setNewMediaCreator(event.target.value)}
                placeholder="Creator/Author"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
              <select
                value={newMediaType}
                onChange={(event) => setNewMediaType(event.target.value as MediaType)}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              >
                {MEDIA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={newMediaStatus}
                onChange={(event) => setNewMediaStatus(event.target.value as MediaStatus)}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              >
                {MEDIA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addMediaItem}
                className="rounded-xl border border-rose-300 bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-200"
              >
                Add
              </button>
            </div>
            <textarea
              rows={2}
              value={newMediaNotes}
              onChange={(event) => setNewMediaNotes(event.target.value)}
              placeholder="Notes"
              className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
            />

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={mediaQuery}
                onChange={(event) => setMediaQuery(event.target.value)}
                placeholder="Search media"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
              <select
                value={mediaFilterType}
                onChange={(event) =>
                  setMediaFilterType(event.target.value as MediaType | "all")
                }
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              >
                <option value="all">All types</option>
                {MEDIA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={mediaFilterStatus}
                onChange={(event) =>
                  setMediaFilterStatus(event.target.value as MediaStatus | "all")
                }
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              >
                <option value="all">All statuses</option>
                {MEDIA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-1">
              <button
                type="button"
                onClick={() => setMediaView("table")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                  mediaView === "table"
                    ? "bg-white text-rose-950"
                    : "text-rose-900/75 hover:bg-white/80"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setMediaView("cards")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                  mediaView === "cards"
                    ? "bg-white text-rose-950"
                    : "text-rose-900/75 hover:bg-white/80"
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setMediaView("status")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                  mediaView === "status"
                    ? "bg-white text-rose-950"
                    : "text-rose-900/75 hover:bg-white/80"
                }`}
              >
                By Status
              </button>
            </div>

            {mediaView === "table" ? (
              <div className="mt-3 overflow-x-auto soft-scroll">
                <table className="min-w-full border-separate border-spacing-y-1 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.08em] text-rose-900/60">
                      <th className="px-2 py-1">Title</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Creator</th>
                      <th className="px-2 py-1">Started</th>
                      <th className="px-2 py-1">Done</th>
                      <th className="px-2 py-1">Notes</th>
                      <th className="px-2 py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedia.map((entry) => (
                      <tr key={entry.id} className="bg-rose-50/45">
                        <td className="rounded-l-xl px-2 py-1">
                          <input
                            type="text"
                            value={entry.title}
                            onChange={(event) =>
                              updateMediaEntry(entry.id, { title: event.target.value })
                            }
                            className="w-[220px] rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-950 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={entry.type}
                            onChange={(event) =>
                              updateMediaEntry(entry.id, {
                                type: event.target.value as MediaType,
                              })
                            }
                            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-950 outline-none"
                          >
                            {MEDIA_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={entry.status}
                            onChange={(event) =>
                              updateMediaEntry(entry.id, {
                                status: event.target.value as MediaStatus,
                                finishedOn:
                                  event.target.value === "read"
                                    ? (entry.finishedOn ?? todayAsDateKey())
                                    : null,
                              })
                            }
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toStatusClass(entry.status)}`}
                          >
                            {MEDIA_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={entry.creator}
                            onChange={(event) =>
                              updateMediaEntry(entry.id, { creator: event.target.value })
                            }
                            className="w-[140px] rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="date"
                            value={entry.startedOn ?? ""}
                            onChange={(event) =>
                              updateMediaEntry(entry.id, {
                                startedOn: event.target.value || null,
                              })
                            }
                            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="date"
                            value={entry.finishedOn ?? ""}
                            onChange={(event) =>
                              updateMediaEntry(entry.id, {
                                finishedOn: event.target.value || null,
                              })
                            }
                            className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(event) =>
                              updateMediaEntry(entry.id, { notes: event.target.value })
                            }
                            className="w-[220px] rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                          />
                        </td>
                        <td className="rounded-r-xl px-2 py-1">
                          <button
                            type="button"
                            onClick={() => deleteMediaEntry(entry.id)}
                            className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredMedia.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-2 py-2 text-xs text-rose-900/65">
                          No media entries match this filter.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {mediaView === "cards" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {filteredMedia.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-rose-200 bg-rose-50/45 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={entry.title}
                        onChange={(event) =>
                          updateMediaEntry(entry.id, { title: event.target.value })
                        }
                        className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-semibold text-rose-950 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => deleteMediaEntry(entry.id)}
                        className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-900/65">
                        Type
                        <select
                          value={entry.type}
                          onChange={(event) =>
                            updateMediaEntry(entry.id, {
                              type: event.target.value as MediaType,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-950 outline-none"
                        >
                          {MEDIA_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-900/65">
                        Status
                        <select
                          value={entry.status}
                          onChange={(event) =>
                            updateMediaEntry(entry.id, {
                              status: event.target.value as MediaStatus,
                              finishedOn:
                                event.target.value === "read"
                                  ? (entry.finishedOn ?? todayAsDateKey())
                                  : null,
                            })
                          }
                          className={`mt-1 w-full rounded-lg px-2 py-1 text-xs font-semibold ${toStatusClass(entry.status)} outline-none`}
                        >
                          {MEDIA_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-900/65">
                        Creator
                        <input
                          type="text"
                          value={entry.creator}
                          onChange={(event) =>
                            updateMediaEntry(entry.id, { creator: event.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                        />
                      </label>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-900/65">
                        Started
                        <input
                          type="date"
                          value={entry.startedOn ?? ""}
                          onChange={(event) =>
                            updateMediaEntry(entry.id, {
                              startedOn: event.target.value || null,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                        />
                      </label>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-900/65 col-span-2">
                        Finished
                        <input
                          type="date"
                          value={entry.finishedOn ?? ""}
                          onChange={(event) =>
                            updateMediaEntry(entry.id, {
                              finishedOn: event.target.value || null,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                        />
                      </label>
                    </div>

                    <label className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.06em] text-rose-900/65">
                      Notes
                      <textarea
                        rows={2}
                        value={entry.notes}
                        onChange={(event) =>
                          updateMediaEntry(entry.id, { notes: event.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                      />
                    </label>
                  </article>
                ))}
                {filteredMedia.length === 0 ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2 text-xs text-rose-900/65">
                    No media entries match this filter.
                  </p>
                ) : null}
              </div>
            ) : null}

            {mediaView === "status" ? (
              <div className="mt-3">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {MEDIA_STATUSES.map((status) => (
                    <div
                      key={status}
                      className="rounded-2xl border border-rose-200 bg-rose-50/45 p-2"
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-900/70">
                        {status}
                      </p>
                      <div className="space-y-2">
                        {mediaByStatus[status].map((entry) => (
                          <article
                            key={entry.id}
                            className="rounded-xl border border-rose-200 bg-white p-2"
                          >
                            <input
                              type="text"
                              value={entry.title}
                              onChange={(event) =>
                                updateMediaEntry(entry.id, { title: event.target.value })
                              }
                              className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-semibold text-rose-950 outline-none"
                            />
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <select
                                value={entry.type}
                                onChange={(event) =>
                                  updateMediaEntry(entry.id, {
                                    type: event.target.value as MediaType,
                                  })
                                }
                                className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-950 outline-none"
                              >
                                {MEDIA_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={entry.status}
                                onChange={(event) =>
                                  updateMediaEntry(entry.id, {
                                    status: event.target.value as MediaStatus,
                                    finishedOn:
                                      event.target.value === "read"
                                        ? (entry.finishedOn ?? todayAsDateKey())
                                        : null,
                                  })
                                }
                                className={`rounded-lg px-2 py-1 text-xs font-semibold ${toStatusClass(entry.status)} outline-none`}
                              >
                                {MEDIA_STATUSES.map((statusOption) => (
                                  <option key={statusOption} value={statusOption}>
                                    {statusOption}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="text"
                              value={entry.creator}
                              onChange={(event) =>
                                updateMediaEntry(entry.id, {
                                  creator: event.target.value,
                                })
                              }
                              placeholder="Creator"
                              className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => deleteMediaEntry(entry.id)}
                              className="mt-1 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </article>
                        ))}
                        {mediaByStatus[status].length === 0 ? (
                          <p className="rounded-lg border border-rose-200 bg-white/70 px-2 py-1 text-xs text-rose-900/60">
                            No entries.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard resizable movable storageScope={userScope} title="Kanban Projects" subtitle="Horizontal board with drag and drop">
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={newKanbanTitle}
                onChange={(event) => setNewKanbanTitle(event.target.value)}
                placeholder="Task or project"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 sm:col-span-2"
              />
              <input
                type="text"
                value={newKanbanProject}
                onChange={(event) => setNewKanbanProject(event.target.value)}
                placeholder="Project name"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <button
              type="button"
              onClick={addKanbanCard}
              className="mt-2 rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-200"
            >
              Add Card
            </button>

            <div className="mt-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {KANBAN_COLUMNS.map((column) => (
                  <div
                    key={column.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverColumn(column.id);
                    }}
                    onDragLeave={() => setDragOverColumn((previous) => (previous === column.id ? null : previous))}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedKanbanCardId) {
                        moveKanbanCardToColumn(draggedKanbanCardId, column.id);
                      }
                      setDraggedKanbanCardId(null);
                      setDragOverColumn(null);
                    }}
                    className={`rounded-2xl border p-2 ${column.accent} ${
                      dragOverColumn === column.id ? "ring-2 ring-rose-300" : ""
                    }`}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-900/70">
                      {column.title}
                    </p>
                    <div className="space-y-2">
                      {data.kanban.cards
                        .filter((card) => card.column === column.id)
                        .map((card) => (
                          <article
                            key={card.id}
                            draggable
                            onDragStart={() => setDraggedKanbanCardId(card.id)}
                            onDragEnd={() => {
                              setDraggedKanbanCardId(null);
                              setDragOverColumn(null);
                            }}
                            className="rounded-xl border border-rose-200 bg-white/95 p-2"
                          >
                            <input
                              type="text"
                              value={card.title}
                              onChange={(event) =>
                                updateKanbanCard(card.id, { title: event.target.value })
                              }
                              className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-semibold text-rose-950 outline-none"
                            />
                            <input
                              type="text"
                              value={card.project}
                              onChange={(event) =>
                                updateKanbanCard(card.id, { project: event.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                            />
                            <input
                              type="date"
                              value={card.dueDate ?? ""}
                              onChange={(event) =>
                                updateKanbanCard(card.id, {
                                  dueDate: event.target.value || null,
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                            />
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-rose-900/65">
                                Drag to move
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteKanbanCard(card.id)}
                                className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        ))}
                      {data.kanban.cards.filter((card) => card.column === column.id).length ===
                      0 ? (
                        <p className="text-xs text-rose-900/60">No cards.</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard resizable movable storageScope={userScope}
            title="Feedly + Substack"
            subtitle="Reading intake widgets with inline management"
            actions={
              <div className="flex gap-2">
                <span className="rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900/85">
                  Auto Sync Enabled
                </span>
              </div>
            }
          >
            <label className="block text-xs font-semibold text-rose-900/70">
              Feedly token
              <input
                type="password"
                value={data.feedly.token}
                onChange={(event) =>
                  setData((previous) => ({
                    ...previous,
                    feedly: { ...previous.feedly, token: event.target.value },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
            </label>
            <label className="mt-2 block text-xs font-semibold text-rose-900/70">
              Feedly stream id
              <input
                type="text"
                value={data.feedly.streamId}
                onChange={(event) =>
                  setData((previous) => ({
                    ...previous,
                    feedly: { ...previous.feedly, streamId: event.target.value },
                  }))
                }
                placeholder="user/xxxx/category/xxxx"
                className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
            </label>
            <p className="mt-1 text-xs text-rose-900/60">
              Feedly last synced: {toInputDateTime(data.feedly.lastSyncedAt)}
            </p>

            <div className="mt-2 space-y-2 rounded-2xl border border-rose-200 bg-rose-50/60 p-2">
              {data.feedly.items.slice(0, 8).map((item) => (
                <article key={item.id} className="rounded-xl border border-rose-200 bg-white p-2">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(event) =>
                        setData((previous) => ({
                          ...previous,
                          feedly: {
                            ...previous.feedly,
                            items: previous.feedly.items.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, title: event.target.value }
                                : entry,
                            ),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-semibold text-rose-950 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setData((previous) => ({
                          ...previous,
                          feedly: {
                            ...previous.feedly,
                            items: previous.feedly.items.filter(
                              (entry) => entry.id !== item.id,
                            ),
                          },
                        }))
                      }
                      className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-rose-900/65">
                    {item.source} | {toInputDateTime(item.publishedAt)}
                  </p>
                </article>
              ))}
              {data.feedly.items.length === 0 ? (
                <p className="text-xs text-rose-900/65">
                  Feedly items appear here after syncing.
                </p>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={newSubstackName}
                onChange={(event) => setNewSubstackName(event.target.value)}
                placeholder="Newsletter name"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
              <input
                type="url"
                value={newSubstackFeedUrl}
                onChange={(event) => setNewSubstackFeedUrl(event.target.value)}
                placeholder="https://name.substack.com/feed"
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
              />
              <button
                type="button"
                onClick={addSubstackFeed}
                className="rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-200"
              >
                Add
              </button>
            </div>

            <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50/60 p-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-900/65">
                Substack feeds
              </p>
              <div className="mt-2 space-y-2">
                {data.substack.feeds.map((feed) => (
                  <div key={feed.id} className="rounded-xl border border-rose-200 bg-white p-2">
                    <input
                      type="text"
                      value={feed.name}
                      onChange={(event) =>
                        updateSubstackFeed(feed.id, { name: event.target.value })
                      }
                      className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-950 outline-none"
                    />
                    <input
                      type="url"
                      value={feed.feedUrl}
                      onChange={(event) =>
                        updateSubstackFeed(feed.id, { feedUrl: event.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => deleteSubstackFeed(feed.id)}
                      className="mt-1 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {data.substack.feeds.length === 0 ? (
                  <p className="text-xs text-rose-900/65">No Substack feeds added yet.</p>
                ) : null}
              </div>
            </div>

            <div className="mt-2 space-y-2 rounded-2xl border border-rose-200 bg-rose-50/60 p-2">
              {data.substack.items.slice(0, 10).map((item) => (
                <article key={item.id} className="rounded-xl border border-rose-200 bg-white p-2">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(event) =>
                        setData((previous) => ({
                          ...previous,
                          substack: {
                            ...previous.substack,
                            items: previous.substack.items.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, title: event.target.value }
                                : entry,
                            ),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm font-semibold text-rose-950 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setData((previous) => ({
                          ...previous,
                          substack: {
                            ...previous.substack,
                            items: previous.substack.items.filter(
                              (entry) => entry.id !== item.id,
                            ),
                          },
                        }))
                      }
                      className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-rose-900/65">
                    {item.source} | {toInputDateTime(item.publishedAt)}
                  </p>
                </article>
              ))}
              {data.substack.items.length === 0 ? (
                <p className="text-xs text-rose-900/65">
                  Substack headlines appear here after refresh.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard resizable movable storageScope={userScope}
            title="Go-To Notes & Lists"
            subtitle="Things to buy, present ideas, and brainstorming lists"
          >
            {(
              [
                { key: "buy", label: "Things to Buy" },
                { key: "presents", label: "Present Ideas" },
                { key: "brainstorm", label: "Brainstorming" },
              ] as const
            ).map((entry) => (
              <div key={entry.key} className="mb-3 rounded-2xl border border-rose-200 bg-rose-50/55 p-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-900/70">
                  {entry.label}
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={quickListDrafts[entry.key]}
                    onChange={(event) =>
                      setQuickListDrafts((previous) => ({
                        ...previous,
                        [entry.key]: event.target.value,
                      }))
                    }
                    placeholder={`Add ${entry.label.toLowerCase()} item`}
                    className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-950 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                  />
                  <button
                    type="button"
                    onClick={() => addQuickListItem(entry.key)}
                    className="rounded-xl border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-200"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {data.quickLists[entry.key].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-2 py-1.5 text-sm text-rose-900"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          updateQuickListItem(entry.key, item.id, { done: !item.done })
                        }
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(event) =>
                          updateQuickListItem(entry.key, item.id, {
                            text: event.target.value,
                          })
                        }
                        className={`w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-900 outline-none ${
                          item.done ? "line-through text-rose-900/55" : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => deleteQuickListItem(entry.key, item.id)}
                        className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-xs font-semibold text-rose-900 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {data.quickLists[entry.key].length === 0 ? (
                    <p className="text-xs text-rose-900/60">No items yet.</p>
                  ) : null}
                </div>
              </div>
            ))}
          </SectionCard>

        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-30"
        onPointerMove={(event) => {
          if (!draggedStickyId || !stickyDragOffset || !boardRef.current) {
            return;
          }
          const bounds = boardRef.current.getBoundingClientRect();
          const x = Math.max(
            0,
            Math.min(bounds.width - 210, event.clientX - bounds.left - stickyDragOffset.x),
          );
          const y = Math.max(
            0,
            Math.min(bounds.height - 210, event.clientY - bounds.top - stickyDragOffset.y),
          );
          updateStickyNote(draggedStickyId, {
            x: Math.round(x),
            y: Math.round(y),
          });
        }}
        onPointerUp={() => {
          setDraggedStickyId(null);
          setStickyDragOffset(null);
        }}
      >
        {stickyNotes.map((note) => (
          <article
            key={note.id}
            className={`sticky-note-shape pointer-events-auto absolute ${
              note.style === "pink-heart"
                ? "h-[200px] w-[220px]"
                : "h-[190px] w-[210px]"
            }`}
            style={{ left: note.x, top: note.y }}
            onPointerDown={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("button")) {
                return;
              }
              const bounds = event.currentTarget.getBoundingClientRect();
              setDraggedStickyId(note.id);
              setStickyDragOffset({
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
              });
            }}
          >
            {note.style === "pink-heart" ? (
              <div className="relative h-full w-full">
                <svg
                  className="absolute inset-0 h-full w-full drop-shadow-[0_10px_20px_rgba(60,40,60,0.28)]"
                  viewBox="0 0 220 200"
                  aria-hidden="true"
                >
                  <path
                    d="M110 186 C108 183, 20 123, 20 74 C20 43, 44 22, 73 22 C91 22, 104 30, 110 42 C116 30, 129 22, 147 22 C176 22, 200 43, 200 74 C200 123, 112 183, 110 186 Z"
                    fill="#ff4d9d"
                  />
                </svg>
                <div className="absolute left-0 top-0 z-10 flex w-full items-center justify-end px-7 pt-6 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-950">
                  <button
                    type="button"
                    onClick={() => deleteStickyNote(note.id)}
                    className="px-1 py-0 text-[12px] leading-none text-rose-950/90"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={note.text}
                  onChange={(event) => updateStickyNote(note.id, { text: event.target.value })}
                  placeholder="Type your note..."
                  className="sticky-note-textarea absolute left-1/2 top-[57%] z-10 h-[100px] w-[140px] -translate-x-1/2 -translate-y-1/2 resize-none px-2 py-1 text-xs text-rose-950 placeholder:text-rose-900/70 outline-none"
                />
              </div>
            ) : (
              <div className="relative h-full w-full">
                <div className="pointer-events-none absolute inset-0 bg-[#ffef00] shadow-[0_10px_20px_-16px_rgba(60,40,60,0.45)]" />
                <div className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[28px] border-b-[28px] border-l-transparent border-b-[#e0cf00]" />
                <div className="pointer-events-none absolute right-[2px] top-[2px] h-0 w-0 border-l-[22px] border-b-[22px] border-l-transparent border-b-[#fff7a6]" />
                <div className="absolute left-0 top-0 z-20 mb-1 flex w-full items-center justify-end px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-950/90">
                  <button
                    type="button"
                    onClick={() => deleteStickyNote(note.id)}
                    className="px-1 py-0 text-[13px] leading-none"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={note.text}
                  onChange={(event) => updateStickyNote(note.id, { text: event.target.value })}
                  placeholder="Type your note..."
                  className="sticky-note-textarea absolute left-0 top-0 z-10 h-full w-full resize-none px-3 py-7 text-sm text-rose-950 caret-rose-900 placeholder:text-rose-900/65 outline-none"
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
};




