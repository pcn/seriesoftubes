const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');
const { lit } = require('../scripts/lib/js-literal');

const g = n => `RG.findIndex(r=>r.n===${lit(n)})`;
const start = "ACT.start({});S.cash=1e8;S.lvl=13;S.nextFail=1e9;S.nextEvent=1e9";
// A POP with traffic on it: a transit port, so it is no longer idle and a lone swap would be an outage.
const busy = c => `ACT.buildPop({city:'${c}'});ACT.buyTransit({city:'${c}',net:cheapestTransit('${c}').id,tier:0})`;
const maint = c => `S.inc.some(i=>i.type==='maint'&&i.ref==='${c}'&&i.until>S.day)`;

test('a kit swaps the model and adds routers in one click, for exactly its quoted price (#315)', () => {
  const { ev, dom, errors } = load();
  const K = ev(g('Knockia 7950 XRS'));
  ev(start + `;S.pops.fra.rgen=${K};S.pops.fra.routers=3;ACT.popKitSet({city:'fra',k:'medium'})`);
  assert.deepEqual(JSON.parse(ev('JSON.stringify(S.popKits.medium)')), { g: K, rt: 3 });
  ev(busy('ams') + ';ACT.addRouter({city:\'ams\'})');
  const q = JSON.parse(ev("JSON.stringify(popKitPlan('ams','medium'))"));
  assert.equal(q.up, true);
  assert.equal(q.pre, 0, 'two routers already: the swap rolls');
  // The button is on the panel with the price, and clicking it does the lot.
  ev("selectCity('ams');UI.tab='links';renderPanel()");
  const b = [...dom.window.document.querySelectorAll('[data-act="popKitApply"]')].map(x => x.textContent);
  assert.ok(b.some(t => t.includes('Medium POP') && t.includes(ev(`fmt$(${q.cost})`))), 'button shows the price: ' + b);
  const cash = ev('S.cash');
  ev("ACT.popKitApply({city:'ams',k:'medium'})");
  assert.equal(ev('S.pops.ams.rgen'), K);
  assert.equal(ev('S.pops.ams.routers'), 3);
  assert.equal(cash - ev('S.cash'), q.cost, 'the charge is the quote');
  assert.equal(ev(maint('ams')), false, 'a rolling swap has no maintenance window');
  // Applied again, nothing happens.
  assert.equal(ev("popKitPlan('ams','medium').done"), true);
  assert.deepEqual(errors, []);
});

test('the redundant-pair rule: a lone busy router gets its pair first, or is not swapped', () => {
  const { ev, errors } = load();
  const K = ev(g('Knockia 7950 XRS'));
  ev(start + `;S.popKits.medium={g:${K},rt:2};S.popKits.micro={g:${K},rt:1};` + busy('ams') + ';' + busy('par'));
  // On, with a two-router kit: the second router goes in first, then both are swapped in turn.
  const q = JSON.parse(ev("JSON.stringify(popKitPlan('ams','medium'))"));
  assert.equal(q.pre, 1);
  const cash = ev('S.cash');
  ev("ACT.popKitApply({city:'ams',k:'medium'})");
  assert.equal(ev('S.pops.ams.rgen'), K);
  assert.equal(ev('S.pops.ams.routers'), 2);
  assert.equal(ev(maint('ams')), false, 'no outage');
  assert.equal(cash - ev('S.cash'), q.cost);
  // On, with a one-router kit: no swap at all, and it says why.
  assert.ok(ev("popKitPlan('par','micro').why"));
  ev("ACT.popKitApply({city:'par',k:'micro'})");
  assert.equal(ev('S.pops.par.rgen||0'), 0);
  // Off: the lone router is swapped and the POP takes its maintenance window, like a manual swap.
  ev('ACT.popKitPair()');
  assert.equal(ev('S.popKitPair'), false);
  assert.equal(ev("popKitPlan('par','micro').outage"), true);
  ev("ACT.popKitApply({city:'par',k:'micro'})");
  assert.equal(ev('S.pops.par.rgen'), K);
  assert.equal(ev(maint('par')), true);
  assert.deepEqual(errors, []);
});

test('a kit never steps down, and nothing is bought when the model cannot go in', () => {
  const { ev, errors } = load();
  const U = ev(g('The Router at the End of the Universe')), M = ev(g('Mikrowtik CCR'));
  ev(start + `;S.popKits.micro={g:${M},rt:2};S.pops.fra.rgen=${U};S.pops.fra.routers=4`);
  assert.equal(ev("popKitPlan('fra','micro').done"), true, 'bigger model and more routers: already there');
  ev("ACT.popKitApply({city:'fra',k:'micro'})");
  assert.equal(ev('S.pops.fra.rgen'), U);
  assert.equal(ev('S.pops.fra.routers'), 4);
  // A locked model: no swap, and no routers of the old model bought to be sold off later.
  ev(`S.popKits.hub={g:${U},rt:3};S.lvl=1;` + busy('ams'));
  const cash = ev('S.cash');
  ev("ACT.popKitApply({city:'ams',k:'hub'})");
  assert.equal(ev('S.pops.ams.routers'), 1);
  assert.equal(ev('S.cash'), cash);
  assert.deepEqual(errors, []);
});

test('the standard for new POPs can come from a kit and follows it; saves are repaired', () => {
  const { ev, errors } = load();
  const A = ev(g('Arrrhipster 7280R')), K = ev(g('Knockia 7950 XRS'));
  ev(start + `;S.pops.fra.rgen=${A};S.pops.fra.routers=2;ACT.popKitSet({city:'fra',k:'micro'});ACT.popKitNew({k:'micro'})`);
  assert.deepEqual(JSON.parse(ev('JSON.stringify(S.popStd)')), { g: A, rt: 2, k: 'micro' });
  ev(`S.pops.fra.rgen=${K};ACT.popKitSet({city:'fra',k:'micro'})`);
  assert.equal(ev('S.popStd.g'), K, 'saving the kit again updates the standard taken from it');
  ev("ACT.popKitClear({k:'micro'})");
  assert.equal(ev('S.popKits.micro'), null);
  assert.equal(ev('S.popStd.g'), K, 'clearing the kit keeps the standard');
  assert.equal(ev("'k' in S.popStd"), false);
  // Garbage in a save.
  ev(`S.popKits={micro:{g:999},medium:{g:${A},rt:99},bogus:{g:1,rt:1}};S.popKitPair='yes';S.popStd={g:${A},rt:1,k:'nope'};S=sanitize(JSON.parse(JSON.stringify(S)))`);
  assert.deepEqual(JSON.parse(ev('JSON.stringify(S.popKits)')), { micro: null, medium: { g: A, rt: ev('RMAX') }, hub: null });
  assert.equal(ev('S.popKitPair'), true);
  assert.equal(ev("'k' in S.popStd"), false);
  // Saves from before kits.
  ev('delete S.popKits;delete S.popKitPair;S=sanitize(JSON.parse(JSON.stringify(S)))');
  assert.deepEqual(JSON.parse(ev('JSON.stringify(S.popKits)')), { micro: null, medium: null, hub: null });
  assert.equal(ev('S.popKitPair'), true);
  assert.deepEqual(errors, []);
});