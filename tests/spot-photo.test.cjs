const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const lastRule=selector=>rules.filter(([,selectors])=>selectors.split(',').map(s=>s.trim()).includes(selector)).at(-1)?.[2]||'';
test('spot photo status progressively restores color without filtering the card or overlays',()=>{
  const host=lastRule('.spot-card .spot-thumb'),image=lastRule('.spot-card .spot-thumb:before');
  assert.match(host,/background:none/);assert.match(host,/filter:none/);
  // The reduced-motion rule changes only the transition, so inspect the image layer directly.
  assert.match(css,/\.spot-card \.spot-thumb:before\{[^}]*background-image:var\(--spot-img\)[^}]*filter:var\(--spot-photo-filter\)/);
  assert.doesNotMatch(host,/filter:(?!none)[^;]*;/);
  const on=lastRule('.spot-card.spot-state-on .spot-thumb'),radar=lastRule('.spot-card.spot-state-radar .spot-thumb'),swell=lastRule('.spot-card.spot-state-swell .spot-thumb'),off=lastRule('.spot-card.spot-state-off .spot-thumb');
  assert.match(on,/grayscale\(0\) saturate\(1\) brightness\(1\)/);
  assert.match(swell,/grayscale\(\.4\) saturate\(\.8\) brightness\(\.88\)/);assert.equal(radar,swell);
  assert.match(off,/grayscale\(1\) brightness\(\.62\)/);
  assert.match(image,/transition:none/);
});
test('status indicator colors stay unchanged and separate from the photo filters',()=>{
  assert.equal(lastRule('.spot-card.spot-state-on .spot-signal'),'color:#4dd3e1');
  assert.equal(lastRule('.spot-card.spot-state-radar .spot-signal'),'color:#7ac67d');
  assert.equal(lastRule('.spot-card.spot-state-swell .spot-signal'),'color:#65b8dc');
  assert.equal(lastRule('.spot-card.spot-state-off .spot-signal'),'color:#a0a6ac');
  for(const [,selectors,body] of rules.filter(([,s])=>s.includes('spot-photo-filter'))){assert.ok(selectors.trim().split(',').every(s=>s.trim().endsWith('.spot-thumb')||s.trim().endsWith('.spot-thumb:before')));assert.doesNotMatch(body,/(?:^|;)color:/);}
});
