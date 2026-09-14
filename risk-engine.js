const n = v => Number(v);
const finite = v => Number.isFinite(n(v));
const floorStep = (value, step) => Math.floor((value + 1e-12) / step) * step;

export function validateTrade({direction, entry, stopLoss, takeProfit}){
  if(!['BUY','SELL'].includes(direction)) return {ok:false,error:'Direction invalide.'};
  if(![entry,stopLoss,takeProfit].every(finite)) return {ok:false,error:'Entry, Stop Loss et Take Profit sont obligatoires et numériques.'};
  if(direction==='BUY' && !(stopLoss < entry && entry < takeProfit)) return {ok:false,error:'BUY : SL < Entry < TP est obligatoire.'};
  if(direction==='SELL' && !(takeProfit < entry && entry < stopLoss)) return {ok:false,error:'SELL : TP < Entry < SL est obligatoire.'};
  return {ok:true};
}

export function monetaryRisk({entry,stopLoss,lot,contractSize,conversionRate=1,fees=0}){
  return Math.abs(n(entry)-n(stopLoss))*n(lot)*n(contractSize)*n(conversionRate) + n(fees||0);
}

export function riskPercent({riskMoney,capital}){ return n(capital) > 0 ? n(riskMoney)/n(capital)*100 : 0; }
export function rr({entry,stopLoss,takeProfit}){
  const d=Math.abs(n(entry)-n(stopLoss)); return d ? Math.abs(n(takeProfit)-n(entry))/d : 0;
}
export function targetLot({capital,riskPercent:targetRiskPercent,entry,stopLoss,contractSize,conversionRate=1,lotStep,minLot}){
  const targetMoney=n(capital)*n(targetRiskPercent)/100;
  const denominator=Math.abs(n(entry)-n(stopLoss))*n(contractSize)*n(conversionRate);
  if(denominator<=0) return {ok:false,error:'Distance Entry/SL invalide.'};
  const raw=targetMoney/denominator;
  const lot=floorStep(raw,n(lotStep));
  if(lot < n(minLot)) return {ok:false,error:`Lot calculé (${raw.toFixed(4)}) inférieur au minimum (${minLot}).`,rawLot:raw};
  return {ok:true,lot:Number(lot.toFixed(8)),rawLot:raw,targetMoney};
}
export function calculateRisk(input){
  const validation=validateTrade(input); if(!validation.ok) return validation;
  const riskMoney=monetaryRisk(input);
  return {...validation,riskMoney,riskPercent:riskPercent({riskMoney,capital:input.capital}),rr:rr(input)};
}
