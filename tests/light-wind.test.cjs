const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../code-engine.js'),'utf8'),ctx);
const {evaluate,radarFor}=ctx.CODEEngine;
const spot={id:'p',seed:{waveMin:1.7,periodMin:9,swellDir:'SE/SSE',windDir:'N'}};
const c={wave:1.8,period:10,waveDir:160,wind:3,windDir:180,energy:2036};
test('up to and including 3 kt ignores wind direction; stronger wind checks it',()=>{
 for(const wind of [0,0.1,2,2.99,3])assert.equal(evaluate({...c,wind},spot).favorable,true,String(wind));
 for(const wind of [3.001,4,5,10])assert.equal(evaluate({...c,wind},spot).favorable,false,String(wind));
 assert.equal(evaluate({...c,wind:6,windDir:0},spot).favorable,true);
});
test('light wind does not bypass swell, size, period or explicit wind maximum',()=>{
 for(const mismatch of [{waveDir:180},{wave:1.6},{period:8},{wave:null},{period:null}])assert.equal(evaluate({...c,...mismatch},spot).favorable,false);
 assert.equal(evaluate(c,{...spot,seed:{...spot.seed,windMax:2}}).favorable,false);
});
test('calm wind needs no meaningful direction, but missing wind speed still rejects',()=>{
 assert.equal(evaluate({...c,wind:0,windDir:null},spot).favorable,true);
 assert.equal(evaluate({...c,wind:3,windDir:null},spot).favorable,true);
 assert.equal(evaluate({...c,wind:3.01,windDir:null},spot).favorable,false);
 assert.equal(evaluate({...c,wind:null},spot).favorable,false);
});
test('learned direction fit does not penalize light wind',()=>{
 const history=Array.from({length:20},()=>({...c,spotId:'p',score:10,windDir:0}));
 assert.equal(evaluate(c,spot,history).favorable,true);
});
test('only qualifying morning hours become a radar window',()=>{
 const hours=Array.from({length:12},(_,i)=>{const hour=i+6,ts='2026-10-20T'+String(hour).padStart(2,'0')+':00';return{...c,ts,time:new Date(ts+':00-03:00').getTime(),wind:hour<10?3:7}});
 const result=radarFor(spot,[],hours,new Date('2026-10-17T08:32:46-03:00').getTime());
 assert.equal(result.state,'radar');assert.equal(result.windows.length,2);assert.equal(result.windows[0].kind,'compatible');assert.equal(result.windows[1].kind,'swell');assert.equal(result.windows[0].startHour,6);assert.equal(result.windows[0].endHour,10);
 assert.equal(result.windows[0].samples.length,4);
});

test('custom per-spot limit supports zero, decimal and legacy 5 kt',()=>{
 for(const limit of [0,1,2.5,5]){
  const custom={...spot,seed:{...spot.seed,lightWindMax:limit}};
  assert.equal(evaluate({...c,wind:limit},custom).favorable,true);
  assert.equal(evaluate({...c,wind:limit+0.001},custom).favorable,false);
 }
 const custom={...spot,seed:{...spot.seed,lightWindMax:5}};
 assert.equal(evaluate({...c,wind:4,windDir:null},custom).favorable,true);
});
test('without a wind reference, a configured spot only qualifies within its light-wind limit',()=>{
 const unknown={...spot,seed:{...spot.seed,windDir:''}};
 assert.equal(evaluate({...c,wind:3},unknown).favorable,true);
 assert.equal(evaluate({...c,wind:3.001},unknown).favorable,false);
 const learned=Array.from({length:20},()=>({...c,wind:7,spotId:spot.id,score:10}));
 assert.equal(evaluate({...c,wind:7},{id:spot.id},learned).favorable,true);
});
test('missing or invalid per-spot settings use 3 kt; strict policy ignores the exemption',()=>{
 assert.equal(ctx.CODEEngine.lightWindLimit(),3);
 for(const value of [null,-1,'bad',201])assert.equal(ctx.CODEEngine.lightWindLimit({lightWindMax:value}),3);
 const strict={...spot,seed:{...spot.seed,windMode:'strict',lightWindMax:20}};
 assert.equal(evaluate({...c,wind:1,windDir:180},strict).favorable,false);
 assert.equal(evaluate({...c,wind:1,windDir:0},strict).favorable,true);
});
