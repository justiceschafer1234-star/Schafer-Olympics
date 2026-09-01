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
