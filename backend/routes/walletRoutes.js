const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const { protect } = require("../middleware/authMiddleware");

// GET /api/wallets — return current Cash balance, UPI balance, and combined Total balance
router.get("/", protect, async (req, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { userId: req.user.id }
    });
    
    let cashBalance = 0;
    let upiBalance = 0;

    wallets.forEach((wallet) => {
      if (wallet.type === "Cash") cashBalance = wallet.balance;
      if (wallet.type === "UPI") upiBalance = wallet.balance;
    });

    res.json({
      cash: cashBalance,
      upi: upiBalance,
      total: cashBalance + upiBalance,
    });
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({ error: "Server error while fetching wallets" });
  }
});

module.exports = router;
