(() => {
  const stopGesture = (event) => event.preventDefault();

  document.addEventListener('gesturestart', stopGesture, { passive: false });
  document.addEventListener('gesturechange', stopGesture, { passive: false });
  document.addEventListener('gestureend', stopGesture, { passive: false });

  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  const path=location.pathname.replace(/\/+$/,'')||'/';

  // The original scorekeeping system uses "Team Gold" as its internal fourth-team
  // identifier. Keep that stable for scoring compatibility, but display the real
  // team name — Yellow — everywhere a person sees it.
  const yellowTeamContexts='button,option,.team-editor-card,.team-editor-note,.team-launch,.team-banner,.player-team-pill,.team-pill,.roster-card,.team-picks,.side,.pair-team,.event-pair__team,.seed-team,.seed-row,.team-name,[class*="team-"]';
  const aliasTeamText=(root)=>{
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){
      const parent=root.parentElement;
      if(!parent||parent.closest('script,style'))return;
      let next=String(root.nodeValue||'').replace(/\bTeam Gold\b/g,'Team Yellow');
      if(parent.closest(yellowTeamContexts))next=next.replace(/\bGold\b/g,'Yellow');
      if(next!==root.nodeValue)root.nodeValue=next;
      return;
    }
    if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(aliasTeamText);
    if(root.querySelectorAll){
      root.querySelectorAll('a[href*="individual-stats.html?team=gold"]').forEach(a=>{
        const u=new URL(a.href,location.origin);u.searchParams.set('team','yellow');a.href=u.pathname+u.search+u.hash;
      });
    }
  };

  // Let the new MVP editor use a clean ?team=yellow URL while translating it to
  // the legacy internal identifier before its own deferred script reads the query.
  if((path==='/individual-stats'||path==='/individual-stats.html')){
    const q=new URLSearchParams(location.search);
    if(String(q.get('team')||'').toLowerCase()==='yellow'){
      const internal=new URL(location.href);
      internal.searchParams.set('team','gold');
      history.replaceState(history.state,document.title,internal.pathname+internal.search+internal.hash);
      window.addEventListener('DOMContentLoaded',()=>{
        const visible=new URL(location.href);
        visible.searchParams.set('team','yellow');
        history.replaceState(history.state,document.title,visible.pathname+visible.search+visible.hash);
      },{once:true});
    }
  }

  window.addEventListener('DOMContentLoaded',()=>{
    aliasTeamText(document.body);
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations)for(const node of mutation.addedNodes)aliasTeamText(node);
    });
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  });

  if (document.querySelector('#events-grid')) {
    const script = document.createElement('script');
    script.src = '/gameday-events.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  const teamEventPaths=new Set([
    '/adult-soccer','/adult-soccer.html',
    '/cornhole-tournament','/cornhole-tournament.html',
    '/wiffle-ball-tournament','/wiffle-ball-tournament.html',
    '/kids-slip-and-slide','/kids-slip-and-slide.html',
    '/adult-slip-and-slide','/adult-slip-and-slide.html',
    '/egg-toss','/egg-toss.html',
    '/kids-soccer','/kids-soccer.html',
    '/junior-basketball','/junior-basketball.html',
    '/speed-grab','/speed-grab.html',
    '/event-scorecard','/event-scorecard.html'
  ]);
  if(teamEventPaths.has(path)){
    const rosterScript=document.createElement('script');
    rosterScript.src='/team-event-rosters.js?v=1';
    rosterScript.defer=true;
    document.head.appendChild(rosterScript);
    if(!document.querySelector('script[src*="copper-medal-ui.js"]')){
      const copperScript=document.createElement('script');
      copperScript.src='/copper-medal-ui.js?v=1';
      copperScript.defer=true;
      document.head.appendChild(copperScript);
    }
    if(!document.querySelector('script[src*="team-color-bars.js"]')){
      const bars=document.createElement('script');
      bars.src='/team-color-bars.js?v=20260902-1';
      bars.defer=true;
      document.head.appendChild(bars);
    }
  }
})();
