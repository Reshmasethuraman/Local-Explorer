import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import { signInWithGoogle, firebaseSignOut } from "./firebase";

const API = "http://localhost:5000";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "Pilgrimage", label: "Temple / Pilgrimage", icon: "🛕", color: "#f97316", bg: "#fff7ed" },
  { key: "Fun",        label: "Fun & Entertainment", icon: "🎡", color: "#8b5cf6", bg: "#f5f3ff" },
  { key: "Food",       label: "Dining",              icon: "🍽️", color: "#ef4444", bg: "#fef2f2" },
  { key: "Movie",      label: "Movies",              icon: "🎬", color: "#f59e0b", bg: "#fffbeb" },
  { key: "Shopping",   label: "Shopping",            icon: "🛍️", color: "#ec4899", bg: "#fdf2f8" },
  { key: "Beach",      label: "Beaches",             icon: "🏖️", color: "#06b6d4", bg: "#ecfeff" },
  { key: "Park",       label: "Parks & Nature",      icon: "🌳", color: "#10b981", bg: "#ecfdf5" },
  { key: "History",    label: "History / Museums",   icon: "🏛️", color: "#6366f1", bg: "#eef2ff" },
  { key: "All",        label: "All Places",          icon: "✨", color: "#1e293b", bg: "#f8fafc" },
];

const PLAN_TYPES = [
  { key: "1day",   days: 1,    label: "1-Day Plan",        icon: "📅", desc: "Perfect day out",    color: "#3b82f6" },
  { key: "2-3day", days: 2,    label: "2–3 Day Plan",      icon: "🗓️", desc: "Weekend getaway",    color: "#8b5cf6" },
  { key: "5day",   days: 5,    label: "5-Day Plan",        icon: "📆", desc: "Full vacation",       color: "#10b981" },
  { key: "custom", days: null, label: "Customized Plan",   icon: "✏️", desc: "Choose your days",    color: "#f59e0b" },
  { key: "around", days: 1,    label: "Places Around Me",  icon: "📍", desc: "Use GPS location",    color: "#ef4444" },
];

const TIME_SLOTS = [
  "6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM",
  "12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
  "6:00 PM","7:00 PM","8:00 PM","9:00 PM","10:00 PM",
];

// Radius progression for retries (meters)
const RADIUS_STEPS = [3000, 8000, 15000, 30000, 50000];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getDayLabel(i) {
  const d = new Date(); d.setDate(d.getDate() + i);
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}
function parseHour(str) {
  const [time, ampm] = str.split(" ");
  let [h] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h;
}
function fmtH(h) {
  if (h === 0) return "12:00 AM";
  if (h < 12)  return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}
function normalizePlaces(raw = [], cat = "") {
  return raw.map(p => ({
    id:          p.id || p.place_id || String(Math.random()),
    name:        p.name || "Unknown Place",
    location:    p.location || p.vicinity || "Nearby",
    rating:      +(p.rating ?? 0),
    ratingCount: p.ratingCount || p.user_ratings_total || 0,
    budget:      typeof p.budget === "number" ? p.budget : 400,
    openNow:     Boolean(p.openNow ?? p.open_now),
    mapsUrl:     p.googleMapsUrl || p.url || "",
    photo:       p.photos?.[0]?.url || "",
    address:     p.address || "",
    category:    p.category || cat,
  }));
}
function buildSlots(startH, endH, places) {
  const pool = [...places];
  return Array.from({ length: endH - startH }, (_, i) => {
    const h = startH + i;
    return { id: String(h), time: `${fmtH(h)} – ${fmtH(h + 1)}`, place: pool.shift() || null, isLunch: h === 12 };
  });
}
function buildMultiDay({ places, numDays, startH, endH, budget, people }) {
  const spd  = endH - startH;
  const pool = [...places.filter(p => p.budget * people <= budget * people)].sort(() => Math.random() - 0.5);
  return Array.from({ length: numDays }, (_, i) => ({
    dayIndex: i,
    label: getDayLabel(i),
    slots: buildSlots(startH, endH, pool.slice(i * spd, (i + 1) * spd)),
  }));
}

// Fetch with progressive radius retry
async function fetchWithRetry(lat, lng, cat) {
  for (const radius of RADIUS_STEPS) {
    try {
      const r = await fetch(`${API}/api/google/nearby?lat=${lat}&lng=${lng}&category=${cat}&radius=${radius}`);
      const d = await r.json();
      if (d.success && d.places?.length > 0) {
        console.log(`✅ [${cat}] found ${d.places.length} at radius ${radius}`);
        return normalizePlaces(d.places, cat);
      }
    } catch { /* continue */ }
    // OSM fallback on last step
    if (radius === RADIUS_STEPS[RADIUS_STEPS.length - 1]) {
      try {
        const r = await fetch(`${API}/api/osm/nearby?lat=${lat}&lng=${lng}&category=${cat}`);
        const d = await r.json();
        if (Array.isArray(d) && d.length) return normalizePlaces(d, cat);
      } catch { /* give up */ }
    }
  }
  return [];
}

