from pathlib import Path
import re

# ---------- app.html ----------
p=Path('app.html')
h=p.read_text()

old_code='''    <section class="spot-panel" data-panel="code">
      <div class="panel-heading"><h2>CODE do pico</h2><div class="panel-copy">As condições abaixo evoluem conforme você registra sessões reais.</div></div><div id="codeOrigin" class="seed">Ainda sem dados suficientes para formar o CODE.</div>
      <div class="card"><div class="row"><span>Ondulação</span><b id="learnWave">Dados insuficientes</b></div><div class="row"><span>Período</span><b id="learnPeriod">Dados insuficientes</b></div><div class="row"><span>Vento</span><b id="learnWind">Dados insuficientes</b></div><div class="row"><span>Energia</span><b id="learnEnergy">Dados insuficientes</b></div><div class="confidence"><i id="confBar" style="width:0"></i></div></div>
      <div class="notice">O norte inicial serve como ponto de partida. Conforme entram sessões com nota 8 ou mais, os dados reais passam a ter mais peso e aumentam o Confidence.</div>
    </section>'''
new_code='''    <section class="spot-panel" data-panel="code">
      <div class="panel-heading"><h2>CODE do pico</h2><div class="panel-copy">O padrão ideal deste pico é atualizado automaticamente conforme você registra sessões.</div></div>
      <div id="codeOrigin" class="code-origin-card">Ainda sem dados suficientes para formar o CODE.</div>
      <div class="code-metrics-grid">
        <div class="code-metric-card"><span>Ondulação</span><b id="learnWave">Dados insuficientes</b></div>
        <div class="code-metric-card"><span>Período</span><b id="learnPeriod">Dados insuficientes</b></div>
        <div class="code-metric-card"><span>Vento</span><b id="learnWind">Dados insuficientes</b></div>
        <div class="code-metric-card"><span>Energia</span><b id="learnEnergy">Dados insuficientes</b></div>
      </div>
      <div class="code-confidence-card"><div><span>Confidence do CODE</span><small>cresce conforme o histórico fica mais consistente</small></div><div class="confidence"><i id="confBar" style="width:0"></i></div></div>
      <div class="notice code-learning-notice">O CODE começa com o norte inicial do pico. A cada sessão registrada, ondulação, período, vento e energia são recalculados automaticamente. As melhores sessões ganham mais peso para aproximar o CODE das condições ideais deste pico; conforme o histórico cresce, o Confidence também aumenta.</div>
    </section>'''
assert old_code in h, 'code panel block not found'
h=h.replace(old_code,new_code)

old_leads='''    <h2>Antecedência</h2><div class="lead-grid" id="alertLeads"><label class="lead-option"><input type="checkbox" data-alert-lead="6"><span>6h</span></label><label class="lead-option"><input type="checkbox" data-alert-lead="12"><span>12h</span></label><label class="lead-option"><input type="checkbox" data-alert-lead="24"><span>24h</span></label><label class="lead-option"><input type="checkbox" data-alert-lead="48"><span>48h</span></label></div><div class="sub lead-help">Você pode escolher mais de um aviso, por exemplo 48h e 24h antes.</div>'''
new_leads='''    <h2>Antecedência</h2><div class="card alerts-card alert-leads-card" id="alertLeads"><div class="toggle-row"><div><b>24 horas antes</b></div><label class="switch"><input type="checkbox" data-alert-lead="24"><span class="slider"></span></label></div><div class="toggle-row"><div><b>48 horas antes</b></div><label class="switch"><input type="checkbox" data-alert-lead="48"><span class="slider"></span></label></div></div><div class="sub lead-help">Você pode manter os dois avisos ativos ao mesmo tempo.</div>'''
assert old_leads in h, 'alert lead block not found'
h=h.replace(old_leads,new_leads)

# Label the persistent action button everywhere.
pattern=re.compile(r'<a class="nav-register" href="#register" aria-label="Registrar sessão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c2-2 4-2 6 0s4 2 6 0"/><path d="M17 6v8"/><path d="M13 10h8"/></svg></a>')
replacement='<a class="nav-register" href="#register" aria-label="Register CODE"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c2-2 4-2 6 0s4 2 6 0"/><path d="M17 6v8"/><path d="M13 10h8"/></svg><span>Register CODE</span></a>'
h,n=pattern.subn(replacement,h)
assert n>=5, f'nav register replacements: {n}'

h=h.replace('styles.css?v=20261004final6','styles.css?v=20261004final7')
h=h.replace('app.js?v=20261004final6','app.js?v=20261004final7')
h=h.replace('FINAL · 2026.10.04 · 6','FINAL · 2026.10.04 · 7')
p.write_text(h)

