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
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Trade, TradingAccount, UserProfile } from '../types';

// ==========================================
// DEMO / GUEST SAMPLE DATA
// ==========================================

export const DEMO_ACCOUNTS: TradingAccount[] = [
  {
    id: "demo-account-apex-50k",
    userId: "guest-trader-id",
    name: "Apex 50K Funded",
    broker: "Apex Trader Funding",
    type: "Prop Firm Funded",
    initialBalance: 50000,
    currentBalance: 52480,
    currency: "USD",
    targetProfit: 3000,
    maxDrawdownLimit: 2500,
    riskPerTradePercent: 1.0,
    status: "Active",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "demo-account-ftmo-100k",
    userId: "guest-trader-id",
    name: "FTMO Challenge $100K",
    broker: "FTMO",
    type: "Prop Firm Challenge",
    initialBalance: 100000,
    currentBalance: 104250,
    currency: "USD",
    targetProfit: 10000,
    maxDrawdownLimit: 10000,
    riskPerTradePercent: 0.5,
    status: "Active",
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
  }
];

export const DEMO_TRADES: Trade[] = [
  {
    id: "demo-trade-1",
    userId: "guest-trader-id",
    accountId: "demo-account-apex-50k",
    symbol: "NQ (Nasdaq)",
    direction: "BUY",
    entryDate: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
    exitDate: new Date(Date.now() - 14 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString(),
    entryPrice: 19820.50,
    exitPrice: 19910.00,
    stopLoss: 19780.00,
    takeProfit: 19910.00,
    positionSize: 2,
    riskAmount: 500,
    result: "WIN",
    pnl: 895.00,
    rMultiple: 1.79,
    setup: "FVG + Liquidity Sweep",
    session: "New York",
    timeframe: "5m",
    emotion: "Disciplined",
    notes: "Clean NY open sweep of Asian high followed by aggressive market structure shift."
  },
  {
    id: "demo-trade-2",
    userId: "guest-trader-id",
    accountId: "demo-account-apex-50k",
    symbol: "ES (S&P 500)",
    direction: "SELL",
    entryDate: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
    exitDate: new Date(Date.now() - 11 * 24 * 3600 * 1000 + 30 * 60 * 1000).toISOString(),
    entryPrice: 5645.25,
    exitPrice: 5660.00,
    stopLoss: 5660.00,
    takeProfit: 5615.00,
    positionSize: 2,
    riskAmount: 450,
    result: "LOSS",
    pnl: -450.00,
    rMultiple: -1.0,
    setup: "Order Block Retest",
    session: "New York",
    timeframe: "15m",
    emotion: "Calm",
    notes: "Price invalidated bearish order block following CPI release. Strict stop loss respected."
  },
  {
    id: "demo-trade-3",
    userId: "guest-trader-id",
    accountId: "demo-account-apex-50k",
    symbol: "EUR/USD",
    direction: "BUY",
    entryDate: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
    exitDate: new Date(Date.now() - 9 * 24 * 3600 * 1000 + 120 * 60 * 1000).toISOString(),
    entryPrice: 1.0842,
    exitPrice: 1.0898,
    stopLoss: 1.0815,
    takeProfit: 1.0898,
    positionSize: 4,
    riskAmount: 400,
    result: "WIN",
    pnl: 672.00,
    rMultiple: 2.07,
    setup: "London Breakout",
    session: "London",
    timeframe: "1h",
    emotion: "Focused",
    notes: "London session expansion target reached with zero slippage."
  },
  {
    id: "demo-trade-4",
    userId: "guest-trader-id",
    accountId: "demo-account-apex-50k",
    symbol: "XAU/USD (Gold)",
    direction: "BUY",
    entryDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    exitDate: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 80 * 60 * 1000).toISOString(),
    entryPrice: 2650.40,
    exitPrice: 2674.20,
    stopLoss: 2638.00,
    takeProfit: 2675.00,
    positionSize: 1.5,
    riskAmount: 500,
    result: "WIN",
    pnl: 1190.00,
    rMultiple: 2.38,
    setup: "Trend Following",
    session: "London",
    timeframe: "15m",
    emotion: "Calm",
    notes: "Gold continuation trade during geopolitical tension. Scaled out at target."
  },
  {
    id: "demo-trade-5",
    userId: "guest-trader-id",
    accountId: "demo-account-apex-50k",
    symbol: "NQ (Nasdaq)",
    direction: "SELL",
    entryDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    exitDate: new Date(Date.now() - 5 * 24 * 3600 * 1000 + 40 * 60 * 1000).toISOString(),
    entryPrice: 19950.00,
    exitPrice: 19952.00,
    stopLoss: 19980.00,
    takeProfit: 19850.00,
    positionSize: 2,
    riskAmount: 400,
    result: "BREAKEVEN",
    pnl: 0.00,
    rMultiple: 0.0,
    setup: "Reversal",
    session: "New York",
    timeframe: "5m",
    emotion: "Disciplined",
    notes: "Moved stop to breakeven after 1R. Pulled back and stopped at scratch."
  },
  {
    id: "demo-trade-6",
    userId: "guest-trader-id",
    accountId: "demo-account-ftmo-100k",
    symbol: "BTC/USDT",
    direction: "BUY",
    entryDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    exitDate: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 180 * 60 * 1000).toISOString(),
    entryPrice: 63200,
    exitPrice: 64850,
    stopLoss: 62400,
    takeProfit: 65000,
    positionSize: 1,
    riskAmount: 800,
    result: "WIN",
    pnl: 1650.00,
    rMultiple: 2.06,
    setup: "Breakout",
    session: "Asia",
    timeframe: "1h",
    emotion: "Focused",
    notes: "High volume breakout above weekly range high."
  },
  {
    id: "demo-trade-7",
    userId: "guest-trader-id",
    accountId: "demo-account-apex-50k",
    symbol: "ES (S&P 500)",
    entryDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    exitDate: new Date(Date.now() - 1 * 24 * 3600 * 1000 + 25 * 60 * 1000).toISOString(),
    direction: "BUY",
    entryPrice: 5720.00,
    exitPrice: 5708.00,
    stopLoss: 5708.00,
    takeProfit: 5750.00,
    positionSize: 2,
    riskAmount: 480,
    result: "LOSS",
    pnl: -480.00,
    rMultiple: -1.0,
    setup: "Liquidity Sweep",
    session: "New York",
    timeframe: "5m",
    emotion: "Disciplined",
    notes: "Fakeout sweep below Asian low failed to bounce. Risk strictly capped."
  }
];

