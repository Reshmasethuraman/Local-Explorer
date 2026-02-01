import { useEffect, useState } from "react";

function App() {
  const [places, setPlaces] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/places")
      .then((res) => res.json())
      .then((data) => setPlaces(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Local Explorer</h1>

      {places.length === 0 ? (
        <p>No places found</p>
      ) : (
        places.map((place) => (
          <div
            key={place._id}
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            <h3>{place.name}</h3>
            <p>Category: {place.category}</p>
            <p>Budget: ₹{place.budget}</p>
            <p>
              Time: {place.openTime} - {place.closeTime}
            </p>
            <p>Location: {place.location}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default App;


