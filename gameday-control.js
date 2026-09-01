(()=>{
  const body=document.body;
  const adminTab=document.querySelector('.admin-tab');
  const adminPanel=document.querySelector('[data-panel="admin"]');
  const adminCode=document.querySelector('#admin-code');
  const controlButton=document.querySelector('#control-mode-button');
  const modeLabel=document.querySelector('#view-mode-label');
  const logoutButton=document.querySelector('#control-mode-exit');
  const STORAGE_KEY='schaferOlympicsControlCode';

  function setViewer(){
    body.classList.add('viewer-mode');
    body.classList.remove('control-mode');
    if(modeLabel)modeLabel.textContent='Viewing View · Read Only';
    if(controlButton){controlButton.hidden=false;controlButton.textContent='🔐 Control';}
    if(logoutButton)logoutButton.hidden=true;
    if(adminCode)adminCode.value='';
    if(adminPanel&&!adminPanel.hidden){
      adminPanel.hidden=true;
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('is-active'));
      document.querySelectorAll('.tab-panel').forEach(p=>{p.hidden=true;p.classList.remove('is-active')});
      const overviewTab=document.querySelector('[data-tab="overview"]');
      const overviewPanel=document.querySelector('[data-panel="overview"]');
      if(overviewTab)overviewTab.classList.add('is-active');
      if(overviewPanel){overviewPanel.hidden=false;overviewPanel.classList.add('is-active');}
    }
  }

  function setControl(code){
    body.classList.remove('viewer-mode');
    body.classList.add('control-mode');
    if(modeLabel)modeLabel.textContent='Control View · Unlocked';
    if(controlButton)controlButton.hidden=true;
    if(logoutButton)logoutButton.hidden=false;
    if(adminCode)adminCode.value=code;
  }

  async function verify(code){
    const response=await fetch('/api/admin/scores',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code})
    });
    if(response.status===401)return false;
    const data=await response.json().catch(()=>({}));
    if(response.status===503)throw new Error(data.error||'Admin code is not configured.');
    return response.status===400&&String(data.error||'').includes('Choose an event');
  }

  async function unlock(){
    const code=prompt('Enter the private control code:');
    if(code===null)return;
    if(!code.trim()){alert('Enter the control code.');return;}
    if(controlButton){controlButton.disabled=true;controlButton.textContent='Checking…';}
    try{
      const ok=await verify(code);
      if(!ok){alert('Incorrect control code.');return;}
      sessionStorage.setItem(STORAGE_KEY,code);
      setControl(code);
    }catch(err){
      alert(err.message||'Could not verify the control code.');
    }finally{
      if(controlButton){controlButton.disabled=false;if(!body.classList.contains('control-mode'))controlButton.textContent='🔐 Control';}
    }
  }

  async function restore(){
    const code=sessionStorage.getItem(STORAGE_KEY);
    if(!code)return;
    try{
      if(await verify(code))setControl(code);
      else sessionStorage.removeItem(STORAGE_KEY);
    }catch{}
  }

  setViewer();
  controlButton?.addEventListener('click',unlock);
  logoutButton?.addEventListener('click',()=>{sessionStorage.removeItem(STORAGE_KEY);setViewer();});
  restore();
})();
