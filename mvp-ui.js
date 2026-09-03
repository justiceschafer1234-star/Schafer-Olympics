(()=>{
  if(!document.querySelector('link[data-mvp-ui-style]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='/mvp-ui.css?v=1';link.dataset.mvpUiStyle='1';document.head.appendChild(link);
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  let playerData=null,observer=null;

  function addControlLink(){
    if(document.querySelector('.mvp-control-link'))return;
    const switcher=document.querySelector('.view-switch');if(!switcher)return;
    const a=document.createElement('a');a.href='/individual-stats.html';a.className='view-switch__link mvp-control-link';a.textContent='📊 MVP Stats';switcher.appendChild(a);
  }
  window.addEventListener('schafer-control-unlocked',addControlLink);
  if(document.body.classList.contains('control-mode'))addControlLink();

  function detailMarkup(mvp){
    const details=(mvp?.details||[]).filter(d=>d&&d.label);
    if(!details.length)return'';
    return `<div class="player-mvp-details">${details.map(d=>`<span><small>${esc(d.label)}</small><strong>${esc(d.key==='finish'||d.key==='team_finish'?String(d.value):fmt(d.value))}</strong></span>`).join('')}</div>`;
  }
  function block(mvp){
    if(!mvp)return'';
    return `<div class="player-event-mvp"><div class="player-event-mvp__top"><span>MY MVP</span><strong>+${esc(fmt(mvp.points))} pts</strong></div>${detailMarkup(mvp)}<div class="player-event-mvp__foot"><span>Raw performance ${esc(fmt(mvp.rawScore))}</span><span>Event max ${esc(fmt(mvp.maxPoints))}</span></div></div>`;
  }
  function inject(){
    if(!playerData?.ok)return false;
    const cards=[...document.querySelectorAll('.player-schedule-list .player-event-card')],events=playerData.events||[];
    if(!cards.length||cards.length!==events.length)return false;
    cards.forEach((card,i)=>{
      card.querySelector('.player-event-mvp')?.remove();
      const markup=block(events[i]?.mvp);if(markup)card.insertAdjacentHTML('beforeend',markup);
    });
    const grid=document.querySelector('.player-summary-grid');
    if(grid&&!grid.querySelector('[data-private-mvp-total]'))grid.insertAdjacentHTML('beforeend',`<article class="player-summary-card player-summary-card--mvp" data-private-mvp-total><strong>${esc(fmt(playerData.summary?.mvpPoints||0))}</strong><span>My MVP points</span></article>`);
    return true;
  }
  function scheduleInject(data){
    playerData=data;if(inject()){observer?.disconnect();observer=null;return}
    if(observer)return;observer=new MutationObserver(()=>{if(inject()){observer.disconnect();observer=null}});observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await originalFetch(input,init);
    try{
      const raw=typeof input==='string'?input:input?.url||'',url=new URL(raw,location.href);
      if(url.pathname==='/api/player-hq'&&response.ok){response.clone().json().then(data=>{if(data?.ok)scheduleInject(data)}).catch(()=>{})}
    }catch{}
    return response;
  };
})();
