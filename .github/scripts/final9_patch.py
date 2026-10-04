from pathlib import Path

# --- app.html ---
p = Path('app.html')
s = p.read_text(encoding='utf-8')
s = s.replace('styles.css?v=20261004final8','styles.css?v=20261004final9')
s = s.replace('app.js?v=20261004final8','app.js?v=20261004final9')
s = s.replace('FINAL · 2026.10.04 · 8','FINAL · 2026.10.04 · 9')

# confidence percentage inside CODE tab
old = '<div class="code-confidence-card"><div><span>Confidence do CODE</span><small>cresce conforme o histórico fica mais consistente</small></div><div class="confidence"><i id="confBar" style="width:0"></i></div></div>'
new = '<div class="code-confidence-card"><div class="code-confidence-head"><div><span>Confidence do CODE</span><small>cresce conforme o histórico fica mais consistente</small></div><b id="codeConfValue" class="code-confidence-value">0%</b></div><div class="confidence"><i id="confBar" style="width:0"></i></div></div>'
assert old in s, 'CODE confidence block not found'
s = s.replace(old,new)

# remove backend notice from alerts
old_notice = '    <div class="notice">As preferências ficam salvas neste aparelho. O backend de notificações push entra quando o CODE estiver compartilhado entre os três usuários.</div>\n'
assert old_notice in s, 'alerts backend notice not found'
s = s.replace(old_notice,'')

# add photo picker in spot modal
old_modal = '  <input id="spotName" class="field" maxlength="50" placeholder="Nome do pico">\n  <div class="section-label">LOCALIZAÇÃO · RECOMENDADA</div>'
new_modal = '''  <input id="spotName" class="field" maxlength="50" placeholder="Nome do pico">\n  <div class="section-label">FOTO DO PICO</div>\n  <div class="spot-photo-editor">\n    <div id="spotPhotoPreview" class="spot-photo-preview"><span>Sem foto personalizada</span></div>\n    <input id="spotPhotoInput" type="file" accept="image/*" hidden>\n    <button id="chooseSpotPhoto" class="btn secondary spot-photo-button" type="button">ESCOLHER FOTO</button>\n  </div>\n  <div class="section-label">LOCALIZAÇÃO · RECOMENDADA</div>'''
assert old_modal in s, 'spot modal insertion point not found'
s = s.replace(old_modal,new_modal)
p.write_text(s,encoding='utf-8')

# --- styles.css ---
p = Path('styles.css')
s = p.read_text(encoding='utf-8')
s += r'''

/* final9 · editable spot photo + CODE confidence value */
.spot-photo-editor{margin:7px 0 14px}
.spot-photo-preview{height:150px;border-radius:18px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#17364a,#08151d);border:1px solid rgba(255,255,255,.08);background-position:center;background-size:cover;color:#8ca5b1;font-size:12px;text-align:center;padding:16px}
.spot-photo-preview.has-photo span{display:none}
.spot-photo-button{margin-top:9px}
.code-confidence-head{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%}
.code-confidence-head>div{min-width:0}
.code-confidence-value{flex:none;font-size:22px;line-height:1;color:#a8faf2;letter-spacing:-.02em}
.code-confidence-card{display:block}
.code-confidence-card .confidence{margin-top:12px}
@media(max-width:520px){.spot-photo-preview{height:132px}.code-confidence-value{font-size:20px}}
'''
p.write_text(s,encoding='utf-8')

# --- app.js ---
p = Path('app.js')
s = p.read_text(encoding='utf-8')

# state pending photo
old_state = "pendingPoint:null,spotsEditMode:false}"
new_state = "pendingPoint:null,spotsEditMode:false,pendingSpotPhoto:null}"
assert old_state in s, 'state insertion not found'
s = s.replace(old_state,new_state,1)

# use custom photo in list
old_img = "style=\"--spot-img:url('${spotImage(i)}')\""
new_img = "style=\"--spot-img:url('${s.photo||spotImage(i)}')\""
assert old_img in s, 'spot image render not found'
s = s.replace(old_img,new_img,1)

# set cover + confidence percentage in renderSpotDetail
old_detail = "$('spotTitle').textContent=spot.name;$('spotScore').textContent=Number.isFinite(avg)?avg.toFixed(1):'—';"
new_detail = "$('spotTitle').textContent=spot.name;const cover=document.querySelector('#spot .cover');if(cover)cover.style.backgroundImage=`linear-gradient(180deg,rgba(5,15,22,.08),rgba(3,10,15,.34)),url('${spot.photo||spotImage(storage.spots().findIndex(x=>x.id===spot.id))}')`;$('spotScore').textContent=Number.isFinite(avg)?avg.toFixed(1):'—';"
assert old_detail in s, 'spot detail title block not found'
s = s.replace(old_detail,new_detail,1)

