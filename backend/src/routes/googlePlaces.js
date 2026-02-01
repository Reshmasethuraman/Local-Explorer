const express = require("express");
const axios = require("axios");

const router = express.Router();

/**
 * GET /api/google/nearby?lat=13.0827&lng=80.2707&type=restaurant&radius=1500
 */
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, type = "restaurant", radius = 1500 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const url = "https://places.googleapis.com/v1/places:searchNearby";

    const body = {
      includedTypes: [type], // e.g. restaurant, park, cafe, movie_theater
      maxResultCount: 15,
      locationRestriction: {
        circle: {
          center: { latitude: Number(lat), longitude: Number(lng) },
          radius: Number(radius),
        },
      },
    };

    const resp = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        // FieldMask is REQUIRED in Places API (New)
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.types",
          "places.rating",
          "places.userRatingCount",
          "places.currentOpeningHours",
          "places.websiteUri",
          "places.googleMapsUri",
        ].join(","),
      },
      timeout: 15000,
    });

    return res.json(resp.data);
  } catch (err) {
    // Show Google error message clearly
    const data = err?.response?.data;
    console.error("Google Places nearby error:", data || err.message);
    return res.status(500).json({
      message: "Google Places API error",
      google: data || null,
    });
  }
});
router.get("/test", async (req, res) => {
  try {
    const axios = require("axios");

    const url =
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=13.0827,80.2707&radius=1500&type=restaurant&key=" +
      process.env.GOOGLE_PLACES_API_KEY;

    const response = await axios.get(url);

    res.json({
      status: response.data.status,
      error_message: response.data.error_message || null,
      results_count: response.data.results ? response.data.results.length : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
router.get("/test", async (req, res) => {
  try {
    const axios = require("axios");

    const url =
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=13.0827,80.2707&radius=1500&type=restaurant&key=" +
      process.env.GOOGLE_PLACES_API_KEY;

    const response = await axios.get(url);

    res.json({
      status: response.data.status,
      error_message: response.data.error_message || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
