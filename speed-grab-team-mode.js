(()=>{
  const q=new URLSearchParams(location.search);
  if(q.get('event')!=='speed-grab')return;
  const mode=q.get('control')==='1'?'control=1':'view=1';
  const target=`/speed-grab.html?${mode}&v=20260902-speed-grab-dedicated-1`;
  location.replace(target);
})();