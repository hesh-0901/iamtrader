import { Trade, PerformanceMetrics, TraderScoreReport, TraderRating } from '../types';

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const isPositive = amount > 0;
  const isNegative = amount < 0;
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (isPositive) return `+${symbol}${formatted}`;
  if (isNegative) return `-${symbol}${formatted}`;
  return `${symbol}0.00`;
}

export function formatPercent(value: number): string {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const formatted = Math.abs(value).toFixed(1);

  if (isPositive) return `+${formatted}%`;
  if (isNegative) return `-${formatted}%`;
  return `0.0%`;
}

export function calculatePerformance(trades: Trade[], initialCapital: number = 0): PerformanceMetrics {
  const closedTrades = trades
    .filter(t => t.result !== 'OPEN')
    .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

  const totalTrades = closedTrades.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRate: 0,
      totalPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      avgRR: 0,
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      expectancy: 0,
      currentStreak: { type: 'NONE', count: 0 },
      bestTrade: 0,
      worstTrade: 0,
      equityCurve: [{ date: new Date().toISOString(), balance: initialCapital, pnl: 0, tradeIndex: 0 }]
    };
  }

  let totalWinAmount = 0;
  let totalLossAmount = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakevenTrades = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;
  let sumRR = 0;
  let rrCount = 0;

  let currentBalance = initialCapital;
  let peakBalance = initialCapital;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  const equityCurve: { date: string; balance: number; pnl: number; tradeIndex: number }[] = [
    { date: closedTrades[0]?.entryDate || new Date().toISOString(), balance: initialCapital, pnl: 0, tradeIndex: 0 }
  ];

  let streakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  let streakCount = 0;

  closedTrades.forEach((trade, index) => {
    const pnl = Number(trade.pnl) || 0;
    currentBalance += pnl;

    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
    }
    const currentDd = peakBalance - currentBalance;
    if (currentDd > maxDrawdownAmount) {
      maxDrawdownAmount = currentDd;
      maxDrawdownPercent = peakBalance > 0 ? (currentDd / peakBalance) * 100 : 0;
    }

    equityCurve.push({
      date: trade.exitDate || trade.entryDate,
      balance: currentBalance,
      pnl,
      tradeIndex: index + 1
    });

    if (pnl > 0) {
      winningTrades++;
      totalWinAmount += pnl;
      if (pnl > bestTrade) bestTrade = pnl;

      if (streakType === 'WIN') {
        streakCount++;
      } else {
        streakType = 'WIN';
        streakCount = 1;
      }
    } else if (pnl < 0) {
      losingTrades++;
      totalLossAmount += Math.abs(pnl);
      if (pnl < worstTrade) worstTrade = pnl;

      if (streakType === 'LOSS') {
        streakCount++;
      } else {
        streakType = 'LOSS';
        streakCount = 1;
      }
    } else {
      breakevenTrades++;
      streakType = 'NONE';
      streakCount = 0;
    }

    if (trade.rMultiple !== undefined && trade.rMultiple !== null) {
      sumRR += Number(trade.rMultiple);
      rrCount++;
    }
  });

  const totalPnl = totalWinAmount - totalLossAmount;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const avgWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 99.9 : 0;
  const avgRR = rrCount > 0 ? sumRR / rrCount : avgLoss > 0 ? avgWin / avgLoss : 0;

  // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
  const winProb = winningTrades / totalTrades;
  const lossProb = losingTrades / totalTrades;
  const expectancy = (winProb * avgWin) - (lossProb * avgLoss);

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    breakevenTrades,
    winRate,
    totalPnl,
    avgWin,
    avgLoss,
    profitFactor,
    avgRR,
    maxDrawdownAmount,
    maxDrawdownPercent,
    expectancy,
    currentStreak: { type: streakType, count: streakCount },
    bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
    worstTrade: worstTrade === Infinity ? 0 : worstTrade,
    equityCurve
  };
}

