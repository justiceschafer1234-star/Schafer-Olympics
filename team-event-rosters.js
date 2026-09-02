(()=>{
const MAP={
'/adult-soccer.html':'adult-soccer',
'/cornhole-tournament.html':'cornhole',
'/wiffle-ball-tournament.html':'wiffle-ball',
'/kids-slip-and-slide.html':'kids-slip-and-slide',
'/adult-slip-and-slide.html':'adult-slip-and-slide',
'/egg-toss.html':'egg-toss',
'/kids-soccer.html':'kids-soccer',
'/junior-basketball.html':'junior-basketball'
};
const path=location.pathname.replace(/\/+$/,'')||'/';
const eventKey=MAP[path];if(!eventKey)return;
const COLORS={'Team Red':'#d83b3b','Team Blue':'#3478d4','Team Green':'#2f9b58','Team Gold':'#d4a72c'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function installStyle(){if(document.querySelector('#team-event-roster-style'))return;const s=document.createElement('style');s.id='team-event-roster-style';s.textContent='.event-team-rosters{max-width:1100px;margin:16px auto;padding:0 16px}.event-team-rosters__panel{background:#fff;border:1px solid #dce7f5;border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(31,55,88,.06)}.event-team-rosters__head{margin-bottom:12px}.event-team-rosters__head p{margin:0 0 4px;font-size:.76rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#5a6d8f}.event-team-rosters__head h2{margin:0}.event-team-rosters__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.event-team-roster{position:relative;overflow:hidden;border:1px solid #dce7f5;border-radius:13px;padding:18px 12px 12px}.event-team-roster:before{content:"";position:absolute;left:0;right:0;top:0;height:8px;background:var(--team-color,#c7d2df)}.event-team-roster h3{margin:0 0 8px}.event-team-roster span{display:block;padding:3px 0;color:#38475d}.event-team-roster .empty{color:#7a8797;font-size:.9rem}.event-team-rosters__error{color:#7a3340}';document.head.appendChild(s)}
function mount(){let host=document.querySelector('#event-team-rosters-shared');if(host)return host;host=document.createElement('section');host.id='event-team-rosters-shared';host.className='event-team-rosters';const main=document.querySelector('main');if(main)main.insertAdjacentElement('afterbegin',host);else document.body.appendChild(host);return host}
async function load(){installStyle();const host=mount();host.innerHTML='<div class="event-team-rosters__panel">Loading teams…</div>';try{const r=await fetch(`/api/team-event-rosters?eventKey=${encodeURIComponent(eventKey)}`,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load teams.');host.innerHTML=`<div class="event-team-rosters__panel"><div class="event-team-rosters__head"><p>Playing this event</p><h2>Teams & Players</h2></div><div class="event-team-rosters__grid">${(d.rosters||[]).map(x=>`<article class="event-team-roster" style="--team-color:${COLORS[x.team]||'#c7d2df'}"><h3>${esc(String(x.team||'').replace('Team ',''))}</h3>${x.players?.length?x.players.map(n=>`<span>${esc(n)}</span>`).join(''):'<div class="empty">No registered players</div>'}</article>`).join('')}</div></div>`}catch(e){host.innerHTML=`<div class="event-team-rosters__panel event-team-rosters__error">${esc(e.message)}</div>`}}
load();
})();