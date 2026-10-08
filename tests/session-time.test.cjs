const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const NOW=Date.parse('2026-10-08T00:29:00Z'); // 21:29 on 7 October in Ubatuba.
function app(){
  const elements=new Map(),values=new Map([['code_access_pin','test-only'],['code_user_name','Teste']]),requests=[],alerts=[];
  const score={value:'9',checked:true};
  const element=id=>{if(!elements.has(id)){const classes=new Set();elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,style:{},dataset:{},attrs:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},setAttribute(k,v){this.attrs[k]=v},querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},focus(){}})}return elements.get(id)};
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[NOW]))}static now(){return NOW}}
  const context={Date:Clock,Intl,Math,JSON,URLSearchParams,AbortController,localStorage:storage,sessionStorage:storage,navigator:{},location:{hash:'#register'},window:{addEventListener(){}},document:{getElementById:element,querySelector:s=>s.includes('score')?score:null,querySelectorAll:s=>s.includes('score')?[score]:[],addEventListener(){}},alert:s=>alerts.push(s),confirm:()=>true,console:{error(){},warn(){}},setTimeout:()=>0,clearTimeout(){},fetch:async(url,opts)=>{const body=JSON.parse(opts.body);requests.push(body);return{ok:true,json:async()=>({session:body.session})}}};
  let source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  source=source.replace(/bootAccess\(\);bind\(\);renderSpots\(\);[^\n]+/, 'globalThis.api={state,storage,bind,saveSession,renderRegisterCapture,sessionForecastAt,sessionHours,renderSpotDetail,openSessionEditor,cancelSessionEdit,deleteSession};');
  vm.runInNewContext(source,context);
  const api=context.api,times=['2026-10-07T07:00','2026-10-07T15:00','2026-10-07T21:00','2026-10-07T22:00','2026-10-08T15:00'];
  api.state.marine={hourly:{time:times,wave_height:[.7,1.5,2.1,2.2,3],wave_direction:[90,135,180,180,225],wave_period:[7,12,9,10,14]}};
  api.state.wind={hourly:{time:times,wind_speed_10m:[2,5,12,15,18],wind_direction_10m:[225,270,90,90,135],wind_gusts_10m:[3,8,16,18,21]}};
  api.state.tides={events:{'2026-10-07':[{time:'14:00',height:.2,type:'low'},{time:'16:00',height:1.2,type:'high'}]}};
  api.state.latest={wave:3,wind:18,ts:'2026-10-08T15:00'};
  api.storage.setSpots([{id:'spot-1',name:'Pico teste'}]);element('spotSelect').value='spot-1';
  api.bind();api.renderRegisterCapture();
  return{api,element,requests,alerts,score,context};
}
function choose(a,ts){a.element('sessionHour').value=ts;a.element('sessionHour').onchange()}
test('15h uses the exact table indices, independently of the forecast day',()=>{
 const a=app();a.api.state.selectedDay='2026-10-08';choose(a,'2026-10-07T15:00');
 const x=a.api.state.registerCapture;
 assert.equal(x.ts,'2026-10-07T15:00');assert.equal(x.wave,1.5);assert.equal(x.waveDir,135);assert.equal(x.period,12);assert.equal(x.wind,5);assert.equal(x.windDir,270);assert.equal(x.gust,8);assert.equal(x.energy,1025*9.81*1.5**2/16);assert.ok(Math.abs(x.tide-.7)<1e-10);
 assert.equal(a.element('rs').textContent,'1.5 m');assert.equal(a.element('rd').textContent,'SE');assert.match(a.element('sessionForecastMoment').textContent,/07\/10\/2026 às 15:00/);
});
test('night defaults to the current Ubatuba hour and never lists future timestamps',()=>{
 const a=app();assert.equal(a.api.state.registerDay,'2026-10-07');assert.equal(a.api.state.registerCapture.ts,'2026-10-07T21:00');
 assert.ok(!a.element('sessionHour').innerHTML.includes('22:00'));assert.ok(!a.element('sessionDay').innerHTML.includes('2026-10-08'));
 assert.equal(a.api.sessionForecastAt('2026-10-07T22:00'),null);
});
test('forecast refresh keeps an explicitly chosen surf hour',()=>{
 const a=app();choose(a,'2026-10-07T15:00');a.api.state.latest={ts:'2026-10-08T15:00',wave:99};a.api.state.marine.hourly.wave_height[1]=1.8;a.api.renderRegisterCapture();
 assert.equal(a.element('sessionHour').value,'2026-10-07T15:00');assert.equal(a.api.state.registerCapture.wave,1.8);
});
test('a missing wind timestamp never falls back to another hour',async()=>{
 const a=app();choose(a,'2026-10-07T15:00');a.api.state.wind.hourly.time[1]='2026-10-07T16:00';a.api.renderRegisterCapture();
 assert.equal(a.api.state.registerCapture,null);assert.equal(a.element('saveSession').disabled,true);assert.equal(a.element('rs').textContent,'—');
 await a.api.saveSession();assert.equal(a.requests.length,0);assert.equal(a.api.state.registerTs,'2026-10-07T15:00');
});
test('missing wave measurements block saving and absent tide is not shown as zero',()=>{
 const a=app();choose(a,'2026-10-07T15:00');a.api.state.tides=null;a.api.renderRegisterCapture();assert.equal(a.element('rt').textContent,'—');
 a.api.state.marine.hourly.wave_height[1]=null;a.api.renderRegisterCapture();assert.equal(a.api.state.registerCapture,null);assert.equal(a.element('saveSession').disabled,true);
});
test('saving at night sends and stores 15h conditions, surf date and author',async()=>{
 const a=app();choose(a,'2026-10-07T15:00');a.element('size').value='1 m';a.element('comment').value='Surf à tarde';await a.api.saveSession();
 const x=a.requests[0].session;assert.equal(a.requests[0].action,'add_session');assert.equal(x.ts,'2026-10-07T15:00');assert.equal(x.date,'07/10/2026');assert.equal(x.wave,1.5);assert.equal(x.wind,5);assert.equal(x.registeredBy,'Teste');assert.equal(x.comment,'Surf à tarde');assert.equal(a.api.storage.sessions()[0].ts,x.ts);
 a.api.renderSpotDetail();assert.match(a.element('history').innerHTML,/07\/10\/2026 · 15:00/);
});
test('a failed save preserves the selected hour and evaluation for retry',async()=>{
 const a=app();choose(a,'2026-10-07T15:00');a.element('comment').value='Manter';a.context.fetch=async()=>({ok:false,json:async()=>({error:'test failure'})});await a.api.saveSession();
 assert.equal(a.api.state.registerTs,'2026-10-07T15:00');assert.equal(a.element('comment').value,'Manter');assert.equal(a.score.checked,true);assert.equal(a.api.storage.sessions().length,0);assert.equal(a.element('saveSession').disabled,false);
});
test('selecting a surf date with no data blocks saving instead of using another date',()=>{
 const a=app();a.element('sessionDay').value='2026-10-06';a.element('sessionDay').onchange();assert.equal(a.api.state.registerCapture,null);assert.equal(a.element('saveSession').disabled,true);assert.equal(a.element('sessionHour').disabled,true);
});

