const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const { protect } = require("../middleware/authMiddleware");

// POST /api/transaction
router.post("/transaction", protect, async (req, res) => {
  const { wallet, type, amount, category, note, date } = req.body;

  if (!wallet || !type || !amount) {
    return res.status(400).json({ error: "Wallet, type, and amount are required" });
  }
  if (type === "debit" && !category) {
    return res.status(400).json({ error: "Category is required for debit transactions" });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  try {
    let updatedWallet;
    
    // We do this inside a Prisma transaction if possible, or sequentially since there are checks.
    // Sequentially is fine since we do one user at a time.
    if (type === "credit") {
      updatedWallet = await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: { balance: { increment: amount } }
      });
    } else if (type === "debit") {
      const currentWallet = await prisma.wallet.findUnique({
        where: { userId_type: { userId: req.user.id, type: wallet } }
      });

      if (!currentWallet || currentWallet.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance for this transaction" });
      }

      updatedWallet = await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: { balance: { decrement: amount } }
      });
    } else {
      return res.status(400).json({ error: "Invalid transaction type" });
    }

    if (!updatedWallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        wallet,
        type,
        amount,
        category: type === "debit" ? category : null,
        note,
        date: date ? new Date(date) : new Date(),
      }
    });

    // Add _id for backwards compatibility
    transaction._id = transaction.id;

    res.status(201).json({
      message: "Transaction successful",
      transaction,
      updatedBalance: updatedWallet.balance,
    });
  } catch (error) {
    console.error("Error processing transaction:", error);
    res.status(500).json({ error: "Server error processing transaction" });
  }
});

// GET /api/transactions
router.get("/transactions", protect, async (req, res) => {
  try {
    const { wallet, category, startDate, endDate } = req.query;
    
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
      orderBy: { date: 'desc' }
    });

    // Map id to _id for frontend compatibility
    const mappedTransactions = transactions.map(t => ({ ...t, _id: t.id }));
    res.json(mappedTransactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Server error fetching transactions" });
  }
});

// GET /api/summary
router.get("/summary", protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { userId: req.user.id };
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.gte = new Date(startDate);
      if (endDate) filter.date.lte = new Date(endDate);
    }

    // 1. UPI vs Cash Totals
    const walletSpending = await prisma.transaction.groupBy({
      by: ['wallet'],
      where: { ...filter, type: 'debit' },
      _sum: { amount: true }
    });
    const formattedWalletSpending = walletSpending.map(s => ({ _id: s.wallet, total: s._sum.amount }));

    const walletIncome = await prisma.transaction.groupBy({
      by: ['wallet'],
      where: { ...filter, type: 'credit' },
      _sum: { amount: true }
    });
    const formattedWalletIncome = walletIncome.map(s => ({ _id: s.wallet, total: s._sum.amount }));

    // 2. Category-wise breakdown (Debit only)
    const categorySpending = await prisma.transaction.groupBy({
      by: ['category'],
      where: { ...filter, type: 'debit' },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    });
    const formattedCategorySpending = categorySpending.filter(c => c.category).map(c => ({ _id: c.category, total: c._sum.amount }));

    // 3. Daily aggregation & 4. Monthly Flow require raw queries because Prisma groupBy lacks robust date formatting functions for Postgres out of the box.
    // Instead, we can fetch all filtered transactions and aggregate in memory, since personal finance data volume for a single user per month is small.
    // This is safer and database agnostic (works on SQLite, Postgres, MySQL identically).
    const allFilteredTransactions = await prisma.transaction.findMany({ where: filter });

    const dailyMap = {};
    const monthlyMap = {};

    allFilteredTransactions.forEach(t => {
      const d = t.date;
      const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

      if (t.type === 'debit') {
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + t.amount;
      }

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { income: 0, spend: 0 };
      }
      if (t.type === 'credit') {
        monthlyMap[monthKey].income += t.amount;
      } else {
        monthlyMap[monthKey].spend += t.amount;
      }
    });

    const formattedDailySpending = Object.keys(dailyMap).sort().map(key => ({ _id: key, total: dailyMap[key] }));
    const formattedMonthlyFlow = Object.keys(monthlyMap).sort().map(key => ({ 
      _id: key, 
      income: monthlyMap[key].income, 
      spend: monthlyMap[key].spend 
    }));

    res.json({
      walletSpending: formattedWalletSpending,
      walletIncome: formattedWalletIncome,
      categorySpending: formattedCategorySpending,
      dailySpending: formattedDailySpending,
      monthlyFlow: formattedMonthlyFlow
    });

  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Server error fetching summary" });
  }
});

