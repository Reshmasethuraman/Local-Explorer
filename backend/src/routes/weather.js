const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: "lat and lng required" });
    }

    // Use OpenWeather (free tier)
    const API_KEY = process.env.OPENWEATHER_API_KEY;
    
    if (!API_KEY) {
      // Return mock data if no API key
      return res.json({
        temp: 28,
        condition: "Clear",
        description: "clear sky",
        icon: "01d",
        humidity: 65,
        windSpeed: 15
      });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          lat,
          lon: lng,
          appid: API_KEY,
          units: "metric"
        }
      }
    );

    const data = response.data;

    res.json({
      temp: Math.round(data.main.temp),
      condition: data.weather[0].main,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      feelsLike: Math.round(data.main.feels_like)
    });

  } catch (error) {
    console.error("Weather API error:", error.message);
    
    // Return fallback data
    res.json({
      temp: 28,
      condition: "Clear",
      description: "weather data unavailable",
      icon: "01d"
    });
  }
});

module.exports = router;