import { auth, IAMTRADER_ADMIN_WORKER_URL } from './firebase-client.js';

export async function getAdminData(){
  const user=auth?.currentUser;
  if(!user) throw new Error('Utilisateur non authentifié.');

  const idToken=await user.getIdToken(true);
  const response=await fetch(IAMTRADER_ADMIN_WORKER_URL+'/admin-data',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+idToken
    }
  });

  const data=await response.json().catch(()=>({}));

  if(!response.ok){
    throw new Error(data?.error||'Impossible de charger les données administrateur.');
  }

  return {
    users:Array.isArray(data?.users)?data.users:[],
    accounts:Array.isArray(data?.accounts)?data.accounts:[],
    trades:Array.isArray(data?.trades)?data.trades:[],
    communityRequests:Array.isArray(data?.communityRequests)?data.communityRequests:[]
  };
}
