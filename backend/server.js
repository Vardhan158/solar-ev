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

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  resetToken: String,
  resetTokenExpiry: Date,
}, { timestamps: true });
const User = mongoose.model("User", userSchema);

const chargingSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  energyUsed: { type: Number, required: true, min: 0 },
  amountCharged: { type: Number, required: true, min: 0 },
  isPaid: { type: Boolean, default: false },
}, { timestamps: true });
const ChargingRecord = mongoose.model("ChargingRecord", chargingSchema);

// Email sender helper
async function sendResetEmail(user, resetToken) {
  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${resetToken}`;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    to: user.email,
    from: process.env.EMAIL_USER,
    subject: "Password Reset Request",
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password. Expires in 1 hour.</p>`,
  });
}

// Routes

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    if (await User.findOne({ email }))
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    res.json({ message: "Registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    if (!(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Forgot password - send reset email
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    await sendResetEmail(user, resetToken);
    res.json({ message: "Reset email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Reset password
app.post("/api/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

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
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add Charging Record
app.post("/api/charging", async (req, res) => {
  try {
    const { vehicleId, startTime, endTime, energyUsed, amountCharged, isPaid } = req.body;
    if (!vehicleId || !startTime || !endTime || energyUsed == null || amountCharged == null)
      return res.status(400).json({ error: "All fields required" });

    const record = new ChargingRecord({
      vehicleId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      energyUsed,
      amountCharged,
      isPaid: Boolean(isPaid),
    });

    await record.save();
    res.json({ message: "Record added", record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all charging records
app.get("/api/charging-records", async (req, res) => {
  try {
    const records = await ChargingRecord.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update payment status to paid
app.put("/api/charging/:id/pay", async (req, res) => {
  try {
    const record = await ChargingRecord.findByIdAndUpdate(req.params.id, { isPaid: true }, { new: true });
    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json({ message: "Payment updated", record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create Razorpay order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, chargingRecordId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!chargingRecordId) return res.status(400).json({ error: "chargingRecordId required" });

    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
      notes: { chargingRecordId },
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create order" });
  }
});

// Verify Razorpay payment and mark charging record paid
app.post("/api/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, chargingRecordId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !chargingRecordId) {
      return res.status(400).json({ error: "Missing payment data" });
    }

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature)
      return res.status(400).json({ error: "Invalid signature" });

    const record = await ChargingRecord.findByIdAndUpdate(chargingRecordId, { isPaid: true }, { new: true });
    if (!record) return res.status(404).json({ error: "Charging record not found" });

    res.json({ message: "Payment verified and record updated", record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
