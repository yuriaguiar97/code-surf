from pathlib import Path
import re

# ---------- app.html ----------
p = Path('app.html')
h = p.read_text(encoding='utf-8')
h = h.replace('styles.css?v=20261004final10', 'styles.css?v=20261004final11')
h = h.replace('app.js?v=20261004final10', 'app.js?v=20261004final11')
h = h.replace('FINAL · 2026.10.04 · 10', 'FINAL · 2026.10.04 · 11')
p.write_text(h, encoding='utf-8')

# ---------- index.html ----------
p = Path('index.html')
idx = p.read_text(encoding='utf-8')
idx = re.sub(r'app\.html\?v=20261004final\d+', 'app.html?v=20261004final11', idx)
p.write_text(idx, encoding='utf-8')

# ---------- app.js ----------
p = Path('app.js')
s = p.read_text(encoding='utf-8')

old = "const ACCESS_PIN='7777';\nconst currentUserName=()=>localStorage.getItem('code_user_name')||'';"
new = """const SYNC_URL='https://aaiynfintqsjvkaitmlz.supabase.co/functions/v1/code-sync';
let accessPin=sessionStorage.getItem('code_access_pin')||'';
let syncPromise=null;
const currentUserName=()=>localStorage.getItem('code_user_name')||'';
async function sharedRequest(action,payload={},pin=accessPin){
  if(!pin)throw new Error('PIN necessário');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
  try{
    const r=await fetch(SYNC_URL,{method:'POST',cache:'no-store',signal:ctl.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action,pin,actor:currentUserName(),...payload})});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok||data?.error)throw new Error(data?.error||('HTTP '+r.status));
    return data;
  }finally{clearTimeout(timer)}
}
async function syncSharedData({migrate=true}={}){
  if(!accessPin)return null;
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
    if(migrate&&localStorage.getItem('code_shared_migrated')!=='1'){
      const spots=storage.spots();
      let changed=false;
      const sessions=storage.sessions().map(x=>{if(x.id)return x;changed=true;return{...x,id:uid(),registeredBy:x.registeredBy||currentUserName()||'Surfista'}});
      if(changed)storage.setSessions(sessions);
      if(spots.length||sessions.length)await sharedRequest('migrate',{spots,sessions});
      localStorage.setItem('code_shared_migrated','1');
    }
    const snap=await sharedRequest('snapshot');
    const spots=Array.isArray(snap.spots)?snap.spots:[];
    const sessions=Array.isArray(snap.sessions)?snap.sessions:[];
    storage.setSpots(spots);storage.setSessions(sessions);
    if(state.currentSpotId&&!spots.some(x=>x.id===state.currentSpotId)){state.currentSpotId='';localStorage.removeItem('code_current_spot')}
    renderSpots();renderSpotDetail();renderRegisterCapture();
    return snap;
  })().finally(()=>{syncPromise=null});
  return syncPromise;
}"""
assert old in s, 'access constants block not found'
s = s.replace(old, new, 1)

# Save spot -> shared backend first
pat = re.compile(r"function saveSpot\(\)\{.*?\}\nfunction deleteSpot\(id\)\{.*?\}\nfunction updateLocationSummary", re.S)
match = pat.search(s)
assert match, 'saveSpot/deleteSpot block not found'
replacement = r'''async function saveSpot(){
  const name=$('spotName').value.trim();if(!name)return alert('Dê um nome ao pico.');
  const lat=numField('spotLat'),lon=numField('spotLon'),seed={waveMin:numField('seedWaveMin'),waveMax:numField('seedWaveMax'),periodMin:numField('seedPeriodMin'),periodMax:numField('seedPeriodMax'),swellDir:$('seedSwellDir').value.trim(),windDir:$('seedWindDir').value.trim(),windMax:numField('seedWindMax'),note:$('seedNote').value.trim()},hasSeed=Object.values(seed).some(v=>v!==null&&v!=='');
  const spots=storage.spots();let candidate;
  if(state.editingSpotId){const existing=spots.find(x=>x.id===state.editingSpotId);if(!existing)return;candidate={...existing,name,lat,lon,seed:hasSeed?seed:null,photo:state.pendingSpotPhoto||existing.photo||null}}
  else{candidate={id:uid(),name,lat,lon,seed:hasSeed?seed:null,photo:state.pendingSpotPhoto||null,createdBy:currentUserName()||'Surfista'}}
  const btn=$('saveSpot');if(btn){btn.disabled=true;btn.textContent='SALVANDO…'}
  try{
    const result=await sharedRequest('upsert_spot',{spot:candidate});const savedSpot=result.spot||candidate;
    const next=spots.filter(x=>x.id!==savedSpot.id);next.push(savedSpot);storage.setSpots(next);
    if(!state.editingSpotId){state.currentSpotId=savedSpot.id;localStorage.setItem('code_current_spot',savedSpot.id)}
    closeSpotEditor();renderSpots();renderSpotDetail();
  }catch(err){console.error(err);alert('Não consegui salvar o pico no CODE compartilhado. Confira sua conexão e tente novamente.')}
  finally{if(btn){btn.disabled=false;btn.textContent='SALVAR'}}
}
async function deleteSpot(id){
  const spots=storage.spots(),spot=spots.find(s=>s.id===id);if(!spot)return;if(!confirm(`Excluir ${spot.name} e todo o histórico deste pico?`))return;
  try{await sharedRequest('delete_spot',{spotId:id})}catch(err){console.error(err);alert('Não consegui excluir o pico do CODE compartilhado. Tente novamente.');return}
  storage.setSpots(spots.filter(s=>s.id!==id));storage.setSessions(storage.sessions().filter(s=>s.spotId!==id));
  if(state.currentSpotId===id){state.currentSpotId='';localStorage.removeItem('code_current_spot')}if(state.editingSpotId===id)closeSpotEditor();renderSpots();renderSpotDetail();
}
function updateLocationSummary'''
s = s[:match.start()] + replacement + s[match.end():]

