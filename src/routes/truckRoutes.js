const express = require('express');
const router = express.Router();
const Truck = require('../models/Truck');
const auth = require('../middleware/authMiddleware');

// GET all trucks (protected)
router.get('/', auth, async (req, res) => {
  const trucks = await Truck.find({ owner: req.user.id });
  res.json(trucks);
});

// ADD a truck
router.post('/', auth, async (req, res) => {
  const truck = await Truck.create({ ...req.body, owner: req.user.id });
  res.status(201).json(truck);
});

// UPDATE a truck
router.put('/:id', auth, async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(truck);
});

// DELETE a truck
router.delete('/:id', auth, async (req, res) => {
  await Truck.findByIdAndDelete(req.params.id);
  res.json({ message: 'Truck deleted' });
});

module.exports = router;