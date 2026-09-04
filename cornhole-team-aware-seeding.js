(()=>{
  const teamsFromOption=option=>{
    const text=String(option?.textContent||'');
    const m=text.match(/\(([^)]+)\)\s*$/);
    if(!m)return [];
    return m[1].split('+').map(x=>x.trim()).filter(x=>/^(Red|Blue|Green|Gold)$/i.test(x)).map(x=>`Team ${x[0].toUpperCase()}${x.slice(1).toLowerCase()}`);
  };

  const shuffle=list=>{
    const out=[...list];
    for(let i=out.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  };

  function scoreDraw(order){
    const bySeed=new Map(order.map((pair,index)=>[index+1,pair]));
    const overlaps=(a,b)=>{
      const x=bySeed.get(a),y=bySeed.get(b);
      return Boolean(x?.teams?.some(team=>y?.teams?.includes(team)));
    };

    let score=0;
    let openingConflicts=0;
    const openingPairs=order.length===14
      ? [[8,9],[4,13],[5,12],[7,10],[3,14],[6,11]]
      : order.length===12
        ? [[5,12],[6,11],[7,10],[8,9]]
        : order.length===10
          ? [[8,9],[7,10],[4,5],[3,6]]
          : [];

    for(const [a,b] of openingPairs){
      if(overlaps(a,b)){
        score+=10000;
        openingConflicts++;
      }
    }

    if(order.length===14){
      for(const b of [8,9])if(overlaps(1,b))score+=100;
      for(const b of [7,10])if(overlaps(2,b))score+=100;
    }else if(order.length===12){
      for(const b of [8,9])if(overlaps(1,b))score+=100;
      for(const b of [7,10])if(overlaps(2,b))score+=100;
      for(const b of [6,11])if(overlaps(3,b))score+=100;
      for(const b of [5,12])if(overlaps(4,b))score+=100;
    }else if(order.length===10){
      for(const b of [8,9])if(overlaps(1,b))score+=100;
      for(const b of [7,10])if(overlaps(2,b))score+=100;
    }

    for(let seed=1;seed<order.length;seed++)if(overlaps(seed,seed+1))score+=2;
    return {score,openingConflicts};
  }

  function makeTeamAwareDraw(selects){
    const source=selects[0];
    const pairs=[...source.options].filter(option=>option.value).map(option=>({id:option.value,teams:teamsFromOption(option)}));
    if(!pairs.length||pairs.length!==selects.length)return null;
    let best=null,bestResult={score:Infinity,openingConflicts:Infinity};
    const attempts=Math.max(6000,pairs.length*800);
    for(let i=0;i<attempts;i++){
      const candidate=shuffle(pairs),result=scoreDraw(candidate);
      if(result.score<bestResult.score||(result.score===bestResult.score&&Math.random()<0.2)){
        best=candidate;bestResult=result;if(result.score===0)break;
      }
    }
    return best?{order:best,...bestResult}:null;
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#cornhole-seed-random');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    const selects=[...document.querySelectorAll('.seed-row select[data-seed]')].sort((a,b)=>Number(a.dataset.seed)-Number(b.dataset.seed));
    const result=makeTeamAwareDraw(selects),message=document.querySelector('#cornhole-seed-message');
    if(!result){if(message)message.textContent='Could not build a team-aware random draw.';return}
    selects.forEach((select,index)=>{select.value=result.order[index]?.id||'';select.dispatchEvent(new Event('change',{bubbles:true}))});
    if(message)message.textContent=result.openingConflicts===0?`🎲 ${selects.length}-pair team-aware draw ready — no overlapping Olympic teams in opening matchups.`:`🎲 Best draw found — ${result.openingConflicts} opening matchup${result.openingConflicts===1?'':'s'} still share an Olympic team.`;
  },true);
})();