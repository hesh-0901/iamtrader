import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateRiskAmount,
  calculateRiskPercent,
  calculateRR
} from "./risk-engine.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "IAM Trader Backend" });
});

app.post("/api/trades/calculate", (req, res) => {
  try {
    const {
      direction,
      entry,
      stopLoss,
      takeProfit,
      quantity,
      contractMultiplier = 1,
      accountBalance
    } = req.body;

    const normalizedDirection = String(direction || "").toUpperCase();
    if (!["BUY", "SELL"].includes(normalizedDirection)) {
      return res.status(400).json({ error: "Direction must be BUY or SELL." });
    }

    const riskAmount = calculateRiskAmount({ entry, stopLoss, quantity, contractMultiplier });
    const riskPercent = calculateRiskPercent({ riskAmount, accountBalance });
    const rr = calculateRR({ entry, stopLoss, takeProfit });

    res.json({ riskAmount, riskPercent, rr });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`IAM Trader backend running on port ${PORT}`);
});
