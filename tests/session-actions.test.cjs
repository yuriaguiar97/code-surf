const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function backend(){
 const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/code-sync/index.ts'),'utf8');
 const code=source.replace(/^import[^\n]+\n/,'').replace('export default {','globalThis.handler = {').replace(/: unknown|: any/g,'');
 const rows=new Map([['session-1',{id:'session-1',spot_id:'spot-1',score:9,author:'Original',wave_dir:180}]]),calls=[];
 const db={from(table){assert.equal(table,'code_sessions');let action,values,id;const q={update(v){action='update';values=v;return q},delete(){action='delete';return q},eq(k,v){assert.equal(k,'id');id=v;calls.push({action,id,values});return q},select(){return q},async maybeSingle(){if(!rows.has(id))return{data:null,error:null};const row={...rows.get(id),...values};rows.set(id,row);return{data:row,error:null}},then(resolve,reject){if(action==='delete')rows.delete(id);return Promise.resolve({error:null}).then(resolve,reject)}};return q}};
 const context={Response,withSupabase:(_,f)=>req=>f(req,{supabaseAdmin:db})};vm.runInNewContext(code,context);
 // Match the configured server PIN without exposing it in test logs.
 const pin=source.match(/body\?\.pin \|\| ''\) !== '([^']+)'/)[1];
 const request=(action,payload={},access=pin)=>context.handler.fetch({method:'POST',json:async()=>({action,pin:access,actor:'Editor',...payload})});
 return{request,rows,calls};
}
test('shared update targets one existing row, preserves author and accepts zero',async()=>{
 const b=backend(),r=await b.request('update_session',{session:{id:'session-1',spotId:'spot-1',score:0,registeredBy:'Forged',waveDir:157,ts:'2026-10-08T15:00'}});assert.equal(r.status,200);const body=await r.json();assert.equal(body.session.id,'session-1');assert.equal(body.session.score,0);assert.equal(body.session.registeredBy,'Original');assert.equal(body.session.waveDir,157);assert.equal(b.rows.size,1);assert.equal(b.calls[0].id,'session-1');assert.ok(!Object.hasOwn(b.calls[0].values,'author'));
});
test('deleted sessions cannot be recreated by an edit; invalid scores rejected',async()=>{
 const b=backend();assert.equal((await b.request('update_session',{session:{id:'missing',spotId:'spot-1',score:8}})).status,404);assert.equal(b.rows.size,1);
 for(const score of [-1,11,'bad'])assert.equal((await b.request('update_session',{session:{id:'session-1',spotId:'spot-1',score}})).status,400);
});
test('shared deletion filters by ID and both mutations require the group PIN',async()=>{
 const b=backend();for(const action of ['delete_session','update_session'])assert.equal((await b.request(action,{sessionId:'session-1',session:{id:'session-1',spotId:'spot-1',score:8}},'invalid')).status,401);assert.equal(b.calls.length,0);
 assert.equal((await b.request('delete_session',{})).status,400);assert.equal(b.rows.size,1);
 assert.equal((await b.request('delete_session',{sessionId:'session-1'})).status,200);assert.equal(b.rows.size,0);assert.equal(b.calls[0].id,'session-1');
});
