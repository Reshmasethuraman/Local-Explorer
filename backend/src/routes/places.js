const express = require("express");
const router = express.Router();
const Place = require("../models/Place");

// POST: Add a new place
router.post("/add", async (req, res) => {
  try {
    const { name, category, budget, openTime, closeTime, location, description } = req.body;

    // create new place
    const newPlace = new Place({
      name,
      category,
      budget,
      openTime,
      closeTime,
      location,
      description
    });

    // save to DB
    const savedPlace = await newPlace.save();

    res.status(201).json(savedPlace);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

// GET: Fetch all places
router.get("/", async (req, res) => {
  try {
    const places = await Place.find(); // get all places from DB
    res.status(200).json(places);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
