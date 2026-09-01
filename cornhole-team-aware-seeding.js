(()=>{
  const teamFromOption=option=>{
    const text=String(option?.textContent||'');
    const m=text.match(/\((Red|Blue|Green|Gold)\)\s*$/i);
    return m?`Team ${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}`:'';
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
    const sameTeam=(a,b)=>{
      const x=bySeed.get(a),y=bySeed.get(b);
      return Boolean(x?.team&&y?.team&&x.team===y.team);
    };

    let score=0;
    let openingConflicts=0;

    // These are the four immediately scheduled matchups in the current
    // 10-team Cornhole bracket. Same Olympic-team matchups are heavily
    // penalized so the randomizer avoids them whenever a valid draw exists.
    const openingPairs=order.length===10
      ? [[8,9],[7,10],[4,5],[3,6]]
      : [];

    for(const [a,b] of openingPairs){
      if(sameTeam(a,b)){
        score+=10000;
        openingConflicts++;
      }
    }

    // Seeds 1 and 2 enter against winners from these early paths. This is a
    // softer penalty because the opponent is not known yet, but it helps keep
    // Olympic teammates separated deeper into the bracket when possible.
    if(order.length===10){
      for(const b of [8,9])if(sameTeam(1,b))score+=100;
      for(const b of [7,10])if(sameTeam(2,b))score+=100;
    }

    // Small tie-breaker to spread teams throughout the seed list rather than
    // clustering all pairs from one Olympic team together.
    for(let seed=1;seed<order.length;seed++){
      if(sameTeam(seed,seed+1))score+=2;
    }

    return {score,openingConflicts};
  }

  function makeTeamAwareDraw(selects){
    const source=selects[0];
    const pairs=[...source.options]
      .filter(option=>option.value)
      .map(option=>({id:option.value,team:teamFromOption(option)}));

    if(!pairs.length||pairs.length!==selects.length)return null;

    let best=null;
    let bestResult={score:Infinity,openingConflicts:Infinity};
    const attempts=Math.max(3000,pairs.length*500);

    for(let i=0;i<attempts;i++){
      const candidate=shuffle(pairs);
      const result=scoreDraw(candidate);
      if(
        result.score<bestResult.score ||
        (result.score===bestResult.score&&Math.random()<0.2)
      ){
        best=candidate;
        bestResult=result;
        if(result.score===0)break;
      }
    }

    return best?{order:best,...bestResult}:null;
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#cornhole-seed-random');
    if(!button)return;

    // Override the basic shuffle installed by team-editor.js.
    event.preventDefault();
    event.stopImmediatePropagation();

    const selects=[...document.querySelectorAll('.seed-row select[data-seed]')]
      .sort((a,b)=>Number(a.dataset.seed)-Number(b.dataset.seed));
    const result=makeTeamAwareDraw(selects);
    const message=document.querySelector('#cornhole-seed-message');

    if(!result){
      if(message)message.textContent='Could not build a team-aware random draw.';
      return;
    }

    selects.forEach((select,index)=>{
      select.value=result.order[index]?.id||'';
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });

    if(message){
      message.textContent=result.openingConflicts===0
        ? '🎲 Team-aware draw ready — no same-team opening matchups.'
        : `🎲 Best draw found — ${result.openingConflicts} same-team opening matchup${result.openingConflicts===1?'':'s'} could not be avoided.`;
    }
  },true);
})();