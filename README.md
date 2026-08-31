# Namma Ooru — Local Explorer

A budget-friendly local travel planner that helps you discover places nearby and build day-by-day plans around your interests, time, group size, and budget.

## Live Demo

🚀 **Deployment:** Pending deployment

> The project is a full-stack application with a React/Vite frontend and an Express/MongoDB backend. The repository currently needs a hosting setup for the backend and frontend before a reliable public URL can be added here.

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
- OpenStreetMap-based fallback routes

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

### 1. Clone the repository

```bash
git clone https://github.com/Reshmasethuraman/Local-Explorer.git
cd Local-Explorer
```

### 2. Configure the backend

Create `backend/.env` with the required server-side values, including your MongoDB connection string and Google Places API key.

Then install dependencies and start the API:

```bash
cd backend
npm install
npm start
```

The backend is configured to use `PORT` when provided and otherwise defaults to port `5000`.

### 3. Configure the frontend

Create/configure the frontend environment variables required by Firebase and the application, then run:

```bash
cd frontend/frontend
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## Important Deployment Notes

The frontend currently uses `http://localhost:5000` as its API base URL, so production deployment requires changing that value to the deployed backend URL.

The backend package currently declares `node index.js` in its `start` script while the server entry file in the repository is `server.js`. Before deploying the backend, update the start script to use `node server.js` (or add the corresponding `index.js`).

Do not commit real API keys, Firebase private credentials, or MongoDB passwords. Use environment variables in the hosting provider instead.

## Available Scripts

### Frontend

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

### Backend

```bash
npm start
npm run dev
```

## Repository

https://github.com/Reshmasethuraman/Local-Explorer

## License

This project is provided for learning and personal project use.
