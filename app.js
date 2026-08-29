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

let latestRows = [];
let latestStandings = [];
let activeFilter = 'All';

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

function medalCounts(rows) {
  const counts = Object.fromEntries(['Team Red', 'Team Blue', 'Team Green', 'Team Gold'].map((team) => [team, { gold: 0, silver: 0, bronze: 0 }]));
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
    return;
  }
  const leader = Number(sorted[0].points || 0);
  standingsCards.innerHTML = sorted.map((team, i) => {
    const gap = i === 0 ? 'Current leader' : `${fmt(leader - Number(team.points || 0))} pts behind`;
    return `<div class="standing-card ${teamSlug(team.team)}">
      <div class="rank-badge">${medalEmoji[i] || i + 1}</div>
      <div><div class="team-name">${esc(team.team)}</div><div class="team-gap">${gap}</div></div>
      <div class="team-points">${fmt(team.points)}<small>pts</small></div>
    </div>`;
  }).join('');

  leaderBanner.className = `leader-banner ${teamSlug(sorted[0].team)}`;
  leaderBanner.innerHTML = `<div><div class="leader-banner__label">🔥 Currently leading</div><div class="leader-banner__team">${esc(sorted[0].team)}</div></div><div class="leader-banner__points"><strong>${fmt(sorted[0].points)}</strong><span>points</span></div>`;
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

function renderProgress(rows, standings) {
  const total = rows.length;
  const complete = rows.filter((r) => r.properties?.Status === 'Complete').length;
  const pct = total ? Math.round((complete / total) * 100) : 0;
  const statuses = ['Complete', 'In Progress', 'Delayed', 'Not Started'];
  eventsComplete.textContent = complete;
  eventsTotal.textContent = total;
  pointsAwarded.textContent = fmt(standings.reduce((sum, t) => sum + Number(t.points || 0), 0));
  progressLabel.textContent = `${pct}%`;
  progressFill.style.width = `${pct}%`;
  statusBreakdown.innerHTML = statuses.map((name) => {
    const count = rows.filter((r) => (r.properties?.Status || 'Not Started') === name).length;
    return `<div class="status-chip"><strong>${count}</strong><span>${esc(name)}</span></div>`;
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
    .filter((row) => activeFilter === 'All' || (row.properties?.Status || 'Not Started') === activeFilter)
    .sort((a, b) => Number(a.properties?.['Event #'] || 999) - Number(b.properties?.['Event #'] || 999));
  if (!filtered.length) {
    eventsGrid.innerHTML = '<div class="empty-state">No events in this category.</div>';
    return;
  }
  eventsGrid.innerHTML = filtered.map((row) => {
    const p = row.properties || {};
    const st = p.Status || 'Not Started';
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
    const st = p.Status || 'Not Started';
    return `<div class="schedule-item"><div class="schedule-time">${formatScheduleTime(p['Scheduled Time'])}</div><div><div class="schedule-title">${esc(p.Event || 'Untitled event')}</div><div class="schedule-sub">Event ${esc(p['Event #'] ?? '—')} · ${esc(p.Format || 'TBD')} · ${esc(Array.isArray(p['Division 2']) ? p['Division 2'].join(', ') : p['Division 2'] || p.Division || '')}</div></div><span class="status-badge ${statusClass(st)}">${esc(st)}</span></div>`;
  }).join('') : '<div class="empty-state">No events scheduled yet.</div>';
}

function renderAll(data) {
  latestRows = data.rows || [];
  latestStandings = data.standings || [];
  renderStandings(latestStandings);
  renderBarChart(pointsChart, latestStandings, 'points');
  renderMedals(latestRows, latestStandings);
  renderProgress(latestRows, latestStandings);
  renderEvents(latestRows);
  renderSchedule(latestRows);
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

refreshButton.addEventListener('click', loadScores);
loadScores();
