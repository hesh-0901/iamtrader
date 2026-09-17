// IAMTRADER — global modal interaction guard
// Close actions are deferred until every modal-specific handler has finished.
// Backdrop clicks never close dialogs: only explicit close controls / Escape do.
const MODAL_SELECTOR='.modal,.iam-account-picker';

function restorePageInteraction(){
  if(document.querySelector(MODAL_SELECTOR))return;
  document.body.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overflow');
}

// Prevent accidental dismissal when clicking the dimmed area around a dialog.
document.addEventListener('click',event=>{
  const overlay=event.target.closest?.(MODAL_SELECTOR);
  if(overlay && event.target===overlay){
    event.preventDefault();
    event.stopImmediatePropagation();
  }
},true);

// Let the page/modal's own close handler run first, then clean up any leftover overlay.
document.addEventListener('click',event=>{
  const close=event.target.closest?.('[data-close],.iam-picker-close');
  if(!close)return;
  const overlay=close.closest?.(MODAL_SELECTOR);
  setTimeout(()=>{
    if(overlay?.isConnected){
      const dialog=overlay.querySelector('.modal-box,.iam-account-v2-box,.iam-account-popover');
      if(!dialog || !dialog.isConnected)overlay.remove();
    }
    restorePageInteraction();
  },0);
},false);

// Escape closes dialogs consistently, including the account picker.
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  document.querySelectorAll(MODAL_SELECTOR).forEach(el=>el.remove());
  restorePageInteraction();
});

// If a dialog is removed by another module, immediately release page interaction.
const observer=new MutationObserver(()=>{
  if(!document.querySelector(MODAL_SELECTOR))restorePageInteraction();
});
observer.observe(document.body,{childList:true,subtree:true});
