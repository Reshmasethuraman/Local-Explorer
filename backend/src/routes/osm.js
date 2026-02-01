const express = require("express");
const axios = require("axios");

const router = express.Router();

// Map your app categories to OSM tags
function getOverpassQuery(lat, lng, category) {
  const radius = 2000; // 2km
  const around = `around:${radius},${lat},${lng}`;
  
  if (category === "Fun") {
  return `
    [out:json];
    (
      node["leisure"="amusement_arcade"](${around});
      way["leisure"="amusement_arcade"](${around});
      relation["leisure"="amusement_arcade"](${around});

      node["amenity"="cinema"](${around});
      way["amenity"="cinema"](${around});
      relation["amenity"="cinema"](${around});

      node["leisure"="escape_game"](${around});
      way["leisure"="escape_game"](${around});
      relation["leisure"="escape_game"](${around});

      node["leisure"="sports_centre"](${around});
      way["leisure"="sports_centre"](${around});
      relation["leisure"="sports_centre"](${around});
    );
    out center 25;
  `;
}

  // Default to restaurants/cafes if no category
  if (!category || category === "Food") {
    return `
      [out:json];
      (
        node["amenity"~"restaurant|cafe|fast_food"](${around});
        way["amenity"~"restaurant|cafe|fast_food"](${around});
        relation["amenity"~"restaurant|cafe|fast_food"](${around});
      );
      out center 20;
    `;
  }

  if (category === "Park") {
    return `
      [out:json];
      (
        node["leisure"="park"](${around});
        way["leisure"="park"](${around});
        relation["leisure"="park"](${around});
      );
      out center 20;
    `;
  }

  // Movies are not reliable in OSM; return leisure options
  if (category === "Movie") {
    return `
      [out:json];
      (
        node["amenity"="cinema"](${around});
        way["amenity"="cinema"](${around});
        relation["amenity"="cinema"](${around});
      );
      out center 20;
    `;
  }

  // fallback
  return `
    [out:json];
    (
      node["tourism"="attraction"](${around});
      way["tourism"="attraction"](${around});
      relation["tourism"="attraction"](${around});
    );
    out center 20;
  `;
}

// GET /api/osm/nearby?lat=...&lng=...&category=Food
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, category } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const query = getOverpassQuery(lat, lng, category);

    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      query,
      { headers: { "Content-Type": "text/plain" } }
    );

    // Normalize results into your app-style objects
    const items = (response.data.elements || [])
      .map((el) => {
        const name = el.tags?.name;
        const lat2 = el.lat ?? el.center?.lat;
        const lng2 = el.lon ?? el.center?.lon;

        if (!name || !lat2 || !lng2) return null;

        return {
          name,
          category: category || "Food",
          location: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "Nearby",
          openTime: el.tags?.opening_hours ? el.tags.opening_hours : "",
          budget: 0, // OSM doesn't give budget — you can estimate later
          latitude: lat2,
          longitude: lng2,
          source: "OpenStreetMap"
        };
      })
      .filter(Boolean);

    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "OSM Overpass error" });
  }
});

module.exports = router;
