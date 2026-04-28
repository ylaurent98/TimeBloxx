import { randomBytes } from "node:crypto";

const COOKIE_NAME = "tb_outlook_oauth_state";

const parseCookies = (cookieHeader) => {
  const header = typeof cookieHeader === "string" ? cookieHeader : "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) {
          return [part, ""];
        }
        const key = part.slice(0, index).trim();
        const value = decodeURIComponent(part.slice(index + 1).trim());
        return [key, value];
      }),
  );
};

const getBaseUrl = (req) => {
  const proto =
    (req.headers["x-forwarded-proto"] || "").toString().split(",")[0].trim() ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] || "").toString().split(",")[0].trim() ||
    req.headers.host;
  return `${proto}://${host}`;
};

const buildCookie = (name, value, req, maxAgeSec) => {
  const baseUrl = getBaseUrl(req);
  const secure = baseUrl.startsWith("https://");
  const pieces = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) {
    pieces.push("Secure");
  }
  return pieces.join("; ");
};

const popupResponse = (res, payload, baseUrl, clearCookie) => {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const escapedBase = JSON.stringify(baseUrl);
  res.statusCode = payload.type === "oauth-success" ? 200 : 400;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (clearCookie) {
    res.setHeader("Set-Cookie", clearCookie);
  }
  res.end(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>OAuth</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 20px;">
    <p>${payload.type === "oauth-success" ? "Connection successful. You can close this window." : "Connection failed. You can close this window."}</p>
    <script>
      (function () {
        var payload = ${json};
        var targetOrigin = ${escapedBase};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, targetOrigin);
          window.close();
          return;
        }
      })();
    </script>
  </body>
</html>`);
};

const toExpiresAt = (expiresInSec) => {
  const seconds = Number(expiresInSec);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return new Date(Date.now() + seconds * 1000).toISOString();
};

export default async function handler(req, res) {
  const action = req.query?.action;
  const baseUrl = getBaseUrl(req);
  const hasOAuthCallbackQuery =
    typeof req.query?.code === "string" ||
    typeof req.query?.state === "string" ||
    typeof req.query?.error === "string";

  const tenant = process.env.OUTLOOK_OAUTH_TENANT_ID || "common";
  const authorizeEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
  const tokenEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  if (action === "start") {
    const clientId = process.env.OUTLOOK_OAUTH_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(500).json({
        error:
          "Missing OUTLOOK_OAUTH_CLIENT_ID/OUTLOOK_OAUTH_CLIENT_SECRET environment variables.",
      });
      return;
    }

    const redirectUri =
      process.env.OUTLOOK_OAUTH_REDIRECT_URI || `${baseUrl}/api/oauth-outlook`;
    const scopes =
      process.env.OUTLOOK_OAUTH_SCOPES ||
      "openid profile offline_access https://graph.microsoft.com/Calendars.ReadBasic";
    const state = randomBytes(16).toString("hex");

    const authorizeUrl = new URL(authorizeEndpoint);
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_mode", "query");
    authorizeUrl.searchParams.set("scope", scopes);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("prompt", "select_account");

    res.statusCode = 302;
    res.setHeader("Location", authorizeUrl.toString());
    res.setHeader("Set-Cookie", buildCookie(COOKIE_NAME, state, req, 600));
    res.end();
    return;
  }

  if (action === "callback" || hasOAuthCallbackQuery) {
    const cookies = parseCookies(req.headers.cookie);
    const expectedState = cookies[COOKIE_NAME];
    const givenState = typeof req.query?.state === "string" ? req.query.state : "";
    const clearCookie = buildCookie(COOKIE_NAME, "", req, 0);

    if (!expectedState || !givenState || expectedState !== givenState) {
      popupResponse(
        res,
        {
          type: "oauth-error",
          provider: "outlook",
          error: "Invalid OAuth state. Please try connecting again.",
        },
        baseUrl,
        clearCookie,
      );
      return;
    }

    const code = typeof req.query?.code === "string" ? req.query.code : "";
    const upstreamError =
      typeof req.query?.error === "string" ? req.query.error : "";
    const upstreamErrorDescription =
      typeof req.query?.error_description === "string"
        ? req.query.error_description
        : "";

    if (upstreamError) {
      popupResponse(
        res,
        {
          type: "oauth-error",
          provider: "outlook",
          error: upstreamErrorDescription || upstreamError,
        },
        baseUrl,
        clearCookie,
      );
      return;
    }
    if (!code) {
      popupResponse(
        res,
        {
          type: "oauth-error",
          provider: "outlook",
          error: "Authorization code is missing.",
        },
        baseUrl,
        clearCookie,
      );
      return;
    }

    const clientId = process.env.OUTLOOK_OAUTH_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_OAUTH_CLIENT_SECRET;
    const redirectUri =
      process.env.OUTLOOK_OAUTH_REDIRECT_URI || `${baseUrl}/api/oauth-outlook`;
    const scopes =
      process.env.OUTLOOK_OAUTH_SCOPES ||
      "openid profile offline_access https://graph.microsoft.com/Calendars.ReadBasic";

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: scopes,
      });

      const tokenResponse = await fetch(tokenEndpoint, {
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
        popupResponse(
          res,
          {
            type: "oauth-error",
            provider: "outlook",
            error: details || `Token exchange failed (${tokenResponse.status}).`,
          },
          baseUrl,
          clearCookie,
        );
        return;
      }

      const tokenPayload = await tokenResponse.json();
      const accessToken = tokenPayload?.access_token;
      if (typeof accessToken !== "string" || !accessToken.trim()) {
        popupResponse(
          res,
          {
            type: "oauth-error",
            provider: "outlook",
            error: "No access token returned by Microsoft.",
          },
          baseUrl,
          clearCookie,
        );
        return;
      }

      popupResponse(
        res,
        {
          type: "oauth-success",
          provider: "outlook",
          tokens: {
            accessToken,
            refreshToken:
              typeof tokenPayload?.refresh_token === "string"
                ? tokenPayload.refresh_token
                : null,
            expiresAt: toExpiresAt(tokenPayload?.expires_in),
            scope:
              typeof tokenPayload?.scope === "string" ? tokenPayload.scope : null,
          },
        },
        baseUrl,
        clearCookie,
      );
      return;
    } catch (error) {
      popupResponse(
        res,
        {
          type: "oauth-error",
          provider: "outlook",
          error: error instanceof Error ? error.message : "Unexpected OAuth error.",
        },
        baseUrl,
        clearCookie,
      );
      return;
    }
  }

  res.status(400).json({ error: "Unsupported action" });
}
