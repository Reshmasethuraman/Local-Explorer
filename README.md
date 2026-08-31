# Namma Ooru — Local Explorer

A budget-friendly local travel planner that helps you discover places nearby and build day-by-day plans around your interests, time, group size, and budget.

## Live Demo

🌐 **Frontend:** Deploying on Vercel

🔗 **Backend API:** https://local-explorer-api.onrender.com

## Features

- Discover nearby places by category
- Categories for pilgrimage, entertainment, food, movies, shopping, beaches, parks, and history/museums
- Progressive location search with Google Places and OpenStreetMap fallback
- Create 1-day, 2–3 day, 5-day, customized, and nearby-place plans
- Budget-aware recommendations
- Firebase Google sign-in
- Save plans per user in local storage
- Responsive interface for desktop and mobile

## Tech Stack

**Frontend**
- React 19
- Vite
- Firebase Authentication
- JavaScript / CSS

**Backend**
- Node.js
- Express 5
- MongoDB / Mongoose
- Axios
- Google Places API
- OpenStreetMap-based fallback

## Project Structure

```text
Local-Explorer/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── src/
└── frontend/
    └── frontend/
        ├── src/
        ├── public/
        ├── package.json
        └── vite.config.js
```

## Getting Started

### Backend

```bash
cd backend
npm install
npm start
```

The backend uses the `PORT` environment variable when provided and otherwise defaults to port `5000`.

Set the required MongoDB and Google Places credentials as environment variables. Never commit secrets to GitHub.

### Frontend

```bash
cd frontend/frontend
npm install
npm run dev
```

For production:

```bash
npm run build
```

The deployed frontend is configured to send the application's existing API requests to the Render backend at `https://local-explorer-api.onrender.com`.

## Deployment

### Backend — Render

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Live API: https://local-explorer-api.onrender.com

### Frontend — Vercel

- Root directory: `frontend/frontend`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

After the Vercel deployment is created, add the Vercel domain to Firebase Authentication → Authorized domains so Google sign-in works on the live site.

## Repository

https://github.com/Reshmasethuraman/Local-Explorer

## License

This project is provided for learning and personal project use.
