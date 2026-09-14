// Lightweight global UX helpers for dynamically-created modals.
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');
  if(close){close.closest('.modal')?.remove();}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')document.querySelectorAll('.modal').forEach(m=>m.remove());
});
