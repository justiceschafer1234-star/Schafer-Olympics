(()=>{
  const params=new URLSearchParams(location.search);
  const token=String(params.get('nfc')||'').trim();
  if(!token)return;

  const STORAGE_KEY='schaferOlympicsControlCode';
  const MARKER='__nfc_team_access__';
  const nativeFetch=window.fetch.bind(window);

  // Install the fetch shim before exposing the NFC session marker.
  // This guarantees individual-stats.js cannot start verification until
  // /api/admin/verify and /api/admin/mvp-stats are intercepted.
  window.fetch=async(input,init={})=>{
    const rawUrl=typeof input==='string'?input:input?.url||'';
    const url=new URL(rawUrl,location.origin);

    if(url.origin===location.origin&&url.pathname==='/api/admin/verify'){
      let body={};try{body=JSON.parse(String(init?.body||'{}'))}catch{}
      if(String(body.code||'')===MARKER){
        return new Response(JSON.stringify({ok:true,nfc:true}),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
      }
    }

    if(url.origin===location.origin&&url.pathname==='/api/admin/mvp-stats'){
      let body={};try{body=JSON.parse(String(init?.body||'{}'))}catch{}
      if(String(body.code||'')===MARKER){
        delete body.code;
        body.nfcToken=token;
        return nativeFetch('/api/nfc/mvp-stats',{
          ...init,
          method:'POST',
          headers:{...(init?.headers||{}),'Content-Type':'application/json'},
          body:JSON.stringify(body),
          cache:'no-store'
        });
      }
    }

    return nativeFetch(input,init);
  };

  sessionStorage.setItem(STORAGE_KEY,MARKER);
  document.body.dataset.nfcAccess='true';
})();
