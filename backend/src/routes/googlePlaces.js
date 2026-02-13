const express = require("express");
const router = express.Router();
const {
  searchNearbyPlaces,
  getPlaceDetails
} = require("../services/googlePlacesService");

/**
 * GET /api/google/nearby?lat=13.0827&lng=80.2707&category=Food&radius=2000
 */
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, category = "Food", radius = 2000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false,
        message: "lat and lng are required" 
      });
    }

    console.log(`🔍 Searching ${category} near ${lat},${lng} (${radius}m)`);

    const places = await searchNearbyPlaces({
      lat,
      lng,
      category,
      radius
    });

    console.log(`✅ Found ${places.length} places`);

    res.json({
      success: true,
      count: places.length,
      category,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius: parseInt(radius),
      places
    });

  } catch (error) {
    console.error("❌ Nearby search error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/google/place/:placeId
 */
router.get("/place/:placeId", async (req, res) => {
  try {
    const { placeId } = req.params;

    console.log(`📍 Getting details for place: ${placeId}`);

    const details = await getPlaceDetails(placeId);

    res.json({
      success: true,
      place: details
    });

  } catch (error) {
    console.error("❌ Place details error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/google/filter-by-budget
 * Filter places by budget and people count
 */
router.post("/filter-by-budget", async (req, res) => {
  try {
    const { places, budgetPerPerson, peopleCount } = req.body;

    if (!places || !budgetPerPerson) {
      return res.status(400).json({
        success: false,
        message: "places and budgetPerPerson are required"
      });
    }

    const filtered = places.filter(place => {
      const totalCost = place.budget * (peopleCount || 1);
      const totalBudget = budgetPerPerson * (peopleCount || 1);
      return totalCost <= totalBudget;
    });

    // Sort by rating
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    res.json({
      success: true,
      original: places.length,
      filtered: filtered.length,
      budgetPerPerson,
      peopleCount,
      places: filtered
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;