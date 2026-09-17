/* IAMTRADER CALENDAR V5 — route guard + legacy renderer recovery */
(()=>{
  const isCalendar=()=>window.IAMTRADER?.state?.page==='calendar'||document.querySelector('.nav-item[data-page="calendar"]')?.classList.contains('active');
  const mount=()=>{
    if(!isCalendar())return;
    const api=window.IAMTRADER_CALENDAR_V44;
    if(typeof api?.render==='function'){
      try{api.render(true)}catch(err){console.error('[IAMTRADER calendar v5]',err)}
    }
  };
  const isCalendarButton=e=>e?.target?.closest?.('.nav-item[data-page="calendar"]');
  const guard=()=>{
    const btn=document.querySelector('.nav-item[data-page="calendar"]');
    if(!btn||btn.__iamCalendarGuard)return;
    const original=btn.onclick;
    btn.onclick=function(e){
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if(typeof original==='function')original.call(this,e);
      else if(window.IAMTRADER?.state)window.IAMTRADER.state.page='calendar';
      setTimeout(mount,0);
      setTimeout(mount,60);
      setTimeout(mount,250);
    };
    btn.__iamCalendarGuard=true;
  };
  window.addEventListener('click',e=>{
    const btn=isCalendarButton(e);
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(typeof btn.onclick==='function')btn.onclick.call(btn,e);
    else if(window.IAMTRADER?.state)window.IAMTRADER.state.page='calendar';
    setTimeout(mount,0);
    setTimeout(mount,60);
    setTimeout(mount,250);
  },true);
  const observer=new MutationObserver(()=>{
    guard();
    if(isCalendar()&&document.querySelector('.calendar-v2')){
      clearTimeout(window.__iamCalendarV5Timer);
      window.__iamCalendarV5Timer=setTimeout(mount,20);
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  guard();
  setTimeout(mount,0);
  setTimeout(mount,300);
  setTimeout(mount,1000);
})();
