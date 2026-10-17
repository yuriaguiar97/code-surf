const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../code-engine.js'),'utf8'),ctx);
const {evaluate,radarFor}=ctx.CODEEngine;
const c={wave:2.2,period:12,waveDir:180,wind:3,windDir:180,energy:3000};
const base={id:'p',seed:{waveMin:2,periodMin:10,swellDir:'S',windDir:'L'}};
const strict={...base,seed:{...base.seed,windMode:'strict'}},vila={...strict,seed:{...strict.seed,windMin:5}};
test('legacy flexible spots still accept light wind in any direction',()=>{assert(evaluate(c,base).favorable);assert(!evaluate({...c,wind:6},base).favorable);});
test('strict spots require the configured sector even below 5 kt',()=>{
 assert(!evaluate(c,strict).favorable);assert(evaluate({...c,windDir:90},strict).favorable);
 assert(!evaluate({...c,wind:0,windDir:90},strict).favorable);
 assert(evaluate({...c,windDir:78.75},strict).favorable);
 assert(!evaluate({...c,windDir:101.25},strict).favorable);
});
test('minimum is exclusive, maximum inclusive, and history cannot override required wind',()=>{
 assert(!evaluate({...c,wind:5,windDir:90},vila).favorable);
 assert(evaluate({...c,wind:5.001,windDir:90},vila).favorable);
 assert(!evaluate({...c,wind:7,windDir:180},vila,Array.from({length:30},()=>({...c,wind:7,spotId:'p',score:10}))).favorable);
 assert(!evaluate({...c,wind:8,windDir:90},{...vila,seed:{...vila.seed,windMax:7}}).favorable);
});
test('wind-only mismatch creates swell radar, never CODE ON or a compatible alert',()=>{
 const ts='2026-10-19T07:00',sample={...c,ts,time:new Date(ts+':00-03:00').getTime()};
 const r=radarFor(strict,[],[sample],sample.time);assert.equal(r.state,'swell');assert.equal(r.windows[0].kind,'swell');assert(!evaluate(sample,strict).favorable);
});
test('adjacent full and swell-only hours are separate; CODE ON only inside full window',()=>{
 const hours=[6,7,8,9].map(h=>{const ts='2026-10-19T0'+h+':00';return{...c,ts,time:new Date(ts+':00-03:00').getTime(),windDir:h<8?90:180}});
 const before=radarFor(strict,[],hours,new Date('2026-10-18T12:00:00-03:00').getTime());assert.equal(before.state,'radar');assert.equal(before.windows.length,2);assert.equal(before.windows[0].kind,'compatible');assert.equal(before.windows[0].endHour,8);assert.equal(before.windows[1].kind,'swell');
 assert.equal(radarFor(strict,[],hours,hours[0].time).state,'on');assert.equal(radarFor(strict,[],hours,hours[2].time).state,'swell');
});
test('swell-only radar still rejects wrong swell direction, height and period',()=>{
 for(const mismatch of [{waveDir:135},{wave:1},{period:8}])assert(!evaluate({...c,...mismatch},strict,[],true).favorable);
});
