import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole } from '../types';

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

export async function registerWithEmail(email: string, pass: string, displayName: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  try {
    await updateProfile(cred.user, { displayName });
  } catch {
    // profile update optional
  }
  
  // Create user profile document in Firestore if permitted by rules
  try {
    const userRef = doc(db, 'users', cred.user.uid);
    const initialProfile: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: displayName || email.split('@')[0],
      plan: 'free', // New accounts start on Starter
      role: 'trader',
      status: 'active',
      createdAt: new Date().toISOString(),
      subscriptionStatus: 'active',
      subscriptionStartAt: new Date().toISOString(),
      paymentStatus: 'unpaid',
      settings: {
        defaultCurrency: 'USD',
        theme: 'light',
        language: 'fr'
      }
    };
    await setDoc(userRef, initialProfile, { merge: true });
  } catch (firestoreErr: any) {
    console.warn("Notice: Firestore profile initial write (rules check):", firestoreErr.message);
  }

  return cred.user;
}

export async function updateTraderProfile(uid: string, traderProfile: UserProfile['traderProfile'], displayName?: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { ...(displayName !== undefined ? { displayName } : {}), traderProfile }, { merge: true });
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function resetUserPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.warn("Could not fetch user profile from Firestore:", error);
    return null;
  }
}

export async function checkIsAdmin(user: User): Promise<boolean> {
  try {
    const profile = await getUserProfile(user.uid);
    return profile?.role === 'admin';
  } catch {
    return false;
  }
}


export async function updateUserAvatar(uid: string, avatarURL: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { avatarURL, photoURL: avatarURL }, { merge: true });
  if (auth.currentUser?.uid === uid) {
    try { await updateProfile(auth.currentUser, { photoURL: avatarURL }); } catch { /* Firestore remains the source of truth. */ }
  }
}
