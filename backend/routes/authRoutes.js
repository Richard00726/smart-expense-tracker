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
    if (userExists) return res.status(400).json({ error: "This email is already registered. Please log in instead." });

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

// @desc    Mobile QR Login Gateway
// @route   GET /api/auth/mobile-login
router.get("/mobile-login", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Failed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; border-radius: 16px; padding: 28px; text-align: center; max-width: 400px; border: 1px solid #334155; }
          h2 { color: #ef4444; margin-top: 0; }
          p { color: #94a3b8; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚠️ Missing Login Token</h2>
          <p>This QR code appears incomplete. Please scan the QR code again from your dashboard.</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, email: true }
    });

    if (!user) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><body style="background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
          <h2>Account Not Found</h2>
          <p style="color:#94a3b8;">User account no longer exists.</p>
        </body></html>
      `);
    }

    const appDeepLink = `exp+mobile://login?token=${encodeURIComponent(token)}`;

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Expense Tracker - Mobile Login</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #0b0f19 0%, #171e31 100%);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            width: 100%;
            max-width: 440px;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 24px;
            padding: 32px 24px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          }
          .icon-badge {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 36px;
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
          }
          h1 {
            font-size: 22px;
            margin: 0 0 8px;
            font-weight: 700;
          }
          .user-box {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.25);
            border-radius: 14px;
            padding: 12px 16px;
            margin: 18px 0 24px;
          }
          .user-name {
            font-weight: 600;
            font-size: 16px;
            color: #60a5fa;
            margin: 0 0 2px;
          }
          .user-email {
            font-size: 13px;
            color: #94a3b8;
            margin: 0;
          }
          .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 16px;
            border-radius: 14px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            margin-bottom: 12px;
          }
          .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #fff;
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
          }
          .status-text {
            color: #10b981;
            font-size: 14px;
            font-weight: 500;
            margin: 16px 0 20px;
          }
          .divider {
            height: 1px;
            background: #334155;
            margin: 20px 0;
          }
          .footer-note {
            font-size: 12px;
            color: #64748b;
            line-height: 1.5;
            margin: 0;
          }
        </style>
        <script>
          // Automatically trigger deep link to open app
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.location.href = "${appDeepLink}";
            }, 600);
          });
        </script>
      </head>
      <body>
        <div class="container">
          <div class="icon-badge">✓</div>
          <h1>Login Authorized!</h1>
          <p style="color:#94a3b8;font-size:14px;margin:0 0 16px;">Opening Smart Expense Tracker on your mobile phone...</p>
          
          <div class="user-box">
            <div class="user-name">${user.username}</div>
            <div class="user-email">${user.email}</div>
          </div>

          <div class="status-text">⚡ Connecting to your app...</div>

          <a href="${appDeepLink}" class="btn btn-primary" id="openAppBtn">
            🚀 Open Smart Expense Tracker App
          </a>

          <div class="divider"></div>

          <p class="footer-note">
            If the app didn't open automatically, tap the button above.<br>
            Make sure the Smart Expense Tracker app is installed on this device.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("QR mobile login error:", err);
    res.status(401).send(`
      <!DOCTYPE html>
      <html><body style="background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
        <h2>⚠️ Session Expired or Invalid</h2>
        <p style="color:#94a3b8;">Please refresh the setup guide on your web browser and scan the new QR code.</p>
      </body></html>
    `);
  }
});

module.exports = router;

