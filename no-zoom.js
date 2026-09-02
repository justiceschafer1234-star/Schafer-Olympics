(() => {
  const stopGesture = (event) => event.preventDefault();

  document.addEventListener('gesturestart', stopGesture, { passive: false });
  document.addEventListener('gesturechange', stopGesture, { passive: false });
  document.addEventListener('gestureend', stopGesture, { passive: false });

  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  if (document.querySelector('#events-grid')) {
    const script = document.createElement('script');
    script.src = '/gameday-events.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  const teamEventPaths=new Set(['/adult-soccer.html','/cornhole-tournament.html','/wiffle-ball-tournament.html','/kids-slip-and-slide.html','/adult-slip-and-slide.html','/egg-toss.html','/kids-soccer.html','/junior-basketball.html']);
  if(teamEventPaths.has(location.pathname.replace(/\/+$/,''))){
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
  }
})();
