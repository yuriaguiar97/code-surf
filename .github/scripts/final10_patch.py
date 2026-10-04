from pathlib import Path

# --- app.html ---
p=Path('app.html')
h=p.read_text(encoding='utf-8')
old='''<section id="splash">\n  <div class="splash-bg"></div><div class="splash-vignette"></div>\n  <a class="splash-tap" href="#forecast" aria-label="Entrar no CODE"></a>\n  <div class="splash-copy"><div class="splash-logo">CODE</div><div class="splash-tag">EVERY SPOT HAS A CODE</div><div class="splash-hint">TOQUE PARA ENTRAR</div></div>\n</section>'''
new='''<section id="splash">\n  <div class="splash-bg"></div><div class="splash-vignette"></div>\n  <button id="splashTap" class="splash-tap" type="button" aria-label="Entrar no CODE"></button>\n  <div class="splash-copy"><div class="splash-logo">CODE<span class="code-blink">.</span></div><div id="typedTag" class="splash-tag" data-text="EVERY SPOT HAS A CODE"></div><div class="splash-hint">TOQUE EM QUALQUER LUGAR</div></div>\n</section>\n\n<section id="pinGate" class="pin-gate hidden" aria-label="Acesso ao CODE">\n  <div class="pin-card">\n    <div class="pin-brand">CODE<span>.</span></div>\n    <div id="pinStep">\n      <div class="pin-kicker">ACESSO PRIVADO</div>\n      <h2>Digite o PIN</h2>\n      <input id="pinInput" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code" placeholder="••••" aria-label="PIN de quatro dígitos">\n      <button id="pinSubmit" class="btn pin-submit" type="button">ENTRAR</button>\n      <div id="pinError" class="pin-error"></div>\n    </div>\n    <div id="profileStep" class="hidden">\n      <div class="pin-kicker">IDENTIFICAÇÃO</div>\n      <h2>Qual é o seu nome?</h2>\n      <div class="sub">Ele aparecerá nas sessões que você registrar.</div>\n      <input id="profileName" class="field" maxlength="30" autocomplete="name" placeholder="Seu nome">\n      <button id="profileSave" class="btn" type="button">ENTRAR NO CODE</button>\n    </div>\n  </div>\n</section>'''
assert old in h, 'splash block not found'
h=h.replace(old,new,1)
h=h.replace('<h1>Registrar sessão</h1><div class="sub">As condições do momento são capturadas automaticamente. Você só avalia o surf.</div>', '<h1>Registrar sessão</h1><div class="sub">As condições do momento são capturadas automaticamente. Você só avalia o surf.</div><div id="registerIdentity" class="register-identity"></div>',1)
h=h.replace('styles.css?v=20261004final9','styles.css?v=20261004final10')
h=h.replace('app.js?v=20261004final9','app.js?v=20261004final10')
h=h.replace('FINAL · 2026.10.04 · 9','FINAL · 2026.10.04 · 10')
p.write_text(h,encoding='utf-8')

# --- styles.css ---
p=Path('styles.css')
c=p.read_text(encoding='utf-8')
c += r'''

/* final10 · private PIN gate + decoding splash */
body:not(.access-granted) .screen{display:none!important}
body:not(.access-granted) #splash{display:flex!important}
body.access-granted #splash{display:none!important}
.splash-tap{border:0;background:transparent;cursor:pointer}
.code-blink{display:inline-block;margin-left:.02em;animation:codeBlink .8s steps(1,end) infinite;color:#f2fbff}
@keyframes codeBlink{0%,48%{opacity:1}49%,100%{opacity:.12}}
.splash-tag{min-height:14px}
.splash-tag:after{content:'_';margin-left:3px;animation:codeBlink .7s steps(1,end) infinite;color:#72e6ff}
.pin-gate{position:fixed;inset:0;z-index:140;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(3,10,16,.76);backdrop-filter:blur(18px)}
.pin-gate.hidden{display:none!important}
.pin-card{width:min(390px,100%);padding:26px 22px 22px;border-radius:27px;background:linear-gradient(180deg,rgba(11,27,39,.98),rgba(6,16,25,.98));border:1px solid rgba(150,200,225,.16);box-shadow:0 28px 80px rgba(0,0,0,.52)}
.pin-brand{font-size:24px;font-weight:300;letter-spacing:.24em;color:#eef8fb;margin-bottom:24px}.pin-brand span{color:#66dfff;animation:codeBlink .8s steps(1,end) infinite}
.pin-kicker{font-size:10px;letter-spacing:.18em;color:#72e6ff;font-weight:850}.pin-card h2{margin:7px 0 12px;font-size:25px}
.pin-input{width:100%;height:66px;border-radius:18px;border:1px solid rgba(124,183,214,.18);background:#07131d;color:#eef9fd;text-align:center;font-size:31px;font-weight:700;letter-spacing:.38em;padding-left:.38em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)}
.pin-input:focus{border-color:rgba(91,206,255,.7);box-shadow:0 0 0 3px rgba(75,178,255,.12)}
.pin-submit{margin-top:12px}.pin-error{height:18px;margin-top:8px;text-align:center;color:#ff9ea3;font-size:11px}
.pin-card.shake{animation:pinShake .28s ease}@keyframes pinShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
.register-identity{display:inline-flex;margin:10px 0 3px;padding:7px 10px;border-radius:999px;background:rgba(101,191,255,.09);border:1px solid rgba(101,191,255,.2);color:#b9dcff;font-size:11px}
.history-head small .registrant{color:#7ce5df}
'''
p.write_text(c,encoding='utf-8')