// ==========================================
// TRADES SERVICE
// ==========================================

export function subscribeUserTrades(
  userId: string, 
  callback: (trades: Trade[], error?: Error) => void,
  accountId?: string
) {
  // Only query Firestore if a real authenticated user is signed in
  if (!userId || userId === 'guest-trader-id' || !auth.currentUser) {
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
  if (!userId || userId === 'guest-trader-id' || !auth.currentUser) {
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
    pendingPlan: undefined,
    planChangeRequestedAt: undefined,
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

// ==========================================
// SEEDING SERVICE (FOR AUTHENTICATED USERS)
// ==========================================

export async function seedStarterTradingData(userId: string): Promise<void> {
  if (!auth.currentUser) {
    return;
  }

  // 1. Create a primary Trading Account
  const accountId = await addAccount({
    userId,
    name: "Apex 50K Funded",
    broker: "Apex Trader Funding",
    type: "Prop Firm Funded",
    initialBalance: 50000,
    currentBalance: 52480,
    currency: "USD",
    targetProfit: 3000,
    maxDrawdownLimit: 2500,
    riskPerTradePercent: 1.0,
    status: "Active",
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  });

  const secondaryAccountId = await addAccount({
    userId,
    name: "FTMO Challenge $100K",
    broker: "FTMO",
    type: "Prop Firm Challenge",
    initialBalance: 100000,
    currentBalance: 104250,
    currency: "USD",
    targetProfit: 10000,
    maxDrawdownLimit: 10000,
    riskPerTradePercent: 0.5,
    status: "Active",
    createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString()
  });

  // 2. Realistic sample trades over recent weeks
  const sampleTrades: Omit<Trade, 'id'>[] = [
    {
      userId,
      accountId,
      symbol: "NQ (Nasdaq)",
      direction: "BUY",
      entryDate: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
      exitDate: new Date(Date.now() - 14 * 24 * 3600 * 1000 + 45 * 60 * 1000).toISOString(),
      entryPrice: 19820.50,
      exitPrice: 19910.00,
      stopLoss: 19780.00,
      takeProfit: 19910.00,
      positionSize: 2,
      riskAmount: 500,
      result: "WIN",
      pnl: 895.00,
      rMultiple: 1.79,
      setup: "FVG + Liquidity Sweep",
      session: "New York",
      timeframe: "5m",
      emotion: "Disciplined",
      notes: "Clean NY open sweep of Asian high followed by aggressive market structure shift."
    },
    {
      userId,
      accountId,
      symbol: "ES (S&P 500)",
      direction: "SELL",
      entryDate: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
      exitDate: new Date(Date.now() - 11 * 24 * 3600 * 1000 + 30 * 60 * 1000).toISOString(),
      entryPrice: 5645.25,
      exitPrice: 5660.00,
      stopLoss: 5660.00,
      takeProfit: 5615.00,
      positionSize: 2,
      riskAmount: 450,
      result: "LOSS",
      pnl: -450.00,
      rMultiple: -1.0,
      setup: "Order Block Retest",
      session: "New York",
      timeframe: "15m",
      emotion: "Calm",
      notes: "Price invalidated bearish order block following CPI release. Strict stop loss respected."
    },
    {
      userId,
      accountId,
      symbol: "EUR/USD",
      direction: "BUY",
      entryDate: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
      exitDate: new Date(Date.now() - 9 * 24 * 3600 * 1000 + 120 * 60 * 1000).toISOString(),
      entryPrice: 1.0842,
      exitPrice: 1.0898,
      stopLoss: 1.0815,
      takeProfit: 1.0898,
      positionSize: 4,
      riskAmount: 400,
      result: "WIN",
      pnl: 672.00,
      rMultiple: 2.07,
      setup: "London Breakout",
      session: "London",
      timeframe: "1h",
      emotion: "Focused",
      notes: "London session expansion target reached with zero slippage."
    },
    {
      userId,
      accountId,
      symbol: "XAU/USD (Gold)",
      direction: "BUY",
      entryDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      exitDate: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 80 * 60 * 1000).toISOString(),
      entryPrice: 2650.40,
      exitPrice: 2674.20,
      stopLoss: 2638.00,
      takeProfit: 2675.00,
      positionSize: 1.5,
      riskAmount: 500,
      result: "WIN",
      pnl: 1190.00,
      rMultiple: 2.38,
      setup: "Trend Following",
      session: "London",
      timeframe: "15m",
      emotion: "Calm",
      notes: "Gold continuation trade during geopolitical tension. Scaled out at target."
    },
    {
      userId,
      accountId,
      symbol: "NQ (Nasdaq)",
      direction: "SELL",
      entryDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      exitDate: new Date(Date.now() - 5 * 24 * 3600 * 1000 + 40 * 60 * 1000).toISOString(),
      entryPrice: 19950.00,
      exitPrice: 19952.00,
      stopLoss: 19980.00,
      takeProfit: 19850.00,
      positionSize: 2,
      riskAmount: 400,
      result: "BREAKEVEN",
      pnl: 0.00,
      rMultiple: 0.0,
      setup: "Reversal",
      session: "New York",
      timeframe: "5m",
      emotion: "Disciplined",
      notes: "Moved stop to breakeven after 1R. Pulled back and stopped at scratch."
    },
    {
      userId,
      accountId: secondaryAccountId,
      symbol: "BTC/USDT",
      direction: "BUY",
      entryDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      exitDate: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 180 * 60 * 1000).toISOString(),
      entryPrice: 63200,
      exitPrice: 64850,
      stopLoss: 62400,
      takeProfit: 65000,
      positionSize: 1,
      riskAmount: 800,
      result: "WIN",
      pnl: 1650.00,
      rMultiple: 2.06,
      setup: "Breakout",
      session: "Asia",
      timeframe: "1h",
      emotion: "Focused",
      notes: "High volume breakout above weekly range high."
    },
    {
      userId,
      accountId,
      symbol: "ES (S&P 500)",
      entryDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      exitDate: new Date(Date.now() - 1 * 24 * 3600 * 1000 + 25 * 60 * 1000).toISOString(),
      direction: "BUY",
      entryPrice: 5720.00,
      exitPrice: 5708.00,
      stopLoss: 5708.00,
      takeProfit: 5750.00,
      positionSize: 2,
      riskAmount: 480,
      result: "LOSS",
      pnl: -480.00,
      rMultiple: -1.0,
      setup: "Liquidity Sweep",
      session: "New York",
      timeframe: "5m",
      emotion: "Disciplined",
      notes: "Fakeout sweep below Asian low failed to bounce. Risk strictly capped."
    }
  ];

  for (const t of sampleTrades) {
    await addTrade(t);
  }
}

