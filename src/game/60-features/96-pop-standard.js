/* ---------- The standard POP (#240) ----------
   Big networks run one design everywhere. A new POP gets the standard routers at once, while the box is still idle
   (no maintenance window): the model if it is unlocked and affordable, then the extra routers as cash allows. */
// What the standard adds to a fresh POP, priced the way popStdApply pays for it, so it can be on the button (#261).
function popStdQuote(){const d=S.popStd;if(!d||pzOn())return null;const g=techOk('rg',d.g,RG[d.g].lvl)?d.g:0;
  let cost=g?Math.max(0,Math.round(RG[g].cost*hwMul('rt')*techMul(RG[g].lvl))-tradeIn(0,1)):0;for(let n=1;n<d.rt;n++)cost+=routerCost(g,n);
  const mo=(d.rt-1)*ROUTER_MO+cageMo(d.rt)+d.rt*RG[g].mo-RG[0].mo;return cost||mo?{cost,mo,g,rt:d.rt}:null;}
// A new POP's setup with the standard's routers, for every way a POP gets built (links, cables, seats).
function newPopCost(c){const q=popStdQuote();return popCost(c)+(q?q.cost:0);}
function popStdApply(city){const d=S.popStd,p=S.pops[city];if(!d||!p||pzOn())return;let miss=false;const c0=S.cash;
  if(d.g!==(p.rgen||0)){if(techOk('rg',d.g,RG[d.g].lvl)&&S.cash>=swapCost(city,d.g)){spend(swapCost(city,d.g));p.rgen=d.g;}else miss=true;}
  while((p.routers||1)<d.rt){const k=routerCost(p.rgen||0,p.routers||1);if(S.cash<k){miss=true;break;}spend(k);p.routers=(p.routers||1)+1;}
  toast(miss?tr('pop_std.not_all_of_the_standard',{city:CITY[city].name}):tr('pop_std.city_gets_the_standard_cost',{city:CITY[city].name,n:p.routers||1,model:esc(RG[p.rgen||0].n),cost:fmt$(c0-S.cash)}),miss?'bad':'good');}
/* ---------- Router kits (#315) ----------
   Three named builds (a model and a count) that go onto any POP in one click, instead of a scroll through the model
   list. A kit only ever adds: a POP that is already bigger keeps what it has. Swapping the only router of a busy POP
   takes it offline, so by default (S.popKitPair) a kit puts in the second router first and swaps the two in turn. */
const POP_KITS=['micro','medium','hub'],KIT_N={micro:N_('pop_kit.micro_pop'),medium:N_('pop_kit.medium_pop'),hub:N_('pop_kit.regional_hub')};
// A saved build or null, for the standard and the kits alike (sanitize()).
const popBuildOk=d=>d&&typeof d==='object'&&Number.isInteger(d.g)&&RG[d.g]?{g:d.g,rt:int(d.rt,1,RMAX,1)}:null;
// What kit k would do at POP c, priced in the order popKitApply() clicks through it. up: the kit's model is bigger;
// pre: a second router first, so the swap rolls; why: what stops the swap (then nothing is bought, not even routers
// of the old model to be sold off later); need: cash to start, since the swap is all or nothing and only the extra
// routers stop when the money does.
function popKitPlan(c,k){const d=S.popKits[k],p=S.pops[c];if(!d||!p)return null;
  const g0=p.rgen||0,rt0=p.routers||1,up=RG[d.g].cap>RG[g0].cap,lone=rt0===1&&!popIdle(c);let why='',pre=0,outage=false;
  if(up){why=modelFits(c,d.g)||(!techOk('rg',d.g,RG[d.g].lvl)?tr('pop_kit.the_model_unlocks_at_level',{lv:RG[d.g].lvl}):p.rupDay===S.day?tr('pop_kit.new_routers_went_in_here_today'):'');
    if(!why&&lone){if(!S.popKitPair)outage=true;else if(d.rt>1)pre=1;else why=tr('pop_kit.needs_a_redundant_pair');}}
  if(why)return {d,up,why,cost:0,need:0,done:false};
  const g=up?d.g:g0;let rt=rt0,cost=0;
  if(up){if(pre)cost+=routerCost(g0,rt++);cost+=swapCostAt(g0,g,rt);}
  const need=cost||(rt<d.rt?routerCost(g,rt):0);for(;rt<d.rt;rt++)cost+=routerCost(g,rt);
  return {d,up,pre,outage,why,cost,need,done:!up&&rt0>=d.rt};}
