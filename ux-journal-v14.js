(()=>{
const TV='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
const MAP={XAUUSD:'OANDA:XAUUSD',XAGUSD:'OANDA:XAGUSD',EURUSD:'OANDA:EURUSD',GBPUSD:'OANDA:GBPUSD',USDJPY:'OANDA:USDJPY',NAS100:'CAPITALCOM:US100',US30:'CAPITALCOM:US30',SPX500:'SP:SPX'};
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function symbolFor(raw){const s=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return MAP[s]||null}
function mount(modal){
 if(!modal||modal.dataset.tv14)return;
 const title=modal.querySelector('.v13-title h2')?.textContent?.trim()||'';
 const tvSymbol=symbolFor(title);
 const box=modal.querySelector('.v13-chart');
 if(!box||!tvSymbol)return;
 modal.dataset.tv14='1';
 box.innerHTML='<div class="tv14-widget" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
 const host=box.querySelector('.tv14-widget');
 const script=document.createElement('script');
 script.type='text/javascript';
 script.src=TV;
 script.async=true;
 script.textContent=JSON.stringify({autosize:true,symbol:tvSymbol,interval:'15',timezone:'exchange',theme:'light',backgroundColor:'rgba(255,255,255,1)',gridColor:'rgba(10,25,47,0.06)',style:'1',withdateranges:false,hide_top_toolbar:true,hide_side_toolbar:true,allow_symbol_change:false,save_image:false,locale:'fr',calendar:false,support_host:'https://www.tradingview.com'});
 host.appendChild(script);
 const link=modal.querySelector('.v13-open a');
 if(link)link.textContent='Ouvrir l’analyse TradingView ↗';
}
function run(){document.querySelectorAll('.modal .menu-modal.trade-view-v13').forEach(mount)}
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});setTimeout(run,250);setTimeout(run,1000);
})();
