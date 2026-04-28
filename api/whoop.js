const WHOOP_BASE_URL = "https://api.prod.whoop.com/developer/v2";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

const asIsoRange = (dateKey, boundary) => {
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return `${dateKey}${suffix}`;
};

const numberOrNull = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value;
};

const toDateKey = (isoLike) => {
  if (typeof isoLike !== "string" || !isoLike.trim()) {
    return null;
  }
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

const enumerateDateKeys = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const keys = [];
  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor = new Date(cursor.getTime() + 86400000)
  ) {
    keys.push(cursor.toISOString().slice(0, 10));
  }
  return keys;
};

const getCollectionRecords = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload?.records)) {
    return payload.records;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  return [];
};

const getNextToken = (payload) => {
  if (typeof payload?.nextToken === "string" && payload.nextToken.trim()) {
    return payload.nextToken;
  }
  if (typeof payload?.next_token === "string" && payload.next_token.trim()) {
    return payload.next_token;
  }
  if (typeof payload?.next === "string" && payload.next.trim()) {
    return payload.next;
  }
  return null;
};

const valueFromPaths = (source, paths) => {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => acc?.[key], source);
    if (value != null) {
      return value;
    }
  }
  return null;
};

const toNumberFromPaths = (source, paths) => numberOrNull(valueFromPaths(source, paths));

const toDateKeyFromPaths = (source, paths) =>
  toDateKey(valueFromPaths(source, paths));

