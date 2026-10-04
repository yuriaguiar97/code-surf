from pathlib import Path
import re

h = Path('app.html')
x = h.read_text()

wave = '<div id="waveCard" class="metric-card quality"><div class="metric-icon"><svg viewBox="0 0 24 24"><path d="M2 15c3-5 6-5 9 0s6 5 11 0"/><path d="M3 19c3-3 6-3 9 0s6 3 9 0"/></svg></div><small>Ondulação</small><strong id="wave">—</strong><div class="metric-sub">—</div></div>'
direction = '<div id="swellDirCard" class="metric-card"><div class="metric-icon"><svg viewBox="0 0 24 24"><path d="M12 20V5"/><path d="M7 10l5-5 5 5"/></svg></div><small>Direção</small><strong id="swellDir">—</strong><div class="metric-sub" id="swellDirDeg">—</div></div>'
if 'id="swellDirCard"' not in x:
    if wave not in x:
        raise SystemExit('wave card not found')
    x = x.replace(wave, wave + '\n        ' + direction, 1)

x = x.replace('\n      <div id="tideEventsList" class="tide-events-list"></div>', '')
x = x.replace('styles.css?v=20261004final3', 'styles.css?v=20261004final4')
x = x.replace('app.js?v=20261004final3', 'app.js?v=20261004final4')
x = x.replace('FINAL · 2026.10.04 · 3', 'FINAL · 2026.10.04 · 4')
h.write_text(x)

p = Path('app.js')
s = p.read_text()
old = "setMetric('waveCard','wave',fmt(wave)+' m',`${dir(waveDir)} · ${fmt(waveDir,0)}°`,'wave',wave);setMetric('periodCard','period',fmt(p,0)+' s','','period',p);"
new = "setMetric('waveCard','wave',fmt(wave)+' m','','wave',wave);$('swellDir').textContent=dir(waveDir);$('swellDirDeg').textContent=fmt(waveDir,0)+'°';setMetric('periodCard','period',fmt(p,0)+' s','','period',p);"
if old not in s:
    raise SystemExit('current wave metric sequence not found')
s = s.replace(old, new, 1)

m = re.search(r"function drawTide\(\)\{.*?\nfunction spotImage", s, re.S)
if not m:
    raise SystemExit('drawTide not found')
draw = r'''function drawTide(){const day=state.selectedDay,ev=tideEvents(day),svg=$('tideChart');$('tideDayLabel').textContent=dayName(day,true);if(!ev.length){svg.innerHTML='';$('tideRange').textContent='sem tábua para este dia';return}const start=new Date(`${day}T00:00:00-03:00`).getTime(),W=640,H=170,s=[];for(let i=0;i<=96;i++){const ms=start+i*15*60*1000,v=tideAtMs(ms,day);if(Number.isFinite(v))s.push([v,i/96*W])}const vals=s.map(x=>x[0]),min=Math.min(...vals),max=Math.max(...vals),pad=Math.max(.06,(max-min)*.12),lo=min-pad,hi=max+pad,y=v=>H-22-(v-lo)/(hi-lo)*(H-42),path=s.map(([v,x],i)=>(i?'L':'M')+x.toFixed(1)+','+y(v).toFixed(1)).join(' '),fill=path+` L ${W},${H-18} L 0,${H-18} Z`,marks=ev.map(e=>{const [hh,mm]=e.time.split(':').map(Number),x=(hh*60+mm)/1440*W,yy=y(Number(e.height)),cx=clamp(x,31,W-31),boxY=e.type==='high'?Math.max(4,yy-36):Math.min(H-31,yy+8),heightText=`${fmt(e.height,2)} m`;return`<circle cx="${x}" cy="${yy}" r="3.2" fill="#e9fbff"/><rect x="${cx-29}" y="${boxY}" width="58" height="27" rx="7" fill="rgba(7,20,30,.94)" stroke="rgba(102,199,255,.32)" stroke-width=".8"/><text x="${cx}" y="${boxY+10}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#dff5ff">${e.time}</text><text x="${cx}" y="${boxY+21}" text-anchor="middle" font-size="8" fill="#9fc3d4">${heightText}</text>`}).join('');svg.innerHTML=`<path d="${fill}" fill="rgba(77,180,255,.10)"/><path d="${path}" fill="none" stroke="#66c7ff" stroke-width="2.2" vector-effect="non-scaling-stroke"/>${marks}`;$('tideRange').textContent=`${fmt(min,2)}–${fmt(max,2)} m`;$('tideSource').textContent=`${state.tides?.source||'tábua astronômica'} · alturas positivas no datum da tábua`}
function spotImage'''
s = s[:m.start()] + draw + s[m.end():]
p.write_text(s)

css = Path('styles.css')
c = css.read_text()
if 'final4: current swell direction' not in c:
    c += '\n/* final4: current swell direction + compact tide labels */\n.metric-card .metric-sub:empty{display:none}#swellDirCard strong{letter-spacing:.04em}#swellDirCard .metric-sub{font-variant-numeric:tabular-nums;color:#9fd7e7}\n'
css.write_text(c)

idx = Path('index.html')
ix = idx.read_text().replace('20261004final3', '20261004final4')
idx.write_text(ix)
