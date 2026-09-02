(()=>{
  const code=document.querySelector('#nfc-admin-code');
  const load=document.querySelector('#load-nfc-cards');
  const message=document.querySelector('#nfc-admin-message');
  const list=document.querySelector('#nfc-card-list');
  const tools=document.querySelector('#nfc-tools');
  const search=document.querySelector('#nfc-player-search');
  const clearSearch=document.querySelector('#nfc-clear-search');
  const filter=document.querySelector('#nfc-player-filter');
  const visibleCount=document.querySelector('#nfc-visible-count');
  const visibleLabel=document.querySelector('#nfc-visible-label');
  const support=document.querySelector('#nfc-write-support');
  if(!code||!load||!message||!list)return;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canWriteNfc=window.isSecureContext&&'NDEFReader' in window;
  let cards=[];
  let toastTimer=null;
  let writing=false;

  document.body.classList.add(canWriteNfc?'web-nfc-supported':'web-nfc-unsupported');
  if(support){
    support.hidden=false;
    support.className=`nfc-write-support ${canWriteNfc?'is-supported':'is-fallback'}`;
    support.textContent=canWriteNfc
      ?'Direct card writing is available on this device.'
      :'Direct browser writing is not available on this device. Use Copy Link with your NFC writing app.';
  }

  const savedCode=sessionStorage.getItem('schaferOlympicsNfcAdminCode')||sessionStorage.getItem('schaferOlympicsControlCode')||'';
  if(savedCode)code.value=savedCode;

  function initials(name){
    const bits=String(name||'').trim().split(/\s+/).filter(Boolean);
    return bits.slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'?';
  }

  function formatUsed(value){
    if(!value)return 'Never tapped';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return 'Previously tapped';
    const now=Date.now();
    const diff=Math.max(0,now-date.getTime());
    if(diff<60*1000)return 'Tapped just now';
    if(diff<60*60*1000)return `Tapped ${Math.max(1,Math.round(diff/60000))} min ago`;
    if(diff<24*60*60*1000)return `Tapped ${Math.max(1,Math.round(diff/3600000))} hr ago`;
    return `Last tapped ${date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
  }

  function showToast(text){
    let toast=document.querySelector('.nfc-toast');
    if(!toast){
      toast=document.createElement('div');
      toast.className='nfc-toast';
      toast.setAttribute('role','status');
      document.body.appendChild(toast);
    }
    toast.textContent=text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),1800);
  }

  function filteredCards(){
    const q=String(search?.value||'').trim().toLowerCase();
    const mode=filter?.value||'all';
    return cards.filter(card=>{
      if(q&&!`${card.name||''} ${card.team||''}`.toLowerCase().includes(q))return false;
      if(mode==='never'&&card.lastUsedAt)return false;
      if(mode==='used'&&!card.lastUsedAt)return false;
      if(mode==='active'&&!card.active)return false;
      if(mode==='inactive'&&card.active)return false;
      return true;
    });
  }

  function updateCount(count){
    if(visibleCount)visibleCount.textContent=String(count);
    if(visibleLabel)visibleLabel.textContent=count===1?'player':'players';
  }

  function cardMarkup(card){
    const used=Boolean(card.lastUsedAt);
    return `<article class="nfc-card" data-player="${esc(card.participantId)}">
      <div class="nfc-card__heading">
        <div class="nfc-player-identity">
          <span class="nfc-player-avatar" aria-hidden="true">${esc(initials(card.name))}</span>
          <div class="nfc-player-copy"><strong>${esc(card.name)}</strong><span>${esc(card.team||'Team not assigned')}</span></div>
        </div>
        <span class="nfc-card__status ${card.active?'is-active':'is-inactive'}">${card.active?'Active':'Inactive'}</span>
      </div>
      <div class="nfc-card__meta ${used?'is-used':''}">${used?'✓':'○'} ${esc(formatUsed(card.lastUsedAt))}</div>
      <div class="nfc-card__actions">
        <button type="button" class="nfc-write-button" data-action="write">Write Card</button>
        <button type="button" class="nfc-copy-button" data-action="copy">Copy Link</button>
        <a class="nfc-open-button" href="${esc(card.url||'#')}" target="_blank" rel="noopener">Open Player Page</a>
      </div>
      <details class="nfc-more">
        <summary>More options</summary>
        <div class="nfc-more__body">
          <label class="nfc-url"><span>Full player link</span><input type="text" readonly value="${esc(card.url||'')}"/></label>
          <button type="button" class="nfc-rotate-button" data-action="rotate">Rotate link / replace card</button>
        </div>
      </details>
    </article>`;
  }

  function render(){
    if(!cards.length){
      tools && (tools.hidden=true);
      updateCount(0);
      list.innerHTML='<div class="nfc-empty-state"><span>👥</span><strong>No player links found</strong><p>Try loading the player list again.</p></div>';
      return;
    }
    if(tools)tools.hidden=false;
    const shown=filteredCards();
    updateCount(shown.length);
    if(clearSearch)clearSearch.hidden=!String(search?.value||'').length;
    list.innerHTML=shown.length?shown.map(cardMarkup).join(''):'<div class="nfc-no-results"><strong>No matching players</strong><br/>Try a different name or filter.</div>';
  }

  async function api(action,participantId){
    const r=await fetch('/api/admin/nfc-cards',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:code.value,action,participantId}),
    });
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Unable to load player cards.');
    cards=(data.cards||[]).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    render();
    return data;
  }

  async function loadPlayers(){
    if(!code.value.trim()){
      message.textContent='Enter the admin code first.';
      code.focus();
      return;
    }
    load.disabled=true;
    load.textContent='Loading…';
    message.textContent='';
    try{
      const data=await api('list');
      sessionStorage.setItem('schaferOlympicsNfcAdminCode',code.value);
      message.textContent=`✓ ${data.count||cards.length} players loaded`;
      if(search)search.focus();
    }catch(e){
      message.textContent=e.message;
    }finally{
      load.disabled=false;
      load.textContent='Load Players';
    }
  }

  async function writeCard(card,button){
    if(!canWriteNfc){
      showToast('Direct NFC writing is not available on this device');
      return;
    }
    if(writing)return;
    writing=true;
    const original=button.textContent;
    button.disabled=true;
    button.classList.add('is-writing');
    button.textContent='Tap NFC Card…';
    message.textContent=`Hold ${card.name}'s NFC card against the phone…`;
    try{
      const ndef=new NDEFReader();
      await ndef.write({records:[{recordType:'url',data:String(card.url||'')}]});
      button.textContent='Written ✓';
      button.classList.remove('is-writing');
      message.textContent=`✓ ${card.name}'s player link was written to the NFC card.`;
      showToast(`${card.name}'s card written`);
      if(navigator.vibrate)navigator.vibrate([60,40,60]);
      setTimeout(()=>{button.textContent=original},1800);
    }catch(e){
      const name=String(e?.name||'');
      const text=name==='NotAllowedError'
        ?'NFC permission was not granted. Tap Write Card and allow NFC access.'
        :name==='NotSupportedError'
          ?'This NFC tag or device is not supported for browser writing.'
          :`Could not write the card${e?.message?`: ${e.message}`:'.'}`;
      message.textContent=text;
      button.textContent='Try Again';
      button.classList.remove('is-writing');
      showToast('Card was not written');
      setTimeout(()=>{button.textContent=original},2200);
    }finally{
      writing=false;
      button.disabled=false;
    }
  }

  load.addEventListener('click',loadPlayers);
  code.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadPlayers()}});
  search?.addEventListener('input',render);
  filter?.addEventListener('change',render);
  clearSearch?.addEventListener('click',()=>{search.value='';render();search.focus()});

  list.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-action]');
    if(!button)return;
    const cardEl=button.closest('[data-player]');
    const participantId=cardEl?.dataset.player;
    const card=cards.find(x=>String(x.participantId)===String(participantId));
    if(!card)return;

    if(button.dataset.action==='write'){
      await writeCard(card,button);
      return;
    }

    if(button.dataset.action==='copy'){
      const original=button.textContent;
      try{
        if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(card.url||'');
        else throw new Error('clipboard unavailable');
      }catch{
        const input=cardEl.querySelector('.nfc-url input');
        input?.select();
        document.execCommand('copy');
      }
      button.textContent='Copied ✓';
      button.classList.add('is-copied');
      showToast(`${card.name} link copied`);
      setTimeout(()=>{button.textContent=original;button.classList.remove('is-copied')},1500);
      return;
    }

    if(button.dataset.action==='rotate'){
      if(!window.confirm(`Replace ${card.name}'s player link? Their old NFC card will stop working immediately.`))return;
      button.disabled=true;
      button.textContent='Rotating…';
      try{
        await api('rotate',participantId);
        message.textContent=`✓ ${card.name}'s link was replaced. Write the new link to their card.`;
        showToast(`${card.name} link replaced`);
        requestAnimationFrame(()=>{
          const updated=[...list.querySelectorAll('[data-player]')].find(x=>x.dataset.player===String(participantId));
          updated?.scrollIntoView({block:'center',behavior:'smooth'});
        });
      }catch(e){
        message.textContent=e.message;
      }finally{
        button.disabled=false;
        button.textContent='Rotate link / replace card';
      }
    }
  });
})();