const fetchWhoopCollection = async (token, path, query) => {
  const collected = [];
  let nextToken = null;

  while (true) {
    const url = new URL(`${WHOOP_BASE_URL}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    if (nextToken) {
      url.searchParams.set("nextToken", nextToken);
    }

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
      const error = new Error(`Whoop request failed (${response.status})`);
      error.status = response.status;
      error.details = details;
      throw error;
    }

    const payload = await response.json();
    collected.push(...getCollectionRecords(payload));
    nextToken = getNextToken(payload);
    if (!nextToken) {
      break;
    }
  }

  return collected;
};

const buildWeeklyMetrics = ({ recoveries, sleeps, cycles, startDate, endDate }) => {
  const byDate = new Map();

  enumerateDateKeys(startDate, endDate).forEach((dateKey) => {
    byDate.set(dateKey, {
      dateKey,
      recoveryScore: null,
      sleepPerformance: null,
      strain: null,
      hrv: null,
      steps: null,
      calories: null,
      restingHeartRate: null,
      sleepHours: null,
    });
  });

  recoveries.forEach((recovery) => {
    const dateKey = toDateKeyFromPaths(recovery, [
      "created_at",
      "updated_at",
      "start",
      "end",
      "score.timestamp",
      "score.updated_at",
    ]);
    if (!dateKey || !byDate.has(dateKey)) {
      return;
    }
    const entry = byDate.get(dateKey);
    entry.recoveryScore = toNumberFromPaths(recovery, [
      "score.recovery_score",
      "score.recoveryScore",
      "recovery_score",
      "recoveryScore",
    ]);
    entry.hrv = toNumberFromPaths(recovery, [
      "score.hrv_rmssd_milli",
      "score.hrv",
      "hrv_rmssd_milli",
      "hrv",
    ]);
    entry.restingHeartRate = toNumberFromPaths(recovery, [
      "score.resting_heart_rate",
      "score.restingHeartRate",
      "resting_heart_rate",
      "restingHeartRate",
    ]);
  });

  sleeps.forEach((sleep) => {
    const dateKey = toDateKeyFromPaths(sleep, [
      "end",
      "created_at",
      "updated_at",
      "start",
      "score.timestamp",
      "score.updated_at",
    ]);
    if (!dateKey || !byDate.has(dateKey)) {
      return;
    }
    const entry = byDate.get(dateKey);
    entry.sleepPerformance = toNumberFromPaths(sleep, [
      "score.sleep_performance_percentage",
      "score.sleepPerformance",
      "sleep_performance_percentage",
      "sleepPerformance",
    ]);
    const sleepDurationHours = toNumberFromPaths(sleep, [
      "score.stage_summary.total_in_bed_time_milli",
      "score.stageSummary.totalInBedTimeMilli",
      "score.total_in_bed_time_milli",
      "score.totalInBedTimeMilli",
      "score.sleep_duration_milli",
      "score.sleepDurationMilli",
    ]);
    if (sleepDurationHours != null) {
      entry.sleepHours = Number((sleepDurationHours / 3600000).toFixed(1));
    }
  });

  cycles.forEach((cycle) => {
    const dateKey = toDateKeyFromPaths(cycle, [
      "end",
      "created_at",
      "updated_at",
      "start",
      "score.timestamp",
      "score.updated_at",
    ]);
    if (!dateKey || !byDate.has(dateKey)) {
      return;
    }
    const entry = byDate.get(dateKey);
    entry.strain = toNumberFromPaths(cycle, [
      "score.strain",
      "strain",
    ]);
    const kilojoule = toNumberFromPaths(cycle, ["score.kilojoule", "kilojoule"]);
    entry.calories =
      kilojoule != null
        ? Math.round(kilojoule * 0.239006)
        : toNumberFromPaths(cycle, [
            "score.active_calories",
            "score.activeCalories",
            "score.calories",
            "active_calories",
            "activeCalories",
            "calories",
          ]);
    entry.steps = toNumberFromPaths(cycle, [
      "score.steps",
      "steps",
      "score.step_count",
      "score.stepCount",
      "step_count",
      "stepCount",
    ]);
  });

  return [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

const toExpiresAt = (expiresInSec) => {
  const seconds = Number(expiresInSec);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return new Date(Date.now() + seconds * 1000).toISOString();
};

const refreshWhoopAccessToken = async (refreshToken) => {
  const clientId = process.env.WHOOP_OAUTH_CLIENT_ID || process.env.WHOOP_CLIENT_ID;
  const clientSecret =
    process.env.WHOOP_OAUTH_CLIENT_SECRET || process.env.WHOOP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const error = new Error("Missing Whoop OAuth client configuration for token refresh.");
    error.status = 500;
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const tokenResponse = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!tokenResponse.ok) {
    let details = "";
    try {
      details = await tokenResponse.text();
    } catch {
      // no-op
    }
    const error = new Error(details || `Whoop token refresh failed (${tokenResponse.status})`);
    error.status = tokenResponse.status;
    throw error;
  }

  const tokenPayload = await tokenResponse.json();
  const accessToken = tokenPayload?.access_token;
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    const error = new Error("Whoop refresh returned no access token.");
    error.status = 502;
    throw error;
  }

  return {
    accessToken,
    refreshToken:
      typeof tokenPayload?.refresh_token === "string" && tokenPayload.refresh_token.trim()
        ? tokenPayload.refresh_token
        : refreshToken,
    expiresAt: toExpiresAt(tokenPayload?.expires_in),
    scope: typeof tokenPayload?.scope === "string" ? tokenPayload.scope : null,
  };
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { action, token, refreshToken, startDate, endDate } = req.body ?? {};
  if (action !== "weeklyMetrics") {
    res.status(400).json({ error: "Unsupported action" });
    return;
  }

  const providedToken = typeof token === "string" ? token.trim() : "";
  const providedRefreshToken =
    typeof refreshToken === "string" ? refreshToken.trim() : "";

  if (!providedToken && !providedRefreshToken) {
    res.status(400).json({ error: "Missing Whoop token credentials" });
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

  try {
    const query = {
      start: asIsoRange(startDate, "start"),
      end: asIsoRange(endDate, "end"),
      limit: 25,
    };

    let accessToken = providedToken;
    let refreshedTokens = null;

    const fetchAllMetrics = async () =>
      Promise.all([
        fetchWhoopCollection(accessToken, "/recovery", query),
        fetchWhoopCollection(accessToken, "/activity/sleep", query),
        fetchWhoopCollection(accessToken, "/cycle", query),
      ]);

    let recoveries;
    let sleeps;
    let cycles;
    if (!accessToken && providedRefreshToken) {
      refreshedTokens = await refreshWhoopAccessToken(providedRefreshToken);
      accessToken = refreshedTokens.accessToken;
    }

    try {
      [recoveries, sleeps, cycles] = await fetchAllMetrics();
    } catch (firstError) {
      const status = Number(firstError?.status) || 500;
      if (status !== 401 || !providedRefreshToken) {
        throw firstError;
      }
      refreshedTokens = await refreshWhoopAccessToken(providedRefreshToken);
      accessToken = refreshedTokens.accessToken;
      [recoveries, sleeps, cycles] = await fetchAllMetrics();
    }

    const metrics = buildWeeklyMetrics({
      recoveries,
      sleeps,
      cycles,
      startDate,
      endDate,
    });

    res.status(200).json({ metrics, tokens: refreshedTokens });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const details = typeof error?.details === "string" ? error.details : "";
    const message =
      status === 401
        ? "Whoop token is unauthorized or expired."
        : `Whoop sync failed (${status})`;
    res.status(status).json({
      error: details ? `${message} ${details}` : message,
    });
  }
}