# Save session -> shared backend first
pat = re.compile(r"function saveSession\(\)\{.*?\}\nfunction alertLeadValues", re.S)
match = pat.search(s)
assert match, 'saveSession block not found'
replacement = r'''async function saveSession(){
  const spots=storage.spots(),spotId=$('spotSelect').value,spot=spots.find(s=>s.id===spotId),score=document.querySelector('input[name="score"]:checked');
  if(!spot)return alert('Crie um pico antes de registrar a sessão.');if(!state.latest)return alert('A previsão ainda não carregou.');if(!score)return alert('Escolha uma nota de 6 a 10.');
  const session={id:uid(),...state.latest,spotId,spotName:spot.name,registeredBy:currentUserName()||'Surfista',score:Number(score.value),size:$('size').value.trim(),comment:$('comment').value.trim(),date:new Date().toLocaleDateString('pt-BR')};
  const btn=$('saveSession');if(btn){btn.disabled=true;btn.textContent='SALVANDO…'}
  try{
    const result=await sharedRequest('add_session',{session});const savedSession=result.session||session,arr=storage.sessions();arr.push(savedSession);storage.setSessions(arr);
    state.currentSpotId=spotId;localStorage.setItem('code_current_spot',spotId);$('saved').style.display='block';renderSpots();renderSpotDetail();
    document.querySelectorAll('input[name="score"]').forEach(x=>x.checked=false);$('size').value='';$('comment').value='';
    setTimeout(()=>{location.hash='spot';showSpotTab('overview');$('saved').style.display='none'},500)
  }catch(err){console.error(err);alert('Não consegui registrar a sessão no CODE compartilhado. Confira sua conexão e tente novamente.')}
  finally{if(btn){btn.disabled=false;btn.textContent='SALVAR SESSÃO'}}
}
function alertLeadValues'''
s = s[:match.start()] + replacement + s[match.end():]

# Access gate: validate PIN on backend, then sync shared data
old = "function unlockAccess(){document.body.classList.add('access-granted');$('pinGate')?.classList.add('hidden');updateRegisterIdentity();const allowed=['#forecast','#spots','#spot','#register','#alerts'];if(!allowed.includes(location.hash))location.hash='forecast'}"
new = "function unlockAccess(){document.body.classList.add('access-granted');$('pinGate')?.classList.add('hidden');updateRegisterIdentity();const allowed=['#forecast','#spots','#spot','#register','#alerts'];if(!allowed.includes(location.hash))location.hash='forecast';syncSharedData({migrate:true}).catch(err=>{console.error('shared sync failed',err);alert('Você entrou no CODE, mas a sincronização compartilhada não respondeu agora. Tente novamente com conexão à internet.')})}"
assert old in s, 'unlockAccess not found'
s=s.replace(old,new,1)

old = "function tryPin(){const input=$('pinInput'),err=$('pinError'),card=document.querySelector('.pin-card');if(!input)return;if(input.value===ACCESS_PIN){err.textContent='';if(currentUserName())unlockAccess();else showProfileStep();return}err.textContent='PIN incorreto';input.value='';card?.classList.remove('shake');void card?.offsetWidth;card?.classList.add('shake');input.focus()}"
new = "async function tryPin(){const input=$('pinInput'),err=$('pinError'),card=document.querySelector('.pin-card'),btn=$('pinSubmit');if(!input)return;const pin=input.value.trim();if(pin.length!==4){err.textContent='Digite os 4 números do PIN';return}if(btn){btn.disabled=true;btn.textContent='VALIDANDO…'}try{await sharedRequest('login',{},pin);accessPin=pin;sessionStorage.setItem('code_access_pin',pin);err.textContent='';if(currentUserName())unlockAccess();else showProfileStep()}catch(e){err.textContent='PIN incorreto ou conexão indisponível';input.value='';card?.classList.remove('shake');void card?.offsetWidth;card?.classList.add('shake');input.focus()}finally{if(btn){btn.disabled=false;btn.textContent='ENTRAR'}}}"
assert old in s, 'tryPin not found'
s=s.replace(old,new,1)

# Periodic shared refresh while unlocked
old = "bootAccess();bind();renderSpots();renderSpotDetail();showSpotTab('overview');loadForecast(true);setInterval(()=>loadForecast(true),CFG.refreshMs);"
new = "bootAccess();bind();renderSpots();renderSpotDetail();showSpotTab('overview');loadForecast(true);setInterval(()=>loadForecast(true),CFG.refreshMs);setInterval(()=>{if(document.body.classList.contains('access-granted'))syncSharedData({migrate:false}).catch(()=>{})},45000);"
assert old in s, 'startup block not found'
s=s.replace(old,new,1)

p.write_text(s, encoding='utf-8')

# Assertions
text = Path('app.js').read_text(encoding='utf-8')
for needle in [
    'SYNC_URL=', 'syncSharedData', "sharedRequest('upsert_spot'", "sharedRequest('delete_spot'", "sharedRequest('add_session'", "sharedRequest('login'"
]:
    assert needle in text, f'missing {needle}'
assert "ACCESS_PIN='7777'" not in text, 'PIN must not remain in browser source'
assert 'FINAL · 2026.10.04 · 11' in Path('app.html').read_text(encoding='utf-8')
