(()=>{
  const participant=document.querySelector('#registration-participant');
  const eventsBox=document.querySelector('#registration-events');
  const identity=document.querySelector('#registration-identity');
  const save=document.querySelector('#save-registration');
  const message=document.querySelector('#registration-message');
  if(!participant)return;

  const hashParams=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  const nfcToken=String(hashParams.get('nfc')||'').trim();
  const participantField=participant.closest('.field');
  const intro=document.querySelector('.registration-intro');
  let data=null;
  let current=null;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={Man:'Men',Woman:'Women',Kid:'Kids'};

  function eligible(p,e){
    const pd=p.divisions||[];
    const ed=e.divisions||[];
    return pd.some(d=>ed.includes(labels[d]));
  }

  function render(){
    current=data.participants.find(p=>p.id===participant.value)||null;
    if(!current){
      identity.hidden=true;
      eventsBox.innerHTML='<p class="panel-note">Choose your name to load eligible events.</p>';
      save.disabled=true;
      return;
    }

    const eligibleEvents=data.events.filter(e=>eligible(current,e));
    identity.hidden=false;
    identity.innerHTML=`<strong>${esc(current.name)}</strong>${current.team?`<span>${esc(current.team)}</span>`:''}`;
    eventsBox.innerHTML=eligibleEvents.length
      ?eligibleEvents.map(e=>`<label class="registration-event"><input type="checkbox" value="${esc(e.id)}" ${current.registeredEventIds.includes(e.id)?'checked':''}><span><strong>#${e.number??'–'} ${esc(e.name)}</strong><small>${esc(e.format||'Event')}</small></span></label>`).join('')
      :'<p class="panel-note">No eligible events were found.</p>';
    save.disabled=!eligibleEvents.length;
    message.textContent='';
  }

  async function load(){
    try{
      const options=nfcToken?{headers:{'X-Player-NFC':nfcToken}}:{};
      const r=await fetch('/api/registration',options);
      data=await r.json();
      if(!r.ok)throw new Error(data.error||'Unable to load registration.');

      participant.innerHTML='<option value="">Choose your name…</option>'+data.participants.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');

      if(nfcToken&&data.playerMode&&data.participants.length===1){
        participant.value=data.participants[0].id;
        if(participantField)participantField.hidden=true;
        if(intro)intro.textContent='NFC player pass recognized. This page is locked to your player profile.';
        render();
      }
    }catch(e){
      identity.hidden=true;
      if(participantField&&nfcToken)participantField.hidden=true;
      eventsBox.innerHTML=`<p class="setup-message">${esc(e.message)}</p>`;
      save.disabled=true;
    }
  }

  participant.addEventListener('change',render);
  save.addEventListener('click',async()=>{
    if(!current)return;
    save.disabled=true;
    message.textContent='Saving…';
    const eventIds=[...eventsBox.querySelectorAll('input:checked')].map(x=>x.value);
    try{
      const body={participantId:current.id,eventIds};
      if(nfcToken)body.nfcToken=nfcToken;
      const r=await fetch('/api/registration',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Unable to save registration.');
      current.registeredEventIds=eventIds;
      message.textContent='✓ Registration saved';
    }catch(e){
      message.textContent=e.message;
    }finally{
      save.disabled=false;
    }
  });

  load();
})();
