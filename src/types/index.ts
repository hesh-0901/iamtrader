export type TradeDirection = 'BUY' | 'SELL';
export type TradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
export type TradingSession = 'Asia' | 'London' | 'New York' | 'Overlap';
export type TradingTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

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
  entryDate: string; // ISO string
  exitDate?: string; // ISO string
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize: number; // Contracts / Lots
  riskAmount?: number; // In currency
  result: TradeResult;
  pnl: number; // Net Profit & Loss in $
  rMultiple?: number; // e.g. +2.5R, -1.0R
  setup: string; // e.g. "Breakout", "Liquidity Sweep", "Order Block", "FVG"
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
  broker: string; // e.g. "FTMO", "Apex", "Interactive Brokers"
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

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: SubscriptionPlan;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  settings?: {
    defaultCurrency: CurrencyCode;
    theme: 'dark' | 'light';
    language: string;
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
  winRate: number; // Percentage
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
