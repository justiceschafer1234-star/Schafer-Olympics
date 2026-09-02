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
    const script=document.createElement('script');
    script.src='/team-event-rosters.js?v=1';
    script.defer=true;
    document.head.appendChild(script);
  }
})();
