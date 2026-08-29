const NOTION_VERSION = "2026-03-11";
const DEFAULT_DATA_SOURCE_ID = "1bffd4df-3de3-4e8e-9c13-cbcb1e30e226";
const TEAMS = ["Team Red", "Team Blue", "Team Green", "Team Gold"];
const EVENT_STATUSES = ["Not Started", "In Progress", "Delayed", "Complete"];

const TEAM_SCORE_FIELDS = [
  { team: "Team Red", field: "🔴 Red Points" },
  { team: "Team Blue", field: "🔵 Blue Points" },
  { team: "Team Green", field: "🟢 Green Points" },
  { team: "Team Gold", field: "🟡 Gold Points" },
];

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", headers.get("Cache-Control") || "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function plainText(parts = []) {
  return parts.map((part) => part?.plain_text ?? part?.text?.content ?? "").join("");
}

function normalizeProperty(property) {
  if (!property || !property.type) return null;

  switch (property.type) {
    case "title": return plainText(property.title);
    case "rich_text": return plainText(property.rich_text);
    case "number": return property.number;
    case "select": return property.select?.name ?? null;
    case "status": return property.status?.name ?? null;
    case "checkbox": return property.checkbox;
    case "date": return property.date?.start ?? null;
    case "url": return property.url;
    case "email": return property.email;
    case "phone_number": return property.phone_number;
    case "formula": {
      const formula = property.formula;
      if (!formula) return null;
      return formula[formula.type] ?? null;
    }
    case "rollup": {
      const rollup = property.rollup;
      if (!rollup) return null;
      if (rollup.type === "number") return rollup.number;
      if (rollup.type === "date") return rollup.date?.start ?? null;
      return null;
    }
    case "multi_select": return property.multi_select?.map((item) => item.name) ?? [];
    default: return null;
  }
}

function normalizePage(page) {
  const properties = {};
  for (const [name, property] of Object.entries(page.properties ?? {})) {
    properties[name] = normalizeProperty(property);
  }
  return { id: page.id, lastEditedTime: page.last_edited_time, properties };
}

function normalizeDataSourceId(value) {
  if (!value) return DEFAULT_DATA_SOURCE_ID;
  return String(value).trim().replace(/^collection:\/\//i, "");
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resultRecorded(row) {
  return row.properties?.Status === "Complete";
}

function buildStandings(rows) {
  return TEAM_SCORE_FIELDS.map(({ team, field }) => ({
    team,
    points: rows.reduce((total, row) => total + numberValue(row.properties?.[field]), 0),
  })).sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));
}

function buildRaceInfo(rows, standings) {
  const remainingGoldPoints = rows
    .filter((row) => !resultRecorded(row))
    .reduce((sum, row) => sum + numberValue(row.properties?.["🥇 Gold Points"]), 0);

  return {
    completedEvents: rows.filter(resultRecorded).length,
    totalEvents: rows.length,
    remainingGoldPoints,
    maximumPossible: standings.map((team) => ({
      team: team.team,
      currentPoints: team.points,
      maximumPoints: team.points + remainingGoldPoints,
    })),
  };
}

async function queryAll(token, dataSourceId) {
  const results = [];
  let startCursor;
  do {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, ...(startCursor ? { start_cursor: startCursor } : {}) }),
    });

    if (!response.ok) {
      let notionError = {};
      try { notionError = await response.json(); }
      catch { notionError = { message: `Notion returned ${response.status}` }; }
      const error = new Error(notionError.message || `Notion returned ${response.status}`);
      error.status = response.status;
      error.code = notionError.code || null;
      throw error;
    }

    const data = await response.json();
    results.push(...(data.results ?? []));
    startCursor = data.has_more ? data.next_cursor : null;
  } while (startCursor);
  return results;
}

async function scoresResponse(env) {
  const token = env.NOTION_API_TOKEN;
  const dataSourceId = normalizeDataSourceId(env.NOTION_DATA_SOURCE_ID);
  if (!token) return json({ configured: false, error: "NOTION_API_TOKEN is missing in Cloudflare." }, { status: 503 });

  try {
    const pages = await queryAll(token, dataSourceId);
    const rows = pages.map(normalizePage);
    const standings = buildStandings(rows);
    const race = buildRaceInfo(rows, standings);
    return json({ configured: true, standings, race, rows, dataSourceId, updatedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("Notion query failed", { status: error?.status, code: error?.code, message: error?.message });
    return json({
      configured: true,
      error: "Unable to load scoreboard data.",
      notionStatus: error?.status ?? null,
      notionCode: error?.code ?? null,
      notionMessage: error?.message ?? "Unknown Notion error",
      dataSourceId,
    }, { status: 502 });
  }
}

function validTeam(value) {
  return TEAMS.includes(value);
}

async function updateScore(request, env) {
  if (!env.NOTION_API_TOKEN) return json({ error: "Notion is not configured." }, { status: 503 });
  if (!env.ADMIN_SCORE_CODE) {
    return json({ error: "Score entry is not enabled yet. Add ADMIN_SCORE_CODE in Cloudflare runtime secrets." }, { status: 503 });
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request." }, { status: 400 }); }

  if (String(body.code || "") !== String(env.ADMIN_SCORE_CODE)) {
    return json({ error: "Incorrect score-entry code." }, { status: 401 });
  }

  const eventId = String(body.eventId || "").trim();
  const goldTeam = body.goldTeam;
  const silverTeam = body.silverTeam;
  const bronzeTeams = Array.isArray(body.bronzeTeams) ? body.bronzeTeams.filter(Boolean) : [];
  const eventStatus = EVENT_STATUSES.includes(body.status) ? body.status : "Complete";

  if (!eventId || !validTeam(goldTeam) || !validTeam(silverTeam)) {
    return json({ error: "Choose an event, gold team, and silver team." }, { status: 400 });
  }
  if (bronzeTeams.length > 2 || bronzeTeams.some((team) => !validTeam(team))) {
    return json({ error: "Bronze teams are invalid." }, { status: 400 });
  }

  const placements = [goldTeam, silverTeam, ...bronzeTeams];
  if (new Set(placements).size !== placements.length) {
    return json({ error: "A team cannot occupy more than one finishing position." }, { status: 400 });
  }

  const notionResponse = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.NOTION_API_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        "🥇 Team": { select: { name: goldTeam } },
        "🥈 Team": { select: { name: silverTeam } },
        "🥉 Team": { multi_select: bronzeTeams.map((name) => ({ name })) },
        Status: { status: { name: eventStatus } },
      },
    }),
  });

  const notionData = await notionResponse.json();
  if (!notionResponse.ok) {
    return json({
      error: "Notion rejected the score update.",
      notionStatus: notionResponse.status,
      notionCode: notionData.code || null,
      notionMessage: notionData.message || null,
    }, { status: 502 });
  }

  return json({ ok: true, eventId, status: eventStatus, message: "Result and event status saved to Notion." });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/scores") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET" } });
      return scoresResponse(env);
    }
    if (url.pathname === "/api/admin/scores") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
      return updateScore(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, { status: 404 });
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
