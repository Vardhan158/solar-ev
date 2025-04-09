const express = require('express');
const ChargingRecord = require('../models/ChargingRecord');
const router = express.Router();

// 🟢 Get all charging records - sorted by most recent
router.get('/charging-records', async (req, res) => {
  try {
    const records = await ChargingRecord.find().sort({ createdAt: -1 }); // Optional: sort by latest
    res.status(200).json(records);
  } catch (err) {
    console.error("Error fetching records:", err);
    res.status(500).json({ error: "Server error, please try again later" });
  }
});

// 🔵 Add a new charging record
router.post('/charging-records', async (req, res) => {
  try {
    const { vehicleId, startTime, endTime, energyUsed, amountCharged } = req.body;

    // Validation
    if (!vehicleId || !startTime || !endTime || !energyUsed || !amountCharged) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newRecord = new ChargingRecord({
      vehicleId,
      startTime,
      endTime,
      energyUsed,
      amountCharged,
    });

    await newRecord.save();
    res.status(201).json({ message: "Charging record added successfully", record: newRecord });
  } catch (err) {
    console.error("Error adding record:", err);
    res.status(500).json({ error: "Server error, please try again later" });
  }
});

module.exports = router;
