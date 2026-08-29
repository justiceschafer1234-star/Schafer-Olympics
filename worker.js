const NOTION_VERSION = "2026-03-11";
const DEFAULT_DATA_SOURCE_ID = "1bffd4df-3de3-4e8e-9c13-cbcb1e30e226";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function plainText(parts = []) {
  return parts.map((part) => part?.plain_text ?? part?.text?.content ?? "").join("");
}

function normalizeProperty(property) {
  if (!property || !property.type) return null;

  switch (property.type) {
    case "title":
      return plainText(property.title);
    case "rich_text":
      return plainText(property.rich_text);
    case "number":
      return property.number;
    case "select":
      return property.select?.name ?? null;
    case "status":
      return property.status?.name ?? null;
    case "checkbox":
      return property.checkbox;
    case "date":
      return property.date?.start ?? null;
    case "url":
      return property.url;
    case "email":
      return property.email;
    case "phone_number":
      return property.phone_number;
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
    case "multi_select":
      return property.multi_select?.map((item) => item.name) ?? [];
    default:
      return null;
  }
}

function normalizePage(page) {
  const properties = {};
  for (const [name, property] of Object.entries(page.properties ?? {})) {
    properties[name] = normalizeProperty(property);
  }

  return {
    id: page.id,
    lastEditedTime: page.last_edited_time,
    properties,
  };
}

function normalizeDataSourceId(value) {
  if (!value) return DEFAULT_DATA_SOURCE_ID;
  return String(value).trim().replace(/^collection:\/\//i, "");
}

async function queryAll(token, dataSourceId) {
  const results = [];
  let startCursor;

  do {
    const response = await fetch(
      `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        }),
      }
    );

    if (!response.ok) {
      let notionError = {};
      try {
        notionError = await response.json();
      } catch {
        notionError = { message: `Notion returned ${response.status}` };
      }

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

  if (!token) {
    return json(
      {
        configured: false,
        error: "NOTION_API_TOKEN is missing in Cloudflare.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const pages = await queryAll(token, dataSourceId);
    return json(
      {
        configured: true,
        rows: pages.map(normalizePage),
        dataSourceId,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Notion query failed", {
      status: error?.status,
      code: error?.code,
      message: error?.message,
    });

    return json(
      {
        configured: true,
        error: "Unable to load scoreboard data.",
        notionStatus: error?.status ?? null,
        notionCode: error?.code ?? null,
        notionMessage: error?.message ?? "Unknown Notion error",
        dataSourceId,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/scores") {
      if (request.method !== "GET") {
        return json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET" } });
      }
      return scoresResponse(env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
