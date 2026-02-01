// 1️⃣ Import packages
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const osmRoutes = require("./src/routes/osm");

const geocodeRoutes = require("./src/routes/geocode");
const googlePlacesRoutes = require("./src/routes/googlePlaces");


// 2️⃣ Import routes
const placeRoutes = require("./src/routes/places");

// 3️⃣ Initialize app
const app = express();



// 4️⃣ Middlewares
app.use(cors());
app.use(express.json());
app.use("/api/osm", osmRoutes);
// 5️⃣ Use routes
app.use("/api/places", placeRoutes);
app.use("/api/google", googlePlacesRoutes);
app.use("/api/geocode", geocodeRoutes);
// 6️⃣ Test route
app.get("/", (req, res) => {
  res.send("Local Explorer Backend is running 🚀");
});

// 7️⃣ Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// 8️⃣ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
console.log("GOOGLE KEY LOADED:", process.env.GOOGLE_PLACES_API_KEY ? "YES" : "NO");


