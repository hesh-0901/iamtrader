(()=>{
const KEY='iamtrader:v1',CUSTOM='iamtrader:custom-instruments';
function read(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}}
function syncCustom(){let arr=[];try{arr=JSON.parse(localStorage.getItem(CUSTOM))||[]}catch{};const s=read();s.customInstruments=arr;localStorage.setItem(KEY,JSON.stringify(s))}
function patchTradeAssets(){const s=read(),custom=s.customInstruments||[];if(!custom.length)return;document.querySelectorAll('#tradeModal select[name="symbol"],#tradeForm select[name="symbol"],select[name="asset"],select[name="symbol"]').forEach(sel=>{custom.forEach(x=>{if(![...sel.options].some(o=>o.value===x.symbol)){const o=document.createElement('option');o.value=x.symbol;o.textContent=`${x.symbol} — ${x.name} · personnalisé`;sel.append(o)}})});}
syncCustom();const obs=new MutationObserver(()=>patchTradeAssets());obs.observe(document.body,{childList:true,subtree:true});window.addEventListener('load',()=>setTimeout(patchTradeAssets,150));
})();
