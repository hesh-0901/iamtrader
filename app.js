const $ = (id) => document.getElementById(id);
const genericPages = ['performance','risk','behavior','score','discipline','accounts','settings'];
const titles = {dashboard:['OVERVIEW','Dashboard'],quick:['JOURNAL / QUICK TRADE','Quick Trade'],journal:['TRADING / JOURNAL','Trade Journal'],performance:['ANALYTICS','Performance'],risk:['ANALYTICS','Risk Management'],behavior:['ANALYTICS','Behavior'],score:['EVALUATION','Trader Score'],discipline:['EVALUATION','Discipline'],accounts:['ACCOUNT','Trading Accounts'],settings:['ACCOUNT','Settings']};

function formatMoney(n){return Number.isFinite(n)?`$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—'}
function formatNum(n){return Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}):'—'}
function getTrades(){try{return JSON.parse(localStorage.getItem('iamtrader_trades')||'[]')}catch{return[]}}
function values(){return {entry:Number($('entry')?.value),stopLoss:Number($('stopLoss')?.value),takeProfit:Number($('takeProfit')?.value),quantity:Number($('quantity')?.value),contractMultiplier:Number($('contractMultiplier')?.value),accountBalance:Number($('accountBalance')?.value)}}
function calculate(v){if(![v.entry,v.stopLoss,v.takeProfit,v.quantity,v.contractMultiplier,v.accountBalance].every(Number.isFinite))throw new Error('Tous les champs numériques sont requis.');if(v.quantity<=0||v.contractMultiplier<=0||v.accountBalance<=0)throw new Error('Quantity, contract multiplier et solde doivent être supérieurs à 0.');const riskDistance=Math.abs(v.entry-v.stopLoss);if(riskDistance===0)throw new Error('Le Stop Loss doit être différent de l’Entry.');const riskAmount=riskDistance*v.quantity*v.contractMultiplier;return{riskAmount,riskPercent:riskAmount/v.accountBalance*100,rr:Math.abs(v.takeProfit-v.entry)/riskDistance}}
function preview(){if(!$('entry'))return;try{const v=values(),r=calculate(v);$('rr').textContent=`${formatNum(r.rr)}R`;$('riskAmount').textContent=formatMoney(r.riskAmount);$('riskPercent').textContent=`${formatNum(r.riskPercent)}%`;$('riskFormula').textContent=formatNum(Math.abs(v.entry-v.stopLoss));$('rewardFormula').textContent=formatNum(Math.abs(v.takeProfit-v.entry));$('directionBox').textContent=$('direction').value==='BUY'?'BUY · Long exposure':'SELL · Short exposure'}catch{$('rr').textContent='—';$('riskAmount').textContent='—';$('riskPercent').textContent='—';$('riskFormula').textContent='Entry ↔ SL';$('rewardFormula').textContent='Entry ↔ TP'}}

function renderJournal(){const trades=getTrades();if($('tradeRows'))$('tradeRows').innerHTML=trades.length?trades.map(t=>`<tr class="border-b border-white/[.05] hover:bg-white/[.015]"><td class="px-5 py-3 text-[10px] text-slate-500 sm:px-6">${new Date(t.dateTime).toLocaleString('fr-FR')}</td><td class="py-3 text-[11px] font-bold">${t.symbol}</td><td class="py-3 text-[10px] font-bold ${t.direction==='BUY'?'text-mint':'text-gold'}">${t.direction}</td><td class="py-3 font-mono text-[10px]">${formatNum(t.entry)}</td><td class="py-3 font-mono text-[10px]">${formatNum(t.stopLoss)}</td><td class="py-3 font-mono text-[10px]">${formatNum(t.takeProfit)}</td><td class="py-3 font-mono text-[10px] font-bold text-mint">${formatNum(t.rr)}R</td><td class="py-3 pr-5 font-mono text-[10px] sm:pr-6">${formatMoney(t.riskAmount)}</td></tr>`).join(''):'<tr><td colspan="8" class="px-5 py-14 text-center sm:px-6"><div class="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.02] text-slate-600">＋</div><div class="mt-3 text-[11px] font-semibold text-slate-500">Your journal is empty</div><div class="mt-1 text-[9px] text-slate-700">Record your first trade to start building your profile.</div></td></tr>'}

function renderDashboard(){
  const trades=getTrades();
  const count=trades.length;
  const avgRR=count?trades.reduce((s,t)=>s+(Number(t.rr)||0),0)/count:0;
  const totalRisk=trades.reduce((s,t)=>s+(Number(t.riskAmount)||0),0);
  const bestRR=count?Math.max(...trades.map(t=>Number(t.rr)||0)):0;
  const avgRiskPct=count?trades.reduce((s,t)=>s+(Number(t.riskPercent)||0),0)/count:0;
  const balance=trades[0]?.accountBalance||10000;
  if($('tradeCount'))$('tradeCount').textContent=count;
  if($('avgRR'))$('avgRR').textContent=count?`${formatNum(avgRR)}R`:'—';
  if($('plannedRisk'))$('plannedRisk').textContent=formatMoney(totalRisk);
  if($('bestRR'))$('bestRR').textContent=count?`${formatNum(bestRR)}R`:'—';
  if($('bestRRSmall'))$('bestRRSmall').textContent=count?`${formatNum(bestRR)}R`:'—';
  if($('riskTotalSmall'))$('riskTotalSmall').textContent=formatMoney(totalRisk);
  if($('avgRiskPct'))$('avgRiskPct').textContent=count?`${formatNum(avgRiskPct)}%`:'—';
  if($('riskBar'))$('riskBar').style.width=`${Math.min(avgRiskPct,100)}%`;
  if($('equityValue'))$('equityValue').textContent=formatMoney(balance);
  if($('startBalanceLabel'))$('startBalanceLabel').textContent=formatMoney(balance);
  if($('equityChange'))$('equityChange').textContent='+0.00%';
  if($('healthScore'))$('healthScore').textContent=count?Math.min(100,Math.round(55+Math.min(count,20)*2)):'—';
  if($('healthBadge'))$('healthBadge').textContent=count>=10?'BUILDING':count?'STARTED':'BUILDING';
  const score=count?Math.min(100,55+Math.min(count,20)*2):0;
  const ring=$('healthScore')?.parentElement?.parentElement?.parentElement;
  if(ring)ring.style.background=`conic-gradient(#00C796 ${score*3.6}deg,rgba(255,255,255,.06) ${score*3.6}deg)`;
  if($('dashboardRows'))$('dashboardRows').innerHTML=trades.slice(0,5).map(t=>`<tr class="border-b border-white/[.05] hover:bg-white/[.015]"><td class="px-5 py-3 sm:px-6"><div class="text-[10px] font-bold">${t.symbol}</div><div class="mt-0.5 text-[8px] text-slate-600">${new Date(t.dateTime).toLocaleDateString('fr-FR')}</div></td><td class="py-3 text-[9px] font-bold ${t.direction==='BUY'?'text-mint':'text-gold'}">${t.direction}</td><td class="py-3 font-mono text-[9px]">${formatNum(t.entry)}</td><td class="py-3 font-mono text-[9px] font-bold text-mint">${formatNum(t.rr)}R</td><td class="py-3 font-mono text-[9px]">${formatMoney(t.riskAmount)}</td><td class="py-3 pr-5 sm:pr-6"><span class="rounded-full border border-white/10 bg-white/[.02] px-2 py-1 text-[7px] font-bold tracking-wider text-slate-500">PLANNED</span></td></tr>`).join('')||'<tr><td colspan="6" class="px-5 py-12 text-center sm:px-6"><div class="text-[11px] font-semibold text-slate-500">No trades yet</div><div class="mt-1 text-[9px] text-slate-700">Your latest decisions will appear here.</div></td></tr>';
}

function navigate(page){const isGeneric=genericPages.includes(page);document.querySelectorAll('.page').forEach(el=>el.classList.add('hidden'));if(isGeneric){$('page-generic').classList.remove('hidden');$('genericTitle').textContent=titles[page][1]}else $('page-'+page).classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(b=>{b.classList.remove('active','bg-mint/10','text-mint');b.classList.add('text-slate-400');if(b.dataset.page===page){b.classList.add('active');b.classList.remove('text-slate-400')}});$('topEyebrow').textContent=titles[page][0];$('topTitle').textContent=titles[page][1];$('sidebar').classList.add('-translate-x-full');$('overlay').classList.add('hidden');if(page==='journal')renderJournal();window.scrollTo({top:0,behavior:'smooth'})}

document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.page)));
$('menuBtn')?.addEventListener('click',()=>{$('sidebar').classList.remove('-translate-x-full');$('overlay').classList.remove('hidden')});
$('overlay')?.addEventListener('click',()=>{$('sidebar').classList.add('-translate-x-full');$('overlay').classList.add('hidden')});

