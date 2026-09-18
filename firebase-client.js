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
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, firebaseConfigured } from './firebase-config.js';

let app=null;
let auth=null;
let db=null;

if(firebaseConfigured){
  app=initializeApp(firebaseConfig);
  auth=getAuth(app);
  db=getFirestore(app);
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
    plan:'free',
    status:'active',
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
  const profile=snap.exists()?snap.data():{uid:credential.user.uid,firstName:String(firstName).trim(),plan:'free',status:'active'};
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

export async function getCurrentProfile(){
  const {auth,db}=requireFirebase();
  const user=auth.currentUser;
  if(!user)return null;
  const snap=await getDoc(doc(db,'users',user.uid));
  return snap.exists()?snap.data():null;
}

export { app,auth,db };
