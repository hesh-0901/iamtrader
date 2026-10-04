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
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'scheduled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export type PaymentRecordStatus = 'initiated' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled' | 'invalidated';
export type PaymentMode = 'live' | 'simulation';

export interface PaymentRecord {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  plan: SubscriptionPlan;
  planName: string;
  amount: number;
  currency: string;
  phone?: string;
  provider?: string;
  paymentMethod?: string;
  mode?: PaymentMode;
  status: PaymentRecordStatus;
  reference: string;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  failureMessage?: string;
  baseAmount?: number;
  paymentFee?: number;
  paymentFeeRate?: number;
  payerName?: string;
  paymentProvider?: string;
  subscriptionAction?: 'initial' | 'renewal' | 'upgrade';
  activationStartAt?: string;
  activationExpiresAt?: string;
}

export interface AdminLog {
  id: string;
  adminUid: string;
  action: string;
  userUid: string;
  userName: string;
  details: string;
  createdAt: string;
}

export interface TraderSocialLink {
  network: string;
  username: string;
}

export interface UserCertificate {
  id: string;
  title: string;
  issuedAt: string;
  certificateNumber?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  traderProfile?: {
    firstName?: string;
    lastName?: string;
    gender?: string;
    age?: number;
    city?: string;
    country?: string;
    whatsapp?: string;
    level?: string;
    style?: string;
    markets?: string[];
    socialLinks?: TraderSocialLink[];
  };
  certificates?: UserCertificate[];
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
  scheduledPlan?: SubscriptionPlan;
  scheduledStartAt?: string;
  scheduledExpiresAt?: string;
  settings?: {
    defaultCurrency: CurrencyCode;
    theme: 'dark' | 'light';
    language: string;
    instruments?: TradingInstrument[];
    setups?: TradingSetup[];
  };
}

export interface TraderRating {
  score: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  label: 'Elite' | 'Excellent' | 'Solide' | 'En progression' | 'À construire' | 'Données insuffisantes';
  isSufficientData: boolean;
  tradesAnalyzed: number;
  winRate: number;
  profitFactor: number;
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
