/* IAMTRADER CALENDAR V5 — single calendar UI */
(()=>{
  const KEY='iamtrader:v1';
  const today=new Date();
  const monthStart=d=>new Date(d.getFullYear(),d.getMonth(),1);
  const monthRange=d=>({from:new Date(d.getFullYear(),d.getMonth(),1),to:new Date(d.getFullYear(),d.getMonth()+1,0)});
  const state={month:monthStart(today),range:monthRange(today),preset:'month'};
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{trades:[],accounts:[],activeAccountId:null}}catch{return {trades:[],accounts:[],activeAccountId:null}}};
  const pad=n=>String(n).padStart(2,'0');
  const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dateOnly=s=>{const d=new Date(s);return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate())};
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c='USD')=>`${Number(v||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`;
  const monthLabel=d=>d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).replace(/^./,x=>x.toUpperCase());
  const isCalendarPage=()=>window.IAMTRADER?.state?.page==='calendar';
  const account=()=>{const s=read();return s.accounts?.find(a=>a.id===s.activeAccountId)||null};
  const trades=()=>{const s=read();return (s.trades||[]).filter(t=>t.accountId===s.activeAccountId&&t.exit!==null&&t.exit!==undefined&&t.exit!=='')};
  const dayMap=()=>{const map=new Map();for(const t of trades()){const d=dateOnly(t.date);if(!d)continue;const k=key(d);const x=map.get(k)||{pnl:0,trades:0};x.pnl+=Number(t.pnl||0);x.trades++;map.set(k,x)}return map};
  const fmtRange=r=>r?`${r.from.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})} → ${r.to.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`:'Aucune période sélectionnée';
  const rangeForPreset=p=>{const now=new Date(),todayOnly=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(p==='month')return {from:new Date(todayOnly.getFullYear(),todayOnly.getMonth(),1),to:new Date(todayOnly.getFullYear(),todayOnly.getMonth()+1,0)};if(p==='prev-month')return {from:new Date(todayOnly.getFullYear(),todayOnly.getMonth()-1,1),to:new Date(todayOnly.getFullYear(),todayOnly.getMonth(),0)};if(p==='week'){const day=todayOnly.getDay()||7,from=new Date(todayOnly);from.setDate(todayOnly.getDate()-day+1);const to=new Date(from);to.setDate(from.getDate()+6);return {from,to}}if(p==='7d'){const from=new Date(todayOnly);from.setDate(todayOnly.getDate()-6);return {from,to:todayOnly}}if(p==='30d'){const from=new Date(todayOnly);from.setDate(todayOnly.getDate()-29);return {from,to:todayOnly}}if(p==='year')return {from:new Date(todayOnly.getFullYear(),0,1),to:new Date(todayOnly.getFullYear(),11,31)};return null};
  function summary(r){const ts=trades().filter(t=>{const d=dateOnly(t.date);return d&&d>=r.from&&d<=r.to});return {pnl:ts.reduce((n,t)=>n+Number(t.pnl||0),0),trades:ts.length,days:new Set(ts.map(t=>key(dateOnly(t.date)))).size}};
  function setMonth(d){state.month=monthStart(d);state.range=monthRange(state.month);state.preset='month';render(true)}
  function render(force=false){
    if(!isCalendarPage())return false;
    const host=document.querySelector('.content');if(!host)return false;
    if(host.querySelector('.calendar-v3')&&!force)return true;
    const a=account(),currency=a?.currency||'USD',map=dayMap(),selected=state.range,sum=summary(selected);
    const first=monthStart(state.month),start=new Date(first);start.setDate(1-((first.getDay()||7)-1));
    const cells=[];
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);const k=key(d),x=map.get(k)||{pnl:0,trades:0},inMonth=d.getMonth()===first.getMonth(),inRange=selected&&d>=selected.from&&d<=selected.to,today=k===key(new Date()),weekend=d.getDay()===0||d.getDay()===6;
      cells.push(`<button type="button" class="cal3-day ${inMonth?'':'muted'} ${today?'today':''} ${weekend?'weekend':''} ${x.trades?'has-trades':''} ${inRange?'selected':''}" data-date="${k}"><b>${d.getDate()}</b><span class="cal3-spacer"></span><span class="cal3-pnl ${x.pnl>0?'win':x.pnl<0?'loss':'flat'}">${x.trades?`${x.pnl>=0?'+':''}${money(x.pnl,currency)}`:'—'}</span><small>${x.trades?`Trades: ${x.trades}`:'Aucun trade'}</small></button>`)
    }
    host.innerHTML=`<section class="calendar-v3 card">
      <div class="cal3-head"><div><span class="eyebrow">CALENDRIER DE TRADING</span><button type="button" class="cal3-month-picker" data-month-open aria-label="Choisir le mois"><h2>${monthLabel(first)}</h2><span>Choisir un mois</span></button><p>${esc(fmtRange(selected))}</p></div><div class="cal3-actions"><button type="button" class="cal3-period" data-period-open><span>Période analysée</span><b>${state.preset==='month'?'Ce mois':state.preset==='prev-month'?'Mois précédent':state.preset==='week'?'Cette semaine':state.preset==='7d'?'7 derniers jours':state.preset==='30d'?'30 derniers jours':state.preset==='year'?'Cette année':'Personnalisée'}</b></button><button type="button" class="cal3-today" data-cal-today>Aujourd'hui</button><button type="button" class="cal3-nav" data-prev aria-label="Mois précédent">‹</button><button type="button" class="cal3-nav" data-next aria-label="Mois suivant">›</button></div></div>
      <div class="cal3-summary"><div><span>P&L période</span><b class="${sum.pnl>=0?'positive':'negative'}">${sum.pnl>=0?'+':''}${money(sum.pnl,currency)}</b></div><div><span>Trades</span><b>${sum.trades}</b></div><div><span>Jours actifs</span><b>${sum.days}</b></div><div class="cal3-range-label">${esc(fmtRange(selected))}</div></div>
      <div class="cal3-weekdays">${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(x=>`<b>${x}</b>`).join('')}</div><div class="cal3-grid">${cells.join('')}</div>
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
    root.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const r=rangeForPreset(b.dataset.preset);if(!r)return;state.range=r;state.preset=b.dataset.preset;state.month=monthStart(r.to);period.hidden=true;render(true)});
    root.querySelector('[data-apply]').onclick=()=>{const f=root.querySelector('[data-from]').value,t=root.querySelector('[data-to]').value;if(!f||!t||f>t)return;state.range={from:new Date(`${f}T00:00:00`),to:new Date(`${t}T00:00:00`)};state.preset='custom';state.month=monthStart(state.range.to);period.hidden=true;render(true)};
    root.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{const d=new Date(`${b.dataset.date}T00:00:00`);if(!state.range)state.range={from:d,to:d};else if(d<state.range.from)state.range={from:d,to:state.range.to};else if(d>state.range.to)state.range={from:state.range.from,to:d};else state.range={from:d,to:d};state.preset='custom';render(true)});
    const mp=root.querySelector('[data-month-pop]');root.querySelector('[data-month-open]').onclick=()=>{period.hidden=true;mp.hidden=!mp.hidden};root.querySelector('[data-month-close]').onclick=()=>{mp.hidden=true};
    const year=root.querySelector('[data-year]');root.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{setMonth(new Date(Number(year.value),Number(b.dataset.month),1));mp.hidden=true});
    year.onchange=()=>{setMonth(new Date(Number(year.value),state.month.getMonth(),1));mp.hidden=true};
  }
  window.IAMTRADER_CALENDAR={render,version:'5.0'};
  const boot=()=>{try{render(true)}catch(err){window.IAMTRADER_CALENDAR.error=String(err);console.error('[IAMTRADER calendar]',err)}};
  let timer;
  const observer=new MutationObserver(()=>{if(isCalendarPage()&&!document.querySelector('.calendar-v3')){clearTimeout(timer);timer=setTimeout(boot,30)}});
  observer.observe(document.body,{childList:true,subtree:true});
  boot();
  setTimeout(boot,500);
  setTimeout(boot,1500);
})();
