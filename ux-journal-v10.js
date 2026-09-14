/* IAMTRADER Journal v10 — small DOM enhancement layer */
const KEY='iamtrader:v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}};
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function enhanceJournal(){
  const root=document.querySelector('.content');
  if(!root)return;
  const head=root.querySelector('.page-head');
  const table=root.querySelector('.table-wrap');
  if(!head||!table)return;
  root.classList.add('journal-v10');
  const summary=root.querySelector('.journal-summary');
  if(summary&&!summary.dataset.v10){
    summary.dataset.v10='1';
    const state=read(),trades=(state.trades||[]).filter(t=>t.accountId===state.activeAccountId),closed=trades.filter(t=>t.exit!==null&&t.exit!==undefined&&t.exit!=='');
    const avgR=closed.length?closed.reduce((s,t)=>s+Number(t.rMultiple||0),0)/closed.length:0;
    const r=document.createElement('div');
    r.innerHTML=`<b>${avgR>=0?'+':''}${avgR.toFixed(2)}R</b><span>R moyen</span>`;
    summary.appendChild(r.firstElementChild.parentElement);
  }
  // Keep the existing summary semantics but make it immediately scannable.
  const labels=['Trades','Win rate','P&L filtré'];
  [...(root.querySelectorAll('.journal-summary>div'))].slice(0,3).forEach((el,i)=>{if(!el.dataset.v10label){el.dataset.v10label='1';const span=el.querySelector('span');if(span&&i<labels.length)span.textContent=labels[i]}});
}
function enhanceTradeModal(modal){
  if(!modal||modal.dataset.v10)return;
  modal.dataset.v10='1';
  modal.classList.add('trade-view-v10');
  const head=modal.querySelector('.modal-head');
  const grid=modal.querySelector('.detail-grid');
  if(head&&grid){
    const title=head.querySelector('h2');
    const text=title?.textContent||'';
    const [symbol,direction]=text.split(' · ');
    const p=grid.querySelectorAll('div');
    const pnlEl=p[6]?.querySelector('b');
    const rEl=p[7]?.querySelector('b');
    const pnlText=pnlEl?.textContent||'';
    const positive=!/^[-−]/.test(pnlText) && !pnlText.toLowerCase().includes('planifié');
    const hero=document.createElement('div');
    hero.className='trade-identity-v10';
    hero.innerHTML=`<div class="trade-symbol-v10"><span>${symbol?esc(symbol.slice(0,2)):'TR'}</span><div><b>${esc(symbol||'Trade')}</b><small>${direction==='BUY'?'Position acheteuse':direction==='SELL'?'Position vendeuse':'Décision enregistrée'}</small></div></div><span class="trade-status-v10 ${positive?'win':'loss'}">${pnlText.toLowerCase().includes('planifié')?'OUVERT':positive?'GAGNANT':'PERDANT'}</span>`;
    head.insertAdjacentElement('afterend',hero);
    if(pnlEl) pnlEl.classList.add(positive?'positive':'negative');
    if(rEl) rEl.classList.add(positive?'positive':'negative');
  }
  const note=modal.querySelector('.trade-note');
  if(note){
    const title=note.querySelector('b');
    if(title)title.textContent='Contexte & psychologie';
  }
}
const observer=new MutationObserver(()=>{enhanceJournal();const m=document.querySelector('.modal .menu-modal');if(m)enhanceTradeModal(m)});
observer.observe(document.body,{childList:true,subtree:true});
setTimeout(enhanceJournal,80);
