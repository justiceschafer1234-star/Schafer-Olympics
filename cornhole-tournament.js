(()=>{
  const teams=[
    {seed:1,players:['Natasha','Justice']},
    {seed:2,players:['Sarinede','Chase']},
    {seed:3,players:['Annie','Dwight']},
    {seed:4,players:['Riley','Ian']},
    {seed:5,players:['Kaden','Ava']},
    {seed:6,players:['Jericho','David']},
    {seed:7,players:['Judah','Slade']},
    {seed:8,players:['Darren','TBD partner'],open:true}
  ];
  const teamName=t=>`Team ${t.seed}`;
  const teamLabel=t=>`${teamName(t)} — ${t.players.join(' + ')}`;
  const teamGrid=document.querySelector('#team-grid');
  teamGrid.innerHTML=teams.map(t=>`<article class="team-card${t.open?' open':''}"><span class="seed">Seed ${t.seed}</span><strong>${teamName(t)}</strong>${t.players.map(p=>`<span class="player">${p}</span>`).join('')}</article>`).join('');

  const match=(a,b)=>`<div class="match"><div class="slot ${a.placeholder?'placeholder':''}"><span>${a.text}</span>${a.seed?`<small>#${a.seed}</small>`:''}</div><div class="slot ${b.placeholder?'placeholder':''}"><span>${b.text}</span>${b.seed?`<small>#${b.seed}</small>`:''}</div></div>`;
  const slotTeam=i=>({text:teamLabel(teams[i]),seed:teams[i].seed});
  const ph=text=>({text,placeholder:true});

  document.querySelector('#winners-bracket').innerHTML=`
    <section class="round"><div class="round-title">Round 1</div>
      ${match(slotTeam(0),slotTeam(7))}
      ${match(slotTeam(3),slotTeam(4))}
      ${match(slotTeam(1),slotTeam(6))}
      ${match(slotTeam(2),slotTeam(5))}
    </section>
    <section class="round"><div class="round-title">Semifinals</div>
      ${match(ph('Winner W1'),ph('Winner W2'))}
      ${match(ph('Winner W3'),ph('Winner W4'))}
    </section>
    <section class="round"><div class="round-title">Winners Final</div>
      ${match(ph('Winner W5'),ph('Winner W6'))}
    </section>`;

  document.querySelector('#losers-bracket').innerHTML=`
    <section class="round"><div class="round-title">Losers Round 1</div>
      ${match(ph('Loser W1'),ph('Loser W2'))}
      ${match(ph('Loser W3'),ph('Loser W4'))}
    </section>
    <section class="round"><div class="round-title">Losers Round 2</div>
      ${match(ph('Winner L1'),ph('Loser W5'))}
      ${match(ph('Winner L2'),ph('Loser W6'))}
    </section>
    <section class="round"><div class="round-title">Losers Round 3</div>
      ${match(ph('Winner L3'),ph('Winner L4'))}
      ${match(ph('Advancing team'),ph('Loser Winners Final'))}
    </section>
    <section class="round"><div class="round-title">Losers Final</div>
      ${match(ph('Losers survivor'),ph('Winners Final loser'))}
    </section>`;
})();