function getCat(key) { return CATEGORIES.find(c => c.key === key) || CATEGORIES[0]; }

// Per-user localStorage key
function userKey(uid) { return `le_plans_${uid || "guest"}`; }

function loadUserPlans(uid) {
  try { return JSON.parse(localStorage.getItem(userKey(uid)) || "[]"); } catch { return []; }
}
function saveUserPlans(uid, plans) {
  localStorage.setItem(userKey(uid), JSON.stringify(plans));
}

// ─── NAVBAR (full width, like commercial sites) ───────────────────────────────
function Navbar({ user, savedCount, onNav, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) { setProfileOpen(false); setMenuOpen(false); }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav className="navbar" ref={ref}>
      <div className="nav-inner">
        {/* Logo */}
        <button className="nav-logo" onClick={() => onNav(user ? "plans" : "welcome")}>
          <span className="nav-logo-icon">🗺️</span>
          <div className="nav-logo-text">
            <span className="nav-brand">Namma Ooru</span>
            <span className="nav-tagline">Local Explorer</span>
          </div>
        </button>

        {/* Nav links — desktop only */}
        {user && (
          <div className="nav-links">
            <button onClick={() => onNav("plans")}>Explore</button>
            <button onClick={() => onNav("savedplans")}>My Plans {savedCount > 0 && <span className="nav-count">{savedCount}</span>}</button>
          </div>
        )}

        {/* Right actions */}
        <div className="nav-actions">
          {!user ? (
            <>
              <button className="btn-nav-ghost" onClick={() => onNav("login")}>Login</button>
              <button className="btn-nav-primary" onClick={() => onNav("signup")}>Sign Up</button>
            </>
          ) : (
            <div className="profile-menu-wrap">
              <button className="profile-btn" onClick={() => setProfileOpen(v => !v)}>
                <div className="profile-avatar">
                  {user.photo
                    ? <img src={user.photo} alt={user.name} referrerPolicy="no-referrer" />
                    : <span>{(user.name || "U")[0].toUpperCase()}</span>
                  }
                </div>
                <span className="profile-name">{user.name?.split(" ")[0] || "Account"}</span>
                <span className="profile-chevron">{profileOpen ? "▲" : "▼"}</span>
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="pd-header">
                    <div className="pd-avatar">
                      {user.photo
                        ? <img src={user.photo} alt={user.name} referrerPolicy="no-referrer" />
                        : <span>{(user.name || "U")[0].toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <p className="pd-name">{user.name}</p>
                      <p className="pd-email">{user.email}</p>
                    </div>
                  </div>
                  <div className="pd-divider" />
                  <button className="pd-item" onClick={() => { setProfileOpen(false); onNav("plans"); }}>🗺️ Explore</button>
                  <button className="pd-item" onClick={() => { setProfileOpen(false); onNav("savedplans"); }}>
                    🗂 My Plans {savedCount > 0 && <span className="pd-count">{savedCount}</span>}
                  </button>
                  <div className="pd-divider" />
                  <button className="pd-item pd-logout" onClick={() => { setProfileOpen(false); onLogout(); }}>
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Hamburger — mobile */}
          <button className="hamburger" onClick={() => setMenuOpen(v => !v)}>
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu">
          {user ? (
            <>
              <div className="mm-user">
                <p className="mm-name">{user.name}</p>
                <p className="mm-email">{user.email}</p>
              </div>
              <button onClick={() => { setMenuOpen(false); onNav("plans"); }}>🗺️ Explore</button>
              <button onClick={() => { setMenuOpen(false); onNav("savedplans"); }}>🗂 My Plans {savedCount > 0 && `(${savedCount})`}</button>
              <button className="mm-logout" onClick={() => { setMenuOpen(false); onLogout(); }}>🚪 Logout</button>
            </>
          ) : (
            <>
              <button onClick={() => { setMenuOpen(false); onNav("login"); }}>Login</button>
              <button onClick={() => { setMenuOpen(false); onNav("signup"); }}>Sign Up</button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

// ─── PAGE: Welcome ────────────────────────────────────────────────────────────
function PageWelcome({ onNav }) {
  return (
    <div className="page pg-welcome">
      {/* Hero */}
      <div className="hero-section">
        <div className="hero-bg">
          <div className="hero-orb o1" /><div className="hero-orb o2" /><div className="hero-orb o3" />
        </div>
        <div className="hero-content container">
          <h1 className="hero-title">
            Discover Amazing Places<br />
            <span className="hero-accent">Within Your Budget</span>
          </h1>
          <p className="hero-sub">Plan your perfect day out with AI-powered recommendations, real-time data, and smart budget filters.</p>
          <div className="hero-btns">
            <button className="btn-hero-primary" onClick={() => onNav("signup")}>Get Started Free</button>
            <button className="btn-hero-ghost" onClick={() => onNav("login")}>Login</button>
          </div>
          <div className="hero-stats">
            {[["20+", "Cities Covered"], ["9", "Categories"], ["AI", "Powered Plans"], ["Free", "To Use"]].map(([v,l]) => (
              <div className="hero-stat" key={l}><strong>{v}</strong><span>{l}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Category showcase */}
      <div className="showcase-section container">
        <h2 className="sec-title">Explore by Category</h2>
        <p className="sec-sub">Find exactly what you're looking for in your city</p>
        <div className="cat-showcase-grid">
          {CATEGORIES.filter(c => c.key !== "All").map(cat => (
            <button key={cat.key} className="cat-showcase-card" style={{ "--cc": cat.color, "--cbg": cat.bg }}
              onClick={() => onNav("signup")}>
              <span className="csc-icon">{cat.icon}</span>
              <span className="csc-label">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Plan types */}
      <div className="plans-showcase container">
        <h2 className="sec-title">Plan Your Way</h2>
        <p className="sec-sub">Multiple plan types to suit every trip</p>
        <div className="plan-showcase-grid">
          {PLAN_TYPES.map(pt => (
            <div key={pt.key} className="psc-card" style={{ "--pc": pt.color }}>
              <span className="psc-icon">{pt.icon}</span>
              <h3>{pt.label}</h3>
              <p>{pt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA band */}
      <div className="cta-band">
        <div className="container cta-inner">
          <h2>Ready to Explore?</h2>
          <p>Sign up free and start planning your perfect day out</p>
          <button className="btn-cta" onClick={() => onNav("signup")}>Start Planning Now →</button>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">🗺️ <strong>Namma Ooru</strong> — Local Explorer</div>
          <p className="footer-copy">© {new Date().getFullYear()} Namma Ooru · AI & Data Science Project</p>
        </div>
      </footer>
    </div>
  );
}

// ─── PAGE: Login ──────────────────────────────────────────────────────────────
function PageLogin({ onNav, onLogin }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!email || !pass) { setErr("Please fill all fields"); return; }
    onLogin({ uid: `email_${email}`, email, name: email.split("@")[0], provider: "email" });
  }

  async function googleLogin() {
    setLoading(true); setErr("");
    try {
      const u = await signInWithGoogle();
      onLogin(u);
    } catch (e) {
      setErr("Google sign-in failed. " + (e.message || ""));
    } finally { setLoading(false); }
  }

  return (
    <div className="page pg-auth">
      <div className="auth-wrap">
        <div className="auth-side">
          <div className="auth-side-content">
            <div className="auth-side-logo">🗺️ Namma Ooru</div>
            <h2>Welcome back!</h2>
            <p>Sign in to access your plans, explore new places, and continue your adventures.</p>
            <div className="auth-side-features">
              {["AI-powered day plans", "Budget-smart suggestions", "Real-time place data", "Save & revisit plans"].map(f => (
                <div key={f} className="asf-item"><span>✓</span>{f}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-card">
            <button className="back-link" onClick={() => onNav("welcome")}>← Back to Home</button>
            <h2 className="auth-title">Login</h2>
            <p className="auth-sub">New here? <button onClick={() => onNav("signup")}>Create an account</button></p>

            {err && <div className="err-box">⚠️ {err}</div>}

            <button className="btn-google" onClick={googleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              {loading ? "Signing in…" : "Continue with Google"}
            </button>

            <div className="divider"><span>or sign in with email</span></div>

            <form onSubmit={submit} className="auth-form">
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Enter your password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" />
              </div>
              <button type="submit" className="btn-primary btn-full">Login</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: Signup ─────────────────────────────────────────────────────────────
function PageSignup({ onNav, onLogin }) {
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!email) { setErr("Email is required"); return; }
    onLogin({ uid: `email_${email}`, email, name: name || email.split("@")[0], provider: "email" });
  }

  async function googleLogin() {
    setLoading(true); setErr("");
    try {
      const u = await signInWithGoogle();
      onLogin(u);
    } catch (e) {
      setErr("Google sign-in failed. " + (e.message || ""));
    } finally { setLoading(false); }
  }

  return (
    <div className="page pg-auth">
      <div className="auth-wrap">
        <div className="auth-side">
          <div className="auth-side-content">
            <div className="auth-side-logo">🗺️ Namma Ooru</div>
            <h2>Start Exploring!</h2>
            <p>Create your free account and discover the best places around you with smart AI planning.</p>
            <div className="auth-side-features">
              {["Free forever", "AI-powered itineraries", "Budget-aware planning", "Unlimited saved plans"].map(f => (
                <div key={f} className="asf-item"><span>✓</span>{f}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-card">
            <button className="back-link" onClick={() => onNav("welcome")}>← Back to Home</button>
            <h2 className="auth-title">Create Account</h2>
            <p className="auth-sub">Already have an account? <button onClick={() => onNav("login")}>Login</button></p>

            {err && <div className="err-box">⚠️ {err}</div>}

            <button className="btn-google" onClick={googleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              {loading ? "Signing up…" : "Continue with Google"}
            </button>

            <div className="divider"><span>or sign up with email</span></div>

            <form onSubmit={submit} className="auth-form">
              <div className="field">
                <label>Full Name</label>
                <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              </div>
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Create a password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="new-password" />
              </div>
              <button type="submit" className="btn-primary btn-full">Create Account</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: Select Plan ────────────────────────────────────────────────────────
function PageSelectPlan({ user, onNav, savedPlans, onSelectPlan }) {
  return (
    <div className="page pg-plans">
      <div className="plans-hero-bar">
        <div className="container">
          <h1>Hey {user?.name?.split(" ")[0] || "Explorer"} 👋</h1>
          <p>What kind of outing are you planning today?</p>
        </div>
      </div>
      <div className="container plans-body">
        <div className="plans-grid">
          {PLAN_TYPES.map(pt => (
            <button key={pt.key} className="plan-card" style={{ "--pc": pt.color }} onClick={() => onSelectPlan(pt)}>
              <div className="pc-icon-wrap"><span className="pc-icon">{pt.icon}</span></div>
              <div className="pc-text">
                <h3>{pt.label}</h3>
                <p>{pt.desc}</p>
              </div>
              <span className="pc-arrow">→</span>
            </button>
          ))}
        </div>

        {savedPlans.length > 0 && (
          <div className="saved-cta-card" onClick={() => onNav("savedplans")}>
            <div className="scc-left">
              <span className="scc-icon">🗂</span>
              <div>
                <h3>My Saved Plans</h3>
                <p>You have {savedPlans.length} saved plan{savedPlans.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <span className="scc-arrow">→</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE: Categories ─────────────────────────────────────────────────────────
function PageCategories({ user, onNav, planType, onConfirm }) {
  const [sel, setSel] = useState([]);
  const isAround = planType?.key === "around";

  function toggle(key) {
    if (key === "All") { setSel(["All"]); return; }
    setSel(p => {
      const w = p.filter(k => k !== "All");
      return w.includes(key) ? w.filter(k => k !== key) : [...w, key];
    });
  }

  function confirm() {
    onConfirm(sel.includes("All") ? CATEGORIES.filter(c => c.key !== "All").map(c => c.key) : sel);
  }

  return (
    <div className="page pg-cats">
      <div className="page-header container">
        <button className="pg-back" onClick={() => onNav("plans")}>← Back</button>
        <div>
          <h1>Choose Activities</h1>
          <p>{isAround ? "Select categories — we'll detect your location" : `For ${planType?.label} — pick what interests you`}</p>
        </div>
      </div>
      <div className="container">
        <div className="cats-grid">
          {CATEGORIES.map(cat => {
            const on = sel.includes(cat.key) || sel.includes("All");
            return (
              <button key={cat.key} className={`cat-card ${on ? "cat-card--on" : ""}`}
                style={{ "--cc": cat.color, "--cbg": cat.bg }} onClick={() => toggle(cat.key)}>
                <span className="cc-icon">{cat.icon}</span>
                <span className="cc-label">{cat.label}</span>
                {on && <span className="cc-check">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="cats-footer">
          <p className="sel-count">{sel.includes("All") ? "All categories selected" : sel.length > 0 ? `${sel.length} selected` : "Select at least one"}</p>
          <button className="btn-primary btn-lg" disabled={sel.length === 0} onClick={confirm}>
            {isAround ? "📍 Find Nearby Places" : "Continue to Location →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: Location ───────────────────────────────────────────────────────────
function PageLocation({ user, onNav, planType, categories, onGenerate, onPickOut }) {
  const [loc,    setLoc]    = useState("");
  const [start,  setStart]  = useState("9:00 AM");
  const [end,    setEnd]    = useState("6:00 PM");
  const [ppl,    setPpl]    = useState(2);
  const [bud,    setBud]    = useState(800);
  const [cdays,  setCdays]  = useState(3);
  const [loading,setLoading]= useState(false);
  const [err,    setErr]    = useState("");
  const [step,   setStep]   = useState(""); // for progress feedback

  const isAround = planType?.key === "around";
  const isCustom = planType?.key === "custom";
  const numDays  = isCustom ? cdays : (planType?.days || 1);

  async function getGeo() {
    if (isAround) {
      setStep("Detecting your location…");
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 12000 })
      );
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, locationLabel: "Your Current Location" };
    }
    if (!loc.trim()) throw new Error("Please enter a location (e.g. Hyderabad, Goa, Chennai)");
    setStep("Finding location…");
    const r = await fetch(`${API}/api/geocode?q=${encodeURIComponent(loc)}`);
    const d = await r.json();
    if (!d.lat) throw new Error(`Location "${loc}" not found. Try adding city name (e.g. "Banjara Hills, Hyderabad").`);
    return { lat: d.lat, lng: d.lng, locationLabel: loc };
  }

  async function go(mode) {
    const startH = parseHour(start);
    const endH   = parseHour(end);
    if (endH <= startH) { setErr("End time must be after start time"); return; }
    setLoading(true); setErr(""); setStep("");
    try {
      const geo = await getGeo();
      if (mode === "pickout") {
        onPickOut({ ...geo, people: ppl, budget: bud, categories, startTime: start, endTime: end, planType, numDays, startH, endH });
        return;
      }
      setStep(`Searching places in ${geo.locationLabel}…`);
      const allPlaces = [];
      for (const cat of categories) {
        setStep(`Finding ${getCat(cat).label}…`);
        const places = await fetchWithRetry(geo.lat, geo.lng, cat);
        allPlaces.push(...places.slice(0, Math.max(8, numDays * 3)));
      }
      if (!allPlaces.length) throw new Error(`No places found around ${geo.locationLabel}. Try a different location or more categories.`);
      onGenerate({ ...geo, people: ppl, budget: bud, categories, startTime: start, endTime: end, startH, endH, planType, numDays, allPlaces });
    } catch (e) { setErr(e.message || "Something went wrong"); }
    finally { setLoading(false); setStep(""); }
  }

  return (
    <div className="page pg-loc">
      <div className="page-header container">
        <button className="pg-back" onClick={() => onNav("categories")}>← Back</button>
        <div>
          <h1>{isAround ? "Nearby Exploration" : "Set Your Location"}</h1>
          <p>{planType?.label} · {categories.length} {categories.length === 1 ? "category" : "categories"} selected</p>
        </div>
      </div>

      <div className="container loc-body">
        <div className="loc-form-card">
          {/* Location */}
          {!isAround ? (
            <div className="field">
              <label>📍 Location</label>
              <div className="loc-input-wrap">
                <input className="loc-input" placeholder="e.g. Hyderabad, Goa, Anna Nagar Chennai"
                  value={loc} onChange={e => setLoc(e.target.value)} onKeyDown={e => e.key === "Enter" && go("generate")} />
              </div>
            </div>
          ) : (
            <div className="gps-info-box">
              <span className="gps-icon">📡</span>
              <div>
                <strong>GPS Location</strong>
                <p>Your current location will be detected automatically</p>
              </div>
            </div>
          )}

          {/* Timing */}
          <div className="form-row">
            <div className="field">
              <label>⏰ Start Time</label>
              <select value={start} onChange={e => setStart(e.target.value)}>
                {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>⏰ End Time</label>
              <select value={end} onChange={e => setEnd(e.target.value)}>
                {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* People + Budget */}
          <div className="form-row">
            <div className="field">
              <label>👥 Number of People</label>
              <input type="number" min="1" max="20" value={ppl} onChange={e => setPpl(+e.target.value || 1)} />
            </div>
            <div className="field">
              <label>💰 Budget per person (₹)</label>
              <input type="number" min="100" step="50" value={bud} onChange={e => setBud(+e.target.value || 100)} />
            </div>
          </div>

          {/* Custom days */}
          {isCustom && (
            <div className="field">
              <label>📅 Number of Days</label>
              <input type="number" min="1" max="30" value={cdays} onChange={e => setCdays(Math.max(1, +e.target.value || 1))} />
            </div>
          )}

          {/* Category chips */}
          <div className="cat-chips-row">
            {categories.map(k => {
              const c = getCat(k);
              return <span key={k} className="cat-chip" style={{ "--cc": c.color, "--cbg": c.bg }}>{c.icon} {c.label}</span>;
            })}
          </div>

          {err && <div className="err-box">⚠️ {err}</div>}
          {loading && step && <div className="loading-step">⏳ {step}</div>}

          <div className="loc-actions">
            <button className="btn-primary btn-lg" onClick={() => go("generate")} disabled={loading}>
              {loading ? "Generating…" : "✨ Generate Plan"}
            </button>
            <button className="btn-outline btn-lg" onClick={() => go("pickout")} disabled={loading}>
              📋 Pick Out Manually
            </button>
          </div>
        </div>

        {/* Summary card */}
        <div className="loc-summary-card">
          <h3>Trip Summary</h3>
          <div className="ls-rows">
            <div className="ls-row"><span>Plan Type</span><strong>{planType?.label}</strong></div>
            <div className="ls-row"><span>Days</span><strong>{numDays}</strong></div>
            <div className="ls-row"><span>People</span><strong>{ppl}</strong></div>
            <div className="ls-row"><span>Total Budget</span><strong>₹{bud * ppl * numDays}</strong></div>
            <div className="ls-row"><span>Budget/Person/Day</span><strong>₹{bud}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: Day Plan ───────────────────────────────────────────────────────────
function PageDayPlan({ user, onNav, planData, savedPlans, onSavePlan, onPickOut }) {
  const { allPlaces, startH, endH, people, budget, locationLabel, planType, numDays, categories, lat, lng } = planData;

  const [days,    setDays]  = useState(() =>
    buildMultiDay({ places: allPlaces, numDays, startH, endH, budget, people })
  );
  const [activeDay, setActiveDay] = useState(0);
  const [pool,   setPool]  = useState([]);
  const [saved,  setSaved] = useState(false);

  const cur      = days[activeDay];
  const allFill  = days.flatMap(d => d.slots.filter(s => s.place));
  const totalCost = allFill.reduce((s, sl) => s + (sl.place?.budget || 0) * people, 0);
  const totalBudget = budget * people * numDays;

  function rm(di, si) {
    setDays(prev => prev.map((d, i) => i !== di ? d : {
      ...d, slots: d.slots.map((s, j) => {
        if (j !== si) return s;
        if (s.place) setPool(p => [...p, s.place]);
        return { ...s, place: null };
      })
    }));
  }
  function swap(di, si) {
    if (!pool.length) return;
    const [next, ...rest] = pool;
    setDays(prev => prev.map((d, i) => i !== di ? d : {
      ...d, slots: d.slots.map((s, j) => {
        if (j !== si) return s;
        if (s.place) setPool([s.place, ...rest]);
        else setPool(rest);
        return { ...s, place: next };
      })
    }));
  }
  function doSave() {
    onSavePlan({ id: Date.now(), title: `${planType?.label} — ${locationLabel}`, location: locationLabel, createdAt: new Date().toLocaleDateString("en-IN"), days, people, budget });
    setSaved(true);
  }
  const pct = totalBudget > 0 ? Math.min(100, (totalCost / totalBudget) * 100) : 0;
  const savingsColor = totalCost > totalBudget ? "#ef4444" : "#10b981";

  return (
    <div className="page pg-dayplan">
      <div className="dp-top container">
        <div className="dp-top-left">
          <button className="pg-back" onClick={() => onNav("location")}>← Back</button>
          <div>
            <h1>{planType?.label}</h1>
            <p>📍 {locationLabel} · 👥 {people} people · {numDays} day{numDays > 1 ? "s" : ""}</p>
          </div>
        </div>
        <button className="btn-outline" onClick={() => onPickOut({ lat, lng, locationLabel, people, budget, categories, planType, numDays })}>
          + Add Places
        </button>
      </div>

      <div className="container dp-body">
        {/* Left: plan */}
        <div className="dp-main">
          {numDays > 1 && (
            <div className="day-tabs">
              {days.map((_, i) => (
                <button key={i} className={`day-tab ${activeDay === i ? "day-tab--on" : ""}`}
                  onClick={() => setActiveDay(i)}>
                  Day {i + 1}
                </button>
              ))}
            </div>
          )}
          {cur && (
            <div className="day-label-bar">
              <span className="dlb-num">Day {activeDay + 1}</span>
              <span className="dlb-date">{cur.label}</span>
            </div>
          )}
          <div className="slots-list">
            {cur?.slots.map((sl, si) => (
              <div key={sl.id} className={`slot-card ${!sl.place ? "slot-card--empty" : ""}`}>
                <div className="sc-time">
                  {sl.isLunch && <span className="lunch-tag">🍽 Lunch</span>}
                  {sl.time}
                </div>
                {sl.place ? (
                  <div className="sc-body">
                    <div className="sc-img">
                      {sl.place.photo
                        ? <img src={sl.place.photo} alt={sl.place.name} onError={e => e.target.style.display="none"} />
                        : <div className="sc-no-img">{getCat(sl.place.category).icon}</div>
                      }
                    </div>
                    <div className="sc-info">
                      <span className="sc-cat">{getCat(sl.place.category).icon} {sl.place.category}</span>
                      <h4>{sl.place.name}</h4>
                      <p className="sc-loc">📍 {sl.place.location}</p>
                      {sl.place.rating > 0 && (
                        <p className="sc-rating">⭐ {sl.place.rating} <span>({sl.place.ratingCount} reviews)</span></p>
                      )}
                      <p className="sc-cost">₹{sl.place.budget * people} for {people} people</p>
                      {sl.place.mapsUrl && (
                        <a href={sl.place.mapsUrl} target="_blank" rel="noopener noreferrer" className="sc-maps">View on Maps →</a>
                      )}
                    </div>
                    <div className="sc-actions">
                      <button className="sca rm" onClick={() => rm(activeDay, si)} title="Remove">✕</button>
                      {pool.length > 0 && <button className="sca sw" onClick={() => swap(activeDay, si)} title="Swap">↻</button>}
                    </div>
                  </div>
                ) : (
                  <div className="sc-empty">
                    <span>No place assigned to this slot</span>
                    {pool.length > 0 && <button className="btn-outline btn-xs" onClick={() => swap(activeDay, si)}>+ Fill Slot</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: summary sidebar */}
        <div className="dp-sidebar">
          <div className="dp-summary-card">
            <h3>Trip Summary</h3>
            <div className="ds-rows">
              <div className="ds-row"><span>Places</span><strong>{allFill.length}</strong></div>
              <div className="ds-row"><span>Total Budget</span><strong>₹{totalBudget}</strong></div>
              <div className="ds-row"><span>Spending</span><strong>₹{totalCost}</strong></div>
              <div className="ds-row"><span>Remaining</span><strong style={{ color: savingsColor }}>₹{Math.max(0, totalBudget - totalCost)}</strong></div>
            </div>
            <div className="budget-bar-wrap">
              <div className="budget-bar-bg">
                <div className="budget-bar-fill" style={{ width: `${pct}%`, background: pct > 90 ? "#ef4444" : "#FF6B35" }} />
              </div>
              <p className="budget-pct">{pct.toFixed(0)}% of budget used</p>
            </div>
            {!saved ? (
              <button className="btn-save-full" onClick={doSave}>🗂 Add to My Plans</button>
            ) : (
              <div className="save-done-card">
                <p>✅ Plan saved!</p>
                <button onClick={() => onNav("savedplans")}>View My Plans →</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: Pick Out ───────────────────────────────────────────────────────────
function PagePickOut({ user, onNav, planData, savedPlans, onAddToDay }) {
  const { lat, lng, people, budget, categories } = planData;
  const [activeCat, setActiveCat] = useState(categories[0] || "Food");
  const [places,    setPlaces]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [added,     setAdded]     = useState({});

  const load = useCallback(async cat => {
    setLoading(true);
    setPlaces(await fetchWithRetry(lat, lng, cat));
    setLoading(false);
  }, [lat, lng]);

  useEffect(() => { load(activeCat); }, [activeCat, load]);

  function add(p) {
    setAdded(prev => ({ ...prev, [p.id]: true }));
    onAddToDay?.(p);
  }

  const filtered = places.filter(p => (p.budget || 0) * people <= budget * people);

  return (
    <div className="page pg-pickout">
      <div className="page-header container">
        <button className="pg-back" onClick={() => onNav("location")}>← Back</button>
        <div><h1>Pick Out Places</h1><p>Browse and add places to your plan</p></div>
      </div>

      <div className="po-tabs-wrap container">
        <div className="po-tabs">
          {categories.map(ck => {
            const c = getCat(ck);
            return (
              <button key={ck} className={`po-tab ${activeCat === ck ? "po-tab--on" : ""}`}
                style={{ "--cc": c.color }} onClick={() => setActiveCat(ck)}>
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="container po-body">
        {loading && <div className="po-skels">{[0,1,2,3,4,5].map(i => <div key={i} className="skel-card" />)}</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="es-icon">🔍</div>
            <h3>No places found</h3>
            <p>No places within your budget for this category. Try a different category or increase your budget.</p>
          </div>
        )}
        {!loading && (
          <div className="po-grid">
            {filtered.map(p => {
              const isAdded = added[p.id];
              return (
                <div key={p.id} className="po-card">
                  <div className="poc-img">
                    {p.photo
                      ? <img src={p.photo} alt={p.name} onError={e => e.target.style.display="none"} />
                      : <div className="poc-no-img">{getCat(p.category).icon}</div>
                    }
                    <div className="poc-badges">
                      {p.openNow && <span className="badge open-b">Open Now</span>}
                      <span className="badge budget-b">₹{p.budget}/pp</span>
                    </div>
                  </div>
                  <div className="poc-info">
                    <h3>{p.name}</h3>
                    <p className="poc-loc">📍 {p.location}</p>
                    {p.rating > 0 && <p className="poc-rat">⭐ {p.rating} <span>({p.ratingCount})</span></p>}
                    <p className="poc-cost">₹{p.budget * people} for {people} people</p>
                  </div>
                  <button className={`btn-add-card ${isAdded ? "added" : ""}`} onClick={() => add(p)} disabled={isAdded}>
                    {isAdded ? "✓ Added" : "+ Add to Plan"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {Object.keys(added).length > 0 && (
        <div className="po-fab-bar">
          <div className="container">
            <p>{Object.keys(added).length} place{Object.keys(added).length > 1 ? "s" : ""} added</p>
            <button className="btn-primary" onClick={() => onNav("dayplan")}>View Plan →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PAGE: Saved Plans ────────────────────────────────────────────────────────
function PageSavedPlans({ user, onNav, savedPlans, onDelete }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="page pg-saved">
      <div className="page-header container">
        <button className="pg-back" onClick={() => onNav("plans")}>← Back</button>
        <div><h1>My Saved Plans</h1><p>{savedPlans.length} plan{savedPlans.length !== 1 ? "s" : ""} saved</p></div>
      </div>
      <div className="container sp-body">
        {savedPlans.length === 0 && (
          <div className="empty-state">
            <div className="es-icon">🗺️</div>
            <h3>No saved plans yet</h3>
            <p>Generate a plan and click "Add to My Plans" to save it here.</p>
            <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => onNav("plans")}>Create a Plan</button>
          </div>
        )}
        <div className="sp-grid">
          {savedPlans.map(plan => (
            <div key={plan.id} className="sp-card">
              <div className="spc-header" onClick={() => setOpen(open === plan.id ? null : plan.id)}>
                <div className="spc-icon">🗺️</div>
                <div className="spc-meta">
                  <h3>{plan.title}</h3>
                  <p>📅 {plan.createdAt} · 👥 {plan.people} people · {plan.days.length} day{plan.days.length > 1 ? "s" : ""}</p>
                  <p className="spc-budget">Total: ₹{plan.days.flatMap(d=>d.slots.filter(s=>s.place)).reduce((s,sl)=>s+(sl.place.budget||0)*plan.people,0)}</p>
                </div>
                <div className="spc-ctrl">
                  <button className="del-btn" onClick={e=>{e.stopPropagation();onDelete(plan.id);}}>🗑</button>
                  <span className="expand-icon">{open===plan.id?"▲":"▼"}</span>
                </div>
              </div>
              {open === plan.id && (
                <div className="spc-body">
                  {plan.days.map((day, di) => (
                    <div key={di} className="spc-day">
                      <p className="spc-day-lbl">Day {di+1} — {day.label}</p>
                      {day.slots.filter(s=>s.place).map((sl,si) => (
                        <div key={si} className="spc-slot">
                          <span className="ss-time">{sl.time}</span>
                          <span className="ss-name">{sl.place.name}</span>
                          <span className="ss-cost">₹{(sl.place.budget||0)*plan.people}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page,       setPage]       = useState("welcome");
  const [user,       setUser]       = useState(null);
  const [planType,   setPlanType]   = useState(null);
  const [categories, setCategories] = useState([]);
  const [planData,   setPlanData]   = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);

  // Load saved plans when user changes — PER-USER storage
  useEffect(() => {
    if (user?.uid) {
      setSavedPlans(loadUserPlans(user.uid));
    } else {
      setSavedPlans([]);
    }
  }, [user?.uid]);

  // Save to per-user localStorage on change
  useEffect(() => {
    if (user?.uid) {
      saveUserPlans(user.uid, savedPlans);
    }
  }, [savedPlans, user?.uid]);

  function nav(p) { setPage(p); window.scrollTo(0, 0); }

  function login(u) {
    setUser(u);
    // Load this user's plans immediately
    setSavedPlans(loadUserPlans(u.uid));
    nav("plans");
  }

  async function logout() {
    await firebaseSignOut();
    setUser(null);
    setSavedPlans([]);
    setPlanData(null);
    nav("welcome");
  }

  function selectPlan(pt)  { setPlanType(pt); nav("categories"); }
  function confirmCats(cs) { setCategories(cs); nav("location"); }
  function generate(d)     { setPlanData(d); nav("dayplan"); }
  function pickOut(d)      { setPlanData(prev => ({ ...(prev || {}), ...d })); nav("pickout"); }
  function addToDay(p)     { setPlanData(prev => ({ ...prev, allPlaces: [...(prev?.allPlaces || []), p] })); }
  function savePlan(plan)  { setSavedPlans(prev => [plan, ...prev]); }
  function deletePlan(id)  { setSavedPlans(prev => prev.filter(p => p.id !== id)); }

  return (
    <div className="app-root">
      <Navbar user={user} savedCount={savedPlans.length} onNav={nav} onLogout={logout} />
      <main className="app-main">
        {page === "welcome"    && <PageWelcome onNav={nav} />}
        {page === "login"      && <PageLogin onNav={nav} onLogin={login} />}
        {page === "signup"     && <PageSignup onNav={nav} onLogin={login} />}
        {page === "plans"      && user && <PageSelectPlan user={user} onNav={nav} savedPlans={savedPlans} onSelectPlan={selectPlan} />}
        {page === "categories" && user && <PageCategories user={user} onNav={nav} planType={planType} onConfirm={confirmCats} />}
        {page === "location"   && user && <PageLocation user={user} onNav={nav} planType={planType} categories={categories} onGenerate={generate} onPickOut={pickOut} />}
        {page === "dayplan"    && user && planData && <PageDayPlan user={user} onNav={nav} planData={planData} savedPlans={savedPlans} onSavePlan={savePlan} onPickOut={pickOut} />}
        {page === "pickout"    && user && planData && <PagePickOut user={user} onNav={nav} planData={planData} savedPlans={savedPlans} onAddToDay={addToDay} />}
        {page === "savedplans" && user && <PageSavedPlans user={user} onNav={nav} savedPlans={savedPlans} onDelete={deletePlan} />}
        {!user && !["welcome","login","signup"].includes(page) && <PageWelcome onNav={nav} />}
      </main>
    </div>
  );
}
