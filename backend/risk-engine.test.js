import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRiskAmount,
  calculateRiskPercent,
  calculateRR,
  calculatePositionSize,
  calculateGrossPnL,
  calculateNetPnL,
  calculateRMultiple,
  calculateDrawdown,
  calculateDrawdownPercent,
  classifyResult
} from "./risk-engine.js";

test("calculates risk amount", () => {
  assert.equal(calculateRiskAmount({ entry: 100, stopLoss: 95, quantity: 2 }), 10);
});

test("calculates risk percent", () => {
  assert.equal(calculateRiskPercent({ riskAmount: 100, accountBalance: 10000 }), 1);
});

test("calculates planned R:R", () => {
  assert.equal(calculateRR({ entry: 100, stopLoss: 95, takeProfit: 115 }), 3);
});

test("calculates position size from fixed risk", () => {
  assert.equal(calculatePositionSize({ riskAmount: 100, entry: 100, stopLoss: 95 }), 20);
});

test("calculates BUY and SELL gross PnL", () => {
  assert.equal(calculateGrossPnL({ direction: "BUY", entry: 100, exit: 110, quantity: 2 }), 20);
  assert.equal(calculateGrossPnL({ direction: "SELL", entry: 100, exit: 90, quantity: 2 }), 20);
});

test("calculates net PnL after costs", () => {
  assert.equal(calculateNetPnL({ grossPnL: 100, commission: 5, swap: 2, fees: 3 }), 90);
});

test("calculates R multiple", () => {
  assert.equal(calculateRMultiple({ netPnL: 200, initialRisk: 100 }), 2);
});

test("calculates drawdown and drawdown percent", () => {
  assert.equal(calculateDrawdown({ peakEquity: 10000, currentEquity: 9200 }), 800);
  assert.equal(calculateDrawdownPercent({ peakEquity: 10000, currentEquity: 9200 }), 8);
});

test("never returns negative drawdown", () => {
  assert.equal(calculateDrawdown({ peakEquity: 10000, currentEquity: 10500 }), 0);
});

test("classifies WIN, LOSS and BE", () => {
  assert.equal(classifyResult(10), "WIN");
  assert.equal(classifyResult(-10), "LOSS");
  assert.equal(classifyResult(0), "BE");
});

test("rejects invalid risk inputs", () => {
  assert.throws(
    () => calculateRiskAmount({ entry: 100, stopLoss: 100, quantity: 1 }),
    /stopLoss must differ from entry/
  );
  assert.throws(
    () => calculateGrossPnL({ direction: "HOLD", entry: 100, exit: 101, quantity: 1 }),
    /direction must be BUY or SELL/
  );
});
