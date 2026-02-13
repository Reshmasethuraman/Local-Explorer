import { useEffect, useMemo, useState } from "react";
import "./App.css";

const CATEGORIES = [
  { key: "Food", label: "Food & Dining", emoji: "🍽️", color: "#EF4444" },
  { key: "Fun", label: "Entertainment", emoji: "🎮", color: "#8B5CF6" },
  { key: "Park", label: "Parks & Nature", emoji: "🌳", color: "#10B981" },
  { key: "Movie", label: "Movies", emoji: "🎬", color: "#F59E0B" },
  { key: "Mall", label: "Shopping", emoji: "🛍️", color: "#EC4899" },
  { key: "Beach", label: "Beaches", emoji: "🏖️", color: "#06B6D4" },
  { key: "Pilgrimage", label: "Spiritual", emoji: "🛕", color: "#F97316" },
  { key: "Activities", label: "Activities", emoji: "🎯", color: "#6366F1" },
];

// Change this if your backend runs on another URL
const API_BASE = "http://localhost:5000";

export default function App() {
  const [places, setPlaces] = useState([]);
  const [filteredPlaces, setFilteredPlaces] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search state
  const [location, setLocation] = useState("Anna Nagar, Chennai");
  const [category, setCategory] = useState("Food");
  const [peopleCount, setPeopleCount] = useState(2);
  const [budgetPerPerson, setBudgetPerPerson] = useState(800);
  const [radius, setRadius] = useState(2000);

  // Location & weather
  const [locationData, setLocationData] = useState(null);
  const [weather, setWeather] = useState(null);

  // Plan
  const [dayPlan, setDayPlan] = useState(null);

  const totalBudget = useMemo(
    () => (Number(budgetPerPerson) || 0) * (Number(peopleCount) || 1),
    [budgetPerPerson, peopleCount]
  );

  function normalizePlaces(rawPlaces = []) {
    // Ensures your UI never crashes even if backend misses fields
    return rawPlaces.map((p) => ({
      id: p.id || p.place_id || crypto.randomUUID(),
      name: p.name || "Unknown place",
      location: p.location || p.vicinity || "Unknown location",
      rating: typeof p.rating === "number" ? p.rating : null,
      ratingCount:
        typeof p.ratingCount === "number"
          ? p.ratingCount
          : typeof p.user_ratings_total === "number"
          ? p.user_ratings_total
          : 0,
      budget: typeof p.budget === "number" ? p.budget : 500, // fallback budget
      openNow: Boolean(p.openNow ?? p.open_now ?? p.opening_hours?.open_now),
      googleMapsUrl: p.googleMapsUrl || p.url || p.google_maps_url || "",
      photos: Array.isArray(p.photos) ? p.photos : [], // expected: [{ url }]
    }));
  }

  function filterPlacesByBudget(list = places) {
    const ppl = Number(peopleCount) || 1;
    const perPerson = Number(budgetPerPerson) || 0;
    const maxTotal = ppl * perPerson;

    const filtered = list
      .filter((place) => {
        const budget = typeof place.budget === "number" ? place.budget : 500;
        return budget * ppl <= maxTotal;
      })
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    setFilteredPlaces(filtered);
  }

  async function searchPlaces() {
    setLoading(true);
    setError("");
    setDayPlan(null);

    try {
      // 1) Geocode
      const geoRes = await fetch(
        `${API_BASE}/api/geocode?q=${encodeURIComponent(location)}`
      );
      const geoData = await geoRes.json();

      if (!geoRes.ok) {
        throw new Error(geoData?.message || "Geocoding request failed");
      }

      if (!geoData?.lat || !geoData?.lng) {
        throw new Error(geoData?.suggestion || "Location not found");
      }

      setLocationData(geoData);

      // 2) Weather (optional)
      try {
        const weatherRes = await fetch(
          `${API_BASE}/api/weather?lat=${geoData.lat}&lng=${geoData.lng}`
        );
        const weatherData = await weatherRes.json();
        if (weatherRes.ok) setWeather(weatherData);
      } catch {
        // ignore weather failures
      }

      // 3) Nearby places
      const url = `${API_BASE}/api/google/nearby?lat=${geoData.lat}&lng=${geoData.lng}&category=${encodeURIComponent(
        category
      )}&radius=${encodeURIComponent(radius)}`;

      const placesRes = await fetch(url);
      const placesData = await placesRes.json();

      if (!placesRes.ok) {
        throw new Error(
          placesData?.message ||
            placesData?.error ||
            "Failed to fetch places from Google"
        );
      }

      if (!placesData?.success) {
        throw new Error(placesData?.message || "Google Places API error");
      }

      const normalized = normalizePlaces(placesData.places || []);
      setPlaces(normalized);

      if (normalized.length === 0) {
        setFilteredPlaces([]);
        setError("No places found. Try increasing radius or changing location.");
        return;
      }

      // 4) Budget filter
      filterPlacesByBudget(normalized);
    } catch (e) {
      setPlaces([]);
      setFilteredPlaces([]);
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Re-filter when budget/people changes
  useEffect(() => {
    filterPlacesByBudget(places);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetPerPerson, peopleCount]);

  // Auto-search when category changes (and on first load)
  useEffect(() => {
    searchPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  function buildDayPlan() {
    if (!filteredPlaces.length) {
      alert("No places found within budget!");
      return;
    }

    const ppl = Number(peopleCount) || 1;

    const pick = (i) => filteredPlaces[i] || filteredPlaces[0];
    const chosen = [pick(0), pick(1), pick(2)];

    const plan = {
      morning: chosen[0],
      afternoon: chosen[1],
      evening: chosen[2],
      totalCost: chosen.reduce((sum, p) => sum + (p.budget || 0) * ppl, 0),
    };

    setDayPlan(plan);
  }

  const withinBudgetCount = filteredPlaces.length;
  const avgRating =
    filteredPlaces.length > 0
      ? (
          filteredPlaces.reduce((sum, p) => sum + (p.rating || 0), 0) /
          filteredPlaces.length
        ).toFixed(1)
      : "0";

  return (
    <div className="app">
      {/* Hero */}
      <section className="hero">
        <div className="hero-gradient" />
        <div className="hero-content">
          <div className="hero-badge">✨ Powered by Google Places API</div>

          <h1 className="hero-title">
            Discover Amazing Places
            <br />
            <span className="gradient-text">Within Your Budget</span>
          </h1>

          <p className="hero-subtitle">
            Real-time data • Accurate ratings • Smart recommendations
          </p>

          {weather && locationData && (
            <div className="weather-card">
              {weather.icon && (
                <img
                  src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                  alt={weather.description || "weather"}
                  style={{ width: 60, height: 60 }}
                />
              )}
              <div>
                <div className="weather-temp">{weather.temp}°C</div>
                <div className="weather-desc">{weather.condition}</div>
              </div>
              <div className="weather-location">
                📍{" "}
                {locationData.address?.county ||
                  locationData.address?.city ||
                  location}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Search */}
      <section className="search-section">
        <div className="container">
          <div className="search-grid">
            <div className="search-field">
              <label>📍 Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Anna Nagar, Chennai"
              />
            </div>

            <div className="search-field">
              <label>👥 People</label>
              <input
                type="number"
                min="1"
                max="20"
                value={peopleCount}
                onChange={(e) => setPeopleCount(Number(e.target.value) || 1)}
              />
            </div>

            <div className="search-field">
              <label>💰 Budget per person (₹)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={budgetPerPerson}
                onChange={(e) => setBudgetPerPerson(Number(e.target.value) || 0)}
              />
            </div>

            <div className="search-field">
              <label>📏 Radius (meters)</label>
              <input
                type="number"
                min="500"
                max="50000"
                step="500"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value) || 2000)}
              />
            </div>
          </div>

          <button className="search-btn" onClick={searchPlaces} disabled={loading}>
            {loading ? "🔍 Searching..." : "🚀 Search Places"}
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="categories">
        <div className="container">
          <div className="category-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                className={`category-tab ${category === cat.key ? "active" : ""}`}
                style={{ "--tab-color": cat.color }}
                onClick={() => setCategory(cat.key)}
              >
                <span className="tab-emoji">{cat.emoji}</span>
                <span className="tab-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{withinBudgetCount}</div>
              <div className="stat-label">Within Budget</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">₹{totalBudget}</div>
              <div className="stat-label">Total Budget</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">⭐ {avgRating}</div>
              <div className="stat-label">Avg Rating</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{radius}m</div>
              <div className="stat-label">Search Radius</div>
            </div>
          </div>

          {withinBudgetCount > 0 && (
            <button className="plan-btn" onClick={buildDayPlan}>
              🗓️ Build Day Plan
            </button>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="container">
          <div className="error-banner">❌ {error}</div>
        </div>
      )}

      {/* Day Plan */}
      {dayPlan && (
        <section className="day-plan">
          <div className="container">
            <h2>🗓️ Your Day Plan</h2>
            <div className="plan-grid">
              <PlanCard time="Morning" place={dayPlan.morning} people={peopleCount} />
              <PlanCard time="Afternoon" place={dayPlan.afternoon} people={peopleCount} />
              <PlanCard time="Evening" place={dayPlan.evening} people={peopleCount} />
            </div>
            <div className="plan-total">
              Total Cost: <strong>₹{dayPlan.totalCost}</strong> for {peopleCount} people
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      <section className="results">
        <div className="container">
          <h2>
            {loading ? "🔍 Searching..." : `${category} Results`}
            <span className="result-count"> ({filteredPlaces.length} places)</span>
          </h2>

          {loading && (
            <div className="loading-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="place-card skeleton" />
              ))}
            </div>
          )}

          {!loading && filteredPlaces.length === 0 && (
            <div className="empty-state">
              <div className="empty-emoji">😕</div>
              <h3>No places found within budget</h3>
              <p>Try increasing your budget or radius</p>
            </div>
          )}

          {!loading && filteredPlaces.length > 0 && (
            <div className="places-grid">
              {filteredPlaces.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  peopleCount={peopleCount}
                  budgetPerPerson={budgetPerPerson}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p>Powered by Google Places API • Made with ❤️</p>
        </div>
      </footer>
    </div>
  );
}

function PlaceCard({ place, peopleCount, budgetPerPerson }) {
  const ppl = Number(peopleCount) || 1;
  const perPerson = Number(budgetPerPerson) || 0;

  const budget = typeof place.budget === "number" ? place.budget : 500;
  const totalCost = budget * ppl;
  const withinBudget = totalCost <= perPerson * ppl;

  const imgUrl =
    place.photos?.length > 0 && place.photos[0]?.url ? place.photos[0].url : "";

  return (
    <div className="place-card">
      <div className="card-image">
        {imgUrl ? <img src={imgUrl} alt={place.name} /> : <div className="no-image">📍</div>}

        <div className="card-badges">
          {place.openNow && <span className="badge-open">Open Now</span>}
          {withinBudget && <span className="badge-budget">Within Budget ✓</span>}
        </div>
      </div>

      <div className="card-content">
        <h3>{place.name}</h3>
        <p className="card-address">📍 {place.location}</p>

        <div className="card-stats">
          <div className="stat">
            <span className="stat-icon">⭐</span>
            <span>{place.rating ?? "N/A"}</span>
            <span className="stat-small">({place.ratingCount || 0})</span>
          </div>
          <div className="stat">
            <span className="stat-icon">💰</span>
            <span>₹{budget}</span>
            <span className="stat-small">/ person</span>
          </div>
          <div className="stat">
            <span className="stat-icon">👥</span>
            <span>₹{totalCost}</span>
            <span className="stat-small">total</span>
          </div>
        </div>

        {place.googleMapsUrl && (
          <a
            href={place.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="card-btn"
          >
            View on Google Maps →
          </a>
        )}
      </div>
    </div>
  );
}

function PlanCard({ time, place, people }) {
  if (!place) return null;
  const ppl = Number(people) || 1;

  return (
    <div className="plan-card">
      <div className="plan-time">{time}</div>
      <h3>{place.name}</h3>
      <p>📍 {place.location}</p>
      <p className="plan-cost">
        ₹{(place.budget || 0) * ppl} for {ppl} people
      </p>
    </div>
  );
}
