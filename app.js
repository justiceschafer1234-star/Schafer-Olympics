const status = document.querySelector('.status');
const statusText = document.querySelector('#status-text');
const updatedAt = document.querySelector('#updated-at');
const refreshButton = document.querySelector('#refresh-button');
const setupMessage = document.querySelector('#setup-message');
const standingsCards = document.querySelector('#standings-cards');
const pointsChart = document.querySelector('#points-chart');
const goldChart = document.querySelector('#gold-chart');
const medalTable = document.querySelector('#medal-table');
const eventsGrid = document.querySelector('#events-grid');
const scheduleList = document.querySelector('#schedule-list');
const leaderBanner = document.querySelector('#leader-banner');
const progressFill = document.querySelector('#progress-fill');
const progressLabel = document.querySelector('#progress-label');
const statusBreakdown = document.querySelector('#status-breakdown');
const eventsComplete = document.querySelector('#events-complete');
const eventsTotal = document.querySelector('#events-total');
const pointsAwarded = document.querySelector('#points-awarded');
const pointsRemaining = document.querySelector('#points-remaining');
const maxPointsGrid = document.querySelector('#max-points-grid');
const scoreForm = document.querySelector('#score-form');
const adminEvent = document.querySelector('#admin-event');
const adminGold = document.querySelector('#admin-gold');
const adminSilver = document.querySelector('#admin-silver');
const adminBronze1 = document.querySelector('#admin-bronze-1');
const adminBronze2 = document.querySelector('#admin-bronze-2');
const adminCode = document.querySelector('#admin-code');
const adminMessage = document.querySelector('#admin-message');
const adminPreview = document.querySelector('#admin-preview');
const saveScore = document.querySelector('#save-score');

let latestRows = [];
let latestStandings = [];
let latestRace = null;
let activeFilter = 'All';

