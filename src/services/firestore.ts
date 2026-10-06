import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  setDoc,
  orderBy,
  limit,
  deleteField,
  addDoc as addFirestoreDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { AdminLog, PaymentRecord, Trade, TradingAccount, UserProfile } from '../types';

// ==========================================
// TRADES SERVICE
// ==========================================

export function subscribeUserTrades(
  userId: string, 
  callback: (trades: Trade[], error?: Error) => void,
  accountId?: string
) {
  // Only query Firestore if a real authenticated user is signed in
  if (!userId || !auth.currentUser) {
    callback([]);
    return () => {};
  }

  try {
    const tradesRef = collection(db, 'trades');
    const q = query(tradesRef, where('userId', '==', userId));

    return onSnapshot(q, (snapshot) => {
      const trades: Trade[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        trades.push({
          id: docSnapshot.id,
          ...data
        } as Trade);
      });

      const filtered = accountId && accountId !== 'all' 
        ? trades.filter(t => t.accountId === accountId)
        : trades;

      filtered.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      callback(filtered);
    }, (error) => {
      console.warn("Firestore trades subscription permission notice:", error.message);
      callback([], error);
    });
  } catch (err: any) {
    console.warn("Notice: Failed to setup trades listener:", err.message);
    callback([], err);
    return () => {};
  }
}

export async function addTrade(trade: Omit<Trade, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'trades'), {
    ...trade,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateTrade(tradeId: string, tradeData: Partial<Trade>): Promise<void> {
  const tradeRef = doc(db, 'trades', tradeId);
  await updateDoc(tradeRef, {
    ...tradeData,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteTrade(tradeId: string): Promise<void> {
  const tradeRef = doc(db, 'trades', tradeId);
  await deleteDoc(tradeRef);
}

// ==========================================
// ACCOUNTS SERVICE
// ==========================================

export function subscribeUserAccounts(
  userId: string,
  callback: (accounts: TradingAccount[], error?: Error) => void
) {
  // Only query Firestore if a real authenticated user is signed in
  if (!userId || !auth.currentUser) {
    callback([]);
    return () => {};
  }

  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('userId', '==', userId));

    return onSnapshot(q, (snapshot) => {
      const accounts: TradingAccount[] = [];
      snapshot.forEach((docSnapshot) => {
        accounts.push({
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as TradingAccount);
      });

      accounts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(accounts);
    }, (error) => {
      console.warn("Firestore accounts subscription permission notice:", error.message);
      callback([], error);
    });
  } catch (err: any) {
    console.warn("Notice: Failed to setup accounts listener:", err.message);
    callback([], err);
    return () => {};
  }
}

export async function addAccount(account: Omit<TradingAccount, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'accounts'), {
    ...account,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateAccount(accountId: string, data: Partial<TradingAccount>): Promise<void> {
  const accountRef = doc(db, 'accounts', accountId);
  await updateDoc(accountRef, data);
}

export async function deleteAccount(accountId: string): Promise<void> {
  const accountRef = doc(db, 'accounts', accountId);
  await deleteDoc(accountRef);
}

// ==========================================
// USER PROFILE & ADMIN
// ==========================================

export async function getAllAccounts(): Promise<TradingAccount[]> {
  const snapshot = await getDocs(query(collection(db, 'accounts'), limit(1000)));
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as TradingAccount));
}

export async function getAllTrades(): Promise<Trade[]> {
  const snapshot = await getDocs(query(collection(db, 'trades'), limit(5000)));
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Trade));
}

export function subscribeAllUsers(
  callback: (users: UserProfile[], error?: Error) => void
) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, limit(200));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(docSnap => ({
      uid: docSnap.id,
      ...docSnap.data()
    } as UserProfile));
    callback(users);
  }, (error) => {
    console.warn('Firestore admin users realtime notice:', error.message);
    callback([], error);
  });
}

export function subscribeAllPayments(
  callback: (payments: PaymentRecord[], error?: Error) => void
) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }

  const paymentsRef = collection(db, 'payments');
  const q = query(paymentsRef, limit(100));
  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as PaymentRecord));
    payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(payments);
  }, (error) => {
    console.warn('Firestore admin payments realtime notice:', error.message);
    callback([], error);
  });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(query(usersRef, limit(200)));
  const users: UserProfile[] = [];
  snapshot.forEach(docSnap => {
    users.push({
      uid: docSnap.id,
      ...docSnap.data()
    } as UserProfile);
  });
  return users;
}


