(()=>{
  const code=document.querySelector('#nfc-admin-code');
  const load=document.querySelector('#load-nfc-cards');
  const message=document.querySelector('#nfc-admin-message');
  const list=document.querySelector('#nfc-card-list');
  if(!code||!load||!message||!list)return;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cards=[];

  function formatUsed(value){
    if(!value)return 'Never tapped';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'Previously tapped':`Last tapped ${date.toLocaleString()}`;
  }

  function render(){
    if(!cards.length){
      list.innerHTML='<p class="panel-note">No player NFC links were found.</p>';
      return;
    }
    list.innerHTML=cards.map(card=>`<article class="panel nfc-card" data-player="${esc(card.participantId)}">
      <div class="nfc-card__heading">
        <div><strong>${esc(card.name)}</strong><span>${esc(card.team||'Team not assigned')}</span></div>
        <span class="nfc-card__status ${card.active?'is-active':'is-inactive'}">${card.active?'Active':'Inactive'}</span>
      </div>
      <label class="nfc-url"><span>NFC URL</span><input type="text" readonly value="${esc(card.url||'')}"/></label>
      <div class="nfc-card__meta">${esc(formatUsed(card.lastUsedAt))}</div>
      <div class="nfc-card__actions">
        <button type="button" class="save-score" data-action="copy">Copy URL</button>
        <button type="button" class="nfc-secondary" data-action="rotate">Rotate Card Link</button>
      </div>
    </article>`).join('');
  }

  async function api(action,participantId){
    const r=await fetch('/api/admin/nfc-cards',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:code.value,action,participantId}),
    });
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Unable to load NFC cards.');
    cards=data.cards||[];
    render();
    return data;
  }

  load.addEventListener('click',async()=>{
    load.disabled=true;
    message.textContent='Loading…';
    try{
      const data=await api('list');
      message.textContent=`✓ ${data.count||cards.length} player links loaded`;
    }catch(e){
      message.textContent=e.message;
    }finally{
      load.disabled=false;
    }
  });

  list.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-action]');
    if(!button)return;
    const cardEl=button.closest('[data-player]');
    const participantId=cardEl?.dataset.player;
    const card=cards.find(x=>x.participantId===participantId);
    if(!card)return;

    if(button.dataset.action==='copy'){
      try{
        await navigator.clipboard.writeText(card.url||'');
        message.textContent=`✓ Copied ${card.name}'s NFC URL`;
      }catch{
        const input=cardEl.querySelector('.nfc-url input');
        input?.select();
        document.execCommand('copy');
        message.textContent=`✓ Copied ${card.name}'s NFC URL`;
      }
      return;
    }

    if(button.dataset.action==='rotate'){
      if(!window.confirm(`Rotate ${card.name}'s NFC link? The old NFC card link will stop working immediately.`))return;
      button.disabled=true;
      message.textContent=`Rotating ${card.name}'s link…`;
      try{
        await api('rotate',participantId);
        message.textContent=`✓ ${card.name}'s NFC link was rotated. Re-write the card with the new URL.`;
      }catch(e){
        message.textContent=e.message;
      }finally{
        button.disabled=false;
      }
    }
  });
})();
