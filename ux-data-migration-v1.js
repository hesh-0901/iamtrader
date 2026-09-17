(()=>{
  const KEY='iamtrader:v1';
  const DEFAULT_INSTRUMENTS=['XAUUSD','EURUSD','GBPUSD','USDJPY','NAS100','US30','SPX500','XAGUSD'];
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return;
    const state=JSON.parse(raw);
    if(!state||!Array.isArray(state.accounts))return;
    let changed=false;
    state.accounts.forEach(a=>{
      if(!Array.isArray(a.instruments)||!a.instruments.length){a.instruments=[...DEFAULT_INSTRUMENTS];changed=true}
      if(a.dailyLoss==null&&a.maxDailyLoss!=null){a.dailyLoss=Number(a.maxDailyLoss);changed=true}
    });
    if(changed)localStorage.setItem(KEY,JSON.stringify(state));
  }catch(e){console.warn('IAMTRADER data migration skipped',e)}
})();
