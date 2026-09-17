/* IAMTRADER CALENDAR V2 — DOM adapter for the existing calendar markup */
const DATE_RE=/^(?:[1-9]|[12]\d|3[01])(?:\s|$)/;
const PNL_RE=/^[+−-]?\s*(?:[$€£]|\d)[\d\s.,]*\s*(?:USD|EUR|GBP|ZMW|JPY|CHF|CAD|AUD)?$/i;

function text(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
function isDateCell(el){
  const t=text(el);
  return DATE_RE.test(t) && t.length<180;
}
function scoreGrid(el){
  const kids=[...el.children];
  if(kids.length<20||kids.length>42)return 0;
  const hits=kids.filter(isDateCell).length;
  return hits/kids.length;
}
function findGrid(root){
  let best=null,bestScore=0;
  root.querySelectorAll('*').forEach(el=>{
    const s=scoreGrid(el);
    if(s>bestScore){bestScore=s;best=el}
  });
  return bestScore>=.70?best:null;
}
function findRoot(){
  const today=[...document.querySelectorAll('button,a,span,b,div')].find(el=>text(el).toLowerCase()==="aujourd'hui");
  if(!today)return null;
  let p=today;
  for(let i=0;i<7&&p;i++,p=p.parentElement){
    const grid=findGrid(p);
    if(grid)return p;
  }
  return null;
}
function markPnl(day){
  [...day.children].forEach(ch=>{
    const t=text(ch);
    if(/^[+−-]/.test(t) || PNL_RE.test(t))ch.classList.add('iam-cal-pnl');
    if(/trades?\s*:/i.test(t))ch.classList.add('iam-cal-trades');
  });
  day.querySelectorAll('*').forEach(ch=>{
    const t=text(ch);
    if(ch.children.length===0 && (/^[+−-]/.test(t)||PNL_RE.test(t)))ch.classList.add('iam-cal-pnl');
    if(ch.children.length===0 && /trades?\s*:/i.test(t))ch.classList.add('iam-cal-trades');
  });
  const pnl=day.querySelector('.iam-cal-pnl');
  if(pnl){
    const raw=text(pnl).replace(/[^0-9,.-]/g,'').replace(/\s/g,'').replace(',','.');
    const n=parseFloat(raw);
    day.classList.toggle('iam-cal-win',n>0);
    day.classList.toggle('iam-cal-loss',n<0);
    day.classList.toggle('iam-cal-flat',!Number.isFinite(n)||n===0);
  }
  day.classList.toggle('iam-cal-muted',/^(?:[1-9]|[12]\d|3[01])\s/.test(text(day)) && /Trades?:\s*0/i.test(text(day))===false && day.classList.contains('muted'));
}
function enhance(){
  const root=findRoot();
  if(!root)return;
  const grid=findGrid(root);
  if(!grid)return;
  root.classList.add('iam-calendar-root');
  grid.classList.add('iam-calendar-grid');
  [...grid.children].forEach(day=>{day.classList.add('iam-calendar-day');markPnl(day)});
  const heads=[...root.querySelectorAll('h1,h2,h3,h4,p,span,b')];
  heads.forEach(el=>{if(/^[A-Za-zÀ-ÿ]+\s+\d{4}$/.test(text(el)))el.classList.add('iam-cal-month');});
}
let timer;
const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,40)});
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',enhance);
enhance();
