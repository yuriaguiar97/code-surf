const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../code-engine.js'),'utf8'),context);
const {evaluate,radarFor}=context.CODEEngine;
const base={wave:1.2,period:8,wind:3,windDir:90,energy:905};
const east={id:'fora',seed:{waveMin:1,periodMin:8,swellDir:'L'}};
test('Leste requires its exact half-open sector',()=>{
 for(const [degree,expected] of [[78.749,false],[78.75,true],[90,true],[101.249,true],[101.25,false],[112.5,false],[134,false],[135,false],[null,false]]){
 assert.equal(evaluate({...base,waveDir:degree},east).favorable,expected,String(degree));
 }
});
test('all 16 named sectors respect their boundaries and north wrap',()=>{
 const labels=['N','NNE','NE','ENE','L','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
 labels.forEach((label,i)=>{const center=i*22.5,spot={id:'s',seed:{waveMin:1,swellDir:label}},normal=d=>(d+360)%360;
 for(const delta of [-11.25,0,11.249])assert.equal(evaluate({...base,waveDir:normal(center+delta)},spot).favorable,true,label+' '+delta);
 for(const delta of [-11.251,11.25])assert.equal(evaluate({...base,waveDir:normal(center+delta)},spot).favorable,false,label+' '+delta);
 });
 assert.equal(evaluate({...base,waveDir:360},{id:'n',seed:{waveMin:1,swellDir:'N'}}).favorable,true);
});
test('multiple configured directions are honored, and learning cannot bypass them',()=>{
 const multi={id:'s',seed:{waveMin:1,swellDir:'L / SE'}};
 assert.equal(evaluate({...base,waveDir:90},multi).favorable,true);
 assert.equal(evaluate({...base,waveDir:135},multi).favorable,true);
 assert.equal(evaluate({...base,waveDir:112.5},multi).favorable,false);
 const sessions=Array.from({length:30},()=>({...base,waveDir:135,spotId:'fora',score:10}));
 assert.equal(evaluate({...base,waveDir:135},east,sessions).favorable,false);
 assert.equal(evaluate({...base,waveDir:135},{id:'fora'},sessions).favorable,true);
});
test('SE Saturday/Sunday hours do not create a radar window for Leste',()=>{
 const hours=['2026-10-17T12:00','2026-10-17T13:00','2026-10-18T06:00'].map((ts,i)=>({...base,waveDir:i===1?134:135,ts,time:new Date(ts+':00-03:00').getTime()}));
 const result=radarFor(east,[],hours,new Date('2026-10-13T10:00:00-03:00').getTime());
 assert.equal(result.state,'off');assert.equal(result.windows.length,0);
});
