import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const CATEGORY_TO_TYPE = {
  Food: "restaurant",
  Fun: "tourist_attraction",
  Park: "park",
  Movie: "movie_theater",
  Mall: "shopping_mall",
  Beach: "tourist_attraction",
  Pilgrimage: "hindu_temple",
  Activities: "tourist_attraction",
};

// helper sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, category = "Food", radius = 2000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: "lat/lng required" });
    }

    const type = CATEGORY_TO_TYPE[category] || "restaurant";

    let allResults = [];
    let nextPageToken = null;

    // Fetch up to 3 pages (max allowed)
    for (let page = 0; page < 3; page++) {
      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${GOOGLE_KEY}`;

      if (nextPageToken) {
        // token needs delay
        await sleep(2000);
        url += `&pagetoken=${nextPageToken}`;
      } else {
        url += `&location=${lat},${lng}&radius=${radius}&type=${type}`;
      }

      const r = await fetch(url);
      const data = await r.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        return res.json({
          success: false,
          message: `Google Places error: ${data.status}`,
          details: data.error_message || null,
        });
      }

      allResults.push(...(data.results || []));

      if (data.next_page_token) {
        nextPageToken = data.next_page_token;
      } else {
        break;
      }

      if (data.status === "ZERO_RESULTS") break;
    }

    // convert to your frontend format
    const places = allResults.map((p) => ({
      id: p.place_id,
      name: p.name,
      location: p.vicinity,
      rating: p.rating,
      ratingCount: p.user_ratings_total,
      openNow: p.opening_hours?.open_now || false,
      price_level: p.price_level ?? null,
      budget: estimateBudget(p.price_level),
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
      photos: p.photos?.length
        ? [
            {
              url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${GOOGLE_KEY}`,
            },
          ]
        : [],
    }));

    res.json({
      success: true,
      count: places.length,
      places,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

function estimateBudget(priceLevel) {
  // basic MVP estimate
  switch (priceLevel) {
    case 0: return 100;
    case 1: return 200;
    case 2: return 400;
    case 3: return 800;
    case 4: return 1500;
    default: return 350;
  }
}

export default router;