export function calculateTraderScore(trades: Trade[]): TraderScoreReport {
  const closedTrades = trades.filter(t => t.result !== 'OPEN');
  
  if (closedTrades.length < 5) {
    return {
      overallScore: 0,
      riskManagementScore: 0,
      disciplineScore: 0,
      consistencyScore: 0,
      executionScore: 0,
      psychologyScore: 0,
      profitabilityScore: 0,
      strengths: [],
      weaknesses: [],
      isSufficientData: false,
      tradesAnalyzed: closedTrades.length
    };
  }

  const perf = calculatePerformance(closedTrades);
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // 1. Risk Management (Max Drawdown, Stop Loss usage, avg loss size)
  let riskScore = 70;
  const tradesWithSL = closedTrades.filter(t => t.stopLoss && t.stopLoss > 0).length;
  const slUsageRate = tradesWithSL / closedTrades.length;
  if (slUsageRate >= 0.9) {
    riskScore += 15;
    strengths.push('Strict stop loss adherence across executions');
  } else if (slUsageRate < 0.6) {
    riskScore -= 25;
    weaknesses.push('Frequent trading without defined stop losses');
  }

  if (perf.maxDrawdownPercent <= 5) {
    riskScore += 15;
    strengths.push('Controlled equity drawdown under 5%');
  } else if (perf.maxDrawdownPercent > 12) {
    riskScore -= 20;
    weaknesses.push(`Elevated equity drawdown (${perf.maxDrawdownPercent.toFixed(1)}%)`);
  }
  riskScore = Math.min(100, Math.max(20, riskScore));

  // 2. Discipline Score (Revenge trading absence, planned sessions)
  let disciplineScore = 75;
  const emotionalTrades = closedTrades.filter(t => t.emotion === 'Revenge' || t.emotion === 'FOMO').length;
  const fomoRatio = emotionalTrades / closedTrades.length;
  if (fomoRatio === 0) {
    disciplineScore += 20;
    strengths.push('Complete absence of revenge or impulsive FOMO entries');
  } else if (fomoRatio > 0.2) {
    disciplineScore -= 30;
    weaknesses.push('High proportion of revenge/FOMO executions impacting discipline');
  }
  disciplineScore = Math.min(100, Math.max(20, disciplineScore));

  // 3. Consistency Score (Win rate stability, consistent risk)
  let consistencyScore = 65;
  if (perf.winRate >= 50 && perf.profitFactor >= 1.5) {
    consistencyScore += 25;
    strengths.push('Strong positive edge with Win Rate > 50% and PF > 1.5');
  } else if (perf.profitFactor < 1.0) {
    consistencyScore -= 20;
    weaknesses.push('Inconsistent expectancy with Profit Factor below 1.0');
  }
  consistencyScore = Math.min(100, Math.max(20, consistencyScore));

  // 4. Execution Score (R:R ratio, take profit hits)
  let executionScore = 70;
  if (perf.avgRR >= 1.8) {
    executionScore += 20;
    strengths.push('Favorable risk-to-reward ratio (> 1.8R)');
  } else if (perf.avgRR < 1.0) {
    executionScore -= 20;
    weaknesses.push('Average reward-to-risk ratio is sub-optimal (< 1.0R)');
  }
  executionScore = Math.min(100, Math.max(20, executionScore));

  // 5. Psychology Score (Calm & Focused proportion)
  let psychologyScore = 70;
  const calmTrades = closedTrades.filter(t => t.emotion === 'Calm' || t.emotion === 'Disciplined' || t.emotion === 'Focused').length;
  const calmRatio = calmTrades / closedTrades.length;
  if (calmRatio >= 0.75) {
    psychologyScore += 20;
    strengths.push('Equanimous mindset: 75%+ of entries executed in calm or disciplined states');
  } else if (calmRatio < 0.4) {
    psychologyScore -= 25;
    weaknesses.push('Elevated emotional reactivity during entries');
  }
  psychologyScore = Math.min(100, Math.max(20, psychologyScore));

  // 6. Profitability Score
  let profitabilityScore = 50;
  if (perf.totalPnl > 0 && perf.profitFactor >= 2.0) {
    profitabilityScore = 95;
    strengths.push('Outstanding profitability with Profit Factor above 2.0');
  } else if (perf.totalPnl > 0 && perf.profitFactor >= 1.3) {
    profitabilityScore = 80;
  } else if (perf.totalPnl > 0) {
    profitabilityScore = 65;
  } else {
    profitabilityScore = 35;
    weaknesses.push('Negative cumulative net P&L on current closed sample');
  }

  const overallScore = Math.round(
    (riskScore * 0.25) +
    (disciplineScore * 0.20) +
    (consistencyScore * 0.15) +
    (executionScore * 0.15) +
    (psychologyScore * 0.15) +
    (profitabilityScore * 0.10)
  );

  return {
    overallScore,
    riskManagementScore: Math.round(riskScore),
    disciplineScore: Math.round(disciplineScore),
    consistencyScore: Math.round(consistencyScore),
    executionScore: Math.round(executionScore),
    psychologyScore: Math.round(psychologyScore),
    profitabilityScore: Math.round(profitabilityScore),
    strengths,
    weaknesses,
    isSufficientData: true,
    tradesAnalyzed: closedTrades.length
  };
}

export function calculateTraderRating(trades: Trade[]): TraderRating {
  const score = calculateTraderScore(trades);
  const perf = calculatePerformance(trades);
  if (!score.isSufficientData) {
    return {
      score: 0,
      grade: 'D',
      label: 'Données insuffisantes',
      isSufficientData: false,
      tradesAnalyzed: score.tradesAnalyzed,
      winRate: perf.winRate,
      profitFactor: perf.profitFactor
    };
  }

  const value = score.overallScore;
  const grade = value >= 90 ? 'A+' : value >= 82 ? 'A' : value >= 74 ? 'B+' : value >= 66 ? 'B' : value >= 55 ? 'C' : 'D';
  const label = value >= 90 ? 'Elite' : value >= 82 ? 'Excellent' : value >= 74 ? 'Solide' : value >= 66 ? 'En progression' : value >= 55 ? 'À construire' : 'Données insuffisantes';

  return {
    score: value,
    grade,
    label,
    isSufficientData: true,
    tradesAnalyzed: score.tradesAnalyzed,
    winRate: perf.winRate,
    profitFactor: perf.profitFactor
  };
}

export function groupTradesByDay(trades: Trade[]): Record<string, { date: string; trades: Trade[]; netPnl: number; winCount: number; lossCount: number }> {
  const grouped: Record<string, { date: string; trades: Trade[]; netPnl: number; winCount: number; lossCount: number }> = {};

  trades.forEach(trade => {
    const dayKey = trade.entryDate.split('T')[0];
    if (!grouped[dayKey]) {
      grouped[dayKey] = {
        date: dayKey,
        trades: [],
        netPnl: 0,
        winCount: 0,
        lossCount: 0
      };
    }

    grouped[dayKey].trades.push(trade);
    const pnl = Number(trade.pnl) || 0;
    grouped[dayKey].netPnl += pnl;
    if (pnl > 0) grouped[dayKey].winCount++;
    if (pnl < 0) grouped[dayKey].lossCount++;
  });

  return grouped;
}
