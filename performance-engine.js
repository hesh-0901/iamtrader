/* IAMTRADER — Trader Performance Engine
 * Turns journal data + psychology into a measurable trader-performance score.
 * Read-only with respect to trades: it calculates and displays metrics without mutating trade history.
 */
(function(){
  'use strict';
  const TRADE_KEY='iamtrader_trades';
  const SETTINGS_KEY='iamtrader_settings_v2';
  const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
  const n=v=>Number(v)||0;
  const pct=(a,b)=>b?100*a/b:0;
  const avg=(arr,key)=>arr.length?arr.reduce((s,x)=>s+n(key?x[key]:x),0)/arr.length:0;
  const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=v=>`${n(v)>=0?'+':''}$${n(v).toFixed(2)}`;

  function getTrades(){try{const x=JSON.parse(localStorage.getItem(TRADE_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function getSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return{}}}

  function outcome(t){
    const close=n(t.close),tp=n(t.tp),sl=n(t.sl),dir=String(t.direction||'').toUpperCase();
    if(!Number.isFinite(close)||!close)return {status:'OPEN',label:'Ouvert',win:null};
    if(tp && ((dir==='BUY'&&close>=tp)||(dir==='SELL'&&close<=tp)))return {status:'TP_REACHED',label:'TP atteint',win:true};
    if(sl && ((dir==='BUY'&&close<=sl)||(dir==='SELL'&&close>=sl)))return {status:'SL_HIT',label:'SL touché',win:false};
    const p=n(t.netPnl);return {status:p>0?'WIN':p<0?'LOSS':'BE',label:p>0?'Gagnant':p<0?'Perdant':'Break-even',win:p>0?p<0?false:null:true};
  }

  function completed(ts){return ts.filter(t=>outcome(t).status!=='OPEN')}
  function wins(ts){return ts.filter(t=>outcome(t).win===true)}
  function losses(ts){return ts.filter(t=>outcome(t).win===false)}

  function behavioral(ts){
    const documented=ts.filter(t=>t.psychology||t.emotion||t.confidence||t.stress||t.fatigue||t.entryReason||t.plan||t.afterEmotion);
    const confidence=ts.filter(t=>n(t.confidence)>0);
    const stress=ts.filter(t=>n(t.stress)>0);
    const fatigue=ts.filter(t=>n(t.fatigue)>0);
    const plan=ts.filter(t=>String(t.plan||'').length);
    const fomo=ts.filter(t=>['fomo','FOMO'].includes(String(t.entryReason||t.reason||'')));
    const revenge=ts.filter(t=>['revenge','revenge trading'].includes(String(t.entryReason||t.reason||'').toLowerCase()));
    const impulse=ts.filter(t=>['impulse','impulsif'].includes(String(t.entryReason||t.reason||'').toLowerCase()));
    const compliant=plan.filter(t=>['yes','oui','true','1'].includes(String(t.plan).toLowerCase()));
    const badStress=stress.filter(t=>n(t.stress)>=7);
    const badFatigue=fatigue.filter(t=>n(t.fatigue)>=7);
    const score=clamp(
      (pct(compliant.length,plan.length||1)*.30)+
      (100-pct(fomo.length+revenge.length+impulse.length,ts.length||1)*.40)+
      (100-pct(badStress.filter(t=>outcome(t).win===false).length,badStress.length||1)*.15)+
      (100-pct(badFatigue.filter(t=>outcome(t).win===false).length,badFatigue.length||1)*.15)
    );
    return {documented,confidence,stress,fatigue,plan,fomo,revenge,impulse,compliant,badStress,badFatigue,score};
  }

  function dimensionScores(ts){
    const done=completed(ts),w=wins(done),l=losses(done);
    if(!done.length)return {profitability:0,risk:0,drawdown:0,consistency:0,execution:0,discipline:0,behavior:0,strategy:0};
    const pnl=done.reduce((s,t)=>s+n(t.netPnl),0), winRate=pct(w.length,done.length);
    const avgRisk=avg(done,'riskPercent');
    const risk=clamp(100-Math.max(0,avgRisk-1)*25);
    const rr=avg(done,'rr');
    const profitability=clamp(50+winRate*.35+clamp(rr*8,-30,30)+(pnl>=0?15:-15));
    const lossRuns=[];let run=0;done.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t=>{if(outcome(t).win===false)run++;else{if(run)lossRuns.push(run);run=0}});if(run)lossRuns.push(run);
    const consistency=clamp(70+Math.min(done.length,20)-Math.max(0,(Math.max(...lossRuns,0)-2)*8));
    const tp=done.filter(t=>outcome(t).status==='TP_REACHED').length;
    const sl=done.filter(t=>outcome(t).status==='SL_HIT').length;
    const execution=clamp(70+pct(tp,done.length)*.25-pct(sl,done.length)*.10);
    const beh=behavioral(done);
    const discipline=clamp(pct(beh.compliant.length,beh.plan.length||1)*.70+(100-pct(beh.fomo.length+beh.revenge.length+beh.impulse.length,done.length)*.30));
    const strategy=clamp(50+Math.min(done.length,20)*2+(rr>1.5?20:0)+(winRate>=50?15:0));
    const settings=getSettings();
    let dd=0;
    const account=settings.accounts?.find(a=>a.id===settings.activeAccountId)||settings.accounts?.[0];
    let peak=n(account?.initialCapital);let eq=peak;
    done.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t=>{eq+=n(t.netPnl);peak=Math.max(peak,eq);if(peak>0)dd=Math.max(dd,(peak-eq)/peak*100)});
    const drawdown=clamp(100-dd*8);
    return {profitability,risk,drawdown,consistency,execution,discipline,behavior:beh.score,strategy};
  }

  function calculate(ts=getTrades()){
    const done=completed(ts),s=dimensionScores(ts);
    const weights={profitability:.20,risk:.20,drawdown:.15,consistency:.15,execution:.10,discipline:.10,behavior:.05,strategy:.05};
    const total=Math.round(Object.keys(weights).reduce((v,k)=>v+s[k]*weights[k],0));
    return {score:total,scores:s,done,behavior:behavioral(done),pnl:done.reduce((v,t)=>v+n(t.netPnl),0),winRate:pct(wins(done).length,done.length)};
  }

  function card(title,value,sub){return `<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div class="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">${title}</div><div class="mt-2 text-2xl font-extrabold text-[#08243a]">${esc(value)}</div><div class="mt-1 text-xs text-slate-500">${esc(sub)}</div></div>`}
  function render(){
    const r=calculate();
    document.querySelectorAll('#page-dashboard,#page-analytics,#page-evaluation').forEach(page=>{
      let box=page.querySelector('.iam-performance-engine');
      if(!box){box=document.createElement('section');box.className='iam-performance-engine mt-6';page.appendChild(box)}
      const s=r.scores,b=r.behavior;
      box.innerHTML=`<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-end justify-between gap-3"><div><div class="text-[10px] font-bold tracking-[.14em] text-[#00a77d]">TRADER PERFORMANCE ENGINE</div><h3 class="mt-1 text-xl font-extrabold text-[#08243a]">Performance globale</h3></div><div class="text-right"><div class="text-4xl font-black text-[#08243a]">${r.score}<span class="text-base font-bold text-slate-400">/100</span></div><div class="text-xs font-semibold text-slate-500">${r.done.length} trades clôturés</div></div></div>
        <div class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">${card('Rentabilité',Math.round(s.profitability)+'/100','P&L '+money(r.pnl))}${card('Risk Management',Math.round(s.risk)+'/100','Risque moyen '+avg(r.done,'riskPercent').toFixed(2)+'%')}${card('Drawdown',Math.round(s.drawdown)+'/100','Contrôle des pertes')}${card('Consistance',Math.round(s.consistency)+'/100','Régularité')}${card('Exécution',Math.round(s.execution)+'/100','TP / SL / sorties')}${card('Discipline',Math.round(s.discipline)+'/100','Respect du plan')}${card('Comportement',Math.round(s.behavior)+'/100','Psychologie trading')}${card('Stratégie',Math.round(s.strategy)+'/100','Qualité des setups')}</div>
        <div class="mt-5 rounded-xl bg-[#f4f8fa] p-4"><div class="text-[10px] font-bold tracking-[.12em] text-slate-500">ANALYSE COMPORTEMENTALE</div><div class="mt-3 grid gap-3 md:grid-cols-4"><div><b>${b.fomo.length}</b> FOMO</div><div><b>${b.revenge.length}</b> revenge</div><div><b>${b.impulse.length}</b> impulsifs</div><div><b>${b.plan.length?Math.round(pct(b.compliant.length,b.plan.length)):0}%</b> plan respecté</div></div></div>
      </div>`;
    });
  }
  function boot(){render();window.addEventListener('iamtrader:data-updated',render);setInterval(render,2500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.IAMTraderPerformance={calculate,render,outcome,dimensionScores};
})();
