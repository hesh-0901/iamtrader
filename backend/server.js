import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "IAM Trader Backend"
    });
});

app.listen(PORT, () => {
    console.log(`IAM Trader backend running on port ${PORT}`);
});
