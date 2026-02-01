import { useEffect, useMemo, useState } from "react";
import "./App.css";

const CATEGORY_TABS = [
  { key: "Food", label: "Food", emoji: "🍽️" },
  { key: "Fun", label: "Fun", emoji: "🎮" },
  { key: "Park", label: "Parks", emoji: "🌳" },
  { key: "Movie", label: "Movies", emoji: "🎬" },
  { key: "Mall", label: "Malls", emoji: "🛍️" },
  { key: "Beach", label: "Beaches", emoji: "🏖️" },
  { key: "Pilgrimage", label: "Pilgrimage", emoji: "🛕" },
];

// Your backend OSM currently supports Food/Park/Movie/Fun only.
// Others will fallback; later you can enhance backend mapping.
function normalizeCategoryForOSM(cat) {
  if (cat === "Beach") return "Park";
  if (cat === "Mall") return "Fun";
  if (cat === "Pilgrimage") return "Fun";
  return cat;
}

// Estimated cost per person for OSM places (simple and explainable)
function estimateCostPerPerson(placeCategory) {
  const c = (placeCategory || "").toLowerCase();

  if (c.includes("park") || c.includes("beach")) return 20; // mostly free
  if (c.includes("pilgrimage")) return 30; // transport/offerings
  if (c.includes("movie")) return 250; // ticket avg
  if (c.includes("fun") || c.includes("mall")) return 350; // arcade/trampoline/mall spend
  // food default
  return 200;
}

// Build a 1-day plan based on budget per person
function buildDayPlan({ places, mode, budgetPerPerson, peopleCount }) {
  // Separate into buckets
  const food = [];
  const park = [];
  const fun = [];
  const movie = [];
  const other = [];

  for (const p of places) {
    const cat = (p.category || "").toLowerCase();
    if (cat.includes("food")) food.push(p);
    else if (cat.includes("park") || cat.includes("beach")) park.push(p);
    else if (cat.includes("fun") || cat.includes("mall")) fun.push(p);
    else if (cat.includes("movie")) movie.push(p);
    else other.push(p);
  }

  // Helper to get per-person cost for a place
  const costFor = (p) => {
    if (mode === "DB") {
      // DB places have real budget field
      return Number(p.budget || 0);
    }
    // OSM places: estimate based on category
    return estimateCostPerPerson(p.category);
  };

  // Filter any place that exceeds budget per person (for DB)
  // For OSM, we don't "exceed" — we just estimate and compare.
  const withinBudget = (p) => costFor(p) <= budgetPerPerson;

  const pickOne = (arr) => {
    const candidates = arr.filter(withinBudget);
    return candidates[0] || null;
  };

  // Plan slots (simple, review-friendly)
  const breakfast = pickOne(food);
  const midActivity = pickOne(park.length ? park : fun);
  const lunch = pickOne(food.filter((p) => p !== breakfast));
  const evening = pickOne(movie.length ? movie : fun.filter((p) => p !== midActivity));
  const dinner = pickOne(food.filter((p) => p !== breakfast && p !== lunch));

  const slots = [
    { title: "Breakfast", icon: "🥞", place: breakfast },
    { title: "Activity", icon: "✨", place: midActivity },
    { title: "Lunch", icon: "🍛", place: lunch },
    { title: "Evening", icon: "🌆", place: evening },
    { title: "Dinner", icon: "🍽️", place: dinner },
  ];

  const chosen = slots.map((s) => s.place).filter(Boolean);
  const perPersonTotal = chosen.reduce((sum, p) => sum + costFor(p), 0);
  const groupTotal = perPersonTotal * peopleCount;

  // If nothing fits, return helpful message
  const ok = chosen.length > 0;

  return {
    ok,
    slots,
    perPersonTotal,
    groupTotal,
    notes: ok
      ? []
      : [
          "No places fit your budget. Increase budget or switch category/mode.",
          "Tip: Parks/Beaches are usually cheapest.",
        ],
  };
}

