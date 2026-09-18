import { auth, IAMTRADER_ADMIN_WORKER_URL } from './firebase-client.js';

export async function adminAction(action,payload={}){
  const user=auth?.currentUser;
  if(!user) throw new Error('Utilisateur non authentifié.');

  const idToken=await user.getIdToken(true);
  const response=await fetch(IAMTRADER_ADMIN_WORKER_URL+'/admin-action',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+idToken
    },
    body:JSON.stringify({action,...payload})
  });

  const data=await response.json().catch(()=>({}));

  if(!response.ok){
    throw new Error(data?.error||'L’opération administrateur a été refusée.');
  }

  return data;
}
