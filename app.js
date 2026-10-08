(()=>{
'use strict';
const CFG={lat:-23.4347,lon:-45.0711,marineLat:-23.75,marineLon:-44.75,forecastVersion:'ubatuba-south-interpolated-wind-v3',tz:'America/Sao_Paulo',forecastDays:7,refreshMs:30*60*1000,staleMs:15*60*1000};
// Ubatuba-specific surrounding cells; order NW, NE, SW, SE.
// Fixed relative weights from the WG comparison, restricted to these available models.
const WIND_SOURCES=[
  {model:'gfs_seamless',weight:14.1,points:[[-23.371292,-45.117188],[-23.371292,-45],[-23.488441,-45.117188],[-23.488441,-45]]},
  {model:'ecmwf_ifs',weight:20.4,points:[[-23.374342,-45.094543],[-23.374342,-45],[-23.44464,-45.141968],[-23.44464,-45.047333]]},
  {model:'icon_global',weight:12.7,points:[[-23.375,-45.125],[-23.375,-45],[-23.5,-45.125],[-23.5,-45]]},
  {model:'gem_global',weight:5.7,points:[[-23.399994,-45.149994],[-23.399994,-45],[-23.549995,-45.149994],[-23.549995,-45]]}
];
const $=id=>document.getElementById(id);
const dirs=['N','NNE','NE','ENE','L','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
const state={marine:null,wind:null,tides:null,selectedDay:'',latest:null,registerDay:'',registerTs:'',registerCapture:null,registerOriginal:null,registerEdits:{},registerError:'',sessionEditing:false,sessionSaving:false,lastLoad:0,sourceMode:'primary',currentSpotId:localStorage.getItem('code_current_spot')||'',editingSpotId:null,map:null,mapMarker:null,pendingPoint:null,spotsEditMode:false,pendingSpotPhoto:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=(n,d=1)=>Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const dir=d=>d!==null&&d!==undefined&&d!==''&&Number.isFinite(Number(d))?dirs[Math.round((((Number(d)%360)+360)%360)/22.5)%16]:'—';
const localDate=ts=>new Date(ts+':00-03:00');
const dayPlus=(day,n)=>{const d=new Date(day+'T12:00:00-03:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const dayName=(day,long=false)=>new Intl.DateTimeFormat('pt-BR',long?{weekday:'long',day:'2-digit',month:'2-digit'}:{weekday:'short'}).format(new Date(day+'T12:00:00-03:00')).replace('.','');
const storage={sessions:()=>{try{return JSON.parse(localStorage.getItem('code_sessions')||'[]')}catch{return[]}},setSessions:v=>localStorage.setItem('code_sessions',JSON.stringify(v)),spots:()=>{try{return JSON.parse(localStorage.getItem('code_spots')||'[]')}catch{return[]}},setSpots:v=>localStorage.setItem('code_spots',JSON.stringify(v)),alerts:()=>{try{return JSON.parse(localStorage.getItem('code_alert_settings')||'{"enabled":true,"leads":[168],"daily":true,"spots":{}}')}catch{return{enabled:true,leads:[168],daily:true,spots:{}}}},setAlerts:v=>localStorage.setItem('code_alert_settings',JSON.stringify(v))};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const SYNC_URL='https://aaiynfintqsjvkaitmlz.supabase.co/functions/v1/code-sync';
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
}
function nearestIndex(times,target=Date.now()){let best=0,delta=Infinity;times.forEach((v,i)=>{const d=Math.abs(localDate(v).getTime()-target);if(d<delta){delta=d;best=i}});return best}
function nearestInDay(times,day,targetHour=12){let idx=-1,delta=Infinity;times.forEach((v,i)=>{if(!v.startsWith(day))return;const h=Number(v.slice(11,13))+Number(v.slice(14,16))/60,d=Math.abs(h-targetHour);if(d<delta){delta=d;idx=i}});return idx}
function energy(H){H=Number(H);return Number.isFinite(H)?1025*9.81*H*H/16:null}
function windIndex(ts){if(!state.wind?.hourly?.time?.length)return 0;const exact=state.wind.hourly.time.indexOf(ts);return exact>=0?exact:nearestIndex(state.wind.hourly.time,localDate(ts).getTime())}
// GFS-Wave maps wave_period to NOAA PERPW (peak period) and wave_direction to DIRPW (primary direction).
// Never silently substitute a swell-component period.
function periodAt(i){const raw=state.marine?.hourly?.wave_period?.[i];return raw!==null&&raw!==undefined&&Number.isFinite(Number(raw))&&Number(raw)>0?Number(raw):null}
function forecastMetadata(ts){return{version:CFG.forecastVersion,provider:'Open-Meteo',sourceMode:state.sourceMode,marineModel:state.sourceMode==='primary'?'ncep_gfswave025':'unknown/cache',windModel:state.wind?.codeWind?.model||'unknown/cache',windMethod:state.wind?.codeWind?.method||'single-cell/provider-dependent',windSources:state.wind?.codeWind?.sources||[],windHourSources:ts?state.wind?.hourly?.code_wind_sources?.[state.wind.hourly.time.indexOf(ts)]||[]:[],requestedWind:{latitude:CFG.lat,longitude:CFG.lon,cellSelection:state.wind?.codeWind?.cellSelection||'sea'},windGrid:{latitude:state.wind?.latitude,longitude:state.wind?.longitude},requestedMarine:{latitude:CFG.marineLat,longitude:CFG.marineLon},marineGrid:{latitude:state.marine?.latitude,longitude:state.marine?.longitude},waveFields:{height:'wave_height',direction:'wave_direction',period:'wave_period',periodKind:state.sourceMode==='primary'?'peak (NOAA PERPW)':'provider-dependent'},directions:'from',retrievedAt:state.lastLoad?new Date(state.lastLoad).toISOString():null}}
function offshore(d){d=((Number(d)%360)+360)%360;return Number.isFinite(d)&&d>=225&&d<=315}
function onshore(d){d=((Number(d)%360)+360)%360;return Number.isFinite(d)&&d>=45&&d<=135}
function quality(kind,val,dirDeg=null){
  const n=Number(val);if(!Number.isFinite(n))return null;
  let good=false,intensity=.25,label='',score=.5;
  if(kind==='wave'){
    if(n<1){good=false;intensity=clamp(.65+(1-n)*.25,.65,.95);score=clamp(.10+n*.18,.08,.28);label='SWELL FRACO'}
    else if(n<1.8){good=false;intensity=clamp(.34-((n-1)/.8)*.22,.10,.34);score=.34+((n-1)/.8)*.26;label='SWELL MÉDIO'}
    else{good=true;const ideal=clamp((n-1.8)/.7,0,1);intensity=.30+ideal*.48;score=.82+ideal*.18;label=n<=2.5?'SWELL BOM':'SWELL GRANDE'}
  }else if(kind==='period'){
    if(n<8){good=false;intensity=clamp(.72+(8-n)*.07,.72,1);score=.10+clamp(n/8,0,1)*.15;label='PERÍODO RUIM'}
    else if(n<10){good=false;intensity=clamp(.34-((n-8)/2)*.20,.12,.34);score=.36+((n-8)/2)*.20;label='PERÍODO CURTO'}
    else if(n<12){good=true;intensity=.18+((n-10)/2)*.24;score=.65+((n-10)/2)*.18;label='PERÍODO OK'}
    else{good=true;intensity=clamp(.55+(n-12)*.09,.55,1);score=clamp(.90+(n-12)*.025,.90,1);label='PERÍODO BOM'}
  }else if(kind==='wind'){
    const d=Number(dirDeg),terral=offshore(d),maral=onshore(d),leve=n<=5;
    if(leve){good=true;intensity=.22;score=.96-n*.018;label='VENTO LEVE'}
    else if(terral&&n<=10){good=true;intensity=.25+((n-5)/5)*.28;score=.86-((n-5)/5)*.20;label='TERRAL'}
    else{good=false;intensity=clamp(.16+(n-5)/15*.72,.16,.95);score=clamp((terral?.52:maral?.24:.36)-(n-5)*.025,.08,.55);label=terral?'TERRAL FORTE':maral?'MARAL':'VENTO FORTE'}
  }else if(kind==='energy'){
    if(n<1000){good=false;intensity=clamp(.62+(1000-n)/1000*.28,.62,.92);score=.10+clamp(n/1000,0,1)*.18;label='ENERGIA BAIXA'}
    else if(n<1800){good=false;intensity=clamp(.34-((n-1000)/800)*.22,.12,.34);score=.34+((n-1000)/800)*.22;label='ENERGIA MÉDIA'}
    else if(n<2500){good=true;intensity=.22+((n-1800)/700)*.32;score=.68+((n-1800)/700)*.18;label='ENERGIA OK'}
    else{good=true;intensity=clamp(.58+(n-2500)/1800*.34,.58,.92);score=clamp(.90+(n-2500)/3000*.10,.90,1);label='ENERGIA BOA'}
  }else return null;
  const light=good?[207,242,218]:[250,222,223],dark=good?[18,101,59]:[124,36,46],mix=(a,b,t)=>Math.round(a+(b-a)*t),bg=`rgb(${mix(light[0],dark[0],intensity)} ${mix(light[1],dark[1],intensity)} ${mix(light[2],dark[2],intensity)})`;
  return{good,intensity,label,bg,dark:intensity>.55,score:clamp(score)}
}
function qStyle(kind,val,dirDeg=null){const q=quality(kind,val,dirDeg);return q?`background:${q.bg};color:${q.dark?'#f7fff8':'#08150d'};font-weight:800`:''}
function surfScore(wave,period,wind,windDir,energyValue){const parts=[['wave',wave,null,.30],['period',period,null,.25],['wind',wind,windDir,.30],['energy',energyValue,null,.15]];let total=0,weight=0;for(const [k,v,d,w] of parts){const q=quality(k,v,d);if(q){total+=q.score*w;weight+=w}}return weight?clamp(total/weight):.5}
function overallQuality(wave,period,wind,windDir,energyValue){const s=surfScore(wave,period,wind,windDir,energyValue);if(s>=.78)return{cls:'good',text:'BOAS CONDIÇÕES'};if(s<.48)return{cls:'bad',text:'CONDIÇÕES FRACAS'};return{cls:'mixed',text:'CONDIÇÕES REGULARES'}}
function dayStars(day){const H=state.marine?.hourly,W=state.wind?.hourly;if(!H||!W)return 1;let idx=H.time.map((t,i)=>[t,i]).filter(([t])=>{const h=Number(t.slice(11,13));return t.startsWith(day)&&h>=7&&h<=19&&h%2===1});if(!idx.length)idx=H.time.map((t,i)=>[t,i]).filter(([t])=>t.startsWith(day));const scores=idx.map(([t,i])=>{const wi=windIndex(t);return surfScore(H.wave_height[i],periodAt(i),W.wind_speed_10m[wi],W.wind_direction_10m[wi],energy(H.wave_height[i]))}).filter(Number.isFinite);if(!scores.length)return 1;const avg=scores.reduce((a,b)=>a+b,0)/scores.length,best=Math.max(...scores),combined=avg*.72+best*.28;return Math.max(1,Math.min(5,Math.round(1+combined*4)))}
function starsText(n){return '★★★★★'.split('').map((x,i)=>i<n?'★':'☆').join('')}
async function fetchJSON(url,timeout=12000){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(timer)}}
function marineURL(fallback=false){const p=new URLSearchParams({latitude:CFG.marineLat,longitude:CFG.marineLon,hourly:'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period',timezone:CFG.tz,forecast_days:CFG.forecastDays,cell_selection:'sea'});if(!fallback)p.set('models','ncep_gfswave025');return'https://marine-api.open-meteo.com/v1/marine?'+p}
function windURL(fallback=false,source=WIND_SOURCES[0]){
  const p=new URLSearchParams({latitude:fallback?CFG.lat:source.points.map(x=>x[0]).join(','),longitude:fallback?CFG.lon:source.points.map(x=>x[1]).join(','),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'kn',timezone:CFG.tz,forecast_days:CFG.forecastDays,cell_selection:fallback?'sea':'nearest'});
  if(!fallback)p.set('models',source.model);
  return'https://api.open-meteo.com/v1/forecast?'+p;
}
function validWindNumber(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function interpolateWindModel(source,cells){
  if(!Array.isArray(cells)||cells.length!==4||cells.some(c=>!c?.hourly?.time?.length))throw new Error('Incomplete wind grid: '+source.model);
  const [nw,ne,sw,se]=cells,north=Number(nw.latitude),south=Number(sw.latitude);
  if(Math.abs(north-Number(ne.latitude))>1e-5||Math.abs(south-Number(se.latitude))>1e-5||north<=south)throw new Error('Invalid latitude grid');
  const xn=(CFG.lon-Number(nw.longitude))/(Number(ne.longitude)-Number(nw.longitude)),xs=(CFG.lon-Number(sw.longitude))/(Number(se.longitude)-Number(sw.longitude)),y=(CFG.lat-south)/(north-south);
  const weights=[(1-xn)*y,xn*y,(1-xs)*(1-y),xs*(1-y)];
  if(weights.some(w=>!Number.isFinite(w)||w<0||w>1))throw new Error('Wind grid does not enclose Ubatuba');
  const indices=cells.map(c=>new Map(c.hourly.time.map((t,i)=>[t,i]))),samples=new Map();
  for(const ts of nw.hourly.time){
    let u=0,v=0,g=0,gustValid=true,complete=true;
    for(let k=0;k<4;k++){
      const i=indices[k].get(ts),h=cells[k].hourly,speed=h.wind_speed_10m?.[i],direction=h.wind_direction_10m?.[i],gust=h.wind_gusts_10m?.[i];
      if(!validWindNumber(speed)||!validWindNumber(direction)||Number(speed)<0){complete=false;break}
      const a=Number(direction)*Math.PI/180;
      u+=weights[k]*Number(speed)*Math.sin(a);v+=weights[k]*Number(speed)*Math.cos(a);
      if(validWindNumber(gust)&&Number(gust)>=0)g+=weights[k]*Number(gust);else gustValid=false;
    }
    if(complete)samples.set(ts,{u,v,gust:gustValid?g:null});
  }
  if(!samples.size)throw new Error('No complete wind samples');
  return{model:source.model,weight:source.weight,samples,grids:cells.map((c,i)=>({latitude:c.latitude,longitude:c.longitude,weight:weights[i]}))};
}
function blendWindModels(models){
  if(!models.length)throw new Error('No wind models available');
  const times=[...new Set(models.flatMap(m=>[...m.samples.keys()]))].sort(),hourly={time:times,wind_speed_10m:[],wind_direction_10m:[],wind_gusts_10m:[],code_wind_sources:[]};
  let degraded=models.length!==WIND_SOURCES.length;
  for(const ts of times){
    const available=models.filter(m=>m.samples.has(ts)),total=available.reduce((a,m)=>a+m.weight,0);
    let u=0,v=0,gust=0,gustWeight=0;
    for(const m of available){
      const p=m.samples.get(ts),w=m.weight/total;u+=w*p.u;v+=w*p.v;
      if(validWindNumber(p.gust)){gust+=w*p.gust;gustWeight+=w}
    }
    hourly.wind_speed_10m.push(Math.hypot(u,v));
    hourly.wind_direction_10m.push(Math.hypot(u,v)<1e-8?null:(Math.atan2(u,v)*180/Math.PI+360)%360);
    hourly.wind_gusts_10m.push(gustWeight>0?gust/gustWeight:null);
    hourly.code_wind_sources.push(available.map(m=>({model:m.model,weight:m.weight/total})));
    if(available.length!==WIND_SOURCES.length)degraded=true;
  }
  return{latitude:CFG.lat,longitude:CFG.lon,timezone:CFG.tz,hourly_units:{time:'iso8601',wind_speed_10m:'kn',wind_direction_10m:'°',wind_gusts_10m:'kn'},hourly,codeWind:{model:'code_wind_blend_v1',method:'spatial-vector-interpolation + weighted-vector-blend',cellSelection:'nearest',degraded,sources:models.map(m=>({model:m.model,relativeWeight:m.weight,grids:m.grids}))}};
}
async function fetchWindForecast(){
  const results=await Promise.allSettled(WIND_SOURCES.map(async source=>interpolateWindModel(source,await fetchJSON(windURL(false,source),18000))));
  const models=[];
  for(const result of results){if(result.status==='fulfilled')models.push(result.value);else console.warn('Wind model unavailable',result.reason)}
  return blendWindModels(models);
}
function cacheForecast(){if(!state.marine||!state.wind)return;localStorage.setItem('code_forecast_cache',JSON.stringify({version:CFG.forecastVersion,saved:Date.now(),marine:state.marine,wind:state.wind}))}
function loadCachedForecast(){try{const c=JSON.parse(localStorage.getItem('code_forecast_cache')||'null');if(c?.version===CFG.forecastVersion&&c?.marine?.hourly?.time?.length&&c?.wind?.hourly?.time?.length){state.marine=c.marine;state.wind=c.wind;state.sourceMode='cache';state.lastLoad=c.saved||0;return c.saved||0}}catch{}return 0}
function setStatus(type,text){const el=$('status');if(!el)return;el.className='status '+(type||'');el.innerHTML=`<span class="dot"></span>${text}`}
async function loadForecast(force=false){if(!force&&state.lastLoad&&Date.now()-state.lastLoad<60000)return;setStatus('','sincronizando previsão…');let marine=null,wind=null,primary=true;try{[marine,wind]=await Promise.all([fetchJSON(marineURL(false)),fetchWindForecast()])}catch(err){console.warn('Primary forecast failed',err);primary=false;try{[marine,wind]=await Promise.all([fetchJSON(marineURL(true)),fetchJSON(windURL(true))])}catch(fallbackErr){console.warn('Fallback forecast failed',fallbackErr)}}try{state.tides=await fetchJSON('tides.json?v='+Date.now(),7000);localStorage.setItem('code_tides_cache',JSON.stringify(state.tides))}catch{try{state.tides=JSON.parse(localStorage.getItem('code_tides_cache')||'null')}catch{state.tides=null}}if(marine?.hourly?.time?.length&&wind?.hourly?.time?.length){state.marine=marine;state.wind=wind;state.sourceMode=primary?'primary':'fallback';state.lastLoad=Date.now();cacheForecast();const ix=nearestIndex(marine.hourly.time);const today=marine.hourly.time[ix].slice(0,10);if(!state.selectedDay||!marine.hourly.time.some(v=>v.startsWith(state.selectedDay)))state.selectedDay=today;renderForecast();setStatus('ok',`AO VIVO · atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${primary?(wind.codeWind?.degraded?' · modelos de vento reduzidos':''):' · fonte alternativa'}`);return}const saved=loadCachedForecast();if(state.marine){const ix=nearestIndex(state.marine.hourly.time),today=state.marine.hourly.time[ix].slice(0,10);if(!state.selectedDay)state.selectedDay=today;renderForecast();setStatus('cache',`SEM CONEXÃO · exibindo última previsão salva${saved?' de '+new Date(saved).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}`)}else setStatus('err','PREVISÃO INDISPONÍVEL · toque em atualizar')}
function renderForecast(){renderDays();renderSelectedDay();renderRegisterCapture()}
function renderDays(){const h=state.marine?.hourly;if(!h)return;const by={};h.time.forEach((t,i)=>(by[t.slice(0,10)]??=[]).push(i));const today=h.time[nearestIndex(h.time)].slice(0,10);$('days').innerHTML=Object.entries(by).slice(0,7).map(([day])=>{const i=nearestInDay(h.time,day,12);if(i<0)return'';const wave=h.wave_height[i],p=periodAt(i),label=day===today?'HOJE':dayName(day).toUpperCase(),rating=dayStars(day);return`<button class="day-card ${day===state.selectedDay?'active':''}" data-day="${day}"><span class="day-name">${label}</span><span class="wave-glyph">≈</span><b>${fmt(wave)} m</b><div class="day-meta">${dir(h.wave_direction[i])} · ${fmt(p,0)}s</div><div class="day-stars" aria-label="${rating} de 5 estrelas">${starsText(rating)}</div></button>`}).join('');$('days').querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{state.selectedDay=b.dataset.day;renderSelectedDay();renderDays()})}
function selectedIndex(){const h=state.marine.hourly.time,today=h[nearestIndex(h)].slice(0,10);return state.selectedDay===today?nearestIndex(h):nearestInDay(h,state.selectedDay,12)}
function renderSelectedDay(){if(!state.marine||!state.wind)return;const i=selectedIndex();if(i<0)return;const h=state.marine.hourly,ts=h.time[i],wi=windIndex(ts),wave=Number(h.wave_height[i]),waveDir=Number(h.wave_direction[i]),p=periodAt(i),wind=Number(state.wind.hourly.wind_speed_10m[wi]),windDir=Number(state.wind.hourly.wind_direction_10m[wi]),gust=Number(state.wind.hourly.wind_gusts_10m[wi]),e=energy(wave),tide=tideValue(ts),today=h.time[nearestIndex(h.time)].slice(0,10),isToday=state.selectedDay===today,overall=overallQuality(wave,p,wind,windDir,e),tideState=tideStatus(ts);state.latest={wave,waveDir,period:p,wind,windDir,gust,energy:e,tide,ts};$('selectedMoment').textContent=isToday?'HOJE · AGORA':dayName(state.selectedDay,true).toUpperCase()+' · 12H';$('selectedTitle').textContent=isToday?'Condições atuais':'Referência do dia';$('conditionPill').className='condition-pill '+overall.cls;$('conditionPill').textContent=overall.text;setMetric('waveCard','wave',fmt(wave)+' m','','wave',wave);$('swellDir').textContent=dir(waveDir);$('swellDirDeg').innerHTML=fmt(waveDir,0)+'° '+directionArrow(waveDir);setMetric('periodCard','period',fmt(p,0)+' s','','period',p);setMetric('windCard','wind',fmt(wind,0)+' kt',`${dir(windDir)} · ${fmt(windDir,0)}° · ${quality('wind',wind,windDir)?.label||''}`,'wind',wind,windDir);$('windCard').querySelector('.metric-sub').innerHTML=`${dir(windDir)} · ${fmt(windDir,0)}° ${directionArrow(windDir)} · ${quality('wind',wind,windDir)?.label||''}`;setMetric('energyCard','energy',fmt(e,0),'J/m²','energy',e);$('tideNow').textContent=Number.isFinite(Number(tide))?`${fmt(tide,2)} m${tideState?' '+(tideState.rising?'↑':'↓'):''}`:'—';const tideSub=$('tideCard')?.querySelector('.metric-sub');if(tideSub)tideSub.textContent=tideState?`${tideState.rising?'subindo':'descendo'} · ${tideState.nextType} ${tideState.nextTime}`:'tábua astronômica';$('dayTitle').textContent=dayName(state.selectedDay,true);$('summarySource').textContent=state.sourceMode==='primary'?`GFS-Wave 0,25° · ${fmt(state.marine.latitude,2)}, ${fmt(state.marine.longitude,2)} + CODE Vento`:'fonte alternativa / cache';renderMatrix();drawTide();renderRegisterCapture()}
function setMetric(cardId,valueId,value,sub,kind,n,dirDeg=null){const card=$(cardId),v=$(valueId);v.textContent=value;card.querySelector('.metric-sub').textContent=sub;card.style.removeProperty('background');card.style.removeProperty('color');card.querySelectorAll('small,.metric-sub,strong').forEach(el=>el.style.removeProperty('color'))}
function dayIndices(day){const times=state.marine.hourly.time;return times.map((t,i)=>[t,i]).filter(([t])=>{const hh=Number(t.slice(11,13));return t.startsWith(day)&&hh>=3&&hh<=23&&hh%2===1})}
function renderMatrix(){const rows=dayIndices(state.selectedDay);if(!rows.length){$('dayMatrix').innerHTML='<div class="empty">Sem dados para este dia.</div>';return}const H=state.marine.hourly,W=state.wind.hourly,head=rows.map(([t])=>`<th>${t.slice(11,13)}h</th>`).join('');const mk=(label,icon,valFn,styleFn)=>`<tr><td><span class="row-icon">${icon}</span>${label}</td>${rows.map(([t,i])=>`<td class="${styleFn?'quality-cell':''}"${styleFn?` style="${styleFn(t,i)}"`:''}>${valFn(t,i)}</td>`).join('')}</tr>`;let html=`<table class="forecast-table"><thead><tr><th>HORA</th>${head}</tr></thead><tbody>`;html+=mk('Ondulação','≈',(t,i)=>fmt(H.wave_height[i])+' m');html+=mk('Dir. onda','↗',(t,i)=>dir(H.wave_direction[i])+' '+fmt(H.wave_direction[i],0)+'°');html+=mk('Período','◷',(t,i)=>fmt(periodAt(i),0)+' s');html+=mk('Vento','≋',(t,i)=>{const wi=windIndex(t);return fmt(W.wind_speed_10m[wi],0)+' kt'});html+=mk('Rajadas','»',(t,i)=>{const wi=windIndex(t);return fmt(W.wind_gusts_10m[wi],0)+' kt'});html+=mk('Dir. vento','→',(t,i)=>{const wi=windIndex(t),d=W.wind_direction_10m[wi];return dir(d)+' '+fmt(d,0)+'°'});html+=mk('Energia','ϟ',(t,i)=>fmt(energy(H.wave_height[i]),0)+' J/m²');html+=mk('Maré','∿',(t,i)=>{const v=tideValue(t);return Number.isFinite(Number(v))?fmt(v,2)+' m':'—'});html+='</tbody></table>';$('dayMatrix').innerHTML=html}
function tideEvents(day){return state.tides?.events?.[day]||[]}
function tideEventMs(day,e){return new Date(`${day}T${e.time}:00-03:00`).getTime()}
function tideSeries(day){return[dayPlus(day,-1),day,dayPlus(day,1)].flatMap(d=>tideEvents(d).map(e=>({...e,day:d,ms:tideEventMs(d,e)}))).sort((a,b)=>a.ms-b.ms)}
function tideAtMs(ms,day){const a=tideSeries(day);if(!a.length)return null;let left=null,right=null;for(const e of a){if(e.ms<=ms)left=e;if(e.ms>=ms){right=e;break}}if(!left)return right?.height??null;if(!right)return left.height;if(left.ms===right.ms)return Number(left.height);const u=clamp((ms-left.ms)/(right.ms-left.ms)),ease=(1-Math.cos(Math.PI*u))/2;return Number(left.height)+(Number(right.height)-Number(left.height))*ease}
function tideValue(ts){if(!state.tides||!ts)return null;return tideAtMs(localDate(ts).getTime(),ts.slice(0,10))}
function tideStatus(ts){if(!state.tides||!ts)return null;const day=ts.slice(0,10),ms=localDate(ts).getTime(),series=tideSeries(day),next=series.find(e=>e.ms>ms);if(!next)return null;const now=tideAtMs(ms,day),later=tideAtMs(ms+10*60*1000,day),rising=Number.isFinite(now)&&Number.isFinite(later)?later>=now:next.type==='high';return{rising,nextType:next.type==='high'?'cheia':'baixa',nextTime:next.time,nextHeight:Number(next.height)}}
// Pointer Events cover touch dragging on iPhone and mouse interaction.
function bindTideProbe(svg,{day,start,W,H,y}){
  const probe=svg.querySelector('.tide-probe'),line=probe.querySelector('line'),dot=probe.querySelector('circle'),box=probe.querySelector('rect'),label=probe.querySelector('text');
  let activePointer=null;
  const show=e=>{
    const bounds=svg.getBoundingClientRect();if(!bounds.width)return;
    const minute=Math.round(clamp((e.clientX-bounds.left)/bounds.width)*1440),x=minute/1440*W,value=tideAtMs(start+minute*60000,day);
    if(!Number.isFinite(value)){probe.setAttribute('visibility','hidden');return}
    const yy=y(value),boxX=clamp(x-61,4,W-126),boxY=yy>H/2?8:H-34;
    line.setAttribute('x1',x);line.setAttribute('x2',x);dot.setAttribute('cx',x);dot.setAttribute('cy',yy);
    box.setAttribute('x',boxX);box.setAttribute('y',boxY);label.setAttribute('x',boxX+61);label.setAttribute('y',boxY+17);
    label.textContent=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')} · ${value.toFixed(2).replace('.',',')} m`;
    probe.setAttribute('visibility','visible');
  };
  svg.onpointerdown=e=>{if(activePointer!==null)return;activePointer=e.pointerId;svg.setPointerCapture(e.pointerId);show(e)};
  svg.onpointermove=e=>{if(e.pointerId===activePointer||(activePointer===null&&e.pointerType==='mouse'))show(e)};
  svg.onpointerup=e=>{if(e.pointerId!==activePointer)return;show(e);activePointer=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId)};
  svg.onpointercancel=()=>{activePointer=null;probe.setAttribute('visibility','hidden')};
}
function drawTide(){const day=state.selectedDay,ev=tideEvents(day),svg=$('tideChart');$('tideDayLabel').textContent=dayName(day,true);if(!ev.length){svg.innerHTML='';svg.onpointerdown=svg.onpointermove=svg.onpointerup=svg.onpointercancel=null;$('tideRange').textContent='sem tábua para este dia';return}const start=new Date(`${day}T00:00:00-03:00`).getTime(),W=640,H=170,s=[];for(let i=0;i<=96;i++){const ms=start+i*15*60*1000,v=tideAtMs(ms,day);if(Number.isFinite(v))s.push([v,i/96*W])}const vals=s.map(x=>x[0]),min=Math.min(...vals),max=Math.max(...vals),pad=Math.max(.06,(max-min)*.12),lo=min-pad,hi=max+pad,y=v=>H-22-(v-lo)/(hi-lo)*(H-42),path=s.map(([v,x],i)=>(i?'L':'M')+x.toFixed(1)+','+y(v).toFixed(1)).join(' '),fill=path+` L ${W},${H-18} L 0,${H-18} Z`,marks=ev.map(e=>{const [hh,mm]=e.time.split(':').map(Number),x=(hh*60+mm)/1440*W,yy=y(Number(e.height)),cx=clamp(x,31,W-31),boxY=e.type==='high'?Math.max(4,yy-36):Math.min(H-31,yy+8),heightText=`${fmt(e.height,2)} m`;return`<circle cx="${x}" cy="${yy}" r="3.2" fill="#e9fbff"/><rect x="${cx-29}" y="${boxY}" width="58" height="27" rx="7" fill="rgba(7,20,30,.94)" stroke="rgba(102,199,255,.32)" stroke-width=".8"/><text x="${cx}" y="${boxY+10}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#dff5ff">${e.time}</text><text x="${cx}" y="${boxY+21}" text-anchor="middle" font-size="8" fill="#9fc3d4">${heightText}</text>`}).join('');svg.innerHTML=`<path d="${fill}" fill="rgba(77,180,255,.10)"/><path d="${path}" fill="none" stroke="#66c7ff" stroke-width="2.2" vector-effect="non-scaling-stroke"/>${marks}<g class="tide-probe" visibility="hidden" pointer-events="none"><line y1="0" y2="170" stroke="#5fe9df" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><circle r="4" fill="#5fe9df" stroke="#061019" stroke-width="2"/><rect width="122" height="26" rx="7" fill="#07141e" stroke="#5fe9df"/><text text-anchor="middle" font-size="12" font-weight="700" fill="#e9fbff"></text></g>`;bindTideProbe(svg,{day,start,W,H,y});$('tideRange').textContent=`${fmt(min,2)}–${fmt(max,2)} m`;$('tideSource').textContent=`${state.tides?.source||'tábua astronômica'} · alturas positivas no datum da tábua`}
function spotImage(i){const imgs=['https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=500&q=80','https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=500&q=80','https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=500&q=80','https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=500&q=80'];return imgs[i%imgs.length]}
function confidenceFor(spot){const all=storage.sessions().filter(s=>s.spotId===spot.id),good=all.filter(s=>Number(s.score)>=8),base=spot.seed?12:0;return Math.min(95,base+good.length*12+all.length*2)}
function avgFor(spot){const a=storage.sessions().filter(s=>s.spotId===spot.id).map(s=>Number(s.score)).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function plural(n,one,many){return Number(n)===1?one:many}
function updateSpotsEditUI(){const btn=$('editSpots'),hint=$('spotsEditHint'),list=$('spotsList');if(btn){btn.classList.toggle('active',state.spotsEditMode);btn.setAttribute('aria-pressed',state.spotsEditMode?'true':'false');btn.setAttribute('aria-label',state.spotsEditMode?'Concluir edição':'Editar picos')}if(hint)hint.classList.toggle('hidden',!state.spotsEditMode);if(list)list.classList.toggle('editing',state.spotsEditMode)}
function toggleSpotsEditMode(){state.spotsEditMode=!state.spotsEditMode;renderSpots()}
function renderSpots(){const list=$('spotsList'),spots=storage.spots(),sess=storage.sessions();updateSpotsEditUI();list.innerHTML=spots.length?spots.map((s,i)=>{const avg=avgFor(s),conf=confidenceFor(s),count=sess.filter(x=>x.spotId===s.id).length,countText=count?`${count} ${plural(count,'sessão registrada','sessões registradas')}`:'Nenhuma sessão registrada';return`<button class="spot-card spot-card-button${state.spotsEditMode?' edit-mode':''}" data-spot="${s.id}" type="button" aria-label="${state.spotsEditMode?'Editar':'Abrir'} ${esc(s.name)}"><span class="spot-thumb" style="--spot-img:url('${s.photo||spotImage(i)}')"></span><span class="spot-main"><b>${esc(s.name)}</b><small>${countText}${Number.isFinite(Number(s.lat))?' · localização salva':''}</small><span class="spot-rating"><span>${Number.isFinite(avg)?stars(Math.round(avg/2)):'☆☆☆☆☆'}</span><span class="confidence-num">Confidence ${conf}%</span></span></span>${state.spotsEditMode?'<span class="edit-indicator" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg></span>':'<span class="spot-chevron" aria-hidden="true">›</span>'}</button>`}).join(''):'<div class="empty">Nenhum pico cadastrado.<br>Crie o primeiro e marque o ponto no mapa.</div>';list.querySelectorAll('[data-spot]').forEach(el=>el.onclick=()=>state.spotsEditMode?openSpotEditor(el.dataset.spot):openSpot(el.dataset.spot));renderSpotSelect();renderAlerts();updateSpotsEditUI()}
function stars(n){return'★★★★★'.split('').map((x,i)=>i<n?'★':'☆').join('')}
function renderSpotSelect(){const sel=$('spotSelect'),spots=storage.spots();if(!sel)return;sel.innerHTML=spots.length?spots.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join(''):'<option value="">Nenhum pico cadastrado</option>';sel.disabled=!spots.length;if(state.currentSpotId&&spots.some(s=>s.id===state.currentSpotId))sel.value=state.currentSpotId;$('noSpot').classList.toggle('hidden',!!spots.length);$('saveSession').disabled=!spots.length;$('saveSession').style.opacity=spots.length?'1':'.45';renderRegisterCapture()}
function openSpot(id){state.currentSpotId=id;localStorage.setItem('code_current_spot',id);renderSpotDetail();location.hash='spot'}
function learnedRange(arr,key,d=1,u=''){const v=arr.map(x=>Number(x[key])).filter(Number.isFinite);return v.length?`${Math.min(...v).toFixed(d)}–${Math.max(...v).toFixed(d)}${u}`:'Dados insuficientes'}
function renderSpotDetail(){const spot=storage.spots().find(s=>s.id===state.currentSpotId);if(!spot){$('spotTitle').textContent='Pico';return}const all=storage.sessions().filter(s=>s.spotId===spot.id),good=all.filter(s=>Number(s.score)>=8),conf=confidenceFor(spot),avg=avgFor(spot),seed=spot.seed||null;$('spotTitle').textContent=spot.name;const cover=document.querySelector('#spot .cover');if(cover)cover.style.backgroundImage=`linear-gradient(180deg,rgba(5,15,22,.08),rgba(3,10,15,.34)),url('${spot.photo||spotImage(storage.spots().findIndex(x=>x.id===spot.id))}')`;$('spotScore').textContent=Number.isFinite(avg)?avg.toFixed(1):'—';$('spotSessionCount').textContent=all.length?`${all.length} ${plural(all.length,'sessão registrada','sessões registradas')}`:'Nenhuma sessão registrada';$('spotConf').textContent=`Confidence ${conf}%`;if($('codeConfValue'))$('codeConfValue').textContent=conf+'%';$('confBar').style.width=conf+'%';$('codeOrigin').textContent=good.length?`CODE atualizado com ${good.length} ${plural(good.length,'sessão de alta qualidade','sessões de alta qualidade')}${seed?' · norte inicial ainda considerado':''}`:seed?'Ponto de partida: norte inicial cadastrado · baixa confiança':'Ainda sem dados suficientes para formar o CODE.';if(good.length){$('learnWave').textContent=learnedRange(good,'wave',1,' m');$('learnPeriod').textContent=learnedRange(good,'period',0,' s');$('learnWind').textContent=learnedRange(good,'wind',0,' kt');$('learnEnergy').textContent=learnedRange(good,'energy',0,' J/m²')}else if(seed){const rr=(a,b,u='')=>a!=null||b!=null?`${a??'—'}${b!=null?'–'+b:''}${u}`:'Dados insuficientes';$('learnWave').textContent=rr(seed.waveMin,seed.waveMax,' m')+(seed.swellDir?' · '+seed.swellDir:'');$('learnPeriod').textContent=rr(seed.periodMin,seed.periodMax,' s');$('learnWind').textContent=(seed.windDir||'—')+(seed.windMax!=null?' · até '+seed.windMax+' kt':'');$('learnEnergy').textContent='—'}else['learnWave','learnPeriod','learnWind','learnEnergy'].forEach(id=>$(id).textContent='Dados insuficientes');$('history').innerHTML=all.length?all.slice().reverse().map(s=>{const waveText=`${fmt(s.wave)} m · ${dir(s.waveDir)} ${fmt(s.waveDir,0)}°`,periodText=`${fmt(s.period,0)} s`,windText=`${dir(s.windDir)} · ${fmt(s.wind,0)} kt`,energyText=`${fmt(s.energy,0)} J/m²`;return`<article class="history-item"><div class="history-head"><div><b>${esc(s.date)}${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s.ts||'')?' · '+esc(s.ts.slice(11,16)):''}</b><small>${s.registeredBy?'por '+esc(s.registeredBy):'Sessão registrada'}</small></div><span class="history-score">${esc(s.score)}/10</span></div><div class="history-grid"><div><span>Ondulação</span><b>${waveText}</b></div><div><span>Período</span><b>${periodText}</b></div><div><span>Vento</span><b>${windText}</b></div><div><span>Energia</span><b>${energyText}</b></div></div>${sessionAuditMarkup(s)}${s.size?`<div class="history-observed"><span>Tamanho observado</span><b>${esc(s.size)}</b></div>`:''}${s.comment?`<div class="history-comment">${esc(s.comment)}</div>`:''}</article>`}).join(''):'<div class="history-empty">Nenhuma sessão registrada neste pico.</div>';$('overviewBest').innerHTML=`<div class="row"><span>Ondulação</span><b>${esc($('learnWave').textContent)}</b></div><div class="row"><span>Período</span><b>${esc($('learnPeriod').textContent)}</b></div><div class="row"><span>Vento</span><b>${esc($('learnWind').textContent)}</b></div>`}
function showSpotTab(name){document.querySelectorAll('.spot-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.spot-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===name))}
function updateSpotPhotoPreview(photo){const el=$('spotPhotoPreview');if(!el)return;if(photo){el.style.backgroundImage=`linear-gradient(180deg,rgba(5,15,22,.04),rgba(3,10,15,.18)),url('${photo}')`;el.classList.add('has-photo')}else{el.style.backgroundImage='';el.classList.remove('has-photo')}}
function compressSpotPhoto(file){return new Promise((resolve,reject)=>{if(!file||!file.type?.startsWith('image/'))return reject(new Error('invalid image'));const reader=new FileReader();reader.onerror=()=>reject(new Error('read failed'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('image failed'));img.onload=()=>{const max=1100,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',.78))};img.src=reader.result};reader.readAsDataURL(file)})}
async function chooseSpotPhoto(file){if(!file)return;try{const photo=await compressSpotPhoto(file);state.pendingSpotPhoto=photo;updateSpotPhotoPreview(photo)}catch{alert('Não consegui usar essa imagem. Escolha uma foto JPG, PNG ou HEIC compatível com o navegador.')}finally{if($('spotPhotoInput'))$('spotPhotoInput').value=''}}
function openSpotEditor(id=null){state.editingSpotId=id;const spot=storage.spots().find(s=>s.id===id),seed=spot?.seed||{};state.pendingSpotPhoto=spot?.photo||null;updateSpotPhotoPreview(state.pendingSpotPhoto);if($('chooseSpotPhoto'))$('chooseSpotPhoto').textContent=spot?'ALTERAR FOTO':'ESCOLHER FOTO';$('modalTitle').textContent=spot?'Editar pico':'Novo pico';$('spotName').value=spot?.name||'';$('spotLat').value=spot?.lat??'';$('spotLon').value=spot?.lon??'';$('seedWaveMin').value=seed.waveMin??'';$('seedWaveMax').value=seed.waveMax??'';$('seedPeriodMin').value=seed.periodMin??'';$('seedPeriodMax').value=seed.periodMax??'';$('seedSwellDir').value=seed.swellDir??'';$('seedWindDir').value=seed.windDir??'';$('seedWindMax').value=seed.windMax??'';$('seedNote').value=seed.note??'';updateLocationSummary();$('deleteSpotInModal').classList.toggle('hidden',!spot);$('spotModal').classList.add('show');setTimeout(()=>$('spotName').focus(),50)}
function closeSpotEditor(){$('spotModal').classList.remove('show');state.editingSpotId=null;state.pendingSpotPhoto=null}
function numField(id){const v=$(id).value.trim().replace(',','.');return v===''?null:Number(v)}
async function saveSpot(){
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
    state.spotsEditMode=false;
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
function updateLocationSummary(){const lat=$('spotLat').value,lon=$('spotLon').value,ok=lat!==''&&lon!=='';$('spotLocationSummary').classList.toggle('marked',ok);$('spotLocationSummary').textContent=ok?`Ponto marcado · ${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`:'Nenhum local marcado'}
function openMap(){const lat=Number($('spotLat').value),lon=Number($('spotLon').value),has=$('spotLat').value!==''&&$('spotLon').value!==''&&Number.isFinite(lat)&&Number.isFinite(lon);state.pendingPoint=has?{lat,lon}:null;$('mapResults').innerHTML='';$('mapSearch').value='';$('mapModal').classList.add('show');setTimeout(()=>{if(!window.L){$('mapCoords').textContent='Mapa indisponível. Tente novamente em alguns segundos.';return}if(!state.map){state.map=L.map('mapCanvas',{zoomControl:true}).setView(has?[lat,lon]:[CFG.lat,CFG.lon],has?16:11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.map);state.map.on('click',e=>setMapPoint(e.latlng.lat,e.latlng.lng,'Ponto marcado'))}else{state.map.invalidateSize();state.map.setView(has?[lat,lon]:[CFG.lat,CFG.lon],has?16:11)}if(has)setMapPoint(lat,lon,'Ponto atual');else{$('mapCoords').textContent='Busque uma praia ou toque no mapa para marcar o pico.';if(state.mapMarker){state.map.removeLayer(state.mapMarker);state.mapMarker=null}}},120)}
function closeMap(){$('mapModal').classList.remove('show')}
function setMapPoint(lat,lon,label='Ponto marcado'){lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;state.pendingPoint={lat,lon};if(state.map){if(!state.mapMarker)state.mapMarker=L.marker([lat,lon]).addTo(state.map);else state.mapMarker.setLatLng([lat,lon]);state.map.panTo([lat,lon])}$('mapCoords').textContent=`${label} · ${lat.toFixed(6)}, ${lon.toFixed(6)}`}
async function searchMap(){const q=$('mapSearch').value.trim();if(!q)return;$('mapSearchBtn').textContent='…';$('mapResults').innerHTML='<div class="hintbox">Buscando…</div>';try{const data=await fetchJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=pt-BR&countrycodes=br&q='+encodeURIComponent(q),10000);if(!data.length){$('mapResults').innerHTML='<div class="hintbox">Nenhum resultado. Tente incluir Ubatuba ou o nome da praia.</div>';return}$('mapResults').innerHTML=data.map((x,i)=>`<button class="map-result" data-map-result="${i}" type="button">${esc(x.display_name)}</button>`).join('');$('mapResults').querySelectorAll('[data-map-result]').forEach(b=>b.onclick=()=>{const x=data[Number(b.dataset.mapResult)],lat=Number(x.lat),lon=Number(x.lon);setMapPoint(lat,lon,x.display_name.split(',').slice(0,2).join(','));state.map.setView([lat,lon],16);$('mapResults').innerHTML=''})}catch{$('mapResults').innerHTML='<div class="hintbox">Não consegui buscar agora. Você ainda pode navegar e tocar diretamente no mapa.</div>'}finally{$('mapSearchBtn').textContent='BUSCAR'}}
function surfToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:CFG.tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
const SESSION_FIELDS={wave:{label:'Ondulação',unit:'m',decimals:2,min:0,max:30},waveDir:{label:'Direção da ondulação',unit:'°',decimals:0,min:0,max:360},period:{label:'Período',unit:'s',decimals:1,min:.1,max:40},wind:{label:'Vento',unit:'nós',decimals:1,min:0,max:200},windDir:{label:'Direção do vento',unit:'°',decimals:0,min:0,max:360},gust:{label:'Rajadas',unit:'nós',decimals:1,min:0,max:250,optional:true},energy:{label:'Energia',unit:'J/m²',decimals:0,min:0,max:1000000},tide:{label:'Maré',unit:'m',decimals:2,min:-10,max:10,optional:true}};
function sessionInputValue(key,value){return value===null||value===undefined||!Number.isFinite(Number(value))?'':Number(Number(value).toFixed(SESSION_FIELDS[key].decimals)).toString().replace('.',',')}
function sessionFieldText(key,value){if(value===null||value===undefined||!Number.isFinite(Number(value)))return'—';return(key==='waveDir'||key==='windDir'?dir(value)+' ':'')+sessionInputValue(key,value)+' '+SESSION_FIELDS[key].unit}
function adjustedSessionCapture(original,edits){
  if(!original)return{capture:null,error:''};
  const capture={...original},changes={};
  for(const [key,raw] of Object.entries(edits)){
    const field=SESSION_FIELDS[key];if(!field)continue;
    const text=String(raw).trim().replace(',','.'),value=text===''&&field.optional?null:Number(text);
    if((text===''&&!field.optional)||(value!==null&&(!Number.isFinite(value)||value<field.min||value>field.max)))return{capture:null,error:field.label+': informe um valor entre '+field.min+' e '+field.max+'.'};
    capture[key]=(key==='waveDir'||key==='windDir')&&value===360?0:value;
  }
  if(capture.wave!==original.wave&&!Object.hasOwn(edits,'energy'))capture.energy=energy(capture.wave);
  for(const key of Object.keys(SESSION_FIELDS))if(capture[key]!==original[key])changes[key]={from:original[key],to:capture[key],source:key==='energy'&&!Object.hasOwn(edits,'energy')?'calculated-from-wave':'manual'};
  capture.originalForecast=JSON.parse(JSON.stringify(original));
  capture.manualAdjustments=Object.keys(changes).length?{fields:changes,by:currentUserName(),at:new Date().toISOString()}:null;
  return{capture,error:''};
}
function resetSessionDraft(){state.registerOriginal=null;state.registerEdits={};state.registerError='';state.sessionEditing=false}
function editSessionField(key,value){
  if(!state.registerOriginal)return;
  if(!state.registerTs)state.registerTs=state.registerOriginal.ts;
  if(value===sessionInputValue(key,state.registerOriginal[key]))delete state.registerEdits[key];else state.registerEdits[key]=value;
  renderRegisterCapture(false);
}
// Forecast directions report where wind/waves come FROM; arrows point toward their travel direction, as in WG.
function directionArrow(value){
  if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return'';
  const degrees=((Number(value)%360)+360)%360;
  return `<svg class="direction-arrow" viewBox="0 0 24 24" role="img" aria-label="Vem de ${dir(degrees)} ${fmt(degrees,0)} graus" style="transform:rotate(${(degrees+180)%360}deg)"><path d="M12 21V3M5 10l7-7 7 7"/></svg>`;
}
function toggleSessionEditing(){
  if(!state.registerOriginal||state.sessionSaving)return;
  if(state.sessionEditing&&state.registerError){document.querySelector('[data-session-edit][aria-invalid="true"]')?.focus();return}
  state.sessionEditing=!state.sessionEditing;renderRegisterCapture(false);
}
function sessionAuditMarkup(session){
  const fields=session.manualAdjustments?.fields;if(!fields||!Object.keys(fields).length)return'';
  return'<details class="history-audit"><summary>Ajustado manualmente</summary>'+Object.entries(fields).filter(([key])=>SESSION_FIELDS[key]).map(([key,change])=>'<div class="row"><span>'+esc(SESSION_FIELDS[key].label)+'</span><b>'+esc(sessionFieldText(key,change.from))+' → '+esc(sessionFieldText(key,change.to))+'</b></div>').join('')+(session.manualAdjustments.by?'<small>Ajustado por '+esc(session.manualAdjustments.by)+'</small>':'')+'</details>';
}
let windguruLoaded=false;
function showForecastTab(name){
  const code=name!=='windguru';$('codeForecastPanel').hidden=!code;$('windguruForecastPanel').hidden=code;
  for(const [id,active] of [['codeForecastTab',code],['windguruForecastTab',!code]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-selected',String(active))}
  if(!code)loadWindguruWidget();
}
function loadWindguruWidget(){
  if(windguruLoaded)return;windguruLoaded=true;
  const uid='wg_fwdg_185085_100_1791428441581',host=$('windguruWidget'),anchor=document.createElement('script');anchor.id=uid;host.appendChild(anchor);
  const params=new URLSearchParams({s:'185085',m:'100',mw:'83',uid,wj:'knots',tj:'c',waj:'m',tij:'cm',odh:'0',doh:'24',fhours:'168',hrsm:'2',vt:'forecasts',lng:'pt',idbs:'1',ts:'2',p:'WINDSPD,GUST,SMER,HTSGW,PERPW,DIRPW'}),script=document.createElement('script');
  script.src='https://www.windguru.cz/js/widget.php?'+params;script.async=true;
  $('windguruWidgetStatus').hidden=false;$('windguruWidgetStatus').textContent='Carregando Windguru…';
  script.onload=()=>{$('windguruWidgetStatus').textContent='';$('windguruWidgetStatus').hidden=true;host.querySelector('iframe')?.setAttribute('title','Previsão oficial Windguru de Ubatuba, com maré')};
  script.onerror=()=>{$('windguruWidgetStatus').hidden=false;$('windguruWidgetStatus').textContent='Windguru indisponível. Use Abrir WG ↗';windguruLoaded=false;host.replaceChildren()};
  host.insertBefore(script,anchor);
}

function sessionForecastAt(ts){
  const H=state.marine?.hourly,W=state.wind?.hourly;
  if(!H||!W||!ts||localDate(ts).getTime()>Date.now())return null;
  const i=H.time.indexOf(ts),wi=W.time.indexOf(ts);if(i<0||wi<0)return null;
  const number=v=>v===null||v===undefined||v===''?null:Number(v);
  const x={wave:number(H.wave_height[i]),waveDir:number(H.wave_direction[i]),period:periodAt(i),wind:number(W.wind_speed_10m[wi]),windDir:number(W.wind_direction_10m[wi]),gust:number(W.wind_gusts_10m[wi])};
  if(!['wave','waveDir','period','wind','windDir'].every(k=>Number.isFinite(x[k]))||x.period<=0)return null;
  return {...x,energy:energy(x.wave),tide:tideValue(ts),ts,forecast:forecastMetadata(ts)};
}
function sessionHours(day){return (state.marine?.hourly?.time||[]).filter(ts=>ts.startsWith(day)&&sessionForecastAt(ts))}
function renderSessionTime(){
  const daySelect=$('sessionDay'),hourSelect=$('sessionHour');if(!daySelect||!hourSelect)return;
  const today=surfToday();if(!state.registerDay)state.registerDay=today;
  const days=[...new Set([today,state.registerDay,...(state.marine?.hourly?.time||[]).map(ts=>ts.slice(0,10)).filter(day=>day<=today)])].sort().reverse();
  daySelect.innerHTML=days.map(day=>`<option value="${esc(day)}">${day===today?'Hoje · ':''}${day.split('-').reverse().join('/')}</option>`).join('');daySelect.value=state.registerDay;
  const hours=sessionHours(state.registerDay),current=hours.at(-1),options=[];
  if(state.registerDay===today&&current)options.push(`<option value="">Agora · ${current.slice(11,16)}</option>`);
  if(state.registerDay!==today&&!state.registerTs)state.registerTs=current||'';
  if(state.registerTs&&!hours.includes(state.registerTs))options.push(`<option value="${esc(state.registerTs)}" disabled>${esc(state.registerTs.slice(11,16))} · indisponível</option>`);
  options.push(...hours.map(ts=>`<option value="${esc(ts)}">${ts.slice(11,16)}</option>`));
  hourSelect.innerHTML=options.join('')||'<option value="">Sem previsão disponível</option>';hourSelect.value=state.registerTs;hourSelect.disabled=!hours.length;
}
function renderRegisterCapture(updateTime=true){
  if(updateTime)renderSessionTime();
  const ts=state.registerTs||sessionHours(state.registerDay).at(-1),base=sessionForecastAt(ts);
  if(state.registerOriginal?.ts!==ts){resetSessionDraft();state.registerOriginal=base}
  else if(!Object.keys(state.registerEdits).length)state.registerOriginal=base;
  const result=adjustedSessionCapture(state.registerOriginal,state.registerEdits),x=result.capture;state.registerCapture=x;state.registerError=result.error;
  const shown=x||state.registerOriginal;
  $('rs').textContent=shown?fmt(shown.wave)+' m':'—';$('rd').textContent=shown?dir(shown.waveDir):'—';$('rp').textContent=shown?fmt(shown.period,0)+' s':'—';$('rw').textContent=shown?fmt(shown.wind,0)+' kt':'—';$('re').textContent=shown?fmt(shown.energy,0)+' J/m²':'—';$('rt').textContent=Number.isFinite(shown?.tide)?fmt(shown.tide,2)+' m':'—';
  $('sessionWaveDirection').innerHTML=shown?`${fmt(shown.waveDir,0)}° ${directionArrow(shown.waveDir)}`:'';
  $('sessionWindDirection').innerHTML=shown?`${dir(shown.windDir)} · ${fmt(shown.windDir,0)}° ${directionArrow(shown.windDir)}`:'';
  $('sessionConditions').classList.toggle('editing',state.sessionEditing);
  $('editSessionConditions').setAttribute('aria-pressed',String(state.sessionEditing));$('editSessionConditions').setAttribute('aria-label',state.sessionEditing?'Concluir edição das condições':'Editar condições da sessão');$('editSessionConditions').disabled=!state.registerOriginal||state.sessionSaving;
  document.querySelectorAll('#sessionConditions .session-value').forEach(el=>el.hidden=state.sessionEditing);
  for(const key of Object.keys(SESSION_FIELDS)){
    const input=$('sessionEdit-'+key);if(!input)continue;input.hidden=!state.sessionEditing;input.disabled=!state.registerOriginal||state.sessionSaving;
    if(document.activeElement!==input)input.value=Object.hasOwn(state.registerEdits,key)?state.registerEdits[key]:sessionInputValue(key,(x||state.registerOriginal)?.[key]);
    input.setAttribute('aria-invalid',result.error&&result.error.startsWith(SESSION_FIELDS[key].label+':')?'true':'false');
  }
  const changed=!!x?.manualAdjustments,status=$('sessionEditStatus');if(status){status.className='session-edit-status'+(result.error?' invalid':changed?' adjusted':'');status.hidden=!result.error&&!changed;status.textContent=result.error||(changed?'Condições ajustadas.':'')}
  if($('resetSessionForecast'))$('resetSessionForecast').hidden=!Object.keys(state.registerEdits).length;
  if($('sessionForecastMoment'))$('sessionForecastMoment').textContent=state.registerOriginal?`Previsão de ${state.registerOriginal.ts.slice(0,10).split('-').reverse().join('/')} às ${state.registerOriginal.ts.slice(11,16)} · horário de Ubatuba`:'Não há previsão completa para esse horário. Atualize a previsão ou escolha outro horário.';
  const btn=$('saveSession');if(btn){btn.disabled=state.sessionSaving||!x||!storage.spots().length;btn.style.opacity=btn.disabled?'.45':'1'}
}
async function saveSession(){
  const spots=storage.spots(),spotId=$('spotSelect').value,spot=spots.find(s=>s.id===spotId),score=document.querySelector('input[name="score"]:checked');
  if(state.sessionSaving)return;if(!spot)return alert('Crie um pico antes de registrar a sessão.');renderRegisterCapture();const capture=state.registerCapture;if(!capture)return alert(state.registerError||'Escolha um horário com previsão disponível.');if(!score)return alert('Escolha uma nota de 6 a 10.');
  const session={id:uid(),...capture,spotId,spotName:spot.name,registeredBy:currentUserName()||'Surfista',score:Number(score.value),size:$('size').value.trim(),comment:$('comment').value.trim(),date:localDate(capture.ts).toLocaleDateString('pt-BR',{timeZone:CFG.tz})};
  state.sessionSaving=true;const btn=$('saveSession');if(btn){btn.disabled=true;btn.textContent='SALVANDO…'}
  try{
    const result=await sharedRequest('add_session',{session});const savedSession=result.session||session,arr=storage.sessions();arr.push(savedSession);storage.setSessions(arr);
    state.currentSpotId=spotId;localStorage.setItem('code_current_spot',spotId);$('saved').style.display='block';renderSpots();renderSpotDetail();
    document.querySelectorAll('input[name="score"]').forEach(x=>x.checked=false);$('size').value='';$('comment').value='';state.registerDay='';state.registerTs='';resetSessionDraft();
    setTimeout(()=>{location.hash='spot';showSpotTab('overview');$('saved').style.display='none'},500)
  }catch(err){console.error(err);alert('Não consegui registrar a sessão no CODE compartilhado. Confira sua conexão e tente novamente.')}
  finally{state.sessionSaving=false;if(btn)btn.textContent='SALVAR SESSÃO';renderRegisterCapture()}
}

const PUSH_URL=SYNC_URL.replace('code-sync','code-push');
let pushRegistered=false,pushSaveChain=Promise.resolve();
const swReady='serviceWorker' in navigator?navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready):Promise.resolve(null);
swReady.catch(()=>{});
function deviceToken(){let t=localStorage.getItem('code_push_device');if(!t){t=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem('code_push_device',t)}return t}
function pushStatus(message){if($('pushStatus'))$('pushStatus').textContent=message;}
async function pushRequest(action,payload={}){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);try{const r=await fetch(PUSH_URL,{method:'POST',headers:{'Content-Type':'application/json'},signal:ctl.signal,body:JSON.stringify({action,pin:accessPin,deviceToken:deviceToken(),...payload})});const data=await r.json();if(!r.ok)throw new Error(data.error||'push_unavailable');return data;}finally{clearTimeout(timer)}}
function pushSettings(){const s=storage.alerts();return {...s,leads:alertLeadValues(s),daily:s.daily!==false};}
function updatePushUI(){const a=$('activatePush'),t=$('testPush');if(a){a.hidden=pushRegistered;a.disabled=false}if(t)t.hidden=!pushRegistered;}
function pushAvailable(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;}
async function restorePush(){
  if(!pushAvailable()){pushStatus('Para receber no iPhone, adicione o CODE à Tela de Início e abra pelo ícone. É necessário iOS 16.4 ou superior.');return;}
  const reg=await swReady,sub=await reg?.pushManager.getSubscription();
  if(sub&&Notification.permission==='granted'){await pushRequest('subscribe',{subscription:sub.toJSON(),settings:pushSettings()});pushRegistered=true;updatePushUI();pushStatus(storage.alerts().enabled!==false?'Notificações conectadas neste aparelho.':'Alertas pausados neste aparelho.');}
  else{pushRegistered=false;updatePushUI();if(Notification.permission==='denied')pushStatus('Notificações bloqueadas. Permita as notificações do CODE nos Ajustes do aparelho.');}
}
async function activatePush(){
  if(!accessPin){pushStatus('Entre no CODE antes de ativar as notificações.');return;}
  if(!pushAvailable()){pushStatus('No iPhone, adicione o CODE à Tela de Início e abra pelo ícone para ativar as notificações (iOS 16.4 ou superior).');return;}
  // Request immediately inside the user's tap, as required by iOS.
  const permission=Notification.requestPermission();$('activatePush').disabled=true;
  try{
    if(await permission!=='granted'){pushStatus('Permita as notificações do CODE nos Ajustes do aparelho para receber os avisos.');return;}
    const [reg,config]=await Promise.all([swReady,pushRequest('config')]);if(!reg)throw new Error('service_worker_unavailable');
    const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    await pushRequest('subscribe',{subscription:sub.toJSON(),settings:pushSettings()});pushRegistered=true;pushStatus('Notificações conectadas. Envie um teste para confirmar o recebimento.');
  }catch(e){console.warn('Push activation failed',e);pushStatus('Não consegui ativar as notificações. Confira sua conexão e tente novamente.');}
  finally{updatePushUI();}
}
function queuePushPreferences(){
  if(!pushRegistered){pushStatus('Preferências salvas neste aparelho. Ative as notificações para receber os avisos.');return;}
  pushStatus('Salvando preferências…');
  pushSaveChain=pushSaveChain.catch(()=>{}).then(()=>pushRequest('preferences',{settings:pushSettings()})).then(()=>pushStatus(storage.alerts().enabled!==false?'Notificações conectadas neste aparelho.':'Alertas pausados neste aparelho.')).catch(()=>{pushRegistered=false;updatePushUI();pushStatus('Não consegui sincronizar os alertas. Confira sua conexão e tente ativar novamente.');});
}
async function testPush(){
  $('testPush').disabled=true;
  try{await pushRequest('test');pushStatus('Teste enviado. Confira a notificação no celular; o envio sozinho não confirma o recebimento.');}
  catch(e){pushStatus(e.message==='wait_before_test'?'Aguarde um minuto antes de enviar outro teste.':'Não consegui enviar o teste. Confira sua conexão e tente ativar novamente.');}
  finally{$('testPush').disabled=false;}
}

function alertLeadValues(cfg){const allowed=[168,120,72,48,24];let vals=[];if(Array.isArray(cfg?.leads))vals=cfg.leads.map(Number).filter(v=>allowed.includes(v));else if(allowed.includes(Number(cfg?.lead)))vals=[Number(cfg.lead)];return [vals.length?Math.max(...vals):168]}
function renderAlerts(){const box=$('alertsList');if(!box)return;const spots=storage.spots(),cfg=storage.alerts(),leads=alertLeadValues(cfg);$('globalAlert').checked=cfg.enabled!==false;$('dailyAlert').checked=cfg.daily!==false;document.querySelectorAll('[data-alert-lead]').forEach(el=>el.checked=leads.includes(Number(el.dataset.alertLead)));box.innerHTML=spots.length?spots.map(s=>`<div class="toggle-row alert-spot-row"><div><b>${esc(s.name)}</b></div><label class="switch"><input type="checkbox" data-alert-spot="${s.id}" ${cfg.spots?.[s.id]!==false?'checked':''}><span class="slider"></span></label></div>`).join(''):'<small>Nenhum pico cadastrado.</small>';box.querySelectorAll('[data-alert-spot]').forEach(el=>el.onchange=()=>{const x=storage.alerts();x.spots??={};x.spots[el.dataset.alertSpot]=el.checked;storage.setAlerts(x);queuePushPreferences()})}
function saveAlertLeads(){const x=storage.alerts(),selected=document.querySelector('[data-alert-lead]:checked');x.leads=[Number(selected?.dataset.alertLead)||168];delete x.lead;storage.setAlerts(x);queuePushPreferences()}
function typeSplash(){const el=$('typedTag');if(!el)return;const text=el.dataset.text||'EVERY SPOT HAS A CODE';el.textContent='';let i=0;const tick=()=>{if(i<=text.length){el.textContent=text.slice(0,i++);setTimeout(tick,72)}};setTimeout(tick,350)}
function updateRegisterIdentity(){const el=$('registerIdentity');if(!el)return;const name=currentUserName();el.textContent=name?`Registrando como ${name}`:'Identifique-se para registrar'}
function unlockAccess(){document.body.classList.add('access-granted');$('pinGate')?.classList.add('hidden');updateRegisterIdentity();restorePush().catch(()=>pushStatus('Não consegui conectar as notificações. Toque em ativar para tentar novamente.'));const allowed=['#forecast','#spots','#spot','#register','#alerts'];if(!allowed.includes(location.hash))location.hash='forecast';syncSharedData({migrate:true}).catch(err=>{console.error('shared sync failed',err);alert('Você entrou no CODE, mas a sincronização compartilhada não respondeu agora. Tente novamente com conexão à internet.')})}
function showProfileStep(){$('pinStep')?.classList.add('hidden');$('profileStep')?.classList.remove('hidden');setTimeout(()=>$('profileName')?.focus(),80)}
async function tryPin(){const input=$('pinInput'),err=$('pinError'),card=document.querySelector('.pin-card'),btn=$('pinSubmit');if(!input)return;const pin=input.value.trim();if(pin.length!==4){err.textContent='Digite os 4 números do PIN';return}if(btn){btn.disabled=true;btn.textContent='VALIDANDO…'}try{await sharedRequest('login',{},pin);accessPin=pin;sessionStorage.setItem('code_access_pin',pin);err.textContent='';if(currentUserName())unlockAccess();else showProfileStep()}catch(e){err.textContent='PIN incorreto ou conexão indisponível';input.value='';card?.classList.remove('shake');void card?.offsetWidth;card?.classList.add('shake');input.focus()}finally{if(btn){btn.disabled=false;btn.textContent='ENTRAR'}}}
function saveProfileName(){const name=$('profileName')?.value.trim();if(!name){$('profileName')?.focus();return}localStorage.setItem('code_user_name',name.slice(0,30));unlockAccess()}
function openPinGate(){$('pinGate')?.classList.remove('hidden');$('pinStep')?.classList.remove('hidden');$('profileStep')?.classList.add('hidden');const input=$('pinInput');if(input){input.value='';setTimeout(()=>input.focus(),80)}}
function bootAccess(){typeSplash();$('splashTap')?.addEventListener('click',openPinGate);$('pinSubmit')?.addEventListener('click',tryPin);$('pinInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')tryPin()});$('profileSave')?.addEventListener('click',saveProfileName);$('profileName')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveProfileName()});updateRegisterIdentity()}
function bind(){$('editSessionConditions').onclick=toggleSessionEditing;$('codeForecastTab').onclick=()=>showForecastTab('code');$('windguruForecastTab').onclick=()=>showForecastTab('windguru');document.querySelectorAll('[data-session-edit]').forEach(input=>input.addEventListener('input',()=>editSessionField(input.dataset.sessionEdit,input.value)));$('resetSessionForecast').onclick=()=>{resetSessionDraft();renderRegisterCapture()};$('refreshForecast').onclick=()=>loadForecast(true);$('editSpots').onclick=toggleSpotsEditMode;$('addSpot').onclick=()=>openSpotEditor();$('cancelSpot').onclick=closeSpotEditor;$('saveSpot').onclick=saveSpot;if($('chooseSpotPhoto'))$('chooseSpotPhoto').onclick=()=>$('spotPhotoInput').click();if($('spotPhotoInput'))$('spotPhotoInput').onchange=e=>chooseSpotPhoto(e.target.files?.[0]);$('deleteSpotInModal').onclick=()=>{if(state.editingSpotId)deleteSpot(state.editingSpotId)};$('spotModal').onclick=e=>{if(e.target===$('spotModal'))closeSpotEditor()};$('openMapPicker').onclick=openMap;$('cancelMap').onclick=closeMap;$('confirmMap').onclick=()=>{if(!state.pendingPoint)return alert('Marque um ponto no mapa primeiro.');$('spotLat').value=state.pendingPoint.lat.toFixed(6);$('spotLon').value=state.pendingPoint.lon.toFixed(6);updateLocationSummary();closeMap()};$('mapSearchBtn').onclick=searchMap;$('mapSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchMap()}};$('mapModal').onclick=e=>{if(e.target===$('mapModal'))closeMap()};document.querySelectorAll('.spot-tab').forEach(b=>b.onclick=()=>showSpotTab(b.dataset.tab));$('saveSession').onclick=saveSession;$('sessionDay').onchange=()=>{state.registerDay=$('sessionDay').value;state.registerTs='';resetSessionDraft();renderRegisterCapture()};$('sessionHour').onchange=()=>{state.registerTs=$('sessionHour').value;resetSessionDraft();renderRegisterCapture()};$('globalAlert').onchange=()=>{const x=storage.alerts();x.enabled=$('globalAlert').checked;storage.setAlerts(x);queuePushPreferences()};$('dailyAlert').onchange=()=>{const x=storage.alerts();x.daily=$('dailyAlert').checked;storage.setAlerts(x);queuePushPreferences()};$('activatePush').onclick=activatePush;$('testPush').onclick=testPush;document.querySelectorAll('[data-alert-lead]').forEach(el=>el.onchange=saveAlertLeads);window.addEventListener('hashchange',()=>{if(location.hash==='#spots'||location.hash==='#register'||location.hash==='#alerts')renderSpots();if(location.hash==='#spot')renderSpotDetail();if(location.hash==='#register'){renderRegisterCapture();updateRegisterIdentity()}});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-state.lastLoad>CFG.staleMs)loadForecast(true)})}
bootAccess();bind();renderSpots();renderSpotDetail();showSpotTab('overview');loadForecast(true);setInterval(()=>loadForecast(true),CFG.refreshMs);setInterval(()=>{if(document.body.classList.contains('access-granted'))syncSharedData({migrate:false}).catch(()=>{})},45000);
})();