export default function App() {
  const [places, setPlaces] = useState([]);

  // Modes: DB / OSM_NEARBY / OSM_AREA
  const [mode, setMode] = useState("OSM_AREA");
  const [activeCategory, setActiveCategory] = useState("Food");

  // Area search
  const [areaQuery, setAreaQuery] = useState("Anna Nagar, Chennai");
  const [areaInfo, setAreaInfo] = useState(null);

  // Budget controls
  const [peopleCount, setPeopleCount] = useState(2);
  const [budgetPerPerson, setBudgetPerPerson] = useState(800); // ₹ per person

  // Built plan
  const [plan, setPlan] = useState(null);

  const modeLabel = useMemo(() => {
    if (mode === "DB") return "Saved places (MongoDB)";
    if (mode === "OSM_NEARBY") return "Nearby (My Location)";
    if (mode === "OSM_AREA") return "Nearby (Area Search)";
    return "Explore";
  }, [mode]);

  async function fetchByAreaSearch(cat = activeCategory) {
    try {
      setMode("OSM_AREA");
      setPlan(null);

      const geoUrl = `http://localhost:5000/api/geocode?q=${encodeURIComponent(areaQuery)}`;
      const geoRes = await fetch(geoUrl);
      const geo = await geoRes.json();

      if (!geo?.lat || !geo?.lng) {
        alert("Area not found. Try: 'Anna Nagar, Chennai' or 'T Nagar, Chennai'");
        return;
      }
      setAreaInfo(geo);

      const osmCat = normalizeCategoryForOSM(cat);
      const nearbyUrl = `http://localhost:5000/api/osm/nearby?lat=${geo.lat}&lng=${geo.lng}&category=${encodeURIComponent(
        osmCat
      )}`;

      const nearby = await fetch(nearbyUrl).then((r) => r.json());

      // IMPORTANT: attach your chosen category so budget estimator works consistently
      const normalized = Array.isArray(nearby)
        ? nearby.map((p) => ({ ...p, category: osmCat }))
        : [];

      setPlaces(normalized);
    } catch (e) {
      console.error(e);
      alert("Error searching this area. Check backend routes are running.");
    }
  }

  function fetchNearbyMyLocation(cat = activeCategory) {
    if (!navigator.geolocation) {
      alert("Geolocation not supported in this browser");
      return;
    }

    setMode("OSM_NEARBY");
    setAreaInfo(null);
    setPlan(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const osmCat = normalizeCategoryForOSM(cat);

        const url = `http://localhost:5000/api/osm/nearby?lat=${lat}&lng=${lng}&category=${encodeURIComponent(
          osmCat
        )}`;

        try {
          const data = await fetch(url).then((r) => r.json());
          const normalized = Array.isArray(data) ? data.map((p) => ({ ...p, category: osmCat })) : [];
          setPlaces(normalized);
        } catch (e) {
          console.error(e);
          setPlaces([]);
        }
      },
      () => alert("Location permission denied or unavailable")
    );
  }

  function fetchFromDB() {
    setMode("DB");
    setAreaInfo(null);
    setPlan(null);

    let url = "http://localhost:5000/api/places?";
    if (activeCategory) url += `category=${encodeURIComponent(activeCategory)}&`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => setPlaces(Array.isArray(data) ? data : []))
      .catch(() => setPlaces([]));
  }

  useEffect(() => {
    // Load by area search like your main use-case
    fetchByAreaSearch("Food");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onBuildPlan() {
    const built = buildDayPlan({
      places,
      mode: mode === "DB" ? "DB" : "OSM",
      budgetPerPerson: Number(budgetPerPerson),
      peopleCount: Number(peopleCount),
    });
    setPlan(built);
  }

  const hint = useMemo(() => {
    if (mode === "DB") return "Uses stored budgets from MongoDB.";
    return "Uses estimated budgets (since live APIs don't provide exact price).";
  }, [mode]);

  return (
    <div className="page">
      <section className="heroV2">
        <div className="heroMask" />
        <div className="heroInner">
          <div className="navRow">
            <div className="brand">
              <div className="brandDot" />
              <div>
                <div className="brandName">Local Explorer</div>
                <div className="brandTag">Budget-first local plans • People-based</div>
              </div>
            </div>

            <div className="modePills">
              <span className="pill">{modeLabel}</span>
              {mode === "OSM_AREA" && areaInfo?.displayName ? (
                <span className="pill pillLight" title={areaInfo.displayName}>
                  Area: {areaQuery}
                </span>
              ) : null}
            </div>
          </div>

          <h1 className="heroTitle2">Budget-friendly plans, instantly ✨</h1>
          <p className="heroSub2">
            Enter <b>people</b> + <b>per-person budget</b>, then build a 1-day plan (Food + Activity + Evening).
          </p>

          <div className="searchBar">
            <div className="searchField">
              <label>Area</label>
              <input
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
                placeholder="Anna Nagar, Chennai"
              />
            </div>

            <div className="searchField">
              <label>Mode</label>
              <div className="btnRow">
                <button className="btnGhost" onClick={() => fetchByAreaSearch(activeCategory)}>
                  Search Area
                </button>
                <button className="btnGhost" onClick={() => fetchNearbyMyLocation(activeCategory)}>
                  Use My Location
                </button>
                <button className="btnGhost" onClick={fetchFromDB}>
                  Saved
                </button>
              </div>
            </div>

            <button className="btnPrimary" onClick={() => fetchByAreaSearch(activeCategory)}>
              Search
            </button>
          </div>

          <div className="catTabs">
            {CATEGORY_TABS.map((t) => (
              <button
                key={t.key}
                className={`catTab ${activeCategory === t.key ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(t.key);
                  setPlan(null);
                  if (mode === "OSM_NEARBY") fetchNearbyMyLocation(t.key);
                  else if (mode === "DB") fetchFromDB();
                  else fetchByAreaSearch(t.key);
                }}
                type="button"
              >
                <span className="catEmoji">{t.emoji}</span>
                <span className="catLabel">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Budget Controls */}
          <div className="budgetBar">
            <div className="budgetItem">
              <div className="budgetLabel">People</div>
              <input
                type="number"
                min="1"
                max="15"
                value={peopleCount}
                onChange={(e) => setPeopleCount(e.target.value)}
                className="budgetInput"
              />
            </div>

            <div className="budgetItem">
              <div className="budgetLabel">Budget per person (₹)</div>
              <input
                type="number"
                min="50"
                step="50"
                value={budgetPerPerson}
                onChange={(e) => setBudgetPerPerson(e.target.value)}
                className="budgetInput"
              />
            </div>

            <button className="btnPrimary" onClick={onBuildPlan}>
              Build 1-Day Plan
            </button>
          </div>

          <div className="mutedSmall" style={{ marginTop: 8 }}>
            {hint}
          </div>

          <div className="statRow">
            <div className="statCard">
              <div className="statNum">{places.length}</div>
              <div className="statTxt">Results</div>
            </div>
            <div className="statCard">
              <div className="statNum">₹{budgetPerPerson}</div>
              <div className="statTxt">Per person budget</div>
            </div>
            <div className="statCard">
              <div className="statNum">{peopleCount}</div>
              <div className="statTxt">People</div>
            </div>
          </div>
        </div>
      </section>

      <main className="container2">
        {/* PLAN SECTION */}
        {plan && (
          <div className="planBox">
            <div className="planHead">
              <div>
                <div className="planTitle">Your 1-Day Plan</div>
                <div className="mutedSmall">
                  Total per person: <b>₹{plan.perPersonTotal}</b> • Group total:{" "}
                  <b>₹{plan.groupTotal}</b>
                </div>
              </div>
              <div className="mutedSmall">
                Budget per person: ₹{budgetPerPerson} • People: {peopleCount}
              </div>
            </div>

            {!plan.ok ? (
              <div className="empty">
                <h3>Plan couldn’t be built</h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {plan.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="planGrid">
                {plan.slots.map((s) => (
                  <div className="planCard" key={s.title}>
                    <div className="planSlot">
                      <span className="planIcon">{s.icon}</span>
                      <span className="planSlotTitle">{s.title}</span>
                    </div>
                    {s.place ? (
                      <>
                        <div className="planPlace">{s.place.name}</div>
                        <div className="mutedSmall">{s.place.location || "Nearby"}</div>
                        <div className="mutedSmall" style={{ marginTop: 6 }}>
                          Est. cost per person:{" "}
                          <b>
                            ₹
                            {mode === "DB"
                              ? Number(s.place.budget || 0)
                              : estimateCostPerPerson(s.place.category)}
                          </b>
                        </div>
                      </>
                    ) : (
                      <div className="mutedSmall">No option found in budget</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESULTS LIST */}
        <div className="sectionHead">
          <h2 className="h2">
            {activeCategory} results{" "}
            <span className="muted">
              {mode === "OSM_AREA"
                ? "near your searched area"
                : mode === "OSM_NEARBY"
                ? "near you"
                : "saved"}
            </span>
          </h2>
          <div className="mutedSmall">{areaInfo?.displayName || ""}</div>
        </div>

        {places.length === 0 ? (
          <div className="empty">
            <h3>No results</h3>
            <p>Try another area or category.</p>
          </div>
        ) : (
          <div className="grid2">
            {places.map((p, idx) => (
              <div className="card2" key={p._id || `${p.name}-${idx}`}>
                <div className="cardBody">
                  <div className="cardTitleRow">
                    <div>
                      <div className="cardTitle">{p.name}</div>
                      <div className="cardSub">{p.location || "Nearby"}</div>
                    </div>

                    <div className="badgeStack">
                      <span className="badge2">{activeCategory}</span>
                      <span className="badge2 badge2Light">
                        ₹{mode === "DB" ? Number(p.budget || 0) : estimateCostPerPerson(p.category)} / person
                      </span>
                    </div>
                  </div>

                  <div className="miniInfo">
                    Tip: This place fits budget?{" "}
                    <b>
                      {(mode === "DB"
                        ? Number(p.budget || 0)
                        : estimateCostPerPerson(p.category)) <= Number(budgetPerPerson)
                        ? "✅ Yes"
                        : "❌ No"}
                    </b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="footer2">Local Explorer • Budget-first planning • People-based recommendations</footer>
    </div>
  );
}






