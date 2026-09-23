require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Wallet = require("./models/Wallet");
const Transaction = require("./models/Transaction");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/expense_tracker";

const migrateData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for migration");

    // 1. Create a default user
    let user = await User.findOne({ email: "admin@example.com" });
    if (!user) {
      user = await User.create({
        username: "Admin",
        email: "admin@example.com",
        password: "password123",
      });
      console.log("Created default user: admin@example.com / password123");
    }

    // 2. Migrate Wallets
    const walletsToUpdate = await Wallet.find({ user: { $exists: false } });
    if (walletsToUpdate.length > 0) {
      for (let wallet of walletsToUpdate) {
        wallet.user = user._id;
        await wallet.save();
      }
      console.log(`Migrated ${walletsToUpdate.length} wallets to admin user.`);
    }

    // 3. Migrate Transactions
    const txToUpdate = await Transaction.find({ user: { $exists: false } });
    if (txToUpdate.length > 0) {
      for (let tx of txToUpdate) {
        tx.user = user._id;
        await tx.save();
      }
      console.log(`Migrated ${txToUpdate.length} transactions to admin user.`);
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrateData();
