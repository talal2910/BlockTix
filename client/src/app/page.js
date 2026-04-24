'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import ChatbotRag from './components/Ragchatbot';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [trendingEvents, setTrendingEvents] = useState([]);       
  const [trendingCategories, setTrendingCategories] = useState([]); 
  const [filteredSearchResults, setFilteredSearchResults] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => { setShow(true); }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const query = user?.uid ? `?firebase_uid=${user.uid}` : '';
        const res  = await fetch(`/api/recommendations${query}`);
        const data = await res.json();

        if (data.success) {
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          const futureEvents = data.events
            .filter(e => new Date(e.date) >= now)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          setEvents(data.events);
          setUpcomingEvents(futureEvents);

          const trending = data.trendingCategories || [];
          setTrendingCategories(trending);
          if (trending.length > 0) {
            const trendSet = new Set(trending.slice(0, 3));
            const trendEvts = futureEvents
              .filter(e => trendSet.has(e.category))
              .slice(0, 4);
            setTrendingEvents(trendEvts);
          }
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [user]);

  useEffect(() => {
    if (!searchInput.trim()) { setFilteredSearchResults([]); return; }
    const lowerSearch = searchInput.toLowerCase();
    setFilteredSearchResults(events.filter(e => e.event.toLowerCase().includes(lowerSearch)));
  }, [searchInput, events]);

  const handleClick = () => {
    if (!user) {
      toast.error('Login as an Organizer to create an event', { duration: 4000 });
      router.push('/login');
      return;
    }
    if (user.role !== 'organizer') {
      toast.error('Only organizers can create events', { duration: 4000 });
      return;
    }
    router.push('/dashboard/organizer');
  };

  // Reusable event banner card
  const EventBanner = ({ event }) => (
    <div
      key={event._id}
      onClick={() => router.push(`/event/${event.eventId}`)}
      className="group relative flex flex-col md:flex-row h-auto md:h-56 w-full bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer"
    >
      <div className="w-full md:w-2/5 h-48 md:h-full relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10"></div>
        {event.image ? (
          <img src={event.image} alt={event.event} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-white/60">No Image</span>
          </div>
        )}
        <div className="absolute top-3 left-3 z-20 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm text-center min-w-[3rem] border border-white/10">
          <span className="block text-xs font-bold text-white/60 uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
          <span className="block text-xl font-bold text-[#FFA500]">{new Date(event.date).getDate()}</span>
        </div>
      </div>
      <div className="w-full md:w-3/5 p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white truncate mb-2 group-hover:text-[#FFA500] transition-colors">{event.event}</h3>
          <div className="flex items-center text-white/70 mb-2">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            <p className="text-sm truncate">{event.location}</p>
          </div>
          {/* Trending badge */}
          {event.isTrending && (
            <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30 mb-1">
            Trending
            </span>
          )}
        </div>
        <div className="flex flex-row justify-between">
          <div className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-full border border-white/10">{event.time}</div>
          <span className="text-[#FFA500] font-medium text-sm group-hover:translate-x-1 transition-transform pr-16">Get Tickets</span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* HERO */}
      <div className="flex flex-col items-center justify-center min-h-screen shadow-xl relative overflow-hidden">
        <h1 className="text-4xl sm:text-6xl font-bold m-0 w-full sm:w-3/4 px-4 text-center z-10">
          Discover and attend events with{' '}
          <span className={`text-[#FFA500] inline-block transition-all duration-700 ease-out ${show ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
            blockchain security
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-white/70 w-full sm:w-1/2 px-6 text-center mt-6 z-10">
          Find and purchase tickets for the best events near you, secured by blockchain technology to prevent fraud and ensure authenticity.
        </p>

        <div className="relative mt-8 w-auto flex justify-center z-20">
          <div className="relative sm:w-96 w-3/4 group">
            <input
              type="text"
              placeholder="Search for events..."
              className="w-full bg-white/10 border border-white/20 backdrop-blur-md text-white placeholder-white/60 rounded-full pl-6 pr-12 py-3 shadow-lg focus:outline-none focus:bg-white/15 focus:border-[#FFA500]/50 focus:ring-2 focus:ring-[#FFA500]/20 transition-all duration-300"
              onChange={e => setSearchInput(e.target.value)}
              value={searchInput}
            />
            {searchInput && (
              <div className="absolute w-full mt-3 rounded-2xl max-h-72 overflow-y-auto bg-gray-900/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/10 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-400/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500/50">
                {filteredSearchResults.length > 0 ? (
                  filteredSearchResults.map(event => (
                    <div key={event._id} className="group flex justify-between items-center px-4 py-3 mb-1 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer border border-transparent hover:border-white/10" onClick={() => router.push(`/event/${event.eventId}`)}>
                      <div className="flex flex-col">
                        <span className="font-semibold text-white group-hover:text-[#FFA500] transition-colors">{event.event}</span>
                        <div className="flex items-center text-xs text-white/60 mt-0.5">
                          <svg className="w-3 h-3 mr-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          <span className="truncate max-w-[150px]">{event.location}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#FFA500] bg-white/50 px-2 py-1 rounded-md shadow-sm border border-white/50 group-hover:bg-[#FFA500] group-hover:text-white transition-colors">
                        {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center"><p className="text-white/60 font-medium">No events found</p></div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 z-10">
          <button className="bg-[#FFA500] text-white py-2 px-6 rounded-md cursor-pointer border-none shadow-md hover:bg-[#FFA500] transition-colors" onClick={() => router.push('/discover')}>
            Explore
          </button>
          <button className="bg-[#FFA500] text-white py-2 px-6 rounded-md m-2 cursor-pointer border-none shadow-md hover:bg-[#FFA500] transition-colors" onClick={handleClick}>
            Create Event
          </button>
        </div>
      </div>

      {trendingEvents.length > 0 && (
        <div className="flex flex-col min-h-auto p-8 shadow-xl m-0">
          <div className="flex flex-row justify-between items-end mb-6">
            <div>
              <h2 className="text-4xl font-bold m-0 text-white flex items-center gap-3">
                🔥 Trending Now
              </h2>
              <p className="text-white/70 ml-1 mt-2 text-lg">
                Most popular events this week
                {trendingCategories.length > 0 && (
                  <span className="ml-2 text-[#FFA500] text-sm">
                    · {trendingCategories.slice(0, 3).join(', ')}
                  </span>
                )}
              </p>
            </div>
            <button className="text-[#FFA500] font-semibold hover:underline cursor-pointer bg-transparent border-none text-lg flex items-center" onClick={() => router.push('/discover')}>
              View All &rarr;
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 m-4 justify-center">
            {loading ? (
              <p className="text-white/60 text-lg col-span-full text-center">Loading...</p>
            ) : (
              trendingEvents.map(event => <EventBanner key={event._id} event={event} />)
            )}
          </div>
        </div>
      )}

      {/* UPCOMING EVENTS */}
      <div className="flex flex-col min-h-screen p-8 shadow-xl m-0">
        <h2 className="text-4xl font-bold m-0 text-white">Upcoming Events</h2>
        <div className="flex flex-row justify-between items-end mb-6">
          <p className="text-white/70 ml-1 mt-2 text-lg">Discover the hottest events happening soon</p>
          <button className="text-[#FFA500] font-semibold hover:underline cursor-pointer bg-transparent border-none text-lg flex items-center" onClick={() => router.push('/discover')}>
            View All &rarr;
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 m-4 justify-center">
          {loading ? (
            <p className="text-white/60 text-lg col-span-full text-center">Loading events...</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-white/60 text-lg col-span-full text-center">No upcoming events available</p>
          ) : (
            upcomingEvents.slice(0, 4).map(event => <EventBanner key={event._id} event={event} />)
          )}
        </div>
      </div>

      <ChatbotRag user={user} />
    </div>
  );
}