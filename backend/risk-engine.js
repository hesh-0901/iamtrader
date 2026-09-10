const assertFinite = (value, name) => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
};

const assertPositive = (value, name) => {
  assertFinite(value, name);
  if (value <= 0) throw new Error(`${name} must be greater than 0`);
};

export function calculateRiskAmount({ entry, stopLoss, quantity, contractMultiplier = 1 }) {
  assertPositive(quantity, "quantity");
  assertPositive(contractMultiplier, "contractMultiplier");
  assertFinite(entry, "entry");
  assertFinite(stopLoss, "stopLoss");

  const distance = Math.abs(entry - stopLoss);
  if (distance === 0) throw new Error("stopLoss must differ from entry");

  return distance * quantity * contractMultiplier;
}

export function calculateRiskPercent({ riskAmount, accountBalance }) {
  assertPositive(riskAmount, "riskAmount");
  assertPositive(accountBalance, "accountBalance");
  return (riskAmount / accountBalance) * 100;
}

export function calculateRR({ entry, stopLoss, takeProfit }) {
  assertFinite(entry, "entry");
  assertFinite(stopLoss, "stopLoss");
  assertFinite(takeProfit, "takeProfit");

  const riskDistance = Math.abs(entry - stopLoss);
  if (riskDistance === 0) throw new Error("stopLoss must differ from entry");

  return Math.abs(takeProfit - entry) / riskDistance;
}

export function calculatePositionSize({ riskAmount, entry, stopLoss, contractMultiplier = 1 }) {
  assertPositive(riskAmount, "riskAmount");
  assertPositive(contractMultiplier, "contractMultiplier");
  assertFinite(entry, "entry");
  assertFinite(stopLoss, "stopLoss");

  const distance = Math.abs(entry - stopLoss);
  if (distance === 0) throw new Error("stopLoss must differ from entry");

  return riskAmount / (distance * contractMultiplier);
}

export function calculateGrossPnL({ direction, entry, exit, quantity, contractMultiplier = 1 }) {
  assertPositive(quantity, "quantity");
  assertPositive(contractMultiplier, "contractMultiplier");
  assertFinite(entry, "entry");
  assertFinite(exit, "exit");

  const normalizedDirection = String(direction).toUpperCase();
  if (normalizedDirection !== "BUY" && normalizedDirection !== "SELL") {
    throw new Error("direction must be BUY or SELL");
  }

  const priceMove = normalizedDirection === "BUY" ? exit - entry : entry - exit;
  return priceMove * quantity * contractMultiplier;
}

export function calculateNetPnL({ grossPnL, commission = 0, swap = 0, fees = 0 }) {
  assertFinite(grossPnL, "grossPnL");
  assertFinite(commission, "commission");
  assertFinite(swap, "swap");
  assertFinite(fees, "fees");
  return grossPnL - commission - swap - fees;
}

export function calculateRMultiple({ netPnL, initialRisk }) {
  assertFinite(netPnL, "netPnL");
  assertPositive(initialRisk, "initialRisk");
  return netPnL / initialRisk;
}

export function calculateDrawdown({ peakEquity, currentEquity }) {
  assertFinite(peakEquity, "peakEquity");
  assertFinite(currentEquity, "currentEquity");
  return Math.max(0, peakEquity - currentEquity);
}

export function calculateDrawdownPercent({ peakEquity, currentEquity }) {
  assertPositive(peakEquity, "peakEquity");
  return (calculateDrawdown({ peakEquity, currentEquity }) / peakEquity) * 100;
}

export function classifyResult(netPnL, epsilon = 1e-9) {
  assertFinite(netPnL, "netPnL");
  if (netPnL > epsilon) return "WIN";
  if (netPnL < -epsilon) return "LOSS";
  return "BE";
}
