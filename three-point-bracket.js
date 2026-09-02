(()=>{
const key=new URLSearchParams(location.search).get('event')||'';
if(!['women-s-three-point-contest','men-s-three-point-contest'].includes(key))return;
const scorecard=document.querySelector('#scorecard');
if(!scorecard)return;
const FINALISTS=4;
let working=false,advanceTimer=null,saveTimer=null,autoAdvancing=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
function saveNow(){
  clearTimeout(saveTimer);
  if(autoAdvancing){saveTimer=setTimeout(saveNow,100);return}
  const state=document.querySelector('#save-state');
  if(state)state.textContent='Autosaving…';
  const save=document.querySelector('#save');
  if(save&&!save.disabled)save.click();
}
function roundOneCards(){return [...scorecard.querySelectorAll('.shootout-round:first-child .shootout-card:not(.is-placeholder)')]}
function chooseFinalists(ranked){
  const leaderScore=ranked[0]?.score;
  const leaders=ranked.filter(x=>x.score===leaderScore);
  const secondScore=ranked.find(x=>x.score<leaderScore)?.score;
  const secondPlaceTies=secondScore==null?[]:ranked.filter(x=>x.score===secondScore);
  if(leaders.length===1&&secondPlaceTies.length===3){
    return{chosen:new Set([leaders[0],...secondPlaceTies].map(x=>x.index)),specialTie:true};
  }
  return{chosen:new Set(ranked.slice(0,FINALISTS).map(x=>x.index)),specialTie:false};
}
function automaticAdvance(){
  clearTimeout(advanceTimer);
  const cards=roundOneCards();
  if(!cards.length)return;
  const scored=cards.map((card,index)=>{
    const input=card.querySelector('input[type="number"]');
    const checkbox=card.querySelector('input[type="checkbox"]');
    const name=card.querySelector('strong')?.textContent||'';
    const raw=input?.value??'';
    return{card,index,input,checkbox,name,has:raw!==''&&Number.isFinite(Number(raw)),score:Number(raw)};
  });
  if(scored.some(x=>!x.has)){
    autoAdvancing=false;
    const note=scorecard.querySelector('.shootout-limit');
    if(note)note.textContent='Enter every Round 1 score. The top 4 advance automatically.';
    return;
  }
  const ranked=[...scored].sort((a,b)=>b.score-a.score||a.index-b.index);
  const selection=chooseFinalists(ranked);
  const chosen=selection.chosen;
  const mismatch=scored.find(x=>x.checkbox&&x.checkbox.checked!==chosen.has(x.index));
  if(mismatch){
    autoAdvancing=true;
    mismatch.checkbox.checked=chosen.has(mismatch.index);
    mismatch.checkbox.dispatchEvent(new Event('change',{bubbles:true}));
    advanceTimer=setTimeout(automaticAdvance,80);
    return;
  }
  autoAdvancing=false;
  const note=scorecard.querySelector('.shootout-limit');
  if(note){
    note.textContent=selection.specialTie
      ?'Top scorer plus all 3 shooters tied for second advanced automatically to Round 2.'
      :'Top 4 advanced automatically to Round 2.';
  }
  saveNow();
}
function queueAdvance(delay=250){clearTimeout(advanceTimer);advanceTimer=setTimeout(automaticAdvance,delay)}
function build(){
  if(working)return;
  const entries=scorecard.querySelector('.entries');
  if(!entries||entries.dataset.shootoutBracket==='1')return;
  const rows=[...entries.querySelectorAll(':scope > .entry')];
  if(!rows.length)return;
  working=true;
  entries.dataset.shootoutBracket='1';
  const bracket=document.createElement('div');
  bracket.className='shootout-bracket';
  const round1=document.createElement('section');round1.className='shootout-round';
  const round2=document.createElement('section');round2.className='shootout-round';
  round1.innerHTML=`<div class="shootout-round__head"><h3>Round 1</h3><span>All shooters</span></div><div class="shootout-list"></div><p class="shootout-limit">Enter every Round 1 score. The top 4 advance automatically.</p>`;
  round2.innerHTML=`<div class="shootout-round__head"><h3>Round 2</h3><span>Top 4 finalists</span></div><div class="shootout-list"></div>`;
  const arrow=document.createElement('div');arrow.className='shootout-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='→';
  const list1=round1.querySelector('.shootout-list'),list2=round2.querySelector('.shootout-list');
  let finalists=0;
  rows.forEach(row=>{
    const name=row.querySelector('strong')?.textContent||'Shooter';
    const teamBar=row.querySelector('.team-color-bar');
    const inputs=[...row.querySelectorAll('input[type="number"]')];
    const round1Input=inputs[0],finalInput=inputs[1];
    const advance=row.querySelector('input[type="checkbox"]');
    const advanceLabel=advance?.closest('label');
    row.className='shootout-card'+(advance?.checked?' is-finalist':'');
    const nameBox=row.querySelector('div');if(nameBox)nameBox.className='shootout-card__name';
    if(round1Input)round1Input.placeholder='Round 1';
    if(advanceLabel){advanceLabel.hidden=true;advanceLabel.setAttribute('aria-hidden','true')}
    if(finalInput)finalInput.remove();
    list1.appendChild(row);
    if(advance?.checked&&finalInput){
      finalists++;
      const card=document.createElement('div');card.className='shootout-card is-finalist';card.style.cssText=row.style.cssText;
      if(teamBar)card.appendChild(teamBar.cloneNode(true));
      const n=document.createElement('div');n.className='shootout-card__name';n.innerHTML=`<strong>${esc(name)}</strong><small>Finalist</small>`;card.appendChild(n);
      finalInput.placeholder='Round 2';finalInput.disabled=false;card.appendChild(finalInput);list2.appendChild(card);
    }
  });
  if(!finalists){const p=document.createElement('div');p.className='shootout-card is-placeholder';p.textContent='Round 2 fills automatically after all Round 1 scores are entered.';list2.appendChild(p)}
  else if(finalists<FINALISTS){const p=document.createElement('div');p.className='shootout-final-note';p.textContent=`${finalists}/${FINALISTS} finalists advanced`;list2.appendChild(p)}
  entries.replaceWith(bracket);bracket.append(round1,arrow,round2);
  working=false;
  queueAdvance(80);
}
scorecard.addEventListener('input',e=>{
  if(!e.target.matches('input[type="number"]'))return;
  if(e.target.placeholder==='Round 1')queueAdvance();
},true);
scorecard.addEventListener('change',e=>{
  if(!e.target.matches('input[type="number"]'))return;
  if(e.target.placeholder==='Round 1')queueAdvance(0);
  setTimeout(saveNow,0);
},true);
new MutationObserver(()=>queueMicrotask(build)).observe(scorecard,{childList:true,subtree:true});
build();
})();
