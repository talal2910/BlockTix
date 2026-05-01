"use client";

import { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Resize map on mount
function ResizeOnMount() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 150);
  }, []);
  return null;
}

// Fly to marker position smoothly
function FlyToLocation({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 15);
  }, [coords]);
  return null;
}

export default function LocationPicker({ setCoordinates }) {
  const [markerPos, setMarkerPos] = useState([24.8607, 67.0011]); // default Karachi
  const [flyPos, setFlyPos] = useState(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const mapRef = useRef(null);

  const updatePosition = (lat, lng) => {
    const coords = [lat, lng];
    setMarkerPos(coords);
    setFlyPos(coords);
    setCoordinates?.({ lat, lng });
  };

  // Fetch suggestions from Nominatim (Pakistan only)
  useEffect(() => {
    if (!search) return setSuggestions([]);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${search}&addressdetails=1&limit=10&countrycodes=pk`
        );
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error("Error fetching location suggestions:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Handle selecting a suggestion: move marker & clear field
  const handleSelectSuggestion = (item) => {
    updatePosition(parseFloat(item.lat), parseFloat(item.lon));
    setSearch(""); // clear input
    setSuggestions([]); // clear dropdown
  };

  // Use current location
  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updatePosition(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Unable to fetch your location.");
      }
    );
  };

  return (
    <div className="w-full space-y-3">
      {/* SEARCH BAR */}
      <div className="relative w-full">
        <div className="flex gap-2 items-center">
          {/* Input field wrapper */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search location in Pakistan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border p-2 pr-10 rounded-lg bg-white/10 text-white relative z-[9999] placeholder-white/60"
            />

            {/* Cross Clear Button */}
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setSuggestions([]);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600/60 hover:bg-gray-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm z-[9999]"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* My Location Button */}
          <button
            type="button"
            onClick={useMyLocation}
            className="px-4 py-2 bg-green-600 text-white rounded-lg z-[999] ml-12"
          >
            My Location
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <ul className="absolute top-full left-0 w-full bg-gray-900 border border-white/20 rounded-lg max-h-60 overflow-auto mt-1 shadow-lg z-[9999]">
            {suggestions.map((item) => (
              <li
                key={item.place_id}
                className="p-2 hover:bg-white/10 cursor-pointer text-white text-sm"
                onClick={() => handleSelectSuggestion(item)}
              >
                {item.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* MAP */}
      <MapContainer
        center={[24.8607, 67.0011]}
        zoom={13}
        className="w-full h-[300px] md:h-[400px] lg:h-[500px] rounded-xl"
      >
        <ResizeOnMount />
        <FlyToLocation coords={flyPos} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Marker
          draggable
          position={markerPos}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              updatePosition(lat, lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}