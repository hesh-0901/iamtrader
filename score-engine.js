export function traderScore(perf,psych){
  if(!perf || perf.realized<5) return {global:null,risk:null,profitability:null,consistency:null,behavior:psych?.score??null,reason:'Échantillon insuffisant : minimum 5 trades réalisés.'};
  const risk=Math.max(0,Math.min(100,100-(perf.avgRisk*20)-(perf.maxDrawdown*8)-(perf.losingStreak*5)));
  const profitability=Math.max(0,Math.min(100,50+(perf.avgR*15)+((perf.profitFactor??0)*10)+(perf.totalPnl>=0?15:-15)));
  const consistency=Math.max(0,Math.min(100,30+Math.min(30,perf.realized/2)+(perf.winRate>=45?20:0)+Math.max(0,30-perf.losingStreak*5)-perf.maxDrawdown*2));
  const behavior=psych?.score??0;
  return {global:Math.round(risk*.25+profitability*.30+consistency*.25+behavior*.20),risk:Math.round(risk),profitability:Math.round(profitability),consistency:Math.round(consistency),behavior:Math.round(behavior)};
}
