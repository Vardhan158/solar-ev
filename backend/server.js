// Load Environment Variables
require("dotenv").config();

// Required Modules
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// User Schema & Model
const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    resetToken: String,
    resetTokenExpiry: Date,
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

// Charging Record Schema & Model
const chargingSchema = new mongoose.Schema(
  {
    vehicleId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    energyUsed: {
      type: Number,
      required: true,
      min: [0, "Energy used cannot be negative"],
    },
    amountCharged: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
const ChargingRecord = mongoose.model("ChargingRecord", chargingSchema);

// Helper: Send Reset Email
async function sendResetEmail(user, resetToken) {
  const resetLink = `${process.env.FRONTEND_URL || "https://solar-ev-frontend.onrender.com"}/reset-password/${resetToken}`;

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
    subject: "Password Reset Request",
    html: `
      <p>You requested a password reset.</p>
      <p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 1 hour.</p>
    `,
  });
}

// -------------------- ROUTES -------------------- //

// Register User
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server error. Try again later." });
  }
});

// Login User
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error. Try again later." });
  }
});

// Forgot Password
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetToken = hashedToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    await sendResetEmail(user, resetToken);
    res.json({ message: "Password reset link sent to email!" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Reset Password
app.post("/api/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;
    const token = req.params.token;

    if (!password)
      return res.status(400).json({ error: "Password is required" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Add Charging Record
app.post("/api/charging", async (req, res) => {
  try {
    const { vehicleId, startTime, endTime, energyUsed, amountCharged, isPaid } =
      req.body;

    if (!vehicleId || !startTime || !endTime || energyUsed == null || amountCharged == null)
      return res.status(400).json({ error: "All fields are required" });

    const record = new ChargingRecord({
      vehicleId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      energyUsed: Number(energyUsed),
      amountCharged: Number(amountCharged),
      isPaid: Boolean(isPaid) || false,
    });

    await record.save();
    res.json({ message: "Charging record saved!", record });
  } catch (err) {
    console.error("Charging Error:", err);
    res.status(500).json({ error: "Failed to save record" });
  }
});

// Get All Charging Records
app.get("/api/charging-records", async (req, res) => {
  try {
    const records = await ChargingRecord.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error("Fetch Charging Records Error:", err);
    res.status(500).json({ error: "Unable to fetch records" });
  }
});

// Manually Mark Charging Record as Paid
app.put("/api/charging/:id/pay", async (req, res) => {
  try {
    const record = await ChargingRecord.findByIdAndUpdate(
      req.params.id,
      { isPaid: true },
      { new: true }
    );

    if (!record)
      return res.status(404).json({ error: "Charging record not found" });

    res.json({ message: "Payment status updated", record });
  } catch (err) {
    console.error("Payment Status Update Error:", err);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

// Create Razorpay Order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Amount must be positive" });

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise (cents)
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (err) {
    console.error("Create Razorpay Order Error:", err);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
});

// Verify Razorpay Payment Signature
app.post("/api/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      return res.json({ success: true, message: "Payment verified successfully" });
    } else {
      return res.status(400).json({ success: false, error: "Invalid signature" });
    }
  } catch (err) {
    console.error("Verify Payment Error:", err);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// Automatically Mark Charging Record as Paid (After Payment Verification)
app.put("/api/charging/:id/mark-paid", async (req, res) => {
  try {
    const record = await ChargingRecord.findByIdAndUpdate(
      req.params.id,
      { isPaid: true },
      { new: true }
    );

    if (!record)
      return res.status(404).json({ error: "Charging record not found" });

    res.json({ message: "Charging record marked as paid", record });
  } catch (err) {
    console.error("Mark Charging Paid Error:", err);
    res.status(500).json({ error: "Failed to update charging record" });
  }
});

// Root Route
app.get("/", (req, res) => {
  res.send("Solar EV Backend Running 🚀");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
