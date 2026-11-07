const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

const start = "ACT.start({});S.cash=1e8;S.lvl=13;S.nextFail=1e9;S.nextEvent=1e9;ACT.buildPop({city:'ams'});ACT.buildPop({city:'par'})";
const kitted = c => `!!(S.pops.${c}.gen&&S.pops.${c}.site2&&S.pops.${c}.routers>=2)`;

test('the redundancy kit at every POP, from the Ops one-off batches', () => {
  const { ev, errors } = load();
  ev(start);
  const A = JSON.parse(ev('JSON.stringify({n:utilityKitAll().pops.length,cost:utilityKitAll().cost})'));
  assert.ok(A.n >= 3, 'fra, ams and par all lack their kit');
  const html = ev('opsOnceHtml()');
  assert.match(html, /data-act="utilityKitAll"/);
  assert.ok(html.includes(ev(`fmt$(${A.cost})`)), 'the button shows the total');
  // A stale total is refused and buys nothing.
  const cash = ev('S.cash');
  ev(`ACT.utilityKitAll({cost:${A.cost + 1}})`);
  assert.equal(ev('S.cash'), cash);
  // Count what is spent, not the cash left: finishing the kits can complete a goal that pays a reward.
  ev('window.SPENT=0;{const s0=spend;spend=c=>{const ok=s0(c);if(ok)window.SPENT+=c;return ok;};}');
  ev(`ACT.utilityKitAll({cost:${A.cost}})`);
  for (const c of ['fra', 'ams', 'par']) assert.equal(ev(kitted(c)), true, c + ' has its kit');
  assert.equal(ev('window.SPENT'), A.cost, 'it costs what the button said');
  assert.doesNotMatch(ev('opsOnceHtml()'), /data-act="utilityKitAll"/, 'nothing left to do: no button');
  assert.deepEqual(errors, []);
});

test('short of cash, the busiest POPs get their kit first', () => {
  const { ev, errors } = load();
  ev(start + ";R.nodeLoad={par:500,ams:100,fra:1}");
  const L = JSON.parse(ev('JSON.stringify(utilityKitAll().pops.map(x=>[x.city,x.q.cost]))'));
  assert.equal(L[0][0], 'par', 'busiest first');
  // Enough for the busiest POP only.
  ev(`S.cash=${L[0][1] + 1};R.nodeLoad={par:500,ams:100,fra:1}`);
  ev(`ACT.utilityKitAll({cost:utilityKitAll().cost})`);
  assert.equal(ev(kitted('par')), true);
  assert.equal(ev(kitted('ams')), false);
  assert.deepEqual(errors, []);
});