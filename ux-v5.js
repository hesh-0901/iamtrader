(()=>{
function read(){return window.IAMTRADER?.state||{accounts:[],trades:[],activeAccountId:null}}
function syncCustom(){}
function patchTradeAssets(){const s=read(),a=(s.accounts||[]).find(x=>x.id===s.activeAccountId),custom=a?.customInstruments||[];if(!custom.length)return;document.querySelectorAll('#tradeModal select[name="symbol"],#tradeForm select[name="symbol"],select[name="asset"],select[name="symbol"]').forEach(sel=>{custom.forEach(x=>{if(![...sel.options].some(o=>o.value===x.symbol)){const o=document.createElement('option');o.value=x.symbol;o.textContent=`${x.symbol} — ${x.name} · personnalisé`;sel.append(o)}})});}
syncCustom();const obs=new MutationObserver(()=>patchTradeAssets());obs.observe(document.body,{childList:true,subtree:true});window.addEventListener('load',()=>setTimeout(patchTradeAssets,150));
})();
