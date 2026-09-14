(()=>{
const classify=()=>document.querySelectorAll('.cal-day').forEach(cell=>{cell.classList.remove('day-success','day-failure','day-neutral');const pnl=cell.querySelector('.day-pnl');if(!pnl){cell.classList.add('day-neutral');return}const text=pnl.textContent.replace(/\s/g,'');const n=Number(text.replace(/[^0-9+\-.,]/g,'').replace(',','.'));cell.classList.add(n>0?'day-success':n<0?'day-failure':'day-neutral')});
const obs=new MutationObserver(()=>{if(document.querySelector('.calendar-v2'))classify()});obs.observe(document.body,{childList:true,subtree:true});setTimeout(classify,80);window.addEventListener('load',classify);
})();
