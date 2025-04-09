require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cors());
// ✅ Load Environment Variables
require("dotenv").config();

// ✅ Required Modules
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();

// ✅ Middlewares
app.use(express.json());
app.use(cors());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ✅ User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  resetToken: String,
  resetTokenExpiry: Date,
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

// ✅ Charging Record Schema
const chargingSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  energyUsed: {
    type: Number,
    required: true,
    min: [0, "Energy used cannot be negative"]
  },
  amountCharged: {
    type: Number,
    required: true,
    min: [0, "Amount cannot be negative"]
  }
}, { timestamps: true });

const ChargingRecord = mongoose.model("ChargingRecord", chargingSchema);

// ✅ Register User
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
    console.error("Register Error:", err.message);
    res.status(500).json({ error: "Server error. Try again later." });
  }
});

// ✅ Login User
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
    console.error("Login Error:", err.message);
    res.status(500).json({ error: "Server error. Try again later." });
  }
});

// ✅ Forgot Password - Send Email
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetToken = hashedToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `https://solar-ev-frontend.onrender.com/reset-password/${resetToken}`;

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
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 1 hour.</p>`,
    });

    res.json({ message: "Password reset link sent to email!" });
  } catch (err) {
    console.error("Forgot Password Error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ✅ Reset Password
app.post("/api/reset-password/:token", async (req, res) => {
  try {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ error: "Invalid or expired token" });

    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ✅ Add Charging Record
app.post("/api/charging", async (req, res) => {
  try {
    const { vehicleId, startTime, endTime, energyUsed, amountCharged } = req.body;

    if (!vehicleId || !startTime || !endTime || energyUsed == null || amountCharged == null)
      return res.status(400).json({ error: "All fields are required" });

    const record = new ChargingRecord({
      vehicleId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      energyUsed: Number(energyUsed),
      amountCharged: Number(amountCharged),
    });

    await record.save();
    res.json({ message: "Charging record saved!", record });
  } catch (err) {
    console.error("Charging Error:", err.message);
    res.status(500).json({ error: "Failed to save record" });
  }
});

// ✅ Get Charging Records
app.get("/api/charging-records", async (req, res) => {
  try {
    const records = await ChargingRecord.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).json({ error: "Unable to fetch records" });
  }
});

// ✅ Catch-All 404 Route
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ✅ User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  resetToken: String,
  resetTokenExpiry: Date,
});
const User = mongoose.model("User", userSchema);

// ✅ Charging Record Schema
const chargingSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  energyUsed: { type: Number, required: true },
  amountCharged: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});
const ChargingRecord = mongoose.model("ChargingRecord", chargingSchema);

// ✅ Register Route
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server error. Try again later." });
  }
});

// ✅ Login Route
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

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

// ✅ Forgot Password Route
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
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `https://solar-ev-frontend.onrender.com/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Request",
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 1 hour.</p>`,
    });

    res.json({ message: "Password reset email sent!" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: "Server error. Try again later." });
  }
});

// ✅ Reset Password Route
app.post("/api/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

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
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: "Server error. Try again later." });
  }
});

// ✅ Protected Route (Token Required)
app.get("/api/protected", async (req, res) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    res.json({ message: "Access granted", user });
  } catch (err) {
    console.error("Protected Route Error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
});

// ✅ Charging Data Route
app.post("/api/charging", async (req, res) => {
  try {
    let { vehicleId, startTime, endTime, energyUsed, amountCharged } = req.body;

    if (!vehicleId || !startTime || !endTime || energyUsed == null || amountCharged == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    startTime = new Date(startTime);
    endTime = new Date(endTime);
    energyUsed = Number(energyUsed);
    amountCharged = Number(amountCharged);

    if (isNaN(energyUsed) || isNaN(amountCharged)) {
      return res.status(400).json({ error: "Invalid number values" });
    }

    const newRecord = new ChargingRecord({
      vehicleId,
      startTime,
      endTime,
      energyUsed,
      amountCharged,
    });

    await newRecord.save();
    res.json({ message: "Charging record added successfully!" });
  } catch (err) {
    console.error("Charging Record Error:", err);
    res.status(500).json({ error: "Server error. Could not save record." });
  }
});

// ✅ 404 Route
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
