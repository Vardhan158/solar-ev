require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Razorpay Setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ===== MongoDB Schemas =====

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  resetToken: String,
  resetTokenExpiry: Date,
}, { timestamps: true });

const chargingSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  energyUsed: { type: Number, required: true },
  amountCharged: { type: Number, required: true },
  isPaid: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const ChargingRecord = mongoose.model("ChargingRecord", chargingSchema);

// ===== Helper Function: Send Password Reset Email =====
async function sendResetEmail(user, token) {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${token}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    to: user.email,
    from: process.env.EMAIL_USER,
    subject: "Password Reset",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Token expires in 1 hour.</p>`,
  });
}

// ===== Routes =====

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ email, password: hashedPassword }).save();

    res.status(201).json({ message: "Registration successful" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Forgot Password
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    await sendResetEmail(user, rawToken);
    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Reset Password
app.post("/api/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add Charging Record
app.post("/api/charging", async (req, res) => {
  try {
    const { vehicleId, startTime, endTime, energyUsed, amountCharged, isPaid } = req.body;

    if (!vehicleId || !startTime || !endTime || energyUsed == null || amountCharged == null) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const record = new ChargingRecord({
      vehicleId,
      startTime,
      endTime,
      energyUsed,
      amountCharged,
      isPaid: Boolean(isPaid),
    });

    await record.save();
    res.status(201).json({ message: "Charging record added", record });
  } catch (err) {
    console.error("Add charging error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get All Charging Records
app.get("/api/charging-records", async (req, res) => {
  try {
    const records = await ChargingRecord.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error("Fetch charging records error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Mark Charging Record as Paid
app.put("/api/charging/:id/pay", async (req, res) => {
  try {
    const record = await ChargingRecord.findByIdAndUpdate(
      req.params.id,
      { isPaid: true },
      { new: true }
    );

    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json({ message: "Marked as paid", record });
  } catch (err) {
    console.error("Mark as paid error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create Razorpay Order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, chargingRecordId } = req.body;
    if (!amount || !chargingRecordId) return res.status(400).json({ error: "Amount and chargingRecordId required" });

    const order = await razorpay.orders.create({
      amount: Math.round(amount), // Amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
      notes: { chargingRecordId },
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Verify Razorpay Payment
app.post("/api/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, chargingRecordId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !chargingRecordId) {
      return res.status(400).json({ error: "Missing payment information" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const updatedRecord = await ChargingRecord.findByIdAndUpdate(
      chargingRecordId,
      { isPaid: true },
      { new: true }
    );

    if (!updatedRecord) return res.status(404).json({ error: "Charging record not found" });

    res.json({ success: true, message: "Payment verified", record: updatedRecord });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
});

// ===== Server Start =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
