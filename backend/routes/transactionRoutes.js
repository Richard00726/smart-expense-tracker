const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const { protect } = require("../middleware/authMiddleware");

// Fast in-memory summary and transactions cache with TTL and immediate mutation invalidation
const summaryCache = new Map();
const txCache = new Map();

const getSummaryCacheKey = (userId, startDate, endDate, wallet) => {
  return `${userId}:${startDate || 'all'}:${endDate || 'all'}:${wallet || 'all'}`;
};

const getTxCacheKey = (userId, wallet, category, startDate, endDate) => {
  return `${userId}:${wallet || 'all'}:${category || 'all'}:${startDate || 'all'}:${endDate || 'all'}`;
};

const invalidateSummaryCache = (userId) => {
  if (!userId) return;
  for (const key of summaryCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      summaryCache.delete(key);
    }
  }
  for (const key of txCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      txCache.delete(key);
    }
  }
};

// POST /api/transaction
router.post("/transaction", protect, async (req, res) => {
  const { wallet, type, amount, category, note, date } = req.body;

  if (!wallet || !type || amount === undefined || amount === null) {
    return res.status(400).json({ error: "Wallet, type, and amount are required" });
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }
  if (type === "debit" && !category) {
    return res.status(400).json({ error: "Category is required for debit transactions" });
  }
  if (type !== "credit" && type !== "debit") {
    return res.status(400).json({ error: "Invalid transaction type" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find or create wallet
      let currentWallet = await tx.wallet.findUnique({
        where: { userId_type: { userId: req.user.id, type: wallet } }
      });

      if (!currentWallet) {
        currentWallet = await tx.wallet.create({
          data: { userId: req.user.id, type: wallet, balance: 0 }
        });
      }

      if (type === "debit") {
        if (currentWallet.balance < numAmount) {
          const err = new Error("Insufficient balance for this transaction");
          err.statusCode = 400;
          throw err;
        }
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: {
          balance: type === "credit"
            ? { increment: numAmount }
            : { decrement: numAmount }
        }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: req.user.id,
          wallet,
          type,
          amount: numAmount,
          category: type === "debit" ? category : null,
          note,
          date: date ? new Date(date) : new Date(),
          entryMode: 'manual'
        }
      });

      return { transaction, updatedBalance: updatedWallet.balance };
    });

    // Invalidate cached summaries so analysis updates instantly
    invalidateSummaryCache(req.user.id);

    // Add _id for backwards compatibility
    result.transaction._id = result.transaction.id;

    res.status(201).json({
      message: "Transaction successful",
      transaction: result.transaction,
      updatedBalance: result.updatedBalance,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error processing transaction:", error);
    res.status(500).json({ error: "Server error processing transaction" });
  }
});

// GET /api/transactions
router.get("/transactions", protect, async (req, res) => {
  try {
    const { wallet, category, startDate, endDate } = req.query;
    const cacheKey = getTxCacheKey(req.user.id, wallet, category, startDate, endDate);
    const cached = txCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 45000)) {
      return res.json(cached.data);
    }
    
    const filter = { userId: req.user.id };
    if (wallet) filter.wallet = wallet;
    if (category) filter.category = category;
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.gte = new Date(startDate);
      if (endDate) filter.date.lte = new Date(endDate);
    }

    const transactions = await prisma.transaction.findMany({
      where: filter,
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Map id to _id for frontend compatibility
    const mappedTransactions = transactions.map(t => ({ ...t, _id: t.id }));
    txCache.set(cacheKey, { data: mappedTransactions, timestamp: Date.now() });
    res.json(mappedTransactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Server error fetching transactions" });
  }
});