const TEAMS = ['Team Red', 'Team Blue', 'Team Green', 'Team Gold'];
const teamClass = {
  'Team Red': 'team-red',
  'Team Blue': 'team-blue',
  'Team Green': 'team-green',
  'Team Gold': 'team-gold',
};
const medalEmoji = ['🥇', '🥈', '🥉', '4'];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmt(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function teamSlug(team) {
  return teamClass[team] || '';
}

function statusClass(value) {
  return String(value || 'Not Started').toLowerCase().replaceAll(' ', '-');
}

function resultRecorded(row) {
  const p = row.properties || {};
  return Boolean(p['🥇 Team']) || p.Status === 'Complete';
}

function medalCounts(rows) {
  const counts = Object.fromEntries(TEAMS.map((team) => [team, { gold: 0, silver: 0, bronze: 0 }]));
  rows.forEach((row) => {
    const p = row.properties || {};
    if (counts[p['🥇 Team']]) counts[p['🥇 Team']].gold += 1;
    if (counts[p['🥈 Team']]) counts[p['🥈 Team']].silver += 1;
    const bronze = Array.isArray(p['🥉 Team']) ? p['🥉 Team'] : p['🥉 Team'] ? [p['🥉 Team']] : [];
    bronze.forEach((team) => { if (counts[team]) counts[team].bronze += 1; });
  });
  return counts;
}

function renderStandings(standings) {
  const sorted = [...standings].sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  if (!sorted.length) {
    standingsCards.innerHTML = '<div class="empty-state">No standings available yet.</div>';
    leaderBanner.className = 'leader-banner';
    leaderBanner.innerHTML = '<div><div class="leader-banner__label">No leader yet</div><div class="leader-banner__team">Waiting for results</div></div>';
    return;
  }

  const leader = Number(sorted[0].points || 0);
  const leaders = sorted.filter((team) => Number(team.points || 0) === leader);
  const hasPoints = leader > 0;
  const hasUniqueLeader = hasPoints && leaders.length === 1;

  standingsCards.innerHTML = sorted.map((team, i) => {
    const points = Number(team.points || 0);
    let gap;
    if (!hasPoints) gap = 'No points yet';
    else if (points === leader && leaders.length > 1) gap = 'Tied for lead';
    else if (i === 0 && hasUniqueLeader) gap = 'Current leader';
    else gap = `${fmt(leader - points)} pts behind`;
    return `<div class="standing-card ${teamSlug(team.team)}">
      <div class="rank-badge">${medalEmoji[i] || i + 1}</div>
      <div><div class="team-name">${esc(team.team)}</div><div class="team-gap">${gap}</div></div>
      <div class="team-points">${fmt(team.points)}<small>pts</small></div>
    </div>`;
  }).join('');

  if (!hasPoints) {
    leaderBanner.className = 'leader-banner';
    leaderBanner.innerHTML = '<div><div class="leader-banner__label">🏁 No leader yet</div><div class="leader-banner__team">Waiting for the first points</div></div><div class="leader-banner__points"><strong>0</strong><span>points</span></div>';
  } else if (hasUniqueLeader) {
    leaderBanner.className = `leader-banner ${teamSlug(sorted[0].team)}`;
    leaderBanner.innerHTML = `<div><div class="leader-banner__label">🔥 Currently leading</div><div class="leader-banner__team">${esc(sorted[0].team)}</div></div><div class="leader-banner__points"><strong>${fmt(sorted[0].points)}</strong><span>points</span></div>`;
  } else {
    leaderBanner.className = 'leader-banner';
    leaderBanner.innerHTML = `<div><div class="leader-banner__label">🤝 Tied for the lead</div><div class="leader-banner__team">${leaders.map((team) => esc(team.team)).join(' · ')}</div></div><div class="leader-banner__points"><strong>${fmt(leader)}</strong><span>points each</span></div>`;
  }
}

function renderBarChart(container, values, valueKey) {
  const max = Math.max(...values.map((x) => Number(x[valueKey] || 0)), 1);
  container.innerHTML = values.map((item) => {
    const value = Number(item[valueKey] || 0);
    const width = Math.max(value > 0 ? 3 : 0, (value / max) * 100);
    return `<div class="bar-row ${teamSlug(item.team)}"><div class="bar-label">${esc(item.team.replace('Team ', ''))}</div><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><div class="bar-value">${fmt(value)}</div></div>`;
  }).join('');
}

function renderMedals(rows, standings) {
  const counts = medalCounts(rows);
  const rank = [...standings].sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  medalTable.innerHTML = `<div class="medal-row header"><span>#</span><span>Team</span><span>🥇</span><span>🥈</span><span>🥉</span><span>Points</span></div>` + rank.map((team, i) => {
    const c = counts[team.team] || { gold: 0, silver: 0, bronze: 0 };
    return `<div class="medal-row ${teamSlug(team.team)}"><span>${i + 1}</span><span class="medal-team">${esc(team.team)}</span><span class="medal-count">${c.gold}</span><span class="medal-count">${c.silver}</span><span class="medal-count">${c.bronze}</span><span class="medal-count">${fmt(team.points)}</span></div>`;
  }).join('');
  renderBarChart(goldChart, rank.map((team) => ({ team: team.team, gold: counts[team.team]?.gold || 0 })), 'gold');
}

function renderProgress(rows, standings, race) {
  const total = Number(race?.totalEvents ?? rows.length);
  const complete = Number(race?.completedEvents ?? rows.filter(resultRecorded).length);
  const pct = total ? Math.round((complete / total) * 100) : 0;
  const statusCounts = {
    Complete: rows.filter(resultRecorded).length,
    'In Progress': rows.filter((r) => !resultRecorded(r) && r.properties?.Status === 'In Progress').length,
    Delayed: rows.filter((r) => !resultRecorded(r) && r.properties?.Status === 'Delayed').length,
    'Not Started': rows.filter((r) => !resultRecorded(r) && !['In Progress', 'Delayed'].includes(r.properties?.Status)).length,
  };

  eventsComplete.textContent = complete;
  eventsTotal.textContent = total;
  pointsAwarded.textContent = fmt(standings.reduce((sum, t) => sum + Number(t.points || 0), 0));
  pointsRemaining.textContent = fmt(race?.remainingGoldPoints || 0);
  progressLabel.textContent = `${pct}%`;
  progressFill.style.width = `${pct}%`;
  statusBreakdown.innerHTML = Object.entries(statusCounts).map(([name, count]) => `<div class="status-chip"><strong>${count}</strong><span>${esc(name)}</span></div>`).join('');
}

function renderMaximumPossible(race, standings) {
  const values = race?.maximumPossible?.length
    ? race.maximumPossible
    : standings.map((team) => ({ team: team.team, currentPoints: team.points, maximumPoints: team.points }));
  const sorted = [...values].sort((a, b) => Number(b.maximumPoints || 0) - Number(a.maximumPoints || 0));
  maxPointsGrid.innerHTML = sorted.map((item) => {
    const extra = Number(item.maximumPoints || 0) - Number(item.currentPoints || 0);
    return `<div class="max-card ${teamSlug(item.team)}"><div class="max-card__team">${esc(item.team)}</div><div class="max-card__score">${fmt(item.maximumPoints)}</div><div class="max-card__detail">${fmt(item.currentPoints)} now <span>+ ${fmt(extra)} available</span></div></div>`;
  }).join('');
}

function podiumText(p) {
  const bits = [];
  if (p['🥇 Team']) bits.push(`🥇 ${esc(p['🥇 Team'].replace('Team ', ''))}`);
  if (p['🥈 Team']) bits.push(`🥈 ${esc(p['🥈 Team'].replace('Team ', ''))}`);
  const bronze = Array.isArray(p['🥉 Team']) ? p['🥉 Team'] : p['🥉 Team'] ? [p['🥉 Team']] : [];
  if (bronze.length) bits.push(`🥉 ${bronze.map((x) => esc(x.replace('Team ', ''))).join(' + ')}`);
  return bits.join('<span>•</span>');
}

function renderEvents(rows) {
  const filtered = rows
    .filter((row) => {
      if (activeFilter === 'All') return true;
      if (activeFilter === 'Complete') return resultRecorded(row);
      return !resultRecorded(row) && (row.properties?.Status || 'Not Started') === activeFilter;
    })
    .sort((a, b) => Number(a.properties?.['Event #'] || 999) - Number(b.properties?.['Event #'] || 999));
  if (!filtered.length) {
    eventsGrid.innerHTML = '<div class="empty-state">No events in this category.</div>';
    return;
  }
  eventsGrid.innerHTML = filtered.map((row) => {
    const p = row.properties || {};
    const st = resultRecorded(row) ? 'Complete' : (p.Status || 'Not Started');
    return `<article class="event-card"><div class="event-card__top"><div><div class="event-num">Event ${esc(p['Event #'] ?? '—')}</div><div class="event-title">${esc(p.Event || 'Untitled event')}</div></div><span class="status-badge ${statusClass(st)}">${esc(st)}</span></div><div class="event-meta">${p['Division 2'] ? `<span class="tag">${esc(Array.isArray(p['Division 2']) ? p['Division 2'].join(' · ') : p['Division 2'])}</span>` : ''}${p.Format ? `<span class="tag">${esc(p.Format)}</span>` : ''}${p['Number of teams'] ? `<span class="tag">${esc(p['Number of teams'])} teams</span>` : ''}</div>${podiumText(p) ? `<div class="event-podium">${podiumText(p)}</div>` : ''}</article>`;
  }).join('');
}

function formatScheduleTime(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(value);
  return date.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function renderSchedule(rows) {
  const sorted = [...rows].sort((a, b) => {
    const ad = a.properties?.['Scheduled Time'] ? new Date(a.properties['Scheduled Time']).getTime() : Infinity;
    const bd = b.properties?.['Scheduled Time'] ? new Date(b.properties['Scheduled Time']).getTime() : Infinity;
    return ad - bd || Number(a.properties?.['Event #'] || 999) - Number(b.properties?.['Event #'] || 999);
  });
  scheduleList.innerHTML = sorted.length ? sorted.map((row) => {
    const p = row.properties || {};
    const st = resultRecorded(row) ? 'Complete' : (p.Status || 'Not Started');
    return `<div class="schedule-item"><div class="schedule-time">${formatScheduleTime(p['Scheduled Time'])}</div><div><div class="schedule-title">${esc(p.Event || 'Untitled event')}</div><div class="schedule-sub">Event ${esc(p['Event #'] ?? '—')} · ${esc(p.Format || 'TBD')} · ${esc(Array.isArray(p['Division 2']) ? p['Division 2'].join(', ') : p['Division 2'] || p.Division || '')}</div></div><span class="status-badge ${statusClass(st)}">${esc(st)}</span></div>`;
  }).join('') : '<div class="empty-state">No events scheduled yet.</div>';
}

function teamOptions(optional = false) {
  const first = optional ? '<option value="">None</option>' : '<option value="">Choose team…</option>';
  return first + TEAMS.map((team) => `<option value="${esc(team)}">${esc(team)}</option>`).join('');
}

function renderAdmin(rows) {
  const current = adminEvent.value;
  const sorted = [...rows].sort((a, b) => Number(a.properties?.['Event #'] || 999) - Number(b.properties?.['Event #'] || 999));
  adminEvent.innerHTML = '<option value="">Choose an event…</option>' + sorted.map((row) => {
    const p = row.properties || {};
    const done = resultRecorded(row) ? ' ✓' : '';
    return `<option value="${esc(row.id)}">#${esc(p['Event #'] ?? '—')} — ${esc(p.Event || 'Untitled event')}${done}</option>`;
  }).join('');
  if (sorted.some((row) => row.id === current)) adminEvent.value = current;
  adminGold.innerHTML = teamOptions(false);
  adminSilver.innerHTML = teamOptions(false);
  adminBronze1.innerHTML = teamOptions(true);
  adminBronze2.innerHTML = teamOptions(true);
  fillAdminFromSelectedEvent();
}

function fillAdminFromSelectedEvent() {
  const row = latestRows.find((item) => item.id === adminEvent.value);
  if (!row) {
    adminGold.value = '';
    adminSilver.value = '';
    adminBronze1.value = '';
    adminBronze2.value = '';
    adminPreview.textContent = 'Pick an event to enter or edit its result.';
    return;
  }
  const p = row.properties || {};
  const bronze = Array.isArray(p['🥉 Team']) ? p['🥉 Team'] : p['🥉 Team'] ? [p['🥉 Team']] : [];
  adminGold.value = p['🥇 Team'] || '';
  adminSilver.value = p['🥈 Team'] || '';
  adminBronze1.value = bronze[0] || '';
  adminBronze2.value = bronze[1] || '';
  const parts = [`Event ${p['Event #'] ?? '—'}: ${p.Event || 'Untitled event'}`];
  if (p['🥇 Gold Points'] != null) parts.push(`Gold = ${fmt(p['🥇 Gold Points'])} pts`);
  if (p['🥈 Silver Points'] != null) parts.push(`Silver = ${fmt(p['🥈 Silver Points'])} pts`);
  if (p['🥉 Bronze Points'] != null) parts.push(`Bronze = ${fmt(p['🥉 Bronze Points'])} pts`);
  adminPreview.textContent = parts.join(' · ');
}

function renderAll(data) {
  latestRows = data.rows || [];
  latestStandings = data.standings || [];
  latestRace = data.race || null;
  renderStandings(latestStandings);
  renderBarChart(pointsChart, latestStandings, 'points');
  renderMedals(latestRows, latestStandings);
  renderProgress(latestRows, latestStandings, latestRace);
  renderMaximumPossible(latestRace, latestStandings);
  renderEvents(latestRows);
  renderSchedule(latestRows);
  renderAdmin(latestRows);
}

async function loadScores() {
  refreshButton.disabled = true;
  status.classList.remove('error');
  statusText.textContent = 'Loading live data…';
  setupMessage.hidden = true;
  try {
    const response = await fetch('/api/scores', { cache: 'no-store' });
    const data = await response.json();
    if (!data.configured) {
      setupMessage.hidden = false;
      throw new Error(data.error || 'Notion connection not configured yet.');
    }
    if (!response.ok || data.error) {
      const detail = [data.notionCode, data.notionMessage].filter(Boolean).join(': ');
      throw new Error(detail || data.error || 'Unable to load scores');
    }
    renderAll(data);
    statusText.textContent = 'Live from Notion';
    updatedAt.textContent = data.updatedAt ? `Last synced ${new Date(data.updatedAt).toLocaleString()}` : '';
  } catch (error) {
    console.error(error);
    status.classList.add('error');
    statusText.textContent = 'Connection error';
    updatedAt.textContent = error?.message ? `API: ${error.message}` : '';
    if (!latestStandings.length) standingsCards.innerHTML = '<div class="empty-state">Scores are temporarily unavailable.</div>';
  } finally {
    refreshButton.disabled = false;
  }
}

async function submitScore(event) {
  event.preventDefault();
  adminMessage.className = 'admin-message';
  adminMessage.textContent = '';
  const bronzeTeams = [adminBronze1.value, adminBronze2.value].filter(Boolean);
  const placements = [adminGold.value, adminSilver.value, ...bronzeTeams].filter(Boolean);

  if (!adminEvent.value || !adminGold.value || !adminSilver.value) {
    adminMessage.classList.add('error-text');
    adminMessage.textContent = 'Choose the event, gold, and silver.';
    return;
  }
  if (new Set(placements).size !== placements.length) {
    adminMessage.classList.add('error-text');
    adminMessage.textContent = 'Each team can only appear once.';
    return;
  }

  saveScore.disabled = true;
  saveScore.textContent = 'Saving…';
  try {
    const response = await fetch('/api/admin/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: adminCode.value,
        eventId: adminEvent.value,
        goldTeam: adminGold.value,
        silverTeam: adminSilver.value,
        bronzeTeams,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const detail = [data.error, data.notionMessage].filter(Boolean).join(' ');
      throw new Error(detail || 'Could not save result.');
    }
    adminMessage.classList.add('success-text');
    adminMessage.textContent = '✓ Saved to Notion. Updating scoreboard…';
    await loadScores();
    adminMessage.textContent = '✓ Result saved and scoreboard updated.';
  } catch (error) {
    console.error(error);
    adminMessage.classList.add('error-text');
    adminMessage.textContent = error?.message || 'Could not save result.';
  } finally {
    saveScore.disabled = false;
    saveScore.textContent = 'Save Result to Notion';
  }
}

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b === button));
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const active = panel.dataset.panel === button.dataset.tab;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
}));

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((b) => b.classList.toggle('is-active', b === button));
  renderEvents(latestRows);
}));

adminEvent.addEventListener('change', fillAdminFromSelectedEvent);
scoreForm.addEventListener('submit', submitScore);
refreshButton.addEventListener('click', loadScores);
loadScores();