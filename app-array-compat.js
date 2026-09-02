// Compatibility bridge for Supabase multi-select team fields.
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

const compatTeams=value=>(Array.isArray(value)?value:value?[value]:[]).filter(Boolean);

window.addEventListener('DOMContentLoaded', () => {
  window.resultRecorded = function resultRecordedCompat(row) {
    const p = row?.properties || {};
    return compatTeams(p['🥇 Team']).length > 0 || p.Status === 'Complete';
  };

  window.medalCounts = function medalCountsCompat(rows) {
    const teams=['Team Red','Team Blue','Team Green','Team Gold'];
    const counts=Object.fromEntries(teams.map(team=>[team,{gold:0,silver:0,bronze:0}]));
    (rows||[]).forEach(row=>{
      const p=row?.properties||{};
      compatTeams(p['🥇 Team']).forEach(team=>{if(counts[team])counts[team].gold+=1});
      compatTeams(p['🥈 Team']).forEach(team=>{if(counts[team])counts[team].silver+=1});
      // Only Bronze 1 is a medal. Bronze 2 is a finishing position/points only.
      compatTeams(p['Bronze 1 Team']?.length?p['Bronze 1 Team']:p['🥉 Team']).forEach(team=>{if(counts[team])counts[team].bronze+=1});
    });
    return counts;
  };

  window.podiumText = function podiumTextCompat(p={}) {
    const escFn=typeof window.esc==='function'?window.esc:(v=>String(v??''));
    const short=t=>escFn(String(t).replace('Team ',''));
    const bits=[];
    const gold=compatTeams(p['🥇 Team']),silver=compatTeams(p['🥈 Team']);
    const bronze=compatTeams(p['Bronze 1 Team']?.length?p['Bronze 1 Team']:p['🥉 Team']);
    if(gold.length)bits.push(`🥇 ${gold.map(short).join(' + ')}`);
    if(silver.length)bits.push(`🥈 ${silver.map(short).join(' + ')}`);
    if(bronze.length)bits.push(`🥉 ${bronze.map(short).join(' + ')}`);
    return bits.join('<span>•</span>');
  };
});