// GET /api/summary
router.get("/summary", protect, async (req, res) => {
  try {
    const { startDate, endDate, wallet } = req.query;
    const cacheKey = getSummaryCacheKey(req.user.id, startDate, endDate, wallet);
    const cached = summaryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 120000)) {
      return res.json(cached.data);
    }

    const filter = { userId: req.user.id };
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.gte = new Date(startDate);
      if (endDate) filter.date.lte = new Date(endDate);
    }

    if (wallet && wallet !== 'all') {
      filter.wallet = wallet;
    }

    const start = startDate ? new Date(startDate) : new Date('1970-01-01');

    // Concurrently fetch allFilteredTransactions, prior UPI balance, prior Cash sums, and UPI wallet in ONE roundtrip
    const [allFilteredTransactions, lastUpiBefore, cashPriorCredits, cashPriorDebits, upiWallet] = await Promise.all([
      prisma.transaction.findMany({
        where: filter,
        select: {
          id: true,
          wallet: true,
          type: true,
          amount: true,
          category: true,
          date: true,
          createdAt: true,
          balance: true
        }
      }),
      startDate ? prisma.transaction.findFirst({
        where: {
          userId: req.user.id,
          wallet: 'UPI',
          date: { lt: start }
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { balance: true }
      }) : Promise.resolve(null),
      startDate ? prisma.transaction.aggregate({
        where: { userId: req.user.id, wallet: 'Cash', type: 'credit', date: { lt: start } },
        _sum: { amount: true }
      }) : Promise.resolve({ _sum: { amount: 0 } }),
      startDate ? prisma.transaction.aggregate({
        where: { userId: req.user.id, wallet: 'Cash', type: 'debit', date: { lt: start } },
        _sum: { amount: true }
      }) : Promise.resolve({ _sum: { amount: 0 } }),
      prisma.wallet.findUnique({
        where: { userId_type: { userId: req.user.id, type: 'UPI' } },
        select: { balance: true }
      })
    ]);

    const walletSpendMap = {};
    const walletIncomeMap = {};
    const categorySpendMap = {};
    const dailyMap = {};
    const monthlyMap = {};

    let upiPeriodIn = 0;
    let upiPeriodOut = 0;
    let cashPeriodIn = 0;
    let cashPeriodOut = 0;

    allFilteredTransactions.forEach(t => {
      // Format using Asia/Kolkata timezone so dates match Indian banking and user local time on UTC cloud hosts
      const istDateStr = new Date(t.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const dayKey = istDateStr;
      const monthKey = istDateStr.slice(0, 7);

      const isCredit = t.type === 'credit';
      if (t.wallet === 'UPI') {
        if (isCredit) upiPeriodIn += t.amount;
        else upiPeriodOut += t.amount;
      } else if (t.wallet === 'Cash') {
        if (isCredit) cashPeriodIn += t.amount;
        else cashPeriodOut += t.amount;
      }

      if (t.type === 'debit') {
        walletSpendMap[t.wallet] = (walletSpendMap[t.wallet] || 0) + t.amount;
        if (t.category) {
          categorySpendMap[t.category] = (categorySpendMap[t.category] || 0) + t.amount;
        }
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + t.amount;
      } else if (isCredit) {
        walletIncomeMap[t.wallet] = (walletIncomeMap[t.wallet] || 0) + t.amount;
      }

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          income: 0,
          spend: 0,
          cashIncome: 0,
          cashSpend: 0,
          upiIncome: 0,
          upiSpend: 0
        };
      }
      if (isCredit) {
        monthlyMap[monthKey].income += t.amount;
        if (t.wallet === 'Cash') monthlyMap[monthKey].cashIncome += t.amount;
        else if (t.wallet === 'UPI') monthlyMap[monthKey].upiIncome += t.amount;
      } else {
        monthlyMap[monthKey].spend += t.amount;
        if (t.wallet === 'Cash') monthlyMap[monthKey].cashSpend += t.amount;
        else if (t.wallet === 'UPI') monthlyMap[monthKey].upiSpend += t.amount;
      }
    });

    const formattedWalletSpending = Object.keys(walletSpendMap).map(w => ({ _id: w, total: walletSpendMap[w] }));
    const formattedWalletIncome = Object.keys(walletIncomeMap).map(w => ({ _id: w, total: walletIncomeMap[w] }));
    const formattedCategorySpending = Object.keys(categorySpendMap)
      .map(c => ({ _id: c, total: categorySpendMap[c] }))
      .sort((a, b) => b.total - a.total);

    const formattedDailySpending = Object.keys(dailyMap).sort().map(key => ({ _id: key, total: dailyMap[key] }));
    const formattedMonthlyFlow = Object.keys(monthlyMap).sort().map(key => ({ 
      _id: key, 
      income: monthlyMap[key].income, 
      spend: monthlyMap[key].spend,
      cashIncome: monthlyMap[key].cashIncome || 0,
      cashSpend: monthlyMap[key].cashSpend || 0,
      upiIncome: monthlyMap[key].upiIncome || 0,
      upiSpend: monthlyMap[key].upiSpend || 0
    }));

    // Dynamic ledger opening balance
    let upiOpening = 0;
    if (lastUpiBefore && lastUpiBefore.balance !== null) {
      upiOpening = Number(lastUpiBefore.balance);
    } else {
      // Find first UPI transaction in period directly from in-memory array (0 extra DB queries!)
      const upiInPeriod = allFilteredTransactions
        .filter(t => t.wallet === 'UPI')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const firstUpiInPeriod = upiInPeriod[0];
      if (firstUpiInPeriod && firstUpiInPeriod.balance !== null) {
        if (firstUpiInPeriod.type === 'credit') {
          upiOpening = Number(firstUpiInPeriod.balance) - Number(firstUpiInPeriod.amount);
        } else {
          upiOpening = Number(firstUpiInPeriod.balance) + Number(firstUpiInPeriod.amount);
        }
      } else {
        upiOpening = upiWallet ? Number(upiWallet.balance) : 0;
      }
    }

    const cashOpening = Number((cashPriorCredits._sum?.amount || 0) - (cashPriorDebits._sum?.amount || 0));
    const upiClosing = upiOpening + upiPeriodIn - upiPeriodOut;
    const cashClosing = cashOpening + cashPeriodIn - cashPeriodOut;

    const flowLedger = {
      upi: {
        opening: upiOpening,
        inflow: upiPeriodIn,
        outflow: upiPeriodOut,
        closing: upiClosing
      },
      cash: {
        opening: cashOpening,
        inflow: cashPeriodIn,
        outflow: cashPeriodOut,
        closing: cashClosing
      },
      combined: {
        opening: upiOpening + cashOpening,
        inflow: upiPeriodIn + cashPeriodIn,
        outflow: upiPeriodOut + cashPeriodOut,
        closing: upiClosing + cashClosing
      }
    };

    const responseData = {
      walletSpending: formattedWalletSpending,
      walletIncome: formattedWalletIncome,
      categorySpending: formattedCategorySpending,
      dailySpending: formattedDailySpending,
      monthlyFlow: formattedMonthlyFlow,
      flowLedger
    };

    summaryCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    res.json(responseData);

  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Server error fetching summary" });
  }
});