# ---------- app.js ----------
p=Path('app.js')
s=p.read_text()

old_alert="function alertLeadValues(cfg){if(Array.isArray(cfg?.leads)&&cfg.leads.length)return cfg.leads.map(Number).filter(Number.isFinite);if(Number.isFinite(Number(cfg?.lead)))return[Number(cfg.lead)];return[24,48]}"
new_alert="function alertLeadValues(cfg){const allowed=[24,48];let vals=[];if(Array.isArray(cfg?.leads))vals=cfg.leads.map(Number).filter(v=>allowed.includes(v));else if(allowed.includes(Number(cfg?.lead)))vals=[Number(cfg.lead)];return vals.length?vals:[24,48]}"
assert old_alert in s, 'alertLeadValues not found'
s=s.replace(old_alert,new_alert)

s=s.replace("$('codeOrigin').textContent=good.length?`${good.length} ${plural(good.length,'sessão boa confirmada','sessões boas confirmadas')}${seed?' · norte inicial ainda considerado':''}`:seed?'Norte inicial cadastrado · baixa confiança':'Ainda sem dados suficientes para formar o CODE.';", "$('codeOrigin').textContent=good.length?`CODE atualizado com ${good.length} ${plural(good.length,'sessão de alta qualidade','sessões de alta qualidade')}${seed?' · norte inicial ainda considerado':''}`:seed?'Ponto de partida: norte inicial cadastrado · baixa confiança':'Ainda sem dados suficientes para formar o CODE.';")
s=s.replace("$('learnEnergy').textContent='Será aprendido com suas sessões'", "$('learnEnergy').textContent='—'")

# Remove any stale star update in spot detail; element no longer exists.
s=s.replace("if($('spotStars'))$('spotStars').textContent=Number.isFinite(avg)?stars(Math.round(avg/2)):'☆☆☆☆☆';", "")

p.write_text(s)

# ---------- styles.css ----------
p=Path('styles.css')
c=p.read_text()
c += r'''

/* final7 · CODE learning layout + register label + alert lead consistency */
.code-origin-card{margin:10px 0 12px;padding:14px 15px;border-radius:17px;background:rgba(95,233,223,.065);border:1px solid rgba(95,233,223,.16);color:#bdd8de;font-size:12px;line-height:1.45;overflow-wrap:anywhere}
.code-metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.code-metric-card{min-width:0;padding:15px 16px;border-radius:17px;background:linear-gradient(180deg,rgba(11,25,36,.92),rgba(7,17,26,.9));border:1px solid rgba(152,187,205,.12);box-shadow:var(--shadow)}
.code-metric-card span{display:block;color:#8fa9b6;font-size:11px;margin-bottom:7px}
.code-metric-card b{display:block;color:#eff7fb;font-size:15px;line-height:1.35;text-align:left;white-space:normal;overflow-wrap:anywhere}
.code-confidence-card{margin-top:10px;padding:14px 16px;border-radius:17px;background:linear-gradient(180deg,rgba(11,25,36,.92),rgba(7,17,26,.9));border:1px solid rgba(152,187,205,.12);box-shadow:var(--shadow)}
.code-confidence-card>div:first-child{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.code-confidence-card span{font-size:12px;font-weight:750;color:#d9e9ee}
.code-confidence-card small{font-size:10px;text-align:right;line-height:1.3;max-width:220px}
.code-confidence-card .confidence{margin-top:11px}
.code-learning-notice{margin-top:12px}
.alert-leads-card{padding:0 14px;margin-top:8px}
.alert-leads-card .toggle-row{padding:14px 2px}
.alert-leads-card .toggle-row b{font-size:14px}
.nav-register{width:138px!important;height:54px!important;min-width:138px!important;border-radius:18px!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:8px!important;top:-27px!important;padding:0 14px!important;font-size:11px!important;font-weight:850!important;letter-spacing:.015em!important;white-space:nowrap!important}
.nav-register svg{width:21px!important;height:21px!important;flex:none}
.nav-register span{font-size:11px!important;line-height:1!important;color:inherit!important}
.nav a:nth-child(2){padding-top:24px}
@media(max-width:520px){.code-metrics-grid{grid-template-columns:1fr}.code-confidence-card>div:first-child{display:block}.code-confidence-card small{display:block;text-align:left;margin-top:3px;max-width:none}.nav-register{width:132px!important;min-width:132px!important;font-size:10px!important}.nav-register span{font-size:10px!important}}
'''
p.write_text(c)

# ---------- index.html ----------
p=Path('index.html')
idx=p.read_text()
idx=idx.replace('20261004final6','20261004final7')
p.write_text(idx)