['entry','stopLoss','takeProfit','quantity','contractMultiplier','accountBalance','direction'].forEach(id=>$(id)?.addEventListener('input',preview));
$('tradeForm')?.addEventListener('submit',e=>{e.preventDefault();$('error').hidden=true;try{const v=values(),r=calculate(v),payload={symbol:$('symbol').value.trim().toUpperCase(),direction:$('direction').value,...v,dateTime:$('dateTime').value,note:$('note').value.trim(),...r};if(!payload.symbol)throw new Error('Asset / Symbol est requis.');const trades=getTrades();trades.unshift(payload);localStorage.setItem('iamtrader_trades',JSON.stringify(trades.slice(0,100)));renderJournal();renderDashboard();e.target.reset();$('contractMultiplier').value='1';$('accountBalance').value='10000';$('dateTime').value=new Date().toISOString().slice(0,16);preview();navigate('journal')}catch(err){$('error').textContent=err.message;$('error').hidden=false}});
$('clearTrades')?.addEventListener('click',()=>{if(confirm('Effacer toutes les opérations locales ?')){localStorage.removeItem('iamtrader_trades');renderJournal();renderDashboard()}});

if($('dateTime'))$('dateTime').value=new Date().toISOString().slice(0,16);
preview();renderJournal();renderDashboard();
