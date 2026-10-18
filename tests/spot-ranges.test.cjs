const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function app(){
  const context={Date,Intl,URLSearchParams,AbortController,console,setTimeout,clearTimeout,document:{getElementById:()=>null},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../code-engine.js'),'utf8'),context);
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  vm.runInNewContext(source.slice(source.indexOf("'use strict';"),source.indexOf('const PUSH_URL='))+'\nglobalThis.api={spotConditionRanges,directionRange,seedDirectionRange,learnedRange};',context);
  return context.api;
}
const spot={id:'a',seed:{waveMin:1,waveMax:2,periodMin:8,periodMax:12,swellDir:'SE/SSE',windDir:'S',windMode:'flexible',lightWindMax:3}};
const first={spotId:'a',score:8,wave:1.6,waveDir:126,period:9,wind:4,windDir:180,gust:6,energy:1529,tide:0,forecast:{tideMovement:'rising'}};
const second={...first,score:9,wave:1.7,waveDir:146,period:11,wind:6,windDir:202,gust:8,energy:1903,tide:-.2,forecast:{tideMovement:'falling'}};
const values=result=>Object.fromEntries(result.fields.map(f=>[f.key,f.value]));
test('all nine ranges use only successful sessions from the selected spot, preserving records',()=>{
 const api=app(),sessions=[first,second,{...second,score:7,wave:10,tide:5},{...second,spotId:'other',wave:20}],before=JSON.stringify(sessions);
 const result=api.spotConditionRanges(spot,sessions),v=values(result);
 assert.equal(result.fields.length,9);assert.match(result.source,/2 sessões com nota 8 ou mais/);
 assert.equal(v.wave,'1.6–1.7 m');assert.equal(v.waveDir,'SE · 126°–146°');assert.equal(v.period,'9–11 s');
 assert.equal(v.wind,'4–6 kt');assert.equal(v.windDir,'S–SSO · 180°–202°');assert.equal(v.gust,'6–8 kt');
 assert.equal(v.energy,'1529–1903 J/m²');assert.equal(v.tide,'-0.20–0.00 m');assert.equal(v.tideMovement,'Enchendo ↑ / Vazando ↓');assert.equal(JSON.stringify(sessions),before);
});
test('missing measurements never become zero; real zero and negative tides remain valid',()=>{
 const api=app();assert.equal(api.learnedRange([{tide:null},{tide:''},{tide:undefined},{tide:NaN},{tide:Infinity},{tide:false}],'tide',2,' m'),'Sem registro');
 assert.equal(api.learnedRange([{tide:0},{tide:-.1}],'tide',2,' m'),'-0.10–0.00 m');
 assert.equal(api.learnedRange([{wave:1.6},{wave:1.6}],'wave',1,' m'),'1.6 m');
});
test('directions use the shortest containing arc through north without changing the input',()=>{
 const {directionRange}=app(),values=[350,10,0,360,null,'',undefined,NaN,361,-1],copy=values.slice();
 assert.equal(directionRange(values),'N · 350°–10° (via N)');assert.deepEqual(values,copy);
 assert.equal(directionRange([126,146]),'SE · 126°–146°');assert.equal(directionRange([135,135]),'SE · 135°');assert.equal(directionRange([null,undefined,'']),'Sem registro');
});
test('north initial references are explicit and do not fabricate unconfigured tide, energy or gust',()=>{
 const api=app(),result=api.spotConditionRanges(spot,[{...first,score:7}]),v=values(result);
 assert.match(result.source,/norte inicial/);assert.equal(v.wave,'1.0–2.0 m');assert.equal(v.period,'8–12 s');
 assert.equal(v.waveDir,'SE · 123.75°–146.25° / SSE · 146.25°–168.75°');
 for(const key of ['energy','tide','tideMovement','gust'])assert.equal(v[key],'Sem referência');
 assert.match(v.windDir,/135.00°–225.00°/);assert.match(v.windDir,/até 3.0 kt, qualquer direção/);
});
test('seed angular sectors wrap north; strict wind uses its required sector and exclusive minimum',()=>{
 const api=app();assert.equal(api.seedDirectionRange('N'),'N · 348.75°–11.25° (via N)');
 const v=values(api.spotConditionRanges({id:'a',seed:{windMode:'strict',windDir:'L',windMin:5,windMax:10,waveMin:0}},[]));
 assert.equal(v.windDir,'L · 78.75°–101.25°');assert.equal(v.wind,'> 5 a 10 kt');assert.equal(v.wave,'≥ 0.0 m');
});
test('good sessions with missing tide never fall back to poor sessions or infer tide movement',()=>{
 const api=app(),v=values(api.spotConditionRanges(spot,[{...first,tide:null,forecast:{}},{...second,score:7}]));
 assert.equal(v.tide,'Sem registro');assert.equal(v.tideMovement,'Sem registro');
});
test('empty and legacy spots remain readable without inventing a profile',()=>{
 const result=app().spotConditionRanges({id:'a'},[]);assert.match(result.source,/Registre sessões/);assert(result.fields.every(f=>f.value==='Sem referência'));
});
