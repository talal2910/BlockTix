'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useEventStore from '@/store/useEventStore';
import Skeleton from '../components/Skeleton';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function DiscoverPage() {
  const { events, fetchEvents, loading } = useEventStore();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [location, setLocation] = useState('');
  const [wishlist, setWishlist] = useState([]);

  const { user } = useAuth();
  const router = useRouter();

  const categories = [
    'All', 'Art', 'Sports', 'Food And Drink',
    'Education', 'Festival', 'Music', 'Other',
  ];

  useEffect(() => {
    fetchEvents(user?.uid);
  }, [user, fetchEvents]);

  // Fetch wishlist
  useEffect(() => {
    if (!user?.uid) return;
    fetch(`/api/wishlist?firebase_uid=${user.uid}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setWishlist(data.savedEvents.map(e => e.eventId));
      })
      .catch(() => {});
  }, [user?.uid]);

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

  const handleEventClick = async (event) => {
    router.push(`/event/${event.eventId}`);

    if (user?.uid && event.category) {
      fetch('/api/preferences/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebase_uid: user.uid, category: event.category }),
      }).catch(() => {});
    }
  };

  async function handleToggleWishlist(e, eventId) {
    e.stopPropagation();
    if (!user) { toast.error('Login to save events'); return; }
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebase_uid: user.uid, event_id: eventId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Something went wrong'); return; }
      setWishlist(prev =>
        data.saved ? [...prev, eventId] : prev.filter(id => id !== eventId)
      );
      toast.success(data.saved ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 bg-white/10 backdrop-blur-sm">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white">Discover Events</h1>
        <p className="text-lg text-white/70 mt-2">Find and attend events that interest you</p>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-md mb-8 border border-white/10">
        <h2 className="text-xl font-semibold mb-6 text-white">Filter Events</h2>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
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
            <div>
              <label className="label font-semibold">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="select"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-gray-900 text-white">{cat}</option>
                ))}
              </select>
            </div>
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
            onClick={() => { setSearch(''); setCategory('All'); setLocation(''); }}
            className="btn-sm mt-3"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Event Grid */}
      <div className="max-w-7xl mx-auto bg-white/10 backdrop-blur-md p-10 rounded-lg border border-white/10">
        {loading && events.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-md rounded-lg shadow h-64 overflow-hidden border border-white/10">
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
          <p className="text-center text-white/60 text-lg">No events match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const eb = event.earlyBird;
              const now = new Date();
              const isTimeValid = eb?.enabled && eb.endDate && now <= new Date(eb.endDate);
              const isQuotaValid = eb?.enabled && typeof eb.maxTickets === 'number' && (eb.soldCount ?? 0) < eb.maxTickets;
              const earlyBirdActive = eb?.enabled && (isTimeValid || isQuotaValid);

              return (
                <div
                  key={event._id}
                  className="bg-white/10 backdrop-blur-md rounded-lg shadow hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  {/* Image + Heart */}
                  <div className="h-40 bg-gradient-to-br from-[#FFA500]/20 to-gray-900/10 flex items-center justify-center relative">
                    {event.image ? (
                      <img src={event.image} alt={event.event} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/50 text-lg">No Image</span>
                    )}

                    {user && (
                      <button
                        onClick={(e) => handleToggleWishlist(e, event.eventId)}
                        className="absolute top-2 right-2 rounded-full bg-black/40 w-8 h-8 flex items-center justify-center backdrop-blur-md hover:bg-black/60 transition"
                        title={wishlist.includes(event.eventId) ? 'Remove from wishlist' : 'Save to wishlist'}
                      >
                        {wishlist.includes(event.eventId)
                          ? <FaHeart className="text-red-400 text-xs" />
                          : <FaRegHeart className="text-white text-xs" />
                        }
                      </button>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-white truncate">{event.event}</h3>
                    <p className="text-white/70">
                      <strong>Date:</strong> {new Date(event.date).toLocaleDateString()}
                    </p>
                    <p className="text-white/70">
                      <strong>Location:</strong> {event.location}
                    </p>
                    {earlyBirdActive ? (
                      <p className="text-green-600 font-semibold">
                        Early Bird Price: Rs {event.earlyBird.discountPrice}
                        <span className="line-through text-white/40 ml-2 text-sm">Rs {event.price}</span>
                      </p>
                    ) : (
                      <p className="text-white font-semibold">Price: Rs {event.price}</p>
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