// DELETE /api/transaction/:id
router.delete("/transaction/:id", protect, async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: { id: req.params.id, userId: req.user.id }
      });
      if (!transaction) {
        const err = new Error("Transaction not found");
        err.statusCode = 404;
        throw err;
      }

      // Delete the transaction first within this atomic block
      await tx.transaction.delete({
        where: { id: transaction.id }
      });

      // Rollback the wallet balance
      if (transaction.type === "credit") {
        await tx.wallet.update({
          where: { userId_type: { userId: req.user.id, type: transaction.wallet } },
          data: { balance: { decrement: transaction.amount } }
        });
      } else if (transaction.type === "debit") {
        await tx.wallet.update({
          where: { userId_type: { userId: req.user.id, type: transaction.wallet } },
          data: { balance: { increment: transaction.amount } }
        });
      }
    });

    invalidateSummaryCache(req.user.id);

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Transaction already deleted" });
    }
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Server error deleting transaction" });
  }
});

// PUT /api/transaction/:id
router.put("/transaction/:id", protect, async (req, res) => {
  const { wallet, type, amount, category, note, date } = req.body;

  if (!wallet || !type || amount === undefined || amount === null) {
    return res.status(400).json({ error: "Wallet, type, and amount are required" });
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }
  if (type === "debit" && !category) {
    return res.status(400).json({ error: "Category is required for debit transactions" });
  }
  if (type !== "credit" && type !== "debit") {
    return res.status(400).json({ error: "Invalid transaction type" });
  }

  try {
    const updatedTransaction = await prisma.$transaction(async (tx) => {
      const oldTransaction = await tx.transaction.findFirst({
        where: { id: req.params.id, userId: req.user.id }
      });
      if (!oldTransaction) {
        const err = new Error("Transaction not found");
        err.statusCode = 404;
        throw err;
      }

      // Rollback old transaction on old wallet
      if (oldTransaction.type === "credit") {
        await tx.wallet.update({
          where: { userId_type: { userId: req.user.id, type: oldTransaction.wallet } },
          data: { balance: { decrement: oldTransaction.amount } }
        });
      } else if (oldTransaction.type === "debit") {
        await tx.wallet.update({
          where: { userId_type: { userId: req.user.id, type: oldTransaction.wallet } },
          data: { balance: { increment: oldTransaction.amount } }
        });
      }

      // Apply new transaction on target wallet
      let targetWallet = await tx.wallet.findUnique({
        where: { userId_type: { userId: req.user.id, type: wallet } }
      });
      if (!targetWallet) {
        targetWallet = await tx.wallet.create({
          data: { userId: req.user.id, type: wallet, balance: 0 }
        });
      }

      if (type === "debit" && targetWallet.balance < numAmount) {
        const err = new Error("Insufficient balance for this update");
        err.statusCode = 400;
        throw err;
      }

      await tx.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: {
          balance: type === "credit"
            ? { increment: numAmount }
            : { decrement: numAmount }
        }
      });

      const updated = await tx.transaction.update({
        where: { id: req.params.id },
        data: {
          wallet,
          type,
          amount: numAmount,
          category: type === "debit" ? category : null,
          note,
          date: date ? new Date(date) : oldTransaction.date,
        }
      });

      return updated;
    });

    updatedTransaction._id = updatedTransaction.id;

    invalidateSummaryCache(req.user.id);

    res.json({
      message: "Transaction updated successfully",
      transaction: updatedTransaction,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Server error updating transaction" });
  }
});

