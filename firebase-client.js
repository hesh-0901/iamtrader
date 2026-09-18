import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
  setDoc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, firebaseConfigured } from './firebase-config.js';

let app=null;
let auth=null;
let db=null;

if(firebaseConfigured){
  app=initializeApp(firebaseConfig);
  auth=getAuth(app);
  // Certains navigateurs/extensions bloquent le transport WebChannel de Firestore.
  // Force le transport long-polling pour éviter les erreurs ERR_BLOCKED_BY_CLIENT.
  db=initializeFirestore(app,{experimentalForceLongPolling:true});
}

export const IAMTRADER_BOOTSTRAP_ADMIN_UID='pPIFw9YSgMd4Exp2vobl1CMOqJ3';
export const IAMTRADER_ADMIN_WORKER_URL='https://iamtrader-admin.henochshungu.workers.dev';

const slugifyName=name=>String(name||'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g,'.')
  .replace(/^\.|\.$/g,'');

export function iamtraderEmail(firstName){
  const slug=slugifyName(firstName);
  return slug ? `${slug}@iamtrader.app` : '';
}

function requireFirebase(){
  if(!firebaseConfigured) throw new Error('Firebase n’est pas encore configuré dans firebase-config.js.');
  return {auth,db};
}

export function firebaseStatus(){
  return {configured:firebaseConfigured,auth,db};
}

export async function registerUser({firstName,password,plan='free',memberCode=''}) {
  const {auth,db}=requireFirebase();
  const email=iamtraderEmail(firstName);
  if(!email) throw new Error('Prénom invalide.');
  const credential=await createUserWithEmailAndPassword(auth,email,password);
  const uid=credential.user.uid;
  const profile={
    uid,
    firstName:String(firstName).trim(),
    username:slugifyName(firstName),
    role:'retail',
    plan:'free',
    status:'active',
    role:'retail',
    requestedPlan:['pro','community'].includes(plan)?plan:null,
    communityStatus:plan==='community'?'pending':null,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  };
  try{
    const batch=writeBatch(db);
    batch.set(doc(db,'users',uid),profile);
    if(plan==='community'){
      batch.set(doc(db,'communityRequests',uid),{
        uid,
        firstName:String(firstName).trim(),
        requestedPlan:'community',
        memberCodeSubmitted:Boolean(String(memberCode||'').trim()),
        status:'pending',
        createdAt:serverTimestamp()
      });
    }
    await batch.commit();
  }catch(error){
    try{ await deleteUser(credential.user); }catch(cleanupError){ console.error('IAMTRADER Firebase cleanup error',cleanupError); }
    throw error;
  }
  return {user:credential.user,profile};
}

export async function loginUser({firstName,password}){
  const {auth,db}=requireFirebase();
  const email=iamtraderEmail(firstName);
  if(!email) throw new Error('Prénom invalide.');
  const credential=await signInWithEmailAndPassword(auth,email,password);
  const snap=await getDoc(doc(db,'users',credential.user.uid));
  const profile=snap.exists()?snap.data():{uid:credential.user.uid,firstName:String(firstName).trim(),role:'retail',plan:'free',status:'active'};
  return {user:credential.user,profile};
}

export async function logoutUser(){
  if(!auth)return;
  await signOut(auth);
}

export function watchAuth(callback){
  if(!firebaseConfigured)return ()=>{};
  return onAuthStateChanged(auth,callback);
}

export async function getUserData(uid){
  const {db}=requireFirebase();
  try{
    const [accountsSnap,tradesSnap]=await Promise.all([
      getDocsFromServer(query(collection(db,'accounts'),where('uid','==',uid))),
      getDocsFromServer(query(collection(db,'trades'),where('uid','==',uid)))
    ]);
    const result={
      accounts:accountsSnap.docs.map(s=>s.data()),
      trades:tradesSnap.docs.map(s=>s.data())
    };
    console.info('[IAMTRADER FIRESTORE] read OK',{uid,accounts:result.accounts.length,trades:result.trades.length});
    return result;
  }catch(error){
    console.error('[IAMTRADER FIRESTORE] read failed',{code:error?.code,message:error?.message});
    throw error;
  }
}

export async function migrateSingleAccountTrades(accountId){
  const {db,auth}=requireFirebase();
  const uid=auth.currentUser?.uid;
  if(!uid) throw new Error('Utilisateur non authentifié.');
  const snap=await getDocsFromServer(query(collection(db,'trades'),where('uid','==',uid)));
  const legacy=snap.docs.filter(s=>s.data()?.accountId!==accountId);
  if(!legacy.length) return {migrated:0,trades:snap.docs.map(s=>s.data())};
  const batch=writeBatch(db);
  legacy.forEach(s=>batch.update(s.ref,{accountId}));
  await batch.commit();
  const verified=await getDocsFromServer(query(collection(db,'trades'),where('uid','==',uid)));
  const trades=verified.docs.map(s=>s.data());
  const remaining=trades.filter(t=>t.accountId!==accountId);
  if(remaining.length) throw new Error('Firestore : migration des trades incomplète.');
  console.info('[IAMTRADER FIRESTORE] trade account migration',{accountId,migrated:legacy.length,verified:trades.length});
  return {migrated:legacy.length,trades};
}

export async function saveUserAccount(account){
  const {db,auth}=requireFirebase();
  const uid=auth.currentUser?.uid;
  if(!uid) throw new Error('Utilisateur non authentifié.');
  await setDoc(doc(db,'accounts',account.id),{...account,uid});
  return {...account,uid};
}

export async function saveUserTrade(trade){
  const {db,auth}=requireFirebase();
  const uid=auth.currentUser?.uid;
  if(!uid) throw new Error('Utilisateur non authentifié.');
  await setDoc(doc(db,'trades',trade.id),{...trade,uid});
  return {...trade,uid};
}

export async function deleteUserTrade(tradeId){
  const {db,auth}=requireFirebase();
  const uid=auth.currentUser?.uid;
  if(!uid) throw new Error('Utilisateur non authentifié.');
  await deleteDoc(doc(db,'trades',tradeId));
}

export async function getAuthClaims(forceRefresh=false){
  const {auth}=requireFirebase();
  const user=auth.currentUser;
  if(!user)return {};
  const token=await user.getIdTokenResult(forceRefresh);
  return token.claims||{};
}

async function callAdminWorker(path,payload={}){
  const {auth}=requireFirebase();
  const user=auth.currentUser;
  if(!user) throw new Error('Utilisateur non authentifié.');
  const idToken=await user.getIdToken();
  const response=await fetch(IAMTRADER_ADMIN_WORKER_URL+path,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+idToken
    },
    body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    throw new Error(data?.error||'Le service d’administration a refusé la requête.');
  }
  return data;
}

