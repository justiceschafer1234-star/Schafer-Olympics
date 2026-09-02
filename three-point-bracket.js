(()=>{
const key=new URLSearchParams(location.search).get('event')||'';
if(!['women-s-three-point-contest','men-s-three-point-contest'].includes(key))return;
const scorecard=document.querySelector('#scorecard');
if(!scorecard)return;
let working=false;
function build(){
  if(working)return;
  const entries=scorecard.querySelector('.entries');
  if(!entries||entries.dataset.shootoutBracket==='1')return;
  const rows=[...entries.querySelectorAll(':scope > .entry')];
  if(!rows.length)return;
  working=true;
  entries.dataset.shootoutBracket='1';
  const finalistTarget=key.startsWith('women')?4:6;
  const bracket=document.createElement('div');
  bracket.className='shootout-bracket';
  const round1=document.createElement('section');round1.className='shootout-round';
  const round2=document.createElement('section');round2.className='shootout-round';
  round1.innerHTML=`<div class="shootout-round__head"><h3>Round 1</h3><span>All shooters</span></div><div class="shootout-list"></div><p class="shootout-limit">Advance exactly ${finalistTarget} shooters to Round 2.</p>`;
  round2.innerHTML=`<div class="shootout-round__head"><h3>Round 2</h3><span>Final round</span></div><div class="shootout-list"></div>`;
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
    if(advanceLabel){advanceLabel.className='shootout-advance';advanceLabel.lastChild.textContent=' Advance to Round 2';}
    if(finalInput)finalInput.remove();
    list1.appendChild(row);
    if(advance?.checked&&finalInput){
      finalists++;
      const card=document.createElement('div');card.className='shootout-card is-finalist';card.style.cssText=row.style.cssText;
      if(teamBar)card.appendChild(teamBar.cloneNode(true));
      const n=document.createElement('div');n.className='shootout-card__name';n.innerHTML=`<strong>${name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong><small>Finalist</small>`;card.appendChild(n);
      finalInput.placeholder='Round 2';finalInput.disabled=false;card.appendChild(finalInput);list2.appendChild(card);
    }
  });
  if(!finalists){const p=document.createElement('div');p.className='shootout-card is-placeholder';p.textContent='Round 2 fills as you mark finalists in Round 1.';list2.appendChild(p)}
  else if(finalists<finalistTarget){const p=document.createElement('div');p.className='shootout-final-note';p.textContent=`${finalists}/${finalistTarget} finalists selected`;list2.appendChild(p)}
  entries.replaceWith(bracket);bracket.append(round1,arrow,round2);
  working=false;
}
new MutationObserver(()=>queueMicrotask(build)).observe(scorecard,{childList:true,subtree:true});
build();
})();
