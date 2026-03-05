'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useEventStore from '@/store/useEventStore';
import Skeleton from '../components/Skeleton';

export default function DiscoverPage() {
  // Global State from Zustand
  const { events, fetchEvents, loading } = useEventStore();

  // UI States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [location, setLocation] = useState('');

  const { user } = useAuth();
  const router = useRouter();

  const categories = [
    'All',
    'Art',
    'Sports',
    'Food And Drink',
    'Education',
    'Festival',
    'Music',
    'Other',
  ];

  // 🔹 Fetch events once per session via the store
  useEffect(() => {
    fetchEvents(user?.uid);
  }, [user, fetchEvents]);

  // 🔹 Apply filters (Calculated automatically when dependencies change)
  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      result = result.filter((e) => searchRegex.test(e.event || ''));
    }

    if (category && category !== 'All') {
      result = result.filter(
        (e) => e.category?.toLowerCase() === category.toLowerCase()
      );
    }

    if (location.trim()) {
      const locRegex = new RegExp(location.trim(), 'i');
      result = result.filter((e) => locRegex.test(e.location || ''));
    }

    return result;
  }, [search, category, location, events]);

  // 🔹 Handle click on event and record preference signal
  const handleEventClick = async (event) => {
    router.push(`/event/${event.eventId}`);

    if (user?.uid && event.category) {
      try {
        fetch('/api/preferences/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebase_uid: user.uid,
            category: event.category,
          }),
        }).catch(() => { });
      } catch {
        // Intentionally ignore errors
      }
    }
  };

  return (
    <main className="min-h-screen px-6 py-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          Discover Events
        </h1>
        <p className="text-lg text-white/70 mt-2">
          Find and attend events that interest you
        </p>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-md mb-8 border border-white/10 ">
        <h2 className="text-xl font-semibold mb-6 text-white">
          Filter Events
        </h2>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {/* Search */}
          <div>
            <label className="label font-semibold">Search by Event</label>
            <input
              type="text"
              placeholder="e.g., Music Concert"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>

          {/* Category */}
          <div>
            <label className="label font-semibold">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="select"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-gray-900 text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="label font-semibold">Location</label>
            <input
              type="text"
              placeholder="e.g., Punjab"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input"
            />
            
          </div>
        </div>
        <button
              onClick={() => {
                setSearch('');
                setCategory('All');
                setLocation('');
              }}
              className="btn-sm mt-3"
            >
              Clear Filters
            </button>
        </div>

        {/* Clear Filters */}

      </div>

      {/* Event Grid */}
      <div className="max-w-7xl mx-auto bg-white/10 backdrop-blur-md p-10 rounded-lg border border-white/10">
        {loading && events.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md rounded-lg shadow h-64 overflow-hidden border border-white/10"
              >
                <Skeleton className="h-40 w-full rounded-none border-0" />
                <div className="p-4">
                  <Skeleton variant="text" className="w-3/4 mb-3" />
                  <Skeleton variant="text" className="w-1/2 mb-2" />
                  <Skeleton variant="text" className="w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 && (search.trim() || category !== 'All' || location.trim()) ? (
          <p className="text-center text-white/60 text-lg">
            No events match your filters.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const eb = event.earlyBird;
              const now = new Date();
              const isTimeValid =
                eb?.enabled && eb.endDate && now <= new Date(eb.endDate);
              const isQuotaValid =
                eb?.enabled &&
                typeof eb.maxTickets === 'number' &&
                (eb.soldCount ?? 0) < eb.maxTickets;

              const earlyBirdActive =
                eb?.enabled && (isTimeValid || isQuotaValid);

              return (
                <div
                  key={event._id}
                  className="bg-white/10 backdrop-blur-md rounded-lg shadow hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="h-40 bg-gradient-to-br from-purple-500/20 to-gray-900/10 flex items-center justify-center">
                    {event.image ? (
                      <img
                        src={event.image}
                        alt={event.event}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white/50 text-lg">No Image</span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-xl font-bold text-white truncate">
                      {event.event}
                    </h3>
                    <p className="text-white/70">
                      <strong>Date:</strong>{' '}
                      {new Date(event.date).toLocaleDateString()}
                    </p>
                    <p className="text-white/70">
                      <strong>Location:</strong> {event.location}
                    </p>

                    {earlyBirdActive ? (
                      <p className="text-green-600 font-semibold">
                        Early Bird Price: Rs {event.earlyBird.discountPrice}
                        <span className="line-through text-white/40 ml-2 text-sm">
                          Rs {event.price}
                        </span>
                      </p>
                    ) : (
                      <p className="text-white font-semibold">
                        Price: Rs {event.price}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}