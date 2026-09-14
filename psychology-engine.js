export function behaviorScore(trade){
  const plan=Number(trade.respectPlan||0), confidence=Number(trade.confidence||0), stress=Number(trade.stress||0), fomo=Number(trade.fomo||0), revenge=Number(trade.revenge||0), impulsivity=Number(trade.impulsivity||0);
  const score=(plan/5*40)+(confidence/5*20)-((stress+fomo+revenge+impulsivity)/20*40);
  return Math.max(0,Math.min(100,score));
}
export function psychologySummary(trades){
  if(!trades.length) return {score:null,avg:{},flags:[]};
  const keys=['respectPlan','confidence','stress','fomo','revenge','impulsivity'];
  const avg=Object.fromEntries(keys.map(k=>[k,trades.reduce((s,t)=>s+Number(t[k]||0),0)/trades.length]));
  const score=trades.reduce((s,t)=>s+behaviorScore(t),0)/trades.length;
  const flags=[]; if(avg.fomo>=3)flags.push('FOMO récurrent'); if(avg.revenge>=3)flags.push('Revenge trading'); if(avg.impulsivity>=3)flags.push('Impulsivité'); if(avg.stress>=3)flags.push('Stress élevé'); if(avg.respectPlan<3)flags.push('Respect du plan insuffisant');
  return {score,avg,flags};
}
