(() => {
  const gate = document.getElementById('login-gate');
  const dashboard = document.getElementById('dashboard-content');
  const form = document.getElementById('login-form');
  const input = document.getElementById('dashboard-password');
  const error = document.getElementById('login-error');

  function unlock() {
    sessionStorage.setItem('schaferOrganizerUnlocked', 'yes');
    gate.hidden = true;
    dashboard.hidden = false;
    window.dispatchEvent(new Event('dashboard-unlocked'));
  }

  if (sessionStorage.getItem('schaferOrganizerUnlocked') === 'yes') unlock();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const expected = ['Schafer', '2026'].join('');
    if (input.value === expected) {
      error.textContent = '';
      unlock();
    } else {
      error.textContent = 'Incorrect password. Please try again.';
      input.select();
    }
  });
})();