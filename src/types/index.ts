export type TradeDirection = 'BUY' | 'SELL';
export type TradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
export type TradingSession = 'Asia' | 'London' | 'New York' | 'Overlap';
export type TradingTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

export type TradingInstrumentCategory = 'forex' | 'metal' | 'index' | 'futures' | 'crypto' | 'stock' | 'other';

export interface TradingInstrument {
  id: string;
  symbol: string;
  name: string;
  category: TradingInstrumentCategory;
  priceStep: number | string;
  valuePerPriceUnit: number | string;
  defaultPositionSize?: number | string;
}

export interface TradingSetup {
  id: string;
  name: string;
}

export type EmotionalState =
  | 'Calm'
  | 'Disciplined'
  | 'Focused'
  | 'FOMO'
  | 'Fear'
  | 'Revenge'
  | 'Overconfidence'
  | 'Hesitation';

export interface Trade {
  id: string;
  userId: string;
  accountId: string;
  symbol: string;
  direction: TradeDirection;
  entryDate: string;
  exitDate?: string;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize: number;
  riskAmount?: number;
  result: TradeResult;
  pnl: number;
  rMultiple?: number;
  setup: string;
  session: TradingSession;
  timeframe: TradingTimeframe;
  notes?: string;
  emotion: EmotionalState;
  screenshotBeforeUrl?: string;
  screenshotAfterUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AccountType = 'Prop Firm Challenge' | 'Prop Firm Funded' | 'Personal Live' | 'Demo / Simulation';
export type AccountStatus = 'Active' | 'Passed' | 'Failed' | 'Archived';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

export interface TradingAccount {
  id: string;
  userId: string;
  name: string;
  broker: string;
  type: AccountType;
  initialBalance: number;
  currentBalance: number;
  currency: CurrencyCode;
  targetProfit?: number;
  maxDrawdownLimit?: number;
  riskPerTradePercent?: number;
  status: AccountStatus;
  createdAt: string;
}

export type SubscriptionPlan = 'free' | 'pro' | 'community';
export type UserRole = 'trader' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type SubscriptionStatus = 'pending' | 'active' | 'expired';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: SubscriptionPlan;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  paymentDate?: string;
  subscriptionStartAt?: string;
  subscriptionExpiresAt?: string;
  subscriptionStatus?: SubscriptionStatus;
  paymentStatus?: PaymentStatus;
  pendingPlan?: SubscriptionPlan;
  planChangeRequestedAt?: string;
  planChangeConfirmedAt?: string;
  settings?: {
    defaultCurrency: CurrencyCode;
    theme: 'dark' | 'light';
    language: string;
    instruments?: TradingInstrument[];
    setups?: TradingSetup[];
  };
}

export interface TraderScoreReport {
  overallScore: number;
  riskManagementScore: number;
  disciplineScore: number;
  consistencyScore: number;
  executionScore: number;
  psychologyScore: number;
  profitabilityScore: number;
  strengths: string[];
  weaknesses: string[];
  isSufficientData: boolean;
  tradesAnalyzed: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgRR: number;
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  expectancy: number;
  currentStreak: { type: 'WIN' | 'LOSS' | 'NONE'; count: number };
  bestTrade: number;
  worstTrade: number;
  equityCurve: { date: string; balance: number; pnl: number; tradeIndex: number }[];
}
