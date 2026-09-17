/* IAMTRADER CALENDAR V5 — route guard: the legacy calendar renderer must not win */
(()=>{
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
  },true);
  const observer=new MutationObserver(guard);
  observer.observe(document.body,{childList:true,subtree:true});
  guard();
})();
