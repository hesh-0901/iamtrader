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
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
  setDoc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import { firebaseConfig, firebaseConfigured } from './firebase-config.js';

let app=null;
let auth=null;
let db=null;
let functions=null;

if(firebaseConfigured){
  app=initializeApp(firebaseConfig);
  auth=getAuth(app);
  db=getFirestore(app);
  functions=getFunctions(app,'us-central1');
}

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
  const [accountsSnap,tradesSnap]=await Promise.all([
    getDocs(query(collection(db,'accounts'),where('uid','==',uid))),
    getDocs(query(collection(db,'trades'),where('uid','==',uid)))
  ]);
  return {
    accounts:accountsSnap.docs.map(s=>s.data()),
    trades:tradesSnap.docs.map(s=>s.data())
  };
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

export async function bootstrapAdminAccess(){
  const {auth}=requireFirebase();
  if(!auth.currentUser) throw new Error('Utilisateur non authentifié.');
  if(!functions) throw new Error('Firebase Functions n’est pas configuré.');
  const call=httpsCallable(functions,'bootstrapAdmin');
  const result=await call({});
  return result.data||{};
}

export async function setAdminAccess(uid,enabled){
  const {auth}=requireFirebase();
  if(!auth.currentUser) throw new Error('Utilisateur non authentifié.');
  if(!functions) throw new Error('Firebase Functions n’est pas configuré.');
  const call=httpsCallable(functions,'setAdminAccess');
  const result=await call({uid:String(uid),enabled:Boolean(enabled)});
  return result.data||{};
}


export async function getAdminData(){
  const {db,auth}=requireFirebase();
  if(!auth.currentUser) throw new Error('Utilisateur non authentifié.');
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