// DELETE /api/transaction/:id
router.delete("/transaction/:id", protect, async (req, res) => {
  try {
    const transaction = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Rollback the wallet balance
    if (transaction.type === "credit") {
      await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: transaction.wallet } },
        data: { balance: { decrement: transaction.amount } }
      });
    } else if (transaction.type === "debit") {
      await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: transaction.wallet } },
        data: { balance: { increment: transaction.amount } }
      });
    }

    await prisma.transaction.delete({ where: { id: req.params.id } });

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Server error deleting transaction" });
  }
});

// PUT /api/transaction/:id
router.put("/transaction/:id", protect, async (req, res) => {
  const { wallet, type, amount, category, note, date } = req.body;

  if (!wallet || !type || !amount) {
    return res.status(400).json({ error: "Wallet, type, and amount are required" });
  }
  if (type === "debit" && !category) {
    return res.status(400).json({ error: "Category is required for debit transactions" });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  try {
    const oldTransaction = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!oldTransaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // In a real production app we would use a Prisma $transaction block here.
    // Rollback old transaction
    if (oldTransaction.type === "credit") {
      await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: oldTransaction.wallet } },
        data: { balance: { decrement: oldTransaction.amount } }
      });
    } else if (oldTransaction.type === "debit") {
      await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: oldTransaction.wallet } },
        data: { balance: { increment: oldTransaction.amount } }
      });
    }

    // Apply new transaction
    let updatedWallet;
    if (type === "credit") {
      updatedWallet = await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: { balance: { increment: amount } }
      });
    } else if (type === "debit") {
      const checkWallet = await prisma.wallet.findUnique({
        where: { userId_type: { userId: req.user.id, type: wallet } }
      });
      if (!checkWallet || checkWallet.balance < amount) {
        // Rollback the rollback to keep consistent state if this fails
        if (oldTransaction.type === "credit") {
          await prisma.wallet.update({
            where: { userId_type: { userId: req.user.id, type: oldTransaction.wallet } },
            data: { balance: { increment: oldTransaction.amount } }
          });
        } else if (oldTransaction.type === "debit") {
          await prisma.wallet.update({
            where: { userId_type: { userId: req.user.id, type: oldTransaction.wallet } },
            data: { balance: { decrement: oldTransaction.amount } }
          });
        }
        return res.status(400).json({ error: "Insufficient balance for this update" });
      }

      updatedWallet = await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: { balance: { decrement: amount } }
      });
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        wallet,
        type,
        amount,
        category: type === "debit" ? category : null,
        note,
        date: date ? new Date(date) : oldTransaction.date,
      }
    });

    updatedTransaction._id = updatedTransaction.id;

    res.json({
      message: "Transaction updated successfully",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Server error updating transaction" });
  }
});

// POST /api/transaction/auto
router.post("/transaction/auto", protect, async (req, res) => {
  const { type, amount, bank, counterparty, counterpartyType, refNo, accountNo, balance, date, txnDate } = req.body;

  if (!type || !amount || !bank) {
    return res.status(400).json({ error: "Type, amount, and bank are required" });
  }

  try {
    // 1. Prevent duplicate transactions if refNo exists
    if (refNo) {
      const existingTxn = await prisma.transaction.findFirst({
        where: { userId: req.user.id, refNo }
      });
      if (existingTxn) {
        return res.status(200).json({ message: "Transaction already recorded", transaction: existingTxn });
      }
    }

    // 2. Default wallet for auto-captured is UPI
    const wallet = "UPI";

    // 3. Update the Wallet balance
    let updatedWallet;
    if (type === "credit") {
      updatedWallet = await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: { balance: { increment: amount } }
      });
    } else if (type === "debit") {
      const currentWallet = await prisma.wallet.findUnique({
        where: { userId_type: { userId: req.user.id, type: wallet } }
      });

      if (!currentWallet) {
        return res.status(404).json({ error: "UPI Wallet not found" });
      }

      // We allow negative balances for auto-captured transactions because
      // the bank has already allowed the transaction, and the user's logged balance
      // might just be out of sync.
      updatedWallet = await prisma.wallet.update({
        where: { userId_type: { userId: req.user.id, type: wallet } },
        data: { balance: { decrement: amount } }
      });
    } else {
      return res.status(400).json({ error: "Invalid transaction type" });
    }

    // 4. Save the auto-captured transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        wallet,
        type,
        amount,
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

    res.status(201).json({
      message: "Auto-captured transaction recorded",
      transaction,
      updatedBalance: updatedWallet.balance,
    });
  } catch (error) {
    console.error("Error processing auto-transaction:", error);
    res.status(500).json({ error: "Server error processing auto-transaction" });
  }
});

module.exports = router;
