import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const uid=process.argv[2];

if(!uid){
  console.error('Usage: npm run set-admin -- <FIREBASE_UID>');
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  projectId: 'iamtrader'
});

const auth=getAuth();
const db=getFirestore();

const user=await auth.getUser(uid);
const claims={...(user.customClaims||{}),admin:true};

await auth.setCustomUserClaims(uid,claims);
await db.collection('users').doc(uid).set({
  role:'admin',
  updatedAt:new Date()
},{merge:true});

console.log('Admin activé pour:',user.email||uid);
console.log('Custom claim:',JSON.stringify(claims));
console.log('Important: reconnecte-toi à IAMTRADER ou force un rafraîchissement du token.');
