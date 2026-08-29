const NOTION_VERSION = "2026-03-11";

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
      const detail = await response.text();
      console.error("Notion API error", response.status, detail);
      throw new Error(`Notion returned ${response.status}`);
    }

    const data = await response.json();
    results.push(...(data.results ?? []));
    startCursor = data.has_more ? data.next_cursor : null;
  } while (startCursor);

  return results;
}

export async function onRequestGet(context) {
  const token = context.env.NOTION_API_TOKEN;
  const dataSourceId = context.env.NOTION_DATA_SOURCE_ID;

  if (!token || !dataSourceId) {
    return Response.json(
      {
        configured: false,
        error: "Notion is not configured yet.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const pages = await queryAll(token, dataSourceId);
    const rows = pages.map(normalizePage);

    return Response.json(
      {
        configured: true,
        rows,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=120",
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        configured: true,
        error: "Unable to load scoreboard data.",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
