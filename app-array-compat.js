// Compatibility bridge for Notion multi-select team fields.
// app.js historically treated Gold/Silver as strings; they are arrays now.
if (!Array.prototype.replace) {
  Object.defineProperty(Array.prototype, 'replace', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(searchValue, replaceValue) {
      return String(this[0] || '').replace(searchValue, replaceValue);
    },
  });
}

// An empty multi-select is [] and Boolean([]) is true. The legacy app used
// Boolean(p['🥇 Team']) to decide whether an event was completed, which makes
// every empty Gold field look completed. Replace that check once app.js has
// established its global function binding.
window.addEventListener('DOMContentLoaded', () => {
  window.resultRecorded = function resultRecordedCompat(row) {
    const p = row?.properties || {};
    const gold = Array.isArray(p['🥇 Team']) ? p['🥇 Team'] : p['🥇 Team'] ? [p['🥇 Team']] : [];
    return gold.length > 0 || p.Status === 'Complete';
  };
});
