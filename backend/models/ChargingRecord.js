const mongoose = require('mongoose');

const ChargingRecordSchema = new mongoose.Schema({
  vehicleId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  energyUsed: { type: Number, required: true },
  amountCharged: { type: Number, required: true },
});

module.exports = mongoose.model('ChargingRecord', ChargingRecordSchema);