old_conf = "$('spotConf').textContent=`Confidence ${conf}%`;$('confBar').style.width=conf+'%';"
new_conf = "$('spotConf').textContent=`Confidence ${conf}%`;if($('codeConfValue'))$('codeConfValue').textContent=conf+'%';$('confBar').style.width=conf+'%';"
assert old_conf in s, 'confidence render not found'
s = s.replace(old_conf,new_conf,1)

# insert photo helper functions before openSpotEditor
marker = "function openSpotEditor(id=null){"
assert marker in s, 'openSpotEditor not found'
helpers = r'''function updateSpotPhotoPreview(photo){const el=$('spotPhotoPreview');if(!el)return;if(photo){el.style.backgroundImage=`linear-gradient(180deg,rgba(5,15,22,.04),rgba(3,10,15,.18)),url('${photo}')`;el.classList.add('has-photo')}else{el.style.backgroundImage='';el.classList.remove('has-photo')}}
function compressSpotPhoto(file){return new Promise((resolve,reject)=>{if(!file||!file.type?.startsWith('image/'))return reject(new Error('invalid image'));const reader=new FileReader();reader.onerror=()=>reject(new Error('read failed'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('image failed'));img.onload=()=>{const max=1100,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',.78))};img.src=reader.result};reader.readAsDataURL(file)})}
async function chooseSpotPhoto(file){if(!file)return;try{const photo=await compressSpotPhoto(file);state.pendingSpotPhoto=photo;updateSpotPhotoPreview(photo)}catch{alert('Não consegui usar essa imagem. Escolha uma foto JPG, PNG ou HEIC compatível com o navegador.')}finally{if($('spotPhotoInput'))$('spotPhotoInput').value=''}}
'''
s = s.replace(marker,helpers+marker,1)

# expand open editor with pending photo and preview/button text
old_open = "function openSpotEditor(id=null){state.editingSpotId=id;const spot=storage.spots().find(s=>s.id===id),seed=spot?.seed||{};$('modalTitle').textContent=spot?'Editar pico':'Novo pico';$('spotName').value=spot?.name||'';"
new_open = "function openSpotEditor(id=null){state.editingSpotId=id;const spot=storage.spots().find(s=>s.id===id),seed=spot?.seed||{};state.pendingSpotPhoto=spot?.photo||null;updateSpotPhotoPreview(state.pendingSpotPhoto);if($('chooseSpotPhoto'))$('chooseSpotPhoto').textContent=spot?'ALTERAR FOTO':'ESCOLHER FOTO';$('modalTitle').textContent=spot?'Editar pico':'Novo pico';$('spotName').value=spot?.name||'';"
assert old_open in s, 'open editor signature block not found'
s = s.replace(old_open,new_open,1)

# save photo on update/create
old_update = "s.name=name;s.lat=lat;s.lon=lon;s.seed=hasSeed?seed:null"
new_update = "s.name=name;s.lat=lat;s.lon=lon;s.seed=hasSeed?seed:null;s.photo=state.pendingSpotPhoto||s.photo||null"
assert old_update in s, 'spot update save block not found'
s = s.replace(old_update,new_update,1)
old_create = "spots.push({id,name,lat,lon,seed:hasSeed?seed:null});"
new_create = "spots.push({id,name,lat,lon,seed:hasSeed?seed:null,photo:state.pendingSpotPhoto||null});"
assert old_create in s, 'spot create save block not found'
s = s.replace(old_create,new_create,1)

# cleanup pending photo on close
old_close = "function closeSpotEditor(){$('spotModal').classList.remove('show');state.editingSpotId=null}"
new_close = "function closeSpotEditor(){$('spotModal').classList.remove('show');state.editingSpotId=null;state.pendingSpotPhoto=null}"
assert old_close in s, 'close editor block not found'
s = s.replace(old_close,new_close,1)

# bind photo controls
old_bind = "$('cancelSpot').onclick=closeSpotEditor;$('saveSpot').onclick=saveSpot;"
new_bind = "$('cancelSpot').onclick=closeSpotEditor;$('saveSpot').onclick=saveSpot;if($('chooseSpotPhoto'))$('chooseSpotPhoto').onclick=()=>$('spotPhotoInput').click();if($('spotPhotoInput'))$('spotPhotoInput').onchange=e=>chooseSpotPhoto(e.target.files?.[0]);"
assert old_bind in s, 'bind photo insertion point not found'
s = s.replace(old_bind,new_bind,1)

p.write_text(s,encoding='utf-8')

# Lightweight assertions
for fn, needles in {
    'app.html':['spotPhotoInput','codeConfValue','20261004final9'],
    'styles.css':['spot-photo-preview','code-confidence-value'],
    'app.js':['compressSpotPhoto','pendingSpotPhoto','codeConfValue','s.photo||spotImage']
}.items():
    t=Path(fn).read_text(encoding='utf-8')
    for needle in needles:
        assert needle in t, f'{needle} missing from {fn}'
