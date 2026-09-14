const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=v=>Math.max(0,Math.min(5,n(v)));

export function behaviorScore(trade){
  const plan=clamp(trade.planClarity ?? trade.respectPlan);
  const respect=clamp(trade.respectPlan);
  const confidence=clamp(trade.confidence);
  const execution=clamp(trade.execution ?? trade.respectPlan);
  const control=clamp(trade.emotionalControl ?? (5-(clamp(trade.stress)+clamp(trade.fomo)+clamp(trade.revenge)+clamp(trade.impulsivity))/4));
  return Math.round((plan/5*25)+(respect/5*25)+(confidence/5*15)+(execution/5*15)+(control/5*20));
}

export function psychologySummary(trades){
  if(!trades.length)return {score:null,avg:{},flags:[],dimensions:{}};
  const avgOf=k=>trades.reduce((s,t)=>s+n(t[k]),0)/trades.length;
  const avg={
    planClarity:avgOf('planClarity') || avgOf('respectPlan'),
    respectPlan:avgOf('respectPlan'),
    confidence:avgOf('confidence'),
    execution:avgOf('execution') || avgOf('respectPlan'),
    stress:avgOf('stress'),
    fomo:avgOf('fomo'),
    revenge:avgOf('revenge'),
    impulsivity:avgOf('impulsivity')
  };
  const avgControl=trades.reduce((s,t)=>s+clamp(t.emotionalControl ?? (5-(clamp(t.stress)+clamp(t.fomo)+clamp(t.revenge)+clamp(t.impulsivity))/4)),0)/trades.length;
  avg.emotionalControl=avgControl;
  const score=trades.reduce((s,t)=>s+behaviorScore(t),0)/trades.length;
  const flags=[];
  if(avg.planClarity<3)flags.push('Plan peu clair avant l’entrée');
  if(avg.respectPlan<3)flags.push('Écart au plan récurrent');
  if(avg.execution<3)flags.push('Qualité d’exécution à améliorer');
  if(avg.fomo>=3)flags.push('FOMO récurrent');
  if(avg.revenge>=3)flags.push('Risque de revenge trading');
  if(avg.impulsivity>=3)flags.push('Impulsivité élevée');
  if(avg.stress>=3)flags.push('Stress élevé');
  if(avg.confidence<2.5)flags.push('Confiance faible');
  const dimensions={
    'Clarté du plan':avg.planClarity,
    'Respect du plan':avg.respectPlan,
    'Confiance':avg.confidence,
    'Exécution':avg.execution,
    'Contrôle émotionnel':avg.emotionalControl,
    'Stress':avg.stress,
    'FOMO':avg.fomo,
    'Revenge':avg.revenge,
    'Impulsivité':avg.impulsivity
  };
  return {score,avg,flags,dimensions};
}
