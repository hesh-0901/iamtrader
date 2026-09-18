/* IAMTRADER CALENDAR V6 — day details + Ctrl multi-selection */
(()=>{
  const today=new Date();
  const monthStart=d=>new Date(d.getFullYear(),d.getMonth(),1);
  const monthRange=d=>({from:new Date(d.getFullYear(),d.getMonth(),1),to:new Date(d.getFullYear(),d.getMonth()+1,0)});
  const state={month:monthStart(today),range:monthRange(today),preset:'month',selectedDates:new Set(),detailDate:null};
  const read=()=>window.IAMTRADER?.state||{trades:[],accounts:[],activeAccountId:null};
  const pad=n=>String(n).padStart(2,'0');
  const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dateOnly=s=>{const d=new Date(s);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate())};
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c='USD')=>`${Number(v||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`;
  const monthLabel=d=>d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).replace(/^./,x=>x.toUpperCase());
  const dayLabel=d=>d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).replace(/^./,x=>x.toUpperCase());
  const isCalendarPage=()=>window.IAMTRADER?.state?.page==='calendar';
  const account=()=>{const s=read();return s.accounts?.find(a=>a.id===s.activeAccountId)||null};
  const trades=()=>{const s=read();return (s.trades||[]).filter(t=>t.accountId===s.activeAccountId&&t.exit!==null&&t.exit!==undefined&&t.exit!=='')};
  const dayMap=()=>{const map=new Map();for(const t of trades()){const d=dateOnly(t.date);if(!d)continue;const k=key(d);const x=map.get(k)||{pnl:0,trades:0};x.pnl+=Number(t.pnl||0);x.trades++;map.set(k,x)}return map};
  const tradesForDay=d=>trades().filter(t=>{const x=dateOnly(t.date);return x&&key(x)===key(d)});
  const fmtRange=r=>r?`${r.from.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})} → ${r.to.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`:'';
  const periodLabel=()=>({month:'Ce mois','prev-month':'Mois précédent',week:'Cette semaine','7d':'7 derniers jours','30d':'30 derniers jours',year:'Cette année',custom:'Sélection'}[state.preset]||'Sélection');
  const rangeForPreset=p=>{const now=new Date(),todayOnly=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(p==='month')return {from:new Date(todayOnly.getFullYear(),todayOnly.getMonth(),1),to:new Date(todayOnly.getFullYear(),todayOnly.getMonth()+1,0)};if(p==='prev-month')return {from:new Date(todayOnly.getFullYear(),todayOnly.getMonth()-1,1),to:new Date(todayOnly.getFullYear(),todayOnly.getMonth(),0)};if(p==='week'){const day=todayOnly.getDay()||7,from=new Date(todayOnly);from.setDate(todayOnly.getDate()-day+1);const to=new Date(from);to.setDate(from.getDate()+6);return {from,to}}if(p==='7d'){const from=new Date(todayOnly);from.setDate(todayOnly.getDate()-6);return {from,to:todayOnly}}if(p==='30d'){const from=new Date(todayOnly);from.setDate(todayOnly.getDate()-29);return {from,to:todayOnly}}if(p==='year')return {from:new Date(todayOnly.getFullYear(),0,1),to:new Date(todayOnly.getFullYear(),11,31)};return null};
  function summary(r){const ts=trades().filter(t=>{const d=dateOnly(t.date);return d&&d>=r.from&&d<=r.to});return {pnl:ts.reduce((n,t)=>n+Number(t.pnl||0),0),trades:ts.length,days:new Set(ts.map(t=>key(dateOnly(t.date)))).size}};
  function setMonth(d){state.month=monthStart(d);state.range=monthRange(state.month);state.preset='month';state.selectedDates.clear();state.detailDate=null;render(true)}
  function render(force=false){
    if(!isCalendarPage())return false;
    const host=document.querySelector('.content');if(!host)return false;
    if(host.querySelector('.calendar-v3')&&!force)return true;
    const a=account(),currency=a?.currency||'USD',map=dayMap(),selected=state.range,sum=summary(selected),detail=state.detailDate?tradesForDay(state.detailDate):[];
    const first=monthStart(state.month),daysInMonth=new Date(first.getFullYear(),first.getMonth()+1,0).getDate(),leading=(first.getDay()||7)-1,totalCells=Math.ceil((leading+daysInMonth)/7)*7;
    const cells=[];
    for(let i=0;i<totalCells;i++){
      const dayNumber=i-leading+1;
      if(dayNumber<1||dayNumber>daysInMonth){cells.push('<div class="cal3-empty" aria-hidden="true"></div>');continue}
      const d=new Date(first.getFullYear(),first.getMonth(),dayNumber),k=key(d),x=map.get(k)||{pnl:0,trades:0},today=k===key(new Date()),weekend=d.getDay()===0||d.getDay()===6,selectedDate=state.selectedDates.has(k),status=x.trades?(x.pnl>0?'win':x.pnl<0?'loss':'flat'):'empty';
      const activity=x.trades?`<div class="cal3-result"><strong>${x.pnl>=0?'+':''}${money(x.pnl,currency)}</strong><small>Trades: ${x.trades}</small></div>`:'';
      cells.push(`<button type="button" class="cal3-day ${status} ${today?'today':''} ${weekend?'weekend':''} ${selectedDate?'multi-selected':''}" data-date="${k}" aria-label="${esc(dayLabel(d))}"><b>${dayNumber}</b>${activity}</button>`)
    }
    host.innerHTML=`<section class="calendar-v3 card">
      <div class="cal3-toolbar"><button type="button" class="cal3-today" data-cal-today>Aujourd'hui</button><button type="button" class="cal3-nav" data-prev aria-label="Mois précédent">‹</button><button type="button" class="cal3-month-picker" data-month-open aria-label="Choisir le mois"><strong>${monthLabel(first)}</strong><span>Choisir le mois</span></button><button type="button" class="cal3-nav" data-next aria-label="Mois suivant">›</button><div class="cal3-toolbar-spacer"></div><div class="cal3-period-summary"><span>Statistiques mensuelles</span><strong class="${sum.pnl>=0?'positive':'negative'}">${sum.pnl>=0?'+':''}${money(sum.pnl,currency)}</strong><em>Jours de trading: ${sum.days}</em></div><button type="button" class="cal3-period-trigger" data-period-open><span>Période</span><b>${periodLabel()}</b></button></div>
      <div class="cal3-selection-hint">Cliquez sur une journée pour voir ses trades · <kbd>Ctrl</kbd> + clic pour sélectionner plusieurs journées</div>
      <div class="cal3-weekdays">${['Lun','Mar','Mer','Jeu','Vend.','Sam','Dim'].map(x=>`<b>${x}</b>`).join('')}</div><div class="cal3-grid">${cells.join('')}</div>
      <p class="cal3-footnote">Les trades sont affichés selon l'heure de la plateforme, ce qui peut différer du fuseau horaire local.</p>
      ${state.detailDate?`<aside class="cal3-day-details" data-day-details><div class="cal3-details-head"><div><span>DÉTAILS DE LA JOURNÉE</span><h3>${esc(dayLabel(state.detailDate))}</h3></div><button type="button" data-detail-close aria-label="Fermer">×</button></div>${detail.length?`<div class="cal3-detail-total"><span>P&L de la journée</span><strong class="${detail.reduce((n,t)=>n+Number(t.pnl||0),0)>=0?'positive':'negative'}">${detail.reduce((n,t)=>n+Number(t.pnl||0),0)>=0?'+':''}${money(detail.reduce((n,t)=>n+Number(t.pnl||0),0),currency)}</strong><em>${detail.length} trade${detail.length>1?'s':''}</em></div><div class="cal3-trade-list">${detail.map((t,i)=>`<div class="cal3-trade-row"><span class="cal3-trade-index">${i+1}</span><div class="cal3-trade-main"><strong>${esc(t.symbol||t.instrument||'Trade')}</strong><small>${esc(t.direction||t.side||'')} ${t.setup||t.strategy?'· '+esc(t.setup||t.strategy):''}</small></div><strong class="${Number(t.pnl||0)>=0?'positive':'negative'}">${Number(t.pnl||0)>=0?'+':''}${money(t.pnl,currency)}</strong></div>`).join('')}</div>`:'<div class="cal3-empty-details">Aucun trade clôturé cette journée.</div>'}</aside>`:''}
      <div class="cal3-popover" data-period-pop hidden><div class="cal3-pop-head"><b>Choisir une période</b><button type="button" data-period-close>×</button></div><div class="cal3-presets">${[['month','Ce mois'],['prev-month','Mois précédent'],['week','Cette semaine'],['7d','7 derniers jours'],['30d','30 derniers jours'],['year','Cette année']].map(([v,l])=>`<button type="button" data-preset="${v}">${l}</button>`).join('')}</div><div class="cal3-custom"><span>Personnalisée</span><label>Du<input type="date" data-from></label><label>Au<input type="date" data-to></label><button type="button" data-apply>Appliquer</button></div></div>
      <div class="cal3-popover cal3-month-popover" data-month-pop hidden><div class="cal3-pop-head"><b>Choisir un mois</b><button type="button" data-month-close>×</button></div><div class="cal3-month-select"><label>Année<select data-year>${Array.from({length:21},(_,i)=>new Date().getFullYear()-10+i).map(y=>`<option value="${y}" ${y===first.getFullYear()?'selected':''}>${y}</option>`).join('')}</select></label><div class="cal3-months">${Array.from({length:12},(_,i)=>`<button type="button" data-month="${i}" class="${i===first.getMonth()?'active':''}">${new Date(2000,i,1).toLocaleDateString('fr-FR',{month:'long'}).replace(/^./,x=>x.toUpperCase())}</button>`).join('')}</div></div></div>
    </section>`;
    bind();
    return true;
  }
  function bind(){
    const root=document.querySelector('.calendar-v3');if(!root)return;
    root.querySelector('[data-prev]').onclick=()=>setMonth(new Date(state.month.getFullYear(),state.month.getMonth()-1,1));
    root.querySelector('[data-next]').onclick=()=>setMonth(new Date(state.month.getFullYear(),state.month.getMonth()+1,1));
    root.querySelector('[data-cal-today]').onclick=()=>setMonth(new Date());
    const period=root.querySelector('[data-period-pop]');root.querySelector('[data-period-open]').onclick=()=>{root.querySelector('[data-month-pop]').hidden=true;period.hidden=!period.hidden};root.querySelector('[data-period-close]').onclick=()=>{period.hidden=true};
    root.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const r=rangeForPreset(b.dataset.preset);if(!r)return;state.range=r;state.preset=b.dataset.preset;state.month=monthStart(r.to);state.selectedDates.clear();state.detailDate=null;period.hidden=true;render(true)});
    root.querySelector('[data-apply]').onclick=()=>{const f=root.querySelector('[data-from]').value,t=root.querySelector('[data-to]').value;if(!f||!t||f>t)return;state.range={from:new Date(`${f}T00:00:00`),to:new Date(`${t}T00:00:00`)};state.preset='custom';state.month=monthStart(state.range.to);state.selectedDates.clear();state.detailDate=null;period.hidden=true;render(true)};
    root.querySelectorAll('[data-date]').forEach(b=>b.onclick=e=>{const d=new Date(`${b.dataset.date}T00:00:00`),k=b.dataset.date;if(e.ctrlKey||e.metaKey){if(state.selectedDates.has(k))state.selectedDates.delete(k);else state.selectedDates.add(k);state.preset='custom';state.detailDate=null;render(true);return}state.selectedDates.clear();state.detailDate=d;state.preset='month';state.range=monthRange(d);render(true)});
    const close=root.querySelector('[data-detail-close]');if(close)close.onclick=()=>{state.detailDate=null;render(true)};
    const mp=root.querySelector('[data-month-pop]');root.querySelector('[data-month-open]').onclick=()=>{period.hidden=true;mp.hidden=!mp.hidden};root.querySelector('[data-month-close]').onclick=()=>{mp.hidden=true};
    const year=root.querySelector('[data-year]');root.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{setMonth(new Date(Number(year.value),Number(b.dataset.month),1));mp.hidden=true});
    year.onchange=()=>{setMonth(new Date(Number(year.value),state.month.getMonth(),1));mp.hidden=true};
  }
  window.IAMTRADER_CALENDAR={render,version:'6.0'};
  const boot=()=>{try{render(true)}catch(err){window.IAMTRADER_CALENDAR.error=String(err);console.error('[IAMTRADER calendar]',err)}};
  let timer;
  const observer=new MutationObserver(()=>{if(isCalendarPage()&&!document.querySelector('.calendar-v3')){clearTimeout(timer);timer=setTimeout(boot,30)}});
  observer.observe(document.body,{childList:true,subtree:true});
  boot();
  setTimeout(boot,500);
  setTimeout(boot,1500);
})();
