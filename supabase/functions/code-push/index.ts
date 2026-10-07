import { withSupabase } from 'npm:@supabase/server';
import webpush from 'npm:web-push@3.6.7';
import { LEADS, evaluate, leadFor, shouldNotify } from './engine.js';
const origin='https://yuriaguiar97.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const hash=async (s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const dayOf=(time:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
function validSubscription(s:any){
  try{const u=new URL(s.endpoint);const h=u.hostname;return u.protocol==='https:' && !u.port && !u.username && !u.password && (h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com')) && /^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh||'') && /^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth||'') && s.endpoint.length<2048;}catch{return false;}
}
function settings(s:any){return {enabled:s?.enabled===true,leads:Array.isArray(s?.leads)?s.leads.filter((n:any)=>LEADS.includes(n)):LEADS,daily:s?.daily!==false,spots:Object.fromEntries(Object.entries(s?.spots||{}).slice(0,100).filter(([k,v])=>k.length<=120&&typeof v==='boolean'))};}
async function json(url:string){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('forecast_http_'+r.status);return r.json();}
async function send(db:any,config:any,device:any,payload:any){
  try{await webpush.sendNotification(device.subscription,JSON.stringify(payload),{vapidDetails:{subject:'https://yuriaguiar97.github.io/code-surf/',publicKey:config.public_key,privateKey:config.private_key},TTL:3600,urgency:'normal',timeout:15000});return true;}
  catch(e:any){if(e.statusCode===404||e.statusCode===410){const {error}=await db.from('code_push_devices').update({active:false}).eq('id',device.id);if(error)throw error;}throw new Error('push_http_'+(e.statusCode||'failed'));}
}
async function monitor(db:any,config:any,dryRun=false){
  const now=new Date(),day=dayOf(now),bucket=now.toISOString().slice(0,13);
  const {error:lock}=dryRun?{error:null}:await db.from('code_push_runs').insert({bucket});if(lock?.code==='23505')return {ok:true,duplicate:true};if(lock)throw lock;
  try{
    const {data:devices,error:de}=await db.from('code_push_devices').select('*').eq('active',true);if(de)throw de;
    const active=(devices||[]).filter((d:any)=>d.settings.enabled);
    if(!active.length&&!dryRun){await db.from('code_push_runs').update({status:'ok',detail:{devices:0,sent:0}}).eq('bucket',bucket);return {ok:true,devices:0,sent:0};}
    const [marine,wind,spotsResult,sessionsResult,eventsResult]=await Promise.all([
      json('https://marine-api.open-meteo.com/v1/marine?latitude=-23.5&longitude=-44.25&hourly=wave_height,wave_direction,wave_period&models=ncep_gfswave025&timezone=America%2FSao_Paulo&forecast_days=8&cell_selection=sea'),
      json('https://api.open-meteo.com/v1/forecast?latitude=-23.4347&longitude=-45.0711&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&models=gfs_seamless&timezone=America%2FSao_Paulo&forecast_days=8'),
      db.from('code_spots').select('id,name,seed'),db.from('code_sessions').select('spot_id,score,wave,wave_dir,period,wind,wind_dir,energy'),db.from('code_push_events').select('*').gte('target_day',day)
    ]);
    for(const result of [spotsResult,sessionsResult,eventsResult])if(result.error)throw result.error;
    const sessions=sessionsResult.data.map((s:any)=>({...s,spotId:s.spot_id,waveDir:s.wave_dir,windDir:s.wind_dir}));
    const winds=new Map(wind.hourly.time.map((t:string,i:number)=>[t,{wind:wind.hourly.wind_speed_10m[i],windDir:wind.hourly.wind_direction_10m[i]}]));
    const hours=marine.hourly.time.map((t:string,i:number)=>({ts:t,time:new Date(t+':00-03:00').getTime(),wave:marine.hourly.wave_height[i],waveDir:marine.hourly.wave_direction[i],period:marine.hourly.wave_period[i],energy:1025*9.81*marine.hourly.wave_height[i]**2/16,...(winds.get(t)||{})})).filter((c:any)=>c.time>now.getTime() && Number(c.ts.slice(11,13))>=6 && Number(c.ts.slice(11,13))<=18);
    if(dryRun)return {ok:true,dryRun:true,forecastHours:hours.length,spots:spotsResult.data.map((spot:any)=>({id:spot.id,favorableHours:hours.filter((c:any)=>evaluate(c,spot,sessions).favorable).length}))};
    let sent=0,failed=0;
    for(const device of active){for(const spot of spotsResult.data){
      if(device.settings.spots?.[spot.id]===false)continue;
      const leads=device.settings.leads||LEADS,maxLead=Math.max(0,...leads);
      const candidates=hours.map((c:any)=>({...c,...evaluate(c,spot,sessions)}));
      const previous=eventsResult.data.filter((e:any)=>e.device_id===device.id && e.spot_id===spot.id);
      // Track existing windows even if the forecast deteriorates; discover the next favorable window.
      const first=candidates.find((c:any)=>c.favorable && (c.time-now.getTime())/3600000<=maxLead);
      const targets=new Set(previous.map((e:any)=>e.target_day));if(first)targets.add(first.ts.slice(0,10));
      for(const target of targets){
        const candidatesForDay=candidates.filter((c:any)=>c.ts.startsWith(target));if(!candidatesForDay.length)continue;
        const best=candidatesForDay.reduce((a:any,b:any)=>b.score>a.score?b:a);
        const event=previous.find((e:any)=>e.target_day===target);
        const lead=leadFor((best.time-now.getTime())/3600000,leads);
        if(!shouldNotify(event,{day,lead,favorable:best.favorable,daily:device.settings.daily}))continue;
        const title=!event?'Swell no radar · '+spot.name:best.favorable?'Swell se confirmando · '+spot.name:'Swell mudou · '+spot.name;
        const when=new Date(target+'T12:00:00-03:00').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'2-digit'});
        const body=best.favorable?`Condições compatíveis com o CODE para ${when}. ${best.wave.toFixed(1)} m · ${best.period.toFixed(0)} s · vento ${best.wind.toFixed(0)} kt.`:`A previsão para ${when} perdeu compatibilidade com o CODE. Acompanhe a evolução.`;
        try{
          await send(db,config,device,{title,body,tag:`code-${spot.id}-${target}`,url:'app.html#alerts'});
          const {error}=await db.from('code_push_events').upsert({device_id:device.id,spot_id:spot.id,target_day:target,last_day:day,favorable:best.favorable,sent_leads:[...new Set([...(event?.sent_leads||[]),...(lead===null?[]:[lead])])],sent_at:new Date().toISOString()});if(error)throw error;sent++;
        }catch{failed++;}
      }
    }}
    await db.from('code_push_runs').update({status:failed?'partial':'ok',detail:{devices:active.length,sent,failed}}).eq('bucket',bucket);
    return {ok:true,devices:active.length,sent,failed};
  }catch(e){await db.from('code_push_runs').update({status:'failed',detail:{error:String(e).slice(0,250)}}).eq('bucket',bucket);throw e;}
}
export default {fetch:withSupabase({auth:'none'},async(req,ctx)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
    const raw=await req.text();if(raw.length>16000)return reply({error:'payload_too_large'},413);
    let b:any;try{b=JSON.parse(raw)}catch{return reply({error:'invalid_json'},400);}
    const db=ctx.supabaseAdmin;
    const {data:config,error}=await db.from('code_push_config').select('*').eq('id',1).single();if(error||!config)throw new Error('push_configuration_missing');
    if(b.action==='run'){
      if(typeof b.secret!=='string'||await hash(b.secret)!==await hash(config.cron_secret))return reply({error:'unauthorized'},401);
      return reply(await monitor(db,config,b.dryRun===true));
    }
    if(typeof b.pin!=='string'||await hash(b.pin)!==await hash(config.group_pin))return reply({error:'invalid_pin'},401);
    if(b.action==='config')return reply({publicKey:config.public_key});
    if(!/^[a-f0-9]{64}$/.test(b.deviceToken||''))return reply({error:'invalid_device'},400);
    const id=await hash(b.deviceToken);
    const {data:device,error:readError}=await db.from('code_push_devices').select('*').eq('id',id).maybeSingle();if(readError)throw readError;
    if(b.action==='subscribe'){
      if(!validSubscription(b.subscription))return reply({error:'invalid_subscription'},400);
      const {error}=await db.from('code_push_devices').upsert({id,subscription:b.subscription,settings:settings(b.settings),active:true,updated_at:new Date().toISOString()});if(error)throw error;
      return reply({ok:true});
    }
    if(!device||!device.active)return reply({error:'device_not_registered'},404);
    if(b.action==='preferences'){
      const {error}=await db.from('code_push_devices').update({settings:settings(b.settings),updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;return reply({ok:true});
    }
    if(b.action==='test'){
      // Atomic cooldown prevents concurrent requests bypassing the rate limit.
      const {data:claimed,error}=await db.from('code_push_devices').update({test_at:new Date().toISOString()}).eq('id',id).or(`test_at.is.null,test_at.lt.${new Date(Date.now()-60000).toISOString()}`).select('id');if(error)throw error;if(!claimed?.length)return reply({error:'wait_before_test'},429);
      await send(db,config,device,{title:'CODE · Push conectado',body:'Seu aparelho recebeu a notificação de teste. Os picos monitorados serão acompanhados automaticamente.',tag:'code-test',url:'app.html#alerts'});return reply({ok:true,accepted:true});
    }
    return reply({error:'unknown_action'},400);
  }catch(e){console.error('CODE push:',String(e));return reply({error:'push_unavailable'},500);}
})};
