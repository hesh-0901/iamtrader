export function pnl({direction,entry,exit,lot,contractSize,conversionRate=1,fees=0}){
  if(exit===null || exit===undefined || exit==='') return 0;
  const gross=direction==='BUY' ? (Number(exit)-Number(entry)) : (Number(entry)-Number(exit));
  return gross*Number(lot)*Number(contractSize)*Number(conversionRate)-Number(fees||0);
}
export function rMultiple({pnl:riskPnl,riskMoney}){ return Number(riskMoney)>0 ? Number(riskPnl)/Number(riskMoney) : 0; }
export function equityCurve(trades,capital){
  let equity=Number(capital)||0, peak=equity, maxDD=0;
  const points=[{date:null,equity,drawdown:0}];
  [...trades].filter(t=>t.exit!==null && t.exit!==undefined && t.exit!=='').sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t=>{
    equity += Number(t.pnl||0); peak=Math.max(peak,equity); const dd=peak?((peak-equity)/peak)*100:0; maxDD=Math.max(maxDD,dd);
    points.push({date:t.date,equity,drawdown:dd});
  });
  return {points,equity,maxDD};
}
export function performance(trades,capital){
  const realized=trades.filter(t=>t.exit!==null&&t.exit!==undefined&&t.exit!=='');
  const wins=realized.filter(t=>Number(t.pnl)>0), losses=realized.filter(t=>Number(t.pnl)<0);
  const totalPnl=realized.reduce((s,t)=>s+Number(t.pnl||0),0);
  const grossProfit=wins.reduce((s,t)=>s+Number(t.pnl||0),0), grossLoss=Math.abs(losses.reduce((s,t)=>s+Number(t.pnl||0),0));
  const rs=realized.map(t=>Number(t.rMultiple)).filter(Number.isFinite);
  const avgRisk=realized.length?realized.reduce((s,t)=>s+Number(t.riskPercent||0),0)/realized.length:0;
  const curve=equityCurve(realized,capital);
  return {realized:realized.length,planned:trades.length-realized.length,wins:wins.length,losses:losses.length,totalPnl,winRate:realized.length?wins.length/realized.length*100:0,avgR:rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:0,avgRisk,grossProfit,grossLoss,profitFactor:grossLoss?grossProfit/grossLoss:null,averageWin:wins.length?grossProfit/wins.length:0,averageLoss:losses.length?grossLoss/losses.length:0,bestTrade:realized.length?Math.max(...realized.map(t=>Number(t.pnl))):0,worstTrade:realized.length?Math.min(...realized.map(t=>Number(t.pnl))):0,maxDrawdown:curve.maxDD,equity:curve.equity,losingStreak:maxLosingStreak(realized)};
}
export function maxLosingStreak(trades){let max=0,cur=0; for(const t of [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date))){if(Number(t.pnl)<0){cur++;max=Math.max(max,cur)}else if(Number(t.pnl)>0)cur=0} return max;}
