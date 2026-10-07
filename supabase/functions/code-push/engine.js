// Pure evaluator: conditions are matched jointly against each successful session.
export const LEADS = [168, 120, 72, 48, 24];
const number = v => v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
export const angleDistance = (a,b) => Math.abs(((a-b+540)%360)-180);
export function directions(text='') {
  const names={N:0,NORTE:0,NE:45,NORDESTE:45,L:90,E:90,LESTE:90,SE:135,SUDESTE:135,S:180,SUL:180,SO:225,SW:225,SUDOESTE:225,O:270,W:270,OESTE:270,NO:315,NW:315,NOROESTE:315};
  return String(text).toUpperCase().split(/[^A-Z]+/).filter(t=>t in names).map(t=>names[t]);
}
function seedMatch(c,s) {
  const bounds=[['wave','waveMin','waveMax'],['period','periodMin','periodMax'],['wind',null,'windMax']];
  let criteria=0;
  for(const [key,min,max] of bounds) {
    for(const [field,isMin] of [[min,true],[max,false]]) {
      if(field && number(s[field])!==null){criteria++;if(number(c[key])===null || (isMin?c[key]<s[field]:c[key]>s[field]))return false;}
    }
  }
  for(const [key,field] of [['waveDir','swellDir'],['windDir','windDir']]) {
    const ds=directions(s[field]);if(ds.length){criteria++;if(number(c[key])===null || !ds.some(d=>angleDistance(c[key],d)<=45))return false;}
  }
  // A note alone is not a measurable CODE.
  return criteria>=2;
}
function sessionMatch(c,s) {
  const tolerances={wave:0.5,period:2,wind:5,energy:700};
  let criteria=0, total=0;
  for(const [key,tol] of Object.entries(tolerances)) {
    const v=number(s[key]);if(v===null)continue;criteria++;
    if(number(c[key])===null)return 0;
    total+=Math.max(0,1-Math.abs(c[key]-v)/Math.max(tol,Math.abs(v)*0.3));
  }
  for(const key of ['waveDir','windDir']){if(number(s[key])!==null){criteria++;if(number(c[key])===null)return 0;total+=Math.max(0,1-angleDistance(c[key],s[key])/90);}}
  return criteria>=4?total/criteria:0;
}
export function evaluate(c,spot,sessions=[]) {
  if(['wave','period','wind','waveDir','windDir'].some(k=>number(c[k])===null))return {favorable:false,score:0};
  const good=sessions.filter(s=>s.spotId===spot.id && s.score>=8);
  const seed=seedMatch(c,spot.seed||{});
  if(!good.length)return {favorable:seed,score:seed?1:0};
  const weighted=good.map(s=>({fit:sessionMatch(c,s),weight:s.score*s.score}));
  const learned=weighted.reduce((n,s)=>n+s.fit*s.weight,0)/weighted.reduce((n,s)=>n+s.weight,0);
  const learnedWeight=Math.min(0.85,good.length/(good.length+3));
  const score=spot.seed?learned*learnedWeight+Number(seed)*(1-learnedWeight):learned;
  return {favorable:score>=0.7,score};
}
export function firstLead(settings={}) {const values=Array.isArray(settings?.leads)?settings.leads.map(Number).filter(n=>LEADS.includes(n)):LEADS.includes(Number(settings?.lead))?[Number(settings?.lead)]:[];return values.length?Math.max(...values):168;}
export function leadFor(hours,leads) {return [...leads].sort((a,b)=>a-b).find(v=>hours>0 && hours<=v)??null;}
export function shouldNotify(previous,{day,lead,favorable,daily}) {
  if(!previous)return favorable && lead!==null;
  if(previous.last_day===day)return false;
  return daily===true;
}
