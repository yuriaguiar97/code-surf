import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate,angleDistance,directions,leadFor,shouldNotify } from '../supabase/functions/code-push/engine.js';
const conditions={wave:2.3,period:12,wind:4,waveDir:180,windDir:90,energy:3320};
const spot={id:'test',seed:{waveMin:2,periodMin:10,swellDir:'S/SE',windDir:'L'}};
test('seed matches all measured variables jointly',()=>{
 assert.equal(evaluate(conditions,spot).favorable,true);
 for(const mismatch of [{wave:1},{period:8},{windDir:270},{waveDir:0},{wave:null}])assert.equal(evaluate({...conditions,...mismatch},spot).favorable,false);
 assert.equal(evaluate(conditions,{id:'empty',seed:{note:'good waves'}}).favorable,false);
});
test('Portuguese and English directions wrap at north',()=>{
 assert.deepEqual(directions('Oeste Sudoeste / NE / L'),[270,225,45,90]);
 assert.equal(angleDistance(355,5),10);
 assert.equal(evaluate({...conditions,waveDir:355},{id:'n',seed:{waveMin:1,swellDir:'N'}}).favorable,true);
});
test('successful sessions must match together and low scores do not train',()=>{
 const good={...conditions,spotId:'test',score:10};
 assert.equal(evaluate(conditions,{id:'test'},[good]).favorable,true);
 assert.equal(evaluate({...conditions,wave:4,period:5,wind:25,windDir:270},{id:'test'},[good]).favorable,false);
 assert.equal(evaluate(conditions,{id:'test'},[{...good,score:5}]).favorable,false);
 assert.equal(evaluate(conditions,{id:'test'},[{...good,spotId:'other'}]).favorable,false);
});
test('7-day and milestone boundaries',()=>{
 assert.equal(leadFor(168,[168,120,72,48,24]),168);
 assert.equal(leadFor(169,[168,120,72,48,24]),null);
 assert.equal(leadFor(49,[168,120,72,48,24]),72);
 assert.equal(leadFor(0,[24]),null);
});
test('daily follow-up includes deterioration, avoids duplicates and respects independent leads',()=>{
 const args={day:'2026-10-08',lead:120,favorable:true,daily:false};
 assert.equal(shouldNotify(null,args),true);
 assert.equal(shouldNotify(null,{...args,favorable:false}),false);
 const previous={last_day:'2026-10-07',sent_leads:[168,120]};
 assert.equal(shouldNotify(previous,args),false);
 assert.equal(shouldNotify(previous,{...args,daily:true,favorable:false}),true);
 assert.equal(shouldNotify({...previous,last_day:args.day},{...args,daily:true}),false);
 assert.equal(shouldNotify(previous,{...args,lead:72}),true);
});
