require("dotenv").config();
const dns = require("node:dns");
try { dns.setDefaultResultOrder("ipv4first"); } catch {}
const express = require("express");
const cors = require("cors");
const walletRoutes = require("./routes/walletRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const authRoutes = require("./routes/authRoutes");
const bankSyncRoutes = require("./routes/bankSyncRoutes");
const systemRoutes = require("./routes/systemRoutes");

const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint for cloud liveness monitors
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  res.status(200).send("Cash & UPI Tracker API is running 🚀");
});

// Public Privacy Policy endpoint for Google Cloud OAuth compliance
app.get(["/privacy", "/privacy.html"], (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Cash & UPI Tracker</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem 1rem; line-height: 1.6; }
    .box { max-width: 750px; margin: 0 auto; background: #1e293b; padding: 2.5rem; border-radius: 16px; border: 1px solid #334155; }
    h1 { color: #fff; margin-bottom: 0.5rem; }
    h2 { color: #38bdf8; margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.2rem; }
    p, li { color: #cbd5e1; font-size: 0.95rem; margin-bottom: 0.75rem; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Privacy Policy - Cash &amp; UPI Tracker</h1>
    <p>Last updated: November 2026</p>
    <h2>1. Overview</h2>
    <p>Cash &amp; UPI Tracker is a personal expense management application designed to help users track cash and UPI expenditures.</p>
    <h2>2. Google User Data &amp; Gmail Access</h2>
    <p>When you enable automated Bank Sync, our application connects strictly via the <code>https://www.googleapis.com/auth/gmail.readonly</code> scope. This access is used solely to locate and parse bank statement PDF attachments sent by your bank.</p>
    <p>We do not store, read, or analyze any other emails in your inbox, and we will never share, sell, or use your data for advertising or marketing.</p>
    <h2>3. Data Protection &amp; Security</h2>
    <p>All network communications use secure TLS/SSL encryption. Statement passwords and OAuth tokens are stored securely in an isolated, encrypted database.</p>
    <h2>4. Developer Contact</h2>
    <p>For questions or requests regarding your data, contact the developer at <code>lourdurajsebastin350@gmail.com</code>.</p>
  </div>
</body>
</html>`);
});

// Routes
app.use("/api/system", systemRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/bank-sync", bankSyncRoutes);
app.use("/api", transactionRoutes); // Maps to /api/transaction, /api/transactions, /api/summary

const { startBankSyncScheduler } = require("./services/bankSyncWorker");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start background auto-sync worker (checks every 30 minutes)
  startBankSyncScheduler(30);
});