// The player's own actions, muted like the intern's (opsQuiet()), then one redraw and one toast for the lot.
function popKitApply(c,k){const q=popKitPlan(c,k),p=S.pops[c];if(!q||pzOn())return;const kit=tr(KIT_N[k]),city=CITY[c].name;
  if(q.done){toast(tr('pop_kit.city_already_has_everything_in',{city,kit}));return;}
  if(q.why){toast(tr('pop_kit.city_can_t_take_kit',{city,kit,why:esc(q.why)}),'bad');sfx('err');return;}
  if(S.cash<q.need){toast(tr('interface.not_enough_cash_wait_for_revenue'),'bad');sfx('err');return;}
  const c0=S.cash;
  opsQuiet(()=>{if(q.up){if(q.pre)ACT.addRouter({city:c});ACT.upRouter({city:c,g:q.d.g});}
    if(!q.up||(p.rgen||0)===q.d.g)for(let r=p.routers||1;r<q.d.rt;r=p.routers||1){ACT.addRouter({city:c});if((p.routers||1)===r)break;}});
  const short=(p.routers||1)<q.d.rt||(q.up&&(p.rgen||0)!==q.d.g);
  toast(tr('pop_kit.city_now_runs_n_model',{city,n:p.routers||1,model:esc(RG[p.rgen||0].n),cost:fmt$(c0-S.cash)})+(short?'<br>'+tr('pop_kit.not_all_of_the_kit_fit'):'')+(q.outage?'<br>'+tr('pop_kit.its_only_router_was_swapped'):''),short?'bad':'good');
  sfx('build');after();}
// The kits and the standard in a POP's router section: one button per kit, and behind Edit kits the saving, the
// standard for new POPs and the redundant-pair rule, so the everyday view stays one short row on a phone.
function popStdHtml(c){const p=S.pops[c];if(!p||pzOn())return '';const d=S.popStd,K=S.popKits,ks=POP_KITS.filter(k=>K[k]),
    here=D=>D.g===(p.rgen||0)&&D.rt===(p.routers||1),build=D=>`${D.rt} × ${esc(RG[D.g].n)}`,lbl=k=>`${tr(KIT_N[k])}: ${build(K[k])}`;
  let h=`<div class="kv"><span>${tr('pop_kit.router_kits')}</span><b>${ks.length?'':tr('pop_kit.none_yet')}</b></div>`;
  if(ks.length){const qs=ks.map(k=>[k,popKitPlan(c,k)]);
    h+=`<div class="btns">${qs.map(([k,q])=>btn(q.done?lbl(k)+' ✓':q.why?lbl(k):lbl(k)+' · '+fmt$(q.cost),'popKitApply',{city:c,k},q.done||q.why?'ghost sm':'sm',q.done||!!q.why||S.cash<q.need)).join('')}</div>`;
    for(const [k,q] of qs)if(q.why)h+=`<p class="why">${tr(KIT_N[k])}: ${esc(q.why)}</p>`;else if(q.outage)h+=`<p class="note">${tr('pop_kit.kit_swaps_the_only_router_here',{kit:tr(KIT_N[k])})}</p>`;}
  h+=`<div class="kv"><span>${tr('pop_std.standard_for_new_pops')}</span><b>${d?build(d)+(d.k?` (${tr(KIT_N[d.k])})`:''):tr('pop_std.none')}</b></div>`;
  h+=`<div class="btns">${btn(UI.kitEdit?tr('pop_kit.done'):tr('pop_kit.edit_kits'),'kitEdit',{},'ghost sm')}</div>`;
  if(UI.kitEdit){
    for(const k of POP_KITS){const D=K[k];
      h+=`<div class="kv"><span>${tr(KIT_N[k])}</span><b>${D?build(D):tr('pop_std.none')}</b></div><div class="btns">${D&&here(D)?'':btn(tr('pop_kit.save_this_pop_s_routers'),'popKitSet',{city:c,k},'ghost sm')}${D?(d&&d.k===k?'':btn(tr('pop_kit.use_for_new_pops'),'popKitNew',{k},'ghost sm'))+btn(tr('pop_std.clear'),'popKitClear',{k},'ghost sm'):''}</div>`;}
    h+=`<div class="btns">${d&&here(d)?'':btn(tr('pop_std.make_this_the_standard'),'popStdSet',{city:c},'ghost sm')}${d?btn(tr('pop_kit.no_standard_for_new_pops'),'popStdClear',{},'ghost sm'):''}</div>`;
    h+=`<div class="kv"><span>${tr('pop_kit.only_swap_routers_with_a_redundant_pair')}</span><b>${btn(S.popKitPair?tr('common.on'):tr('common.off'),'popKitPair',{},'ghost sm')}</b></div><p class="note">${tr('pop_kit.on_a_kit_adds_the_second')}</p>`;}
  return h;}