export async function updateUserSettings(
  uid: string,
  settings: Partial<NonNullable<UserProfile['settings']>>
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const updates: Record<string, unknown> = {};
  if (settings.defaultCurrency !== undefined) updates['settings.defaultCurrency'] = settings.defaultCurrency;
  if (settings.theme !== undefined) updates['settings.theme'] = settings.theme;
  if (settings.language !== undefined) updates['settings.language'] = settings.language;
  if (settings.instruments !== undefined) updates['settings.instruments'] = settings.instruments;
  if (settings.setups !== undefined) updates['settings.setups'] = settings.setups;
  await updateDoc(userRef, updates);
}

export async function updateUserRoleAndPlan(
  uid: string,
  data: {
    role?: 'trader' | 'admin';
    plan?: 'free' | 'pro' | 'community';
    status?: 'active' | 'suspended';
    paymentDate?: string;
    subscriptionStartAt?: string;
    subscriptionExpiresAt?: string;
    subscriptionStatus?: 'pending' | 'active' | 'expired';
    paymentStatus?: 'unpaid' | 'paid' | 'refunded';
    pendingPlan?: 'free' | 'pro' | 'community';
    planChangeRequestedAt?: string;
    planChangeConfirmedAt?: string;
  }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function confirmUserPlan(
  uid: string,
  plan: 'free' | 'pro' | 'community',
  paymentDate: string,
  subscriptionStartAt: string,
  subscriptionExpiresAt: string
): Promise<void> {
  await updateUserRoleAndPlan(uid, {
    plan,
    pendingPlan: deleteField(),
    planChangeRequestedAt: deleteField(),
    planChangeConfirmedAt: new Date().toISOString(),
    paymentDate,
    subscriptionStartAt,
    subscriptionExpiresAt,
    subscriptionStatus: 'active',
    paymentStatus: 'paid'
  });
}

export async function extendUserSubscription(
  uid: string,
  plan: 'free' | 'pro' | 'community',
  paymentDate: string,
  subscriptionStartAt: string,
  subscriptionExpiresAt: string
): Promise<void> {
  await updateUserRoleAndPlan(uid, {
    plan,
    paymentDate,
    subscriptionStartAt,
    subscriptionExpiresAt,
    subscriptionStatus: 'active',
    paymentStatus: 'paid'
  });
}
export async function requestUserPlanChange(uid: string, plan: 'pro' | 'community'): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    pendingPlan: plan,
    planChangeRequestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}


export type ContactMessageStatus = 'new' | 'in_progress' | 'resolved';

export interface ContactConversationMessage {
  id?: string;
  direction: 'inbound' | 'outbound';
  body: string;
  at: string;
  from?: string;
  to?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
  updatedAt?: string;
  handledBy?: string;
  handledAt?: string;
  adminNote?: string;
  lastReply?: string;
  repliedAt?: string;
  repliedBy?: string;
  conversation?: ContactConversationMessage[];
}

export async function addContactMessage(data: Omit<ContactMessage, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'handledBy' | 'handledAt' | 'adminNote'>): Promise<string> {
  const docRef = await addFirestoreDoc(collection(db, 'contactMessages'), {
    ...data,
    status: 'new',
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

export function subscribeContactMessages(
  callback: (messages: ContactMessage[], error?: Error) => void
) {
  if (!auth.currentUser) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as ContactMessage)));
  }, (error) => {
    console.warn('Firestore contact messages subscription notice:', error.message);
    callback([], error);
  });
}

export async function updateContactMessage(
  messageId: string,
  data: Partial<Pick<ContactMessage, 'status' | 'adminNote' | 'updatedAt' | 'handledBy' | 'handledAt' | 'lastReply' | 'repliedAt' | 'repliedBy'>>
): Promise<void> {
  await updateDoc(doc(db, 'contactMessages', messageId), {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteContactMessage(messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'contactMessages', messageId));
}

export async function addAdminLog(log: Omit<AdminLog, 'id'>): Promise<string> {
  const ref = await addFirestoreDoc(collection(db, 'adminLogs'), log);
  return ref.id;
}

export async function getAdminLogs(maxItems = 40): Promise<AdminLog[]> {
  const logsRef = collection(db, 'adminLogs');
  const snapshot = await getDocs(query(logsRef, orderBy('createdAt', 'desc'), limit(maxItems)));
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AdminLog));
}
