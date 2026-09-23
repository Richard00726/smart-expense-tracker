const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { protect } = require("../middleware/authMiddleware");

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "default_secret", {
    expiresIn: "30d",
  });
};

// @desc    Send OTP for registration
// @route   POST /api/auth/send-otp
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Please provide an email" });

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) return res.status(400).json({ error: "User already exists with this email" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.oTP.deleteMany({ where: { email } });
    await prisma.oTP.create({ data: { email, code } });

    const mailOptions = {
      from: `"Cash & UPI Tracker" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #4f46e5; text-align: center;">Cash & UPI Tracker</h2>
          <p style="font-size: 16px; color: #334155;">Hello,</p>
          <p style="font-size: 16px; color: #334155;">You are almost there! Here is your 6-digit verification code to create your account. This code will expire in 5 minutes.</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #64748b; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Verification code sent to your email!" });
  } catch (error) {
    console.error("OTP generation error:", error);
    res.status(500).json({ error: "Failed to generate OTP" });
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, otp } = req.body;

    if (!username || !email || !password || !otp) {
      return res.status(400).json({ error: "Please add all fields including OTP" });
    }

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) return res.status(400).json({ error: "User already exists" });

    const validOtp = await prisma.oTP.findFirst({ where: { email, code: otp } });
    
    // Check if OTP exists and is within 5 minutes
    if (!validOtp || new Date() - validOtp.createdAt > 5 * 60 * 1000) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    if (user) {
      await prisma.oTP.delete({ where: { id: validOtp.id } });
      await prisma.wallet.createMany({
        data: [
          { userId: user.id, type: "Cash", balance: 0 },
          { userId: user.id, type: "UPI", balance: 0 },
        ]
      });

      res.status(201).json({
        _id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        profileImage: user.profileImage,
        monthlyLimit: user.monthlyLimit,
        token: generateToken(user.id),
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: "Please add all fields" });

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        profileImage: user.profileImage,
        dailyLimit: user.dailyLimit,
        weeklyLimit: user.weeklyLimit,
        monthlyLimit: user.monthlyLimit,
        yearlyLimit: user.yearlyLimit,
        excludedCategories: user.excludedCategories,
        token: generateToken(user.id),
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// @desc    Get user data
// @route   GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        currency: true,
        profileImage: true,
        dailyLimit: true,
        weeklyLimit: true,
        monthlyLimit: true,
        yearlyLimit: true,
        excludedCategories: true
      }
    });
    // Add _id for backwards compatibility with MERN frontend code (if it relies on _id)
    if (user) {
      user._id = user.id;
    }
    res.status(200).json(user);
  } catch(error) {
    res.status(500).json({ error: "Server error fetching user" });
  }
});

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Please provide an email" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found with this email" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.oTP.deleteMany({ where: { email } });
    await prisma.oTP.create({ data: { email, code } });

    const mailOptions = {
      from: `"Cash & UPI Tracker" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #4f46e5; text-align: center;">Cash & UPI Tracker</h2>
          <p style="font-size: 16px; color: #334155;">Hello,</p>
          <p style="font-size: 16px; color: #334155;">You requested a password reset. Here is your 6-digit verification code. This code will expire in 5 minutes.</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #64748b; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Password reset code sent to your email!" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to send reset code" });
  }
});

// @desc    Reset Password
// @route   POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: "Please provide all fields" });

    const validOtp = await prisma.oTP.findFirst({ where: { email, code: otp } });
    if (!validOtp || new Date() - validOtp.createdAt > 5 * 60 * 1000) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    await prisma.oTP.delete({ where: { id: validOtp.id } });

    res.status(200).json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
router.put("/profile", protect, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updateData = {};
    if (req.body.username) updateData.username = req.body.username;
    if (req.body.currency) updateData.currency = req.body.currency;
    if (req.body.profileImage !== undefined) updateData.profileImage = req.body.profileImage;
    if (req.body.dailyLimit !== undefined) updateData.dailyLimit = Number(req.body.dailyLimit);
    if (req.body.weeklyLimit !== undefined) updateData.weeklyLimit = Number(req.body.weeklyLimit);
    if (req.body.monthlyLimit !== undefined) updateData.monthlyLimit = Number(req.body.monthlyLimit);
    if (req.body.yearlyLimit !== undefined) updateData.yearlyLimit = Number(req.body.yearlyLimit);
    if (req.body.excludedCategories !== undefined) updateData.excludedCategories = req.body.excludedCategories;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    res.json({
      _id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      currency: updatedUser.currency,
      profileImage: updatedUser.profileImage,
      dailyLimit: updatedUser.dailyLimit,
      weeklyLimit: updatedUser.weeklyLimit,
      monthlyLimit: updatedUser.monthlyLimit,
      yearlyLimit: updatedUser.yearlyLimit,
      excludedCategories: updatedUser.excludedCategories,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// @desc    Change Password
// @route   PUT /api/auth/change-password
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Please provide both current and new passwords" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// @desc    Delete Account
// @route   DELETE /api/auth/account
router.delete("/account", protect, async (req, res) => {
  try {
    // Prisma Cascade handles Transaction and Wallet deletion
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: "Account and all data deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

module.exports = router;
