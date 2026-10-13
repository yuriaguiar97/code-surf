(()=>{'use strict';
const CFG={lat:-23.4347,lon:-45.0711,marineLat:-23.75,marineLon:-44.75,forecastVersion:'ubatuba-south-interpolated-wind-v4-past1',tz:'America/Sao_Paulo',forecastDays:7,pastDays:1,refreshMs:30*60*1000,staleMs:15*60*1000};
// Ubatuba-specific surrounding cells; order NW, NE, SW, SE.
// Fixed relative weights from the WG comparison, restricted to these available models.
const WIND_SOURCES=[
  {model:'gfs_seamless',weight:14.1,points:[[-23.371292,-45.117188],[-23.371292,-45],[-23.488441,-45.117188],[-23.488441,-45]]},
  {model:'ecmwf_ifs',weight:20.4,points:[[-23.374342,-45.094543],[-23.374342,-45],[-23.44464,-45.141968],[-23.44464,-45.047333]]},
  {model:'icon_global',weight:12.7,points:[[-23.375,-45.125],[-23.375,-45],[-23.5,-45.125],[-23.5,-45]]},
  {model:'gem_global',weight:5.7,points:[[-23.399994,-45.149994],[-23.399994,-45],[-23.549995,-45.149994],[-23.549995,-45]]}
];
async function fetchJSON(url,timeout=12000){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(timer)}}
function marineURL(fallback=false){const p=new URLSearchParams({latitude:CFG.marineLat,longitude:CFG.marineLon,hourly:'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period',timezone:CFG.tz,forecast_days:CFG.forecastDays,past_days:CFG.pastDays,cell_selection:'sea'});if(!fallback)p.set('models','ncep_gfswave025');return'https://marine-api.open-meteo.com/v1/marine?'+p}
function windURL(fallback=false,source=WIND_SOURCES[0]){
  const p=new URLSearchParams({latitude:fallback?CFG.lat:source.points.map(x=>x[0]).join(','),longitude:fallback?CFG.lon:source.points.map(x=>x[1]).join(','),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'kn',timezone:CFG.tz,forecast_days:CFG.forecastDays,past_days:CFG.pastDays,cell_selection:fallback?'sea':'nearest'});
  if(!fallback)p.set('models',source.model);
  return'https://api.open-meteo.com/v1/forecast?'+p;
}
function validWindNumber(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function interpolateWindModel(source,cells){
  if(!Array.isArray(cells)||cells.length!==4||cells.some(c=>!c?.hourly?.time?.length))throw new Error('Incomplete wind grid: '+source.model);
  const [nw,ne,sw,se]=cells,north=Number(nw.latitude),south=Number(sw.latitude);
  if(Math.abs(north-Number(ne.latitude))>1e-5||Math.abs(south-Number(se.latitude))>1e-5||north<=south)throw new Error('Invalid latitude grid');
  const xn=(CFG.lon-Number(nw.longitude))/(Number(ne.longitude)-Number(nw.longitude)),xs=(CFG.lon-Number(sw.longitude))/(Number(se.longitude)-Number(sw.longitude)),y=(CFG.lat-south)/(north-south);
  const weights=[(1-xn)*y,xn*y,(1-xs)*(1-y),xs*(1-y)];
  if(weights.some(w=>!Number.isFinite(w)||w<0||w>1))throw new Error('Wind grid does not enclose Ubatuba');
  const indices=cells.map(c=>new Map(c.hourly.time.map((t,i)=>[t,i]))),samples=new Map();
  for(const ts of nw.hourly.time){
    let u=0,v=0,g=0,gustValid=true,complete=true;
    for(let k=0;k<4;k++){
      const i=indices[k].get(ts),h=cells[k].hourly,speed=h.wind_speed_10m?.[i],direction=h.wind_direction_10m?.[i],gust=h.wind_gusts_10m?.[i];
      if(!validWindNumber(speed)||!validWindNumber(direction)||Number(speed)<0){complete=false;break}
      const a=Number(direction)*Math.PI/180;
      u+=weights[k]*Number(speed)*Math.sin(a);v+=weights[k]*Number(speed)*Math.cos(a);
      if(validWindNumber(gust)&&Number(gust)>=0)g+=weights[k]*Number(gust);else gustValid=false;
    }
    if(complete)samples.set(ts,{u,v,gust:gustValid?g:null});
  }
  if(!samples.size)throw new Error('No complete wind samples');
  return{model:source.model,weight:source.weight,samples,grids:cells.map((c,i)=>({latitude:c.latitude,longitude:c.longitude,weight:weights[i]}))};
}
function blendWindModels(models){
  if(!models.length)throw new Error('No wind models available');
  const times=[...new Set(models.flatMap(m=>[...m.samples.keys()]))].sort(),hourly={time:times,wind_speed_10m:[],wind_direction_10m:[],wind_gusts_10m:[],code_wind_sources:[]};
  let degraded=models.length!==WIND_SOURCES.length;
  for(const ts of times){
    const available=models.filter(m=>m.samples.has(ts)),total=available.reduce((a,m)=>a+m.weight,0);
    let u=0,v=0,gust=0,gustWeight=0;
    for(const m of available){
      const p=m.samples.get(ts),w=m.weight/total;u+=w*p.u;v+=w*p.v;
      if(validWindNumber(p.gust)){gust+=w*p.gust;gustWeight+=w}
    }
    hourly.wind_speed_10m.push(Math.hypot(u,v));
    hourly.wind_direction_10m.push(Math.hypot(u,v)<1e-8?null:(Math.atan2(u,v)*180/Math.PI+360)%360);
    hourly.wind_gusts_10m.push(gustWeight>0?gust/gustWeight:null);
    hourly.code_wind_sources.push(available.map(m=>({model:m.model,weight:m.weight/total})));
    if(available.length!==WIND_SOURCES.length)degraded=true;
  }
  return{latitude:CFG.lat,longitude:CFG.lon,timezone:CFG.tz,hourly_units:{time:'iso8601',wind_speed_10m:'kn',wind_direction_10m:'°',wind_gusts_10m:'kn'},hourly,codeWind:{model:'code_wind_blend_v1',method:'spatial-vector-interpolation + weighted-vector-blend',cellSelection:'nearest',degraded,sources:models.map(m=>({model:m.model,relativeWeight:m.weight,grids:m.grids}))}};
}
async function fetchWindForecast(){
  const results=await Promise.allSettled(WIND_SOURCES.map(async source=>interpolateWindModel(source,await fetchJSON(windURL(false,source),18000))));
  const models=[];
  for(const result of results){if(result.status==='fulfilled')models.push(result.value);else console.warn('Wind model unavailable',result.reason)}
  return blendWindModels(models);
}

async function load(days=7){const original=CFG.forecastDays;CFG.forecastDays=days;try{return await Promise.all([fetchJSON(marineURL(false)),fetchWindForecast()])}finally{CFG.forecastDays=original}}
globalThis.CODEForecast={load};
})();
