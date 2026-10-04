from pathlib import Path
import re

p = Path('app.html')
h = p.read_text()

h = h.replace('    <a class="btn" href="#register">＋ REGISTRAR SUA SESSÃO</a>\n', '')
h = h.replace('      <a class="btn" href="#register">Registrar sessão</a>\n', '')

old = '<div class="card score-card"><div><small>NOTA MÉDIA</small><div id="spotScore" class="score-number">—</div></div><div><div id="spotStars" class="stars">☆☆☆☆☆</div><small id="spotSessionCount">0 sessões</small><div style="margin-top:8px"><span id="spotConf" class="badge">0%</span></div></div></div>'
new = '<div class="card score-card spot-summary-card"><div class="spot-score-main"><small>NOTA MÉDIA</small><div id="spotScore" class="score-number">—</div></div><div class="spot-summary-meta"><small id="spotSessionCount">Nenhuma sessão registrada</small><span id="spotConf" class="badge">Confidence 0%</span></div></div>'
assert old in h, 'spot score card not found'
h = h.replace(old, new)

h = h.replace('<div class="card alerts-card"><div class="toggle-row"><div><b>Alertas ativos</b><small>usar o CODE dos seus picos</small></div><label class="switch">', '<div class="card alerts-card"><div class="toggle-row"><div><b>Alertas ativos</b></div><label class="switch">')
h = h.replace('<h2>Picos monitorados</h2><div id="alertsList" class="card alerts-card"></div>', '<h2>Picos monitorados</h2><div class="sub alerts-subtitle">Você receberá um alerta quando as condições estiverem favoráveis.</div><div id="alertsList" class="card alerts-card"></div>')

def repl_nav(m):
    body = m.group(1)
    if 'nav-register' in body:
        return m.group(0)
    button = '<a class="nav-register" href="#register" aria-label="Registrar sessão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c2-2 4-2 6 0s4 2 6 0"/><path d="M17 6v8"/><path d="M13 10h8"/></svg></a>'
    return '<nav class="nav">' + body + button + '</nav>'

h, n = re.subn(r'<nav class="nav">(.*?)</nav>', repl_nav, h)
assert n >= 5, f'expected at least 5 navs, found {n}'

h = h.replace('styles.css?v=20261004final5', 'styles.css?v=20261004final6')
h = h.replace('app.js?v=20261004final5', 'app.js?v=20261004final6')
h = h.replace('FINAL · 2026.10.04 · 5', 'FINAL · 2026.10.04 · 6')
p.write_text(h)

p = Path('app.js')
s = p.read_text()
s = s.replace("$('spotStars').textContent=Number.isFinite(avg)?stars(Math.round(avg/2)):'☆☆☆☆☆';", "if($('spotStars'))$('spotStars').textContent=Number.isFinite(avg)?stars(Math.round(avg/2)):'☆☆☆☆☆';")
old = "box.innerHTML=spots.length?spots.map(s=>`<div class=\"toggle-row\"><div><b>${esc(s.name)}</b><small>monitorar aproximação do CODE</small></div><label class=\"switch\"><input type=\"checkbox\" data-alert-spot=\"${s.id}\" ${cfg.spots?.[s.id]!==false?'checked':''}><span class=\"slider\"></span></label></div>`).join(''):'<small>Nenhum pico cadastrado.</small>';"
new = "box.innerHTML=spots.length?spots.map(s=>`<div class=\"toggle-row alert-spot-row\"><div><b>${esc(s.name)}</b></div><label class=\"switch\"><input type=\"checkbox\" data-alert-spot=\"${s.id}\" ${cfg.spots?.[s.id]!==false?'checked':''}><span class=\"slider\"></span></label></div>`).join(''):'<small>Nenhum pico cadastrado.</small>';"
assert old in s, 'renderAlerts row not found'
s = s.replace(old, new)
p.write_text(s)

p = Path('styles.css')
c = p.read_text()
c += '''

/* final6 · spot summary, alerts and persistent register */
.spot-summary-card{grid-template-columns:minmax(0,1fr) minmax(170px,.9fr);padding:18px 20px;gap:22px}
.spot-score-main{min-width:0}
.spot-summary-meta{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:12px;min-width:0}
.spot-summary-meta small{font-size:13px;line-height:1.35;color:#a7bdc8}
.spot-summary-meta .badge{white-space:nowrap}
.spot-panel #overviewBest{padding:3px 22px}
.spot-panel #overviewBest .row{padding:16px 4px}
.spot-panel #overviewBest .row b{max-width:58%;padding-left:18px;text-align:right;line-height:1.35;overflow-wrap:anywhere}
.alerts-subtitle{margin:-4px 0 10px;max-width:560px}
.alert-spot-row>div{min-width:0}
.alert-spot-row b{display:block;padding-right:12px;line-height:1.25}
.alerts-card .toggle-row>div>b{line-height:1.25}
.nav{overflow:visible}
.nav-register{position:absolute!important;left:50%!important;top:-29px!important;transform:translateX(-50%)!important;width:58px!important;height:58px!important;min-width:58px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:linear-gradient(145deg,#4bc8ff,#3d8fff)!important;color:#f4fbff!important;border:4px solid #071018!important;box-shadow:0 13px 28px rgba(55,149,255,.34)!important;z-index:4!important}
.nav-register svg{width:25px;height:25px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.nav-register:active{transform:translateX(-50%) scale(.96)!important}
.nav a:nth-child(2){padding-top:22px}
.nav a:nth-child(2) span{opacity:.8}
@media(max-width:520px){.spot-summary-card{grid-template-columns:1fr auto;gap:14px;padding:16px}.spot-summary-meta{max-width:180px}.spot-panel #overviewBest{padding-left:16px;padding-right:16px}.spot-panel #overviewBest .row b{max-width:60%;padding-left:12px}}
'''
p.write_text(c)
