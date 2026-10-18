const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function app(){
 const elements=new Map(),values=new Map(),requests=[];
 const element=id=>{if(!elements.has(id)){const classes=new Set();let inputValue='';elements.set(id,{get value(){return inputValue},set value(v){inputValue=String(v)},textContent:'',innerHTML:'',hidden:false,disabled:false,style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},querySelector:()=>({scrollTop:0}),focus(){},scrollIntoView(){}})}return elements.get(id)};
 const context={Date,Intl,URLSearchParams,AbortController,location:{hash:'#spot'},console:{error(){},warn(){}},setTimeout:()=>0,clearTimeout(){},document:{getElementById:element,querySelectorAll:()=>[]},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},sessionStorage:{getItem:()=>null},mockRequest:async(action,payload)=>{requests.push({action,...payload});return{}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../code-engine.js'),'utf8'),context);
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 vm.runInNewContext(source.slice(source.indexOf("'use strict';"),source.indexOf('const PUSH_URL='))+'\nsharedRequest=(...args)=>mockRequest(...args);renderSpots=()=>{};renderSpotDetail=()=>{};globalThis.api={state,storage,openSpotEditor,closeSpotEditor,deleteSpot,confirmSpotDeletion,updateSpotDeletion,cancelSpotDeletion};',context);
 context.api.storage.setSpots([{id:'a',name:'Toninhas'},{id:'b',name:'Cepilho'}]);context.api.storage.setSessions([{id:'s1',spotId:'a'},{id:'s2',spotId:'a'},{id:'s3',spotId:'b'}]);context.api.state.currentSpotId='a';
 return{...context.api,element,requests,context};
}
test('opening editor, opening delete intent and wrong names never send a delete request',async()=>{
 const a=app();a.openSpotEditor('a');assert.equal(a.element('spotDangerZone').open,false);a.deleteSpot('a');
 assert.match(a.element('spotDeleteImpact').textContent,/2 sessões/);assert.equal(a.element('confirmSpotDelete').disabled,true);
 for(const text of ['', 'Toninha','toninhas','Cepilho']){a.element('spotDeleteName').value=text;a.updateSpotDeletion();assert.equal(a.element('confirmSpotDelete').disabled,true);await a.confirmSpotDeletion()}
 assert.equal(a.requests.length,0);assert.equal(a.storage.spots().length,2);assert.equal(a.storage.sessions().length,3);
});
test('explicit exact-name confirmation deletes only the targeted spot and its sessions',async()=>{
 const a=app();a.openSpotEditor('a');a.deleteSpot('a');a.element('spotDeleteName').value='Toninhas';a.updateSpotDeletion();assert.equal(a.element('confirmSpotDelete').disabled,false);
 await a.confirmSpotDeletion();assert.equal(a.requests.length,1);assert.equal(a.requests[0].action,'delete_spot');assert.equal(a.requests[0].spotId,'a');
 assert.deepEqual(Array.from(a.storage.spots(),s=>s.id),['b']);assert.deepEqual(Array.from(a.storage.sessions(),s=>s.id),['s3']);assert.equal(a.state.currentSpotId,'');
});
test('cancel, close and switching editors clear confirmation instead of reusing a typed name',async()=>{
 for(const finish of [a=>a.cancelSpotDeletion(),a=>a.closeSpotEditor(),a=>a.openSpotEditor('b')]){
  const a=app();a.openSpotEditor('a');a.deleteSpot('a');a.element('spotDeleteName').value='Toninhas';finish(a);await a.confirmSpotDeletion();assert.equal(a.requests.length,0);
 }
});
test('a stale name or changed target blocks deletion even with the old name entered',async()=>{
 for(const change of [a=>a.storage.setSpots([{id:'a',name:'Nome novo'}]),a=>a.state.editingSpotId='b',a=>a.element('spotDangerZone').open=false]){
  const a=app();a.openSpotEditor('a');a.deleteSpot('a');a.element('spotDeleteName').value='Toninhas';change(a);await a.confirmSpotDeletion();assert.equal(a.requests.length,0);
 }
});
test('double confirmation sends one request and cannot close the editor while pending',async()=>{
 const a=app();let release;a.context.mockRequest=(action,payload)=>{a.requests.push({action,...payload});return new Promise(resolve=>release=resolve)};
 a.openSpotEditor('a');a.deleteSpot('a');a.element('spotDeleteName').value='Toninhas';const pending=a.confirmSpotDeletion();await a.confirmSpotDeletion();a.closeSpotEditor();
 assert.equal(a.requests.length,1);assert.equal(a.element('confirmSpotDelete').disabled,true);assert.equal(a.element('spotModal').classList.contains('show'),true);
 release({});await pending;assert.equal(a.storage.spots().length,1);
});
test('server error retains local data, displays a retry message and does not automatically retry',async()=>{
 const a=app();a.context.mockRequest=async()=>{a.requests.push({});throw Error('offline')};a.openSpotEditor('a');a.deleteSpot('a');a.element('spotDeleteName').value='Toninhas';
 await a.confirmSpotDeletion();assert.equal(a.storage.spots().length,2);assert.equal(a.storage.sessions().length,3);assert.equal(a.requests.length,1);assert.match(a.element('spotDeleteError').textContent,/confirmar a exclusão/);assert.equal(a.element('spotModal').classList.contains('show'),true);
});
test('new spots do not expose destructive controls',()=>{const a=app();a.openSpotEditor();assert.equal(a.element('spotDangerZone').classList.contains('hidden'),true)});
