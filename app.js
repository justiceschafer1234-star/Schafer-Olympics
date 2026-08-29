const body = document.querySelector("#standings-body");
const status = document.querySelector(".status");
const statusText = document.querySelector("#status-text");
const updatedAt = document.querySelector("#updated-at");
const refreshButton = document.querySelector("#refresh-button");
const setupMessage = document.querySelector("#setup-message");

function renderRows(standings) {
  const sorted = [...standings].sort(
    (a, b) => Number(b.points || 0) - Number(a.points || 0) || String(a.team).localeCompare(String(b.team))
  );

  if (!sorted.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="3">No teams found yet.</td></tr>';
    return;
  }

  body.innerHTML = sorted
    .map(
      (team, index) => `
        <tr>
          <td class="place">${index + 1}</td>
          <td class="team">${escapeHtml(team.team)}</td>
          <td class="number points">${formatPoints(team.points)}</td>
        </tr>`
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPoints(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

async function loadScores() {
  refreshButton.disabled = true;
  status.classList.remove("error");
  statusText.textContent = "Loading scores…";
  setupMessage.hidden = true;

  try {
    const response = await fetch("/api/scores", { cache: "no-store" });
    const data = await response.json();

    if (!data.configured) {
      setupMessage.hidden = false;
      body.innerHTML = '<tr class="empty-row"><td colspan="3">Notion connection not configured yet.</td></tr>';
      status.classList.add("error");
      statusText.textContent = "Setup required";
      updatedAt.textContent = "";
      return;
    }

    if (!response.ok || data.error) {
      const detail = [data.notionCode, data.notionMessage].filter(Boolean).join(": ");
      throw new Error(detail || data.error || "Unable to load scores");
    }

    renderRows(data.standings || []);
    statusText.textContent = "Live from Notion";
    updatedAt.textContent = data.updatedAt
      ? `Last checked ${new Date(data.updatedAt).toLocaleString()}`
      : "";
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr class="empty-row"><td colspan="3">Scores are temporarily unavailable.</td></tr>';
    status.classList.add("error");
    statusText.textContent = "Connection error";
    updatedAt.textContent = error?.message ? `API: ${error.message}` : "";
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadScores);
loadScores();
