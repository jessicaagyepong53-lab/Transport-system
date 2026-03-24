const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema({
  truckNumber: { type: String, required: true },
  driver: { type: String, required: true },
  route: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
  revenue: { type: Number, default: 0 },
  expenses: { type: Number, default: 0 },
  year: { type: Number },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Truck', truckSchema);