test('zero score is saved, contributes to the average and appears as 0/10 in history',async()=>{
 const a=app();a.score.value='0';choose(a,'2026-10-07T15:00');await a.api.saveSession();
 assert.equal(a.requests[0].session.score,0);assert.equal(a.api.storage.sessions()[0].score,0);
 a.api.renderSpotDetail();assert.equal(a.element('spotScore').textContent,'0.0');assert.match(a.element('history').innerHTML,/>0\/10</);
});

test('tide movement follows the selected surf hour and is saved with its forecast',async()=>{
 const a=app();a.api.state.tides.events['2026-10-07'].push({time:'22:00',height:.2,type:'low'});
 choose(a,'2026-10-07T15:00');assert.equal(a.api.state.registerCapture.forecast.tideMovement,'rising');assert.equal(a.element('sessionTideMovement').textContent,'enchendo');assert.match(a.element('rt').textContent,/↑/);
 choose(a,'2026-10-07T21:00');assert.equal(a.api.state.registerCapture.forecast.tideMovement,'falling');assert.equal(a.element('sessionTideMovement').textContent,'vazando');assert.match(a.element('rt').textContent,/↓/);
 await a.api.saveSession();assert.equal(a.requests[0].session.forecast.tideMovement,'falling');assert.equal(a.api.storage.sessions()[0].forecast.tideMovement,'falling');assert.equal(a.requests[0].session.originalForecast.forecast.tideMovement,'falling');
});
test('incomplete tide table never invents a movement',()=>{
 const a=app();choose(a,'2026-10-07T07:00');assert.equal(a.api.state.registerCapture.forecast.tideMovement,null);assert.equal(a.element('sessionTideMovement').textContent,'');
 a.api.state.tides=null;choose(a,'2026-10-07T15:00');assert.equal(a.element('rt').textContent,'—');assert.equal(a.element('sessionTideMovement').textContent,'');
});