# --- app.js ---
p=Path('app.js')
s=p.read_text(encoding='utf-8')
needle="const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);"
assert needle in s, 'uid marker not found'
s=s.replace(needle, needle+"\nconst ACCESS_PIN='7777';\nconst currentUserName=()=>localStorage.getItem('code_user_name')||'';",1)

old_save="arr.push({...state.latest,spotId,spotName:spot.name,score:Number(score.value),size:$('size').value.trim(),comment:$('comment').value.trim(),date:new Date().toLocaleDateString('pt-BR')});"
new_save="arr.push({...state.latest,spotId,spotName:spot.name,registeredBy:currentUserName()||'Surfista',score:Number(score.value),size:$('size').value.trim(),comment:$('comment').value.trim(),date:new Date().toLocaleDateString('pt-BR')});"
assert old_save in s, 'session save block not found'
s=s.replace(old_save,new_save,1)

old_hist='<small>Sessão registrada</small>'
new_hist="<small>${s.registeredBy?'por '+esc(s.registeredBy):'Sessão registrada'}</small>"
assert old_hist in s, 'history subtitle not found'
s=s.replace(old_hist,new_hist,1)

marker='function bind(){'
assert marker in s, 'bind marker not found'
helpers=r'''function typeSplash(){const el=$('typedTag');if(!el)return;const text=el.dataset.text||'EVERY SPOT HAS A CODE';el.textContent='';let i=0;const tick=()=>{if(i<=text.length){el.textContent=text.slice(0,i++);setTimeout(tick,72)}};setTimeout(tick,350)}
function updateRegisterIdentity(){const el=$('registerIdentity');if(!el)return;const name=currentUserName();el.textContent=name?`Registrando como ${name}`:'Identifique-se para registrar'}
function unlockAccess(){document.body.classList.add('access-granted');$('pinGate')?.classList.add('hidden');updateRegisterIdentity();const allowed=['#forecast','#spots','#spot','#register','#alerts'];if(!allowed.includes(location.hash))location.hash='forecast'}
function showProfileStep(){$('pinStep')?.classList.add('hidden');$('profileStep')?.classList.remove('hidden');setTimeout(()=>$('profileName')?.focus(),80)}
function tryPin(){const input=$('pinInput'),err=$('pinError'),card=document.querySelector('.pin-card');if(!input)return;if(input.value===ACCESS_PIN){err.textContent='';if(currentUserName())unlockAccess();else showProfileStep();return}err.textContent='PIN incorreto';input.value='';card?.classList.remove('shake');void card?.offsetWidth;card?.classList.add('shake');input.focus()}
function saveProfileName(){const name=$('profileName')?.value.trim();if(!name){$('profileName')?.focus();return}localStorage.setItem('code_user_name',name.slice(0,30));unlockAccess()}
function openPinGate(){$('pinGate')?.classList.remove('hidden');$('pinStep')?.classList.remove('hidden');$('profileStep')?.classList.add('hidden');const input=$('pinInput');if(input){input.value='';setTimeout(()=>input.focus(),80)}}
function bootAccess(){typeSplash();$('splashTap')?.addEventListener('click',openPinGate);$('pinSubmit')?.addEventListener('click',tryPin);$('pinInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')tryPin()});$('profileSave')?.addEventListener('click',saveProfileName);$('profileName')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveProfileName()});updateRegisterIdentity()}
'''
s=s.replace(marker,helpers+marker,1)

old_hash="if(location.hash==='#register')renderRegisterCapture()"
new_hash="if(location.hash==='#register'){renderRegisterCapture();updateRegisterIdentity()}"
assert old_hash in s, 'register hash handler not found'
s=s.replace(old_hash,new_hash,1)

old_bottom='bind();renderSpots();renderSpotDetail();showSpotTab(\'overview\');loadForecast(true);setInterval(()=>loadForecast(true),CFG.refreshMs);'
new_bottom="bootAccess();bind();renderSpots();renderSpotDetail();showSpotTab('overview');loadForecast(true);setInterval(()=>loadForecast(true),CFG.refreshMs);"
assert old_bottom in s, 'boot sequence not found'
s=s.replace(old_bottom,new_bottom,1)
p.write_text(s,encoding='utf-8')

# --- index cache bust ---
p=Path('index.html')
idx=p.read_text(encoding='utf-8')
idx=idx.replace('20261004final5','20261004final10').replace('20261004final9','20261004final10')
p.write_text(idx,encoding='utf-8')

# assertions
assert 'splashTap' in Path('app.html').read_text(encoding='utf-8')
assert 'pinGate' in Path('app.html').read_text(encoding='utf-8')
assert "ACCESS_PIN='7777'" in Path('app.js').read_text(encoding='utf-8')
assert 'registeredBy:currentUserName()' in Path('app.js').read_text(encoding='utf-8')
assert '20261004final10' in Path('index.html').read_text(encoding='utf-8')
