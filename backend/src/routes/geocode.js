const express = require("express");
const axios = require("axios");

const router = express.Router();

// GET /api/geocode?q=Anna%20Nagar%20Chennai
router.get("/", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ message: "q is required" });

    const resp = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q, format: "json", limit: 1, addressdetails: 1 },
      headers: { "User-Agent": "LocalExplorer/1.0 (student-project)" },
      timeout: 15000,
    });

    const item = resp.data?.[0];
    if (!item) return res.status(404).json({ message: "Location not found" });

    res.json({
      displayName: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Geocoding error" });
  }
});

module.exports = router;
