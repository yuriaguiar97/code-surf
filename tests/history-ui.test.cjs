const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function app(){
  const values=new Map(),elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',querySelectorAll:()=>[]});return elements.get(id)};
  const context={Date,Intl,URLSearchParams,AbortController,console,setTimeout,clearTimeout,document:{getElementById:element},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},sessionStorage:{getItem:()=>null}};
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  vm.runInNewContext(source.slice(source.indexOf("'use strict';"),source.indexOf('const PUSH_URL='))+'\nglobalThis.api={sortedHistory,historyTideText,renderHistory,radarDisplayState,spotSignalMarkup,spotWindowText,spotImage,state};',context);
  return {api:context.api,element,values};
}
const sessions=[
  {id:'late-entry',date:'15/10/2026',ts:'2026-10-15T12:00',score:8},
  {id:'morning',date:'17/10/2026',ts:'2026-10-17T08:00',score:0},
  {id:'afternoon',date:'17/10/2026',ts:'2026-10-17T15:00',score:8},
  {id:'legacy',date:'16/10/2026',score:9}
];
test('history sorts by surf time, legacy dates and score while preserving original records',()=>{
  const {api}=app(),copy=JSON.stringify(sessions),ids=mode=>Array.from(api.sortedHistory(sessions,mode),s=>s.id);
  assert.deepEqual(ids('recent'),['afternoon','morning','legacy','late-entry']);
  assert.deepEqual(ids('oldest'),['late-entry','legacy','morning','afternoon']);
  assert.deepEqual(ids('score'),['legacy','afternoon','late-entry','morning']);
  assert.equal(JSON.stringify(sessions),copy);
});
test('history displays the saved tide, including zero and negatives, without inventing movement',()=>{
  const {api}=app();
  assert.equal(api.historyTideText({tide:.65,forecast:{tideMovement:'rising'}}),'0.65 m · Enchendo ↑');
  assert.equal(api.historyTideText({tide:-.15,forecast:{tideMovement:'falling'}}),'-0.15 m · Vazando ↓');
  assert.equal(api.historyTideText({tide:0}),'0.00 m');
  for(const tide of [null,undefined,'',NaN])assert.equal(api.historyTideText({tide}),'Maré não registrada');
});
test('sessions start collapsed, retain open state after sorting and expose the session grade',()=>{
  const {api,element,values}=app(),history=element('history');
  api.renderHistory(sessions);assert.equal((history.innerHTML.match(/<details class="history-item"/g)||[]).length,4);
  assert.doesNotMatch(history.innerHTML,/data-session-id="[^"]+" open/);
  assert.match(history.innerHTML,/Nota da sessão/);assert.match(history.innerHTML,/<strong>0<span>\/10<\/span><\/strong>/);
  history.querySelectorAll=()=>[{dataset:{sessionId:'morning'}}];values.set('code_history_sort','oldest');api.renderHistory(sessions);
  assert.equal(element('historySort').value,'oldest');assert.match(history.innerHTML,/data-session-id="morning" open/);
  assert.ok(history.innerHTML.indexOf('late-entry')<history.innerHTML.indexOf('afternoon'));
});
test('history escapes user content and keeps edit controls inside expanded sessions in edit mode',()=>{
  const {api,element}=app(),session={...sessions[0],registeredBy:'<script>',comment:'<img onerror=alert(1)>',tide:.3,forecast:{tideMovement:'falling'}};
  api.state.historyEditMode=true;api.renderHistory([session]);const html=element('history').innerHTML;
  assert.match(html,/data-session-id="late-entry" open/);assert.match(html,/data-edit-session="late-entry"/);
  assert.match(html,/Maré<\/span><b>0.30 m · Vazando ↓/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<img/);
});
test('card status matches the displayed radar label even when its first window is swell-only',()=>{
  const {api}=app();for(const state of ['off','swell','radar','on'])assert.equal(api.radarDisplayState({state,windows:[]}),state);
  assert.equal(api.radarDisplayState({state:'radar',windows:[{kind:'swell'}]}),'swell');
});
test('dossiers use the approved reticle and colored dots without changing the radar state',()=>{
  const {api}=app();
  assert.match(api.spotSignalMarkup({state:'on',windows:[]}),/<svg[^>]+viewBox="0 0 24 24"/);
  for(const [state,label] of [['radar','NO RADAR'],['swell','SWELL NO RADAR'],['off','CODE OFF']]){
    const html=api.spotSignalMarkup({state,windows:[]});assert.match(html,/class="signal-dot"/);assert.ok(html.includes(label));assert.doesNotMatch(html,/<svg/);
  }
});
test('dossier windows show the active end time and preserve the next forecast window',()=>{
  const {api}=app(),now=Date.now(),window={kind:'compatible',day:'2026-10-18',startHour:8,endHour:11,start:now-3600000,end:now+3600000};
  assert.equal(api.spotWindowText({state:'on',windows:[window]}),'Agora · até 11h');
  assert.equal(api.spotWindowText({state:'radar',windows:[window]}),'dom, 18/10 · 8h–11h');
  assert.equal(api.spotWindowText({state:'off',windows:[]}),'Sem janela nos próximos 7 dias');
});
test('approved default photos follow spot names and remain available for any list index',()=>{
  const {api}=app();assert.equal(api.spotImage(8,'Toninhas'),'assets/code-coast-01.webp');
  assert.equal(api.spotImage(0,'Cepilho'),'assets/code-coast-02.webp');
  assert.equal(api.spotImage(1,'Brava da Almada'),'assets/code-coast-03.webp');
  assert.equal(api.spotImage(2,'Ponta Aguda'),'assets/code-coast-04.webp');
  assert.equal(api.spotImage(-1),'assets/code-coast-04.webp');
});
