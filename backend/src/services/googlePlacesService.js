const axios = require("axios");

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = "https://places.googleapis.com/v1";

// Validate API key on startup
if (!API_KEY) {
  console.error("❌ GOOGLE_PLACES_API_KEY not found in .env");
}

// Category mapping to Google Place Types
const CATEGORY_TO_TYPES = {
  Food: ["restaurant", "cafe", "bakery", "meal_takeaway"],
  Park: ["park", "tourist_attraction"],
  Movie: ["movie_theater"],
  Fun: ["amusement_park", "bowling_alley", "night_club", "casino"],
  Beach: ["beach", "natural_feature"],
  Mall: ["shopping_mall"],
  Pilgrimage: ["hindu_temple", "church", "mosque", "place_of_worship"],
  Hotels: ["lodging", "hotel"],
  Activities: ["tourist_attraction", "amusement_park", "zoo", "aquarium"]
};

// Price level to actual budget (in ₹)
const PRICE_LEVEL_TO_BUDGET = {
  0: 150,   // Free/Very Cheap
  1: 300,   // Inexpensive
  2: 600,   // Moderate
  3: 1200,  // Expensive
  4: 2500   // Very Expensive
};

/**
 * Search nearby places using Google Places API (New)
 */
async function searchNearbyPlaces({ lat, lng, category, radius = 2000 }) {
  try {
    if (!API_KEY) {
      throw new Error("Google Places API key not configured");
    }

    const types = CATEGORY_TO_TYPES[category] || CATEGORY_TO_TYPES.Food;
    
    console.log("🔍 Google API Request:", {
      types,
      lat,
      lng,
      radius,
      category
    });

    const requestBody = {
      includedTypes: types,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { 
            latitude: parseFloat(lat), 
            longitude: parseFloat(lng) 
          },
          radius: parseFloat(radius)
        }
      },
      rankPreference: "POPULARITY"
    };

    console.log("📤 Request Body:", JSON.stringify(requestBody, null, 2));

    const response = await axios.post(
      `${BASE_URL}/places:searchNearby`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.location",
            "places.types",
            "places.rating",
            "places.userRatingCount",
            "places.priceLevel",
            "places.regularOpeningHours",
            "places.websiteUri",
            "places.googleMapsUri",
            "places.photos"
          ].join(",")
        },
        timeout: 15000
      }
    );

    console.log("📥 Google API Response Status:", response.status);
    console.log("📥 Places Count:", response.data.places?.length || 0);

    const places = response.data.places || [];
    
    if (places.length === 0) {
      console.log("⚠️ No places returned from Google API");
      return [];
    }

    // Enrich each place with budget estimation
    const enrichedPlaces = places.map(place => {
      const photos = extractPhotos(place.photos);
      
      return {
        id: place.id,
        name: place.displayName?.text || "Unknown Place",
        address: place.formattedAddress || "",
        location: extractLocation(place.formattedAddress),
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        rating: place.rating || 0,
        ratingCount: place.userRatingCount || 0,
        priceLevel: place.priceLevel || "PRICE_LEVEL_UNSPECIFIED",
        budget: estimateBudget(place.priceLevel, category),
        openNow: place.regularOpeningHours?.openNow,
        openingHours: formatOpeningHours(place.regularOpeningHours),
        website: place.websiteUri,
        googleMapsUrl: place.googleMapsUri,
        photos: photos,
        types: place.types || [],
        category: category,
        source: "Google Places"
      };
    });

    console.log("✅ Enriched places:", enrichedPlaces.length);
    return enrichedPlaces;

  } catch (error) {
    // Detailed error logging
    if (error.response) {
      console.error("❌ Google API Error Response:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });

      // Check for common errors
      if (error.response.status === 403) {
        throw new Error("Google Places API not enabled or API key invalid. Enable 'Places API (New)' in Google Cloud Console.");
      }
      if (error.response.status === 400) {
        throw new Error("Invalid request to Google Places API: " + JSON.stringify(error.response.data));
      }

      throw new Error(`Google API Error: ${error.response.data.error?.message || error.response.statusText}`);
    }

    console.error("❌ Google Places API Error:", error.message);
    throw new Error("Failed to fetch places from Google: " + error.message);
  }
}

// Helper Functions

function estimateBudget(priceLevel, category) {
  // Use Google's price level if available
  if (priceLevel && priceLevel !== "PRICE_LEVEL_UNSPECIFIED") {
    const levelMatch = priceLevel.match(/PRICE_LEVEL_(\d)/);
    if (levelMatch) {
      const level = parseInt(levelMatch[1]);
      return PRICE_LEVEL_TO_BUDGET[level] || 500;
    }
  }

  // Fallback to category-based estimation
  const categoryBudgets = {
    Food: 400,
    Park: 50,
    Movie: 250,
    Fun: 500,
    Beach: 100,
    Mall: 800,
    Pilgrimage: 100,
    Hotels: 2000,
    Activities: 600
  };

  return categoryBudgets[category] || 500;
}

function extractLocation(address) {
  if (!address) return "Nearby";
  
  // Extract area/neighborhood from address
  const parts = address.split(',');
  if (parts.length > 2) {
    return parts[parts.length - 3]?.trim() || parts[0];
  }
  return parts[0] || "Nearby";
}

function formatOpeningHours(hours) {
  if (!hours?.weekdayDescriptions) return null;
  
  return hours.weekdayDescriptions.map(day => {
    const [dayName, times] = day.split(': ');
    return { day: dayName, hours: times || "Not available" };
  });
}

function extractPhotos(photos) {
  if (!photos || photos.length === 0) {
    console.log("⚠️ No photos available for this place");
    return [];
  }
  
  return photos.slice(0, 5).map(photo => {
    const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${API_KEY}`;
    
    return {
      reference: photo.name,
      url: photoUrl,
      attributions: photo.authorAttributions
    };
  });
}

module.exports = {
  searchNearbyPlaces
};