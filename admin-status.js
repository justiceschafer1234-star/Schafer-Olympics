const adminStatusControl = document.querySelector('#admin-status');

// Completion is now explicit: medal selections may remain while an event is reopened.
resultRecorded = function (row) {
  return row?.properties?.Status === 'Complete';
};

function syncAdminStatus() {
  const row = latestRows.find((item) => item.id === adminEvent.value);
  adminStatusControl.value = row?.properties?.Status || 'Not Started';
}

const originalRenderAdmin = renderAdmin;
renderAdmin = function (rows) {
  originalRenderAdmin(rows);
  syncAdminStatus();
};

adminEvent.addEventListener('change', syncAdminStatus);

scoreForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  event.stopImmediatePropagation();

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
        status: adminStatusControl.value,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      const detail = [data.error, data.notionMessage].filter(Boolean).join(' ');
      throw new Error(detail || 'Could not save result.');
    }

    adminMessage.classList.add('success-text');
    adminMessage.textContent = data.status === 'Complete'
      ? '✓ Result saved and event marked complete. Updating…'
      : `✓ Event reopened as ${data.status}. Updating…`;

    await loadScores();
    syncAdminStatus();

    adminMessage.textContent = data.status === 'Complete'
      ? '✓ Result saved and scoreboard updated.'
      : `✓ Event is now ${data.status} and no longer counts as complete.`;
  } catch (error) {
    console.error(error);
    adminMessage.classList.add('error-text');
    adminMessage.textContent = error?.message || 'Could not save result.';
  } finally {
    saveScore.disabled = false;
    saveScore.textContent = 'Save Result & Status';
  }
}, true);
