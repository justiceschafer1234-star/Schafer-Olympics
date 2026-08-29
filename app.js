const body = document.querySelector("#standings-body");
const status = document.querySelector(".status");
const statusText = document.querySelector("#status-text");
const updatedAt = document.querySelector("#updated-at");
const refreshButton = document.querySelector("#refresh-button");
const setupMessage = document.querySelector("#setup-message");

function findProperty(properties, candidates) {
  const entries = Object.entries(properties || {});
  for (const candidate of candidates) {
    const match = entries.find(([name]) => name.toLowerCase() === candidate.toLowerCase());
    if (match) return match[1];
  }
  return null;
}

function inferTeam(properties) {
  const preferred = findProperty(properties, ["Team", "Team Name", "Name"]);
  if (preferred !== null && preferred !== "") return String(preferred);

  const firstText = Object.values(properties || {}).find(
    (value) => typeof value === "string" && value.trim()
  );
  return firstText || "Unnamed Team";
}

function inferPoints(properties) {
  const preferred = findProperty(properties, ["Points", "Total Points", "Score", "Total"]);
  if (typeof preferred === "number") return preferred;
  if (preferred !== null && preferred !== "" && !Number.isNaN(Number(preferred))) return Number(preferred);

  const firstNumber = Object.values(properties || {}).find((value) => typeof value === "number");
  return typeof firstNumber === "number" ? firstNumber : 0;
}

function renderRows(rows) {
  const standings = rows
    .map((row) => ({ team: inferTeam(row.properties), points: inferPoints(row.properties) }))
    .sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));

  if (!standings.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="3">No teams found yet.</td></tr>';
    return;
  }

  body.innerHTML = standings
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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
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

    if (!response.ok || data.error) throw new Error(data.error || "Unable to load scores");

    renderRows(data.rows || []);
    statusText.textContent = "Live from Notion";
    updatedAt.textContent = data.updatedAt
      ? `Last checked ${new Date(data.updatedAt).toLocaleString()}`
      : "";
  } catch (error) {
    console.error(error);
    body.innerHTML = '<tr class="empty-row"><td colspan="3">Scores are temporarily unavailable.</td></tr>';
    status.classList.add("error");
    statusText.textContent = "Connection error";
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadScores);
loadScores();