export async function bootstrapAdminAccess(){
  const result=await callAdminWorker('/bootstrap-admin');
  return result||{};
}

export async function setAdminAccess(uid,enabled){
  const result=await callAdminWorker('/set-admin',{uid:String(uid),enabled:Boolean(enabled)});
  return result||{};
}


export async function getAdminData(){
  const {db,auth}=requireFirebase();
  const user=auth.currentUser;
  if(!user) throw new Error('Utilisateur non authentifié.');
  // Les Custom Claims sont portés par l'ID token utilisé par Firestore.
  // Après une activation admin, force son renouvellement avant les lectures.
  await user.getIdToken(true);
  const claims=(await user.getIdTokenResult()).claims||{};
  if(claims.admin!==true) throw new Error('Autorisation administrateur Firebase absente du token.');
  const [usersSnap,accountsSnap,tradesSnap,requestsSnap]=await Promise.all([
    getDocs(collection(db,'users')),
    getDocs(collection(db,'accounts')),
    getDocs(collection(db,'trades')),
    getDocs(collection(db,'communityRequests'))
  ]);
  return {
    users:usersSnap.docs.map(s=>s.data()),
    accounts:accountsSnap.docs.map(s=>s.data()),
    trades:tradesSnap.docs.map(s=>s.data()),
    communityRequests:requestsSnap.docs.map(s=>s.data())
  };
}

export async function getCurrentProfile(){
  const {auth,db}=requireFirebase();
  const user=auth.currentUser;
  if(!user)return null;
  const snap=await getDoc(doc(db,'users',user.uid));
  return snap.exists()?snap.data():null;
}

export { app,auth,db };