// POST /api/transaction/auto
router.post("/transaction/auto", protect, async (req, res) => {
  const { type, amount, bank, counterparty, counterpartyType, refNo, accountNo, balance, date, txnDate } = req.body;

  if (!type || amount === undefined || amount === null || !bank) {
    return res.status(400).json({ error: "Type, amount, and bank are required" });
  }
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Prevent duplicate transactions if refNo exists
      if (refNo) {
        const existingTxn = await tx.transaction.findFirst({
          where: { userId: req.user.id, refNo }
        });
        if (existingTxn) {
          existingTxn._id = existingTxn.id;
          return { alreadyExists: true, transaction: existingTxn };
        }
      }

      // 2. Default wallet for auto-captured is UPI
      const wallet = "UPI";

      // 3. Ensure wallet exists
      let currentWallet = await tx.wallet.findUnique({
        where: { userId_type: { userId: req.user.id, type: wallet } }
      });
      if (!currentWallet) {
        currentWallet = await tx.wallet.create({
          data: { userId: req.user.id, type: wallet, balance: 0 }
        });
      }

      // 4. Update the Wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: {
          balance: type === "credit"
            ? { increment: numAmount }
            : { decrement: numAmount }
        }
      });

      // 5. Save the auto-captured transaction
      const transaction = await tx.transaction.create({
        data: {
          userId: req.user.id,
          wallet,
          type,
          amount: numAmount,
          category: type === "debit" ? "Uncategorized" : null,
          note: `Auto-captured from ${bank}`,
          bank,
          counterparty,
          counterpartyType,
          refNo,
          accountNo,
          balance,
          entryMode: "auto",
          txnDate: txnDate ? new Date(txnDate) : null,
          date: date ? new Date(date) : new Date(),
        }
      });

      transaction._id = transaction.id;

      await tx.user.update({
        where: { id: req.user.id },
        data: { lastBankSyncAt: new Date() }
      });

      return { transaction, updatedBalance: updatedWallet.balance };
    });

    invalidateSummaryCache(req.user.id);

    if (result.alreadyExists) {
      return res.status(200).json({ message: "Transaction already recorded", transaction: result.transaction });
    }

    res.status(201).json({
      message: "Auto-captured transaction recorded",
      transaction: result.transaction,
      updatedBalance: result.updatedBalance,
    });
  } catch (error) {
    console.error("Error processing auto-transaction:", error);
    res.status(500).json({ error: "Server error processing auto-transaction" });
  }
});

module.exports = router;
module.exports.invalidateSummaryCache = invalidateSummaryCache;
