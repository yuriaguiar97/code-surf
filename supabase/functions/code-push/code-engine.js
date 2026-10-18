(()=>{'use strict';
// Pure evaluator: conditions are matched jointly against each successful session.
const LEADS = [168, 120, 72, 48, 24];
const number = v => v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
const angleDistance = (a,b) => Math.abs(((a-b+540)%360)-180);
function directions(text='') {
  const names={NNE:22.5,ENE:67.5,ESE:112.5,SSE:157.5,SSO:202.5,SSW:202.5,OSO:247.5,WSW:247.5,ONO:292.5,WNW:292.5,NNO:337.5,NNW:337.5,N:0,NORTE:0,NE:45,NORDESTE:45,L:90,E:90,LESTE:90,SE:135,SUDESTE:135,S:180,SUL:180,SO:225,SW:225,SUDOESTE:225,O:270,W:270,OESTE:270,NO:315,NW:315,NOROESTE:315};
  return String(text).toUpperCase().split(/[^A-Z]+/).filter(t=>t in names).map(t=>names[t]);
}
// Use the same half-open 16-direction sectors displayed by the forecast.
const directionSector = degrees => Math.floor((((degrees%360)+360)%360+11.25)/22.5)%16;
function swellDirectionMatch(degrees,text){const ds=directions(text);return !ds.length || (number(degrees)!==null && ds.some(d=>directionSector(degrees)===directionSector(d)));}
const LIGHT_WIND_KT=3;
function lightWindLimit(s={}){const value=number(s?.lightWindMax);return value!==null&&value>=0&&value<=200?value:LIGHT_WIND_KT;}
const lightWind=(c,s)=>number(c.wind)!==null && c.wind>=0 && c.wind<=lightWindLimit(s);
function missingConditions(c,s){return ['wave','period','wind','waveDir'].some(k=>number(c[k])===null) || (!lightWind(c,s)&&number(c.windDir)===null)}
function windMatch(c,s){
  if(number(c.wind)===null||c.wind<0)return false;
  // Without an initial CODE, successful sessions continue to provide the wind reference.
  if(!s)return true;
  if(number(s.windMax)!==null&&c.wind>s.windMax)return false;
  if(number(s.windMin)!==null&&c.wind<=s.windMin)return false;
  const ds=directions(s.windDir),strict=s.windMode==='strict';
  if(strict&&(c.wind===0||!ds.length))return false;
  if(!strict&&lightWind(c,s))return true;
  if(!ds.length)return false;
  if(number(c.windDir)===null)return false;
  return strict?swellDirectionMatch(c.windDir,s.windDir):ds.some(d=>angleDistance(c.windDir,d)<=45);
}
function seedMatch(c,s,ignoreWind=false) {
  const bounds=[['wave','waveMin','waveMax'],['period','periodMin','periodMax']];
  let criteria=0;
  for(const [key,min,max] of bounds)for(const [field,isMin] of [[min,true],[max,false]]){
    if(number(s[field])!==null){criteria++;if(number(c[key])===null||(isMin?c[key]<s[field]:c[key]>s[field]))return false;}
  }
  if(directions(s.swellDir).length){criteria++;if(!swellDirectionMatch(c.waveDir,s.swellDir))return false;}
  if(!ignoreWind){
    if(!windMatch(c,s))return false;
    if(directions(s.windDir).length)criteria++;
    if(number(s.windMax)!==null)criteria++;
    if(number(s.windMin)!==null)criteria++;
  }
  return criteria>=2;
}
function sessionMatch(c,s,ignoreWind=false,strictWind=false,windSeed={}) {
  const tolerances={wave:0.5,period:2,wind:5,energy:700};
  let criteria=0,total=0;
  for(const [key,tol] of Object.entries(tolerances)){
    if(ignoreWind&&key==='wind')continue;
    const v=number(s[key]);if(v===null)continue;criteria++;
    if(number(c[key])===null)return 0;
    total+=Math.max(0,1-Math.abs(c[key]-v)/Math.max(tol,Math.abs(v)*0.3));
  }
  for(const key of ['waveDir','windDir']){
    if(ignoreWind&&key==='windDir')continue;
    if(number(s[key])!==null){criteria++;if(key==='windDir'&&!strictWind&&lightWind(c,windSeed)){total+=1;continue}if(number(c[key])===null)return 0;total+=Math.max(0,1-angleDistance(c[key],s[key])/90);}
  }
  return criteria>=4?total/criteria:0;
}
function evaluate(c,spot,sessions=[],ignoreWind=false) {
  if(ignoreWind?['wave','period','waveDir'].some(k=>number(c[k])===null):missingConditions(c,spot.seed))return {favorable:false,score:0};
  if(!swellDirectionMatch(c.waveDir,spot.seed?.swellDir))return {favorable:false,score:0};
  if(!ignoreWind&&!windMatch(c,spot.seed))return {favorable:false,score:0};
  const good=sessions.filter(s=>s.spotId===spot.id&&s.score>=8),seed=seedMatch(c,spot.seed||{},ignoreWind);
  if(!good.length)return {favorable:seed,score:seed?1:0};
  const weighted=good.map(s=>({fit:sessionMatch(c,s,ignoreWind,spot.seed?.windMode==='strict',spot.seed),weight:s.score*s.score}));
  const learned=weighted.reduce((n,s)=>n+s.fit*s.weight,0)/weighted.reduce((n,s)=>n+s.weight,0),learnedWeight=Math.min(0.85,good.length/(good.length+3));
  const score=spot.seed?learned*learnedWeight+Number(seed)*(1-learnedWeight):learned;
  return {favorable:score>=0.7,score};
}
function firstLead(settings={}) {const values=Array.isArray(settings?.leads)?settings.leads.map(Number).filter(n=>LEADS.includes(n)):LEADS.includes(Number(settings?.lead))?[Number(settings?.lead)]:[];return values.length?Math.max(...values):168;}
function leadFor(hours,leads) {return [...leads].sort((a,b)=>a-b).find(v=>hours>0 && hours<=v)??null;}
function shouldNotify(previous,{day,lead,favorable,daily}) {
  if(!previous)return favorable && lead!==null;
  if(daily!==true)return false;
  if(previous.favorable!==favorable)return true;
  if(!favorable)return false;
  return previous.last_day!==day;
}

function radarFor(spot,sessions,hours,now=Date.now(),available=true){
  if(!available)return {state:'unavailable',windows:[]};
  const today=new Date(now-3*3600000).toISOString().slice(0,10),last=new Date(new Date(today+'T12:00:00-03:00').getTime()+6*86400000).toISOString().slice(0,10);
  const valid=hours.filter(c=>c.ts.slice(0,10)>=today&&c.ts.slice(0,10)<=last&&Number(c.ts.slice(11,13))>=6&&Number(c.ts.slice(11,13))<18);
  if(!valid.length)return {state:'unavailable',windows:[]};
  const incomplete=valid.some(c=>missingConditions(c,spot.seed));
  if(Object.entries(spot.seed||{}).filter(([k,v])=>!['note','windMode','lightWindMax'].includes(k)&&v!==null&&v!==''&&v!==undefined).length<2&&!sessions.some(s=>s.spotId===spot.id&&s.score>=8))return {state:'insufficient',windows:[]};
  const windows=[];
  for(const c of valid){
    const full=evaluate(c,spot,sessions).favorable;
    if(!full&&!evaluate(c,spot,sessions,true).favorable)continue;
    const kind=full?'compatible':'swell',prior=windows.at(-1);
    if(prior&&prior.kind===kind&&prior.day===c.ts.slice(0,10)&&c.time===prior.end){prior.end=c.time+3600000;prior.endHour=Number(c.ts.slice(11,13))+1;prior.samples.push(c);}
    else windows.push({kind,day:c.ts.slice(0,10),start:c.time,end:c.time+3600000,startHour:Number(c.ts.slice(11,13)),endHour:Number(c.ts.slice(11,13))+1,samples:[c]});
  }
  const upcoming=windows.filter(w=>w.end>now),complete=upcoming.filter(w=>w.kind==='compatible');
  return {state:complete.some(w=>w.start<=now&&w.end>now)?'on':complete.length?'radar':upcoming.length?'swell':incomplete?'unavailable':'off',windows:upcoming};
}
function sortSpots(spots,mode,radars,confidence){
  const compare=(a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base',numeric:true});
  const ranks={on:0,radar:1,swell:2,off:3,insufficient:4,unavailable:5};
  return [...spots].sort((a,b)=>{if(mode==='name-asc')return compare(a,b);if(mode==='name-desc')return compare(b,a);if(mode==='confidence-asc')return confidence(a)-confidence(b)||compare(a,b);if(mode==='confidence-desc')return confidence(b)-confidence(a)||compare(a,b);const x=radars[a.id],y=radars[b.id];return (ranks[x.state]-ranks[y.state])||((x.windows[0]?.start||0)-(y.windows[0]?.start||0))||compare(a,b);});
}

globalThis.CODEEngine={lightWindLimit,LEADS,firstLead,evaluate,leadFor,shouldNotify,angleDistance,directions,radarFor,sortSpots};
})();
