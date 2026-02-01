const mongoose = require("mongoose");

// 1️⃣ Define schema
const placeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true }, // e.g., Food, Movie, Park
  budget: { type: Number, required: true }, // approx cost per person
  openTime: { type: String }, // "09:00"
  closeTime: { type: String }, // "21:00"
  location: { type: String }, // e.g., "Anna Nagar, Chennai"
  description: { type: String }, // optional
  createdAt: { type: Date, default: Date.now }
});

// 2️⃣ Create model
const Place = mongoose.model("Place", placeSchema);

module.exports = Place;