function savedSession(a,ts='2026-10-07T15:00'){
 const capture=a.api.sessionForecastAt(ts);return{id:'saved-1',...capture,spotId:'spot-1',spotName:'Pico teste',registeredBy:'Outro surfista',date:'07/10/2026',score:9,size:'1 m',comment:'Manter comentário',originalForecast:capture,manualAdjustments:null};
}
test('history pencil hides actions until enabled and opens the existing record',()=>{
 const a=app(),s=savedSession(a);a.api.storage.setSessions([s]);a.api.state.currentSpotId=s.spotId;a.api.renderSpotDetail();
 assert.ok(!a.element('history').innerHTML.includes('data-edit-session'));a.element('editHistory').onclick();assert.match(a.element('history').innerHTML,/data-edit-session="saved-1"/);
 a.api.openSessionEditor(s.id);assert.equal(a.context.location.hash,'register');assert.equal(a.element('registerTitle').textContent,'Editar sessão');assert.equal(a.element('comment').value,s.comment);assert.equal(a.score.checked,true);assert.equal(a.element('cancelSessionEdit').hidden,false);
});
test('correcting the hour updates one session, all conditions and preserves its author',async()=>{
 const a=app(),s=savedSession(a);a.api.storage.setSessions([s]);a.api.state.historyEditMode=true;a.api.openSessionEditor(s.id);
 choose(a,'2026-10-07T21:00');a.score.value='0';a.element('comment').value='Horário corrigido';await a.api.saveSession();
 const r=a.requests[0];assert.equal(r.action,'update_session');assert.equal(r.session.id,s.id);assert.equal(r.session.waveDir,180);assert.equal(r.session.wind,12);assert.equal(r.session.ts,'2026-10-07T21:00');assert.equal(r.session.registeredBy,'Outro surfista');assert.equal(r.session.score,0);
 assert.equal(a.api.storage.sessions().length,1);assert.equal(a.api.storage.sessions()[0].comment,'Horário corrigido');assert.equal(a.api.state.editingSession,null);assert.equal(a.api.state.historyEditMode,false);assert.equal(a.element('saveSession').textContent,'SALVAR SESSÃO');assert.equal(a.element('spotSelect').disabled,false);
});
test('old sessions retain stored precision and manual audit when forecast is unavailable',async()=>{
 const a=app(),s=savedSession(a);s.ts='2026-09-01T15:00';s.date='01/09/2026';s.waveDir=157.1234;s.originalForecast={...s.originalForecast,ts:s.ts};s.manualAdjustments={fields:{waveDir:{from:135,to:157.1234,source:'manual'}},by:'Outro surfista'};
 a.api.storage.setSessions([s]);a.api.openSessionEditor(s.id);assert.equal(a.api.state.registerCapture.waveDir,157.1234);a.api.renderRegisterCapture();a.element('comment').value='Só o comentário';await a.api.saveSession();
 assert.equal(a.requests[0].session.waveDir,157.1234);assert.equal(a.requests[0].session.ts,s.ts);assert.deepEqual(a.requests[0].session.manualAdjustments,s.manualAdjustments);
});
test('failed edit preserves draft and cancel never writes it',async()=>{
 const a=app(),s=savedSession(a);a.api.storage.setSessions([s]);a.api.openSessionEditor(s.id);choose(a,'2026-10-07T21:00');a.element('comment').value='Rascunho';a.context.fetch=async()=>({ok:false,json:async()=>({error:'failure'})});await a.api.saveSession();
 assert.equal(a.api.state.editingSession.id,s.id);assert.equal(a.element('comment').value,'Rascunho');assert.equal(a.api.storage.sessions()[0].ts,s.ts);assert.equal(a.element('saveSession').disabled,false);
 a.api.cancelSessionEdit(true);assert.equal(a.api.state.editingSession,null);assert.equal(a.api.storage.sessions()[0].comment,s.comment);assert.equal(a.context.location.hash,'spot');
});
test('delete requires confirmation, keeps records on error and removes only the chosen session',async()=>{
 const a=app(),s=savedSession(a);a.api.storage.setSessions([s,{...s,id:'saved-2'}]);a.api.state.currentSpotId=s.spotId;
 a.context.confirm=()=>false;await a.api.deleteSession(s.id);assert.equal(a.requests.length,0);assert.equal(a.api.storage.sessions().length,2);
 a.context.confirm=()=>true;a.context.fetch=async()=>({ok:false,json:async()=>({error:'failure'})});await a.api.deleteSession(s.id);assert.equal(a.api.storage.sessions().length,2);
 a.context.fetch=async(url,opts)=>{a.requests.push(JSON.parse(opts.body));return{ok:true,json:async()=>({ok:true})}};await a.api.deleteSession(s.id);
 assert.equal(a.requests[0].action,'delete_session');assert.equal(a.requests[0].sessionId,s.id);assert.equal(a.api.storage.sessions().length,1);assert.equal(a.api.storage.sessions()[0].id,'saved-2');assert.equal(a.api.state.historyEditMode,false);
});
test('changing back to stored time restores saved conditions; missing new time blocks save',async()=>{
 const a=app(),s=savedSession(a);s.waveDir=157;a.api.storage.setSessions([s]);a.api.openSessionEditor(s.id);choose(a,'2026-10-07T21:00');choose(a,s.ts);assert.equal(a.api.state.registerCapture.waveDir,157);
 choose(a,'2026-09-01T15:00');await a.api.saveSession();assert.equal(a.requests.length,0);assert.equal(a.api.storage.sessions()[0].waveDir,157);
});
