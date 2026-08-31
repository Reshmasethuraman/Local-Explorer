const axios = require("axios");

const API_KEY = (process.env.GOOGLE_PLACES_API_KEY || "").trim();
const BASE_URL = "https://places.googleapis.com/v1";

if (!API_KEY) console.error("❌ GOOGLE_PLACES_API_KEY not set in Render environment");

const STRICT_TYPES = {
  Food: ["restaurant", "cafe", "bakery", "fast_food_restaurant", "meal_takeaway", "food_court", "ice_cream_shop", "sandwich_shop", "pizza_restaurant", "indian_restaurant"],
  Movie: ["movie_theater"],
  Shopping: ["shopping_mall", "department_store", "clothing_store", "shoe_store", "electronics_store", "book_store", "jewelry_store", "market", "gift_shop"],
  Beach: ["beach"],
  Park: ["park", "national_park", "botanical_garden", "dog_park", "hiking_area", "sports_complex", "playground"],
  Pilgrimage: ["hindu_temple", "mosque", "church", "synagogue", "place_of_worship", "shrine", "monastery"],
  Fun: ["amusement_park", "bowling_alley", "night_club", "comedy_club", "trampoline_park", "mini_golf_course", "go_kart_track", "water_park", "zoo", "aquarium"],
  History: ["museum", "art_gallery", "historical_landmark", "cultural_center", "monument", "ruins"],
};

const BUDGETS = {
  Food: { 0: 100, 1: 200, 2: 500, 3: 900, 4: 1500, _: 400 },
  Movie: { 0: 150, 1: 200, 2: 300, 3: 500, 4: 800, _: 300 },
  Shopping: { _: 600 },
  Beach: { _: 50 },
  Park: { 0: 0, 1: 50, 2: 100, 3: 200, 4: 500, _: 80 },
  Pilgrimage: { _: 100 },
  Fun: { 0: 200, 1: 350, 2: 600, 3: 1000, 4: 2000, _: 500 },
  History: { 0: 50, 1: 100, 2: 200, 3: 400, 4: 800, _: 150 },
};

function budget(priceLevel, category) {
  const m = BUDGETS[category] || BUDGETS.Food;
  if (priceLevel && priceLevel !== "PRICE_LEVEL_UNSPECIFIED") {
    const x = String(priceLevel).match(/PRICE_LEVEL_(\d)/);
    if (x) {
      const v = m[parseInt(x[1], 10)];
      if (v !== undefined) return v;
    }
  }
  return m._ ?? 400;
}

function shortAddress(addr) {
  if (!addr) return "Nearby";
  const p = addr.split(",");
  return p.length > 2 ? p[p.length - 3]?.trim() || p[0] : p[0] || "Nearby";
}

function photos(list) {
  if (!list?.length) return [];
  return list.slice(0, 5).map(ph => ({
    reference: ph.name,
    url: `https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=800&key=${encodeURIComponent(API_KEY)}`,
  }));
}

function openingHours(h) {
  if (!h?.weekdayDescriptions) return null;
  return h.weekdayDescriptions.map(d => {
    const [day, hours] = d.split(": ");
    return { day, hours: hours || "N/A" };
  });
}

async function searchNearbyPlaces({ lat, lng, category, radius = 3000 }) {
  if (!API_KEY) throw new Error("Google Places API key not configured");

  const types = STRICT_TYPES[category];
  if (!types) throw new Error(`Unknown category: ${category}`);

  const body = {
    includedTypes: types,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: Number(lat), longitude: Number(lng) },
        radius: Math.min(Number(radius), 50000),
      },
    },
    rankPreference: "POPULARITY",
  };

  console.log(`🔍 [${category}] r=${body.locationRestriction.circle.radius} types=${body.includedTypes.slice(0, 3).join(",")}`);

  try {
    const r = await axios.post(`${BASE_URL}/places:searchNearby`, body, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.websiteUri,places.googleMapsUri,places.photos",
      },
      timeout: 15000,
    });

    const places = r.data.places || [];
    console.log(`✅ [${category}] ${places.length} results`);

    return places.map(p => ({
      id: p.id,
      name: p.displayName?.text || "Unknown",
      address: p.formattedAddress || "",
      location: shortAddress(p.formattedAddress),
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      rating: p.rating || 0,
      ratingCount: p.userRatingCount || 0,
      priceLevel: p.priceLevel || "PRICE_LEVEL_UNSPECIFIED",
      budget: budget(p.priceLevel, category),
      openNow: p.regularOpeningHours?.openNow ?? null,
      openingHours: openingHours(p.regularOpeningHours),
      website: p.websiteUri,
      googleMapsUrl: p.googleMapsUri,
      photos: photos(p.photos),
      types: p.types || [],
      category,
      source: "Google Places",
    }));
  } catch (error) {
    const status = error.response?.status;
    const googleError = error.response?.data?.error;
    const detail = googleError?.message || error.message;
    console.error("❌ Google Places API error:", status, JSON.stringify(googleError || error.message));
    const apiError = new Error(`Google Places API ${status || "request"}: ${detail}`);
    apiError.status = status || 500;
    apiError.googleError = googleError || null;
    throw apiError;
  }
}

async function getPlaceDetails(placeId) {
  if (!API_KEY) throw new Error("Google Places API key not configured");
  try {
    const r = await axios.get(`${BASE_URL}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,rating,googleMapsUri",
      },
      timeout: 15000,
    });
    return r.data;
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.error?.message || error.message;
    throw new Error(`Google Places API ${status || "request"}: ${detail}`);
  }
}

module.exports = { searchNearbyPlaces, getPlaceDetails };