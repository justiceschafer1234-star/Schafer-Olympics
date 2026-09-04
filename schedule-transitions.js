(()=>{
  const schedule=document.querySelector('#schedule-list');
  if(!schedule)return;

  const transitions=[
    {before:'Junior Basketball',time:'Sat 10:25 AM',title:'Transition',detail:'10:25–10:30 AM · 5 min'},
    {before:'Nuke ’Em',time:'Sat 11:22 AM',title:'Transition',detail:'11:22–11:27 AM · 5 min'},
    {before:'Kids Dodgeball',time:'Sat 2:45 PM',title:'Transition',detail:'2:45–2:50 PM · 5 min'},
    {before:'Egg Toss',time:'Sat 3:35 PM',title:'Transition',detail:'3:35–3:40 PM · 5 min'},
    {before:'Kids Slip-and-Slide Relay',time:'Sat 3:50 PM',title:'Transition / Slip-and-Slide Setup',detail:'3:50–4:10 PM · 20 min setup'},
    {before:'Wiffle Ball',time:'Sat 4:30 PM',title:'Transition',detail:'4:30–4:45 PM · 15 min'},
    {before:'Cornhole Tournament',time:'Sat 8:30 PM',title:'Transition',detail:'8:30–9:00 PM · 30 min'},
  ];

  function makeTransition(item){
    const row=document.createElement('div');
    row.className='schedule-item schedule-item--transition';
    row.dataset.scheduleTransition='1';
    row.innerHTML=`<div class="schedule-time">${item.time}</div><div><div class="schedule-title">↔ ${item.title}</div><div class="schedule-sub">${item.detail}</div></div><span class="status-badge">Buffer</span>`;
    return row;
  }

  function addTransitions(){
    schedule.querySelectorAll('[data-schedule-transition="1"]').forEach(node=>node.remove());
    const rows=[...schedule.querySelectorAll('.schedule-item')];
    if(!rows.length)return;

    transitions.forEach(item=>{
      const target=[...schedule.querySelectorAll('.schedule-item')].find(row=>row.querySelector('.schedule-title')?.textContent?.trim()===item.before);
      if(target)target.before(makeTransition(item));
    });
  }

  let queued=false;
  const queue=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;addTransitions();});
  };

  new MutationObserver(queue).observe(schedule,{childList:true});
  queue();
})();