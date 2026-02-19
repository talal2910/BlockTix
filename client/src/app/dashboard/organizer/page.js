'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute'; 
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast'; 
import dynamic from "next/dynamic";

// ICONS
const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>);
const EventIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>);
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const DollarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const LogOutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>);


 const LocationPicker = dynamic(
  () => import("@/app/components/LocationPicker"),
  { ssr: false }
);


function OrganizerDashboard() {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const [coordinates, setCoordinates] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [organizerEvents, setOrganizerEvents] = useState([]);
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, totalTicketsSold: 0, totalEvents: 0 });

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    event: '', date: '', time: '', location: '', category: '',
    price: 0, totalTickets: 0, image: '',
    ebEnabled: false, ebPrice: 0, ebEndDate: '', ebMaxTickets: 0
  });

  // --- STYLING CONSTANTS ---
  const glassContainer = "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden";
  const glassSidebar = "bg-white/5 backdrop-blur-lg border-r border-white/10";
  const glassContent = "bg-transparent";
  const glassCard = "bg-white/40 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl";
  const glassInput = "w-full p-3 bg-white/20 border border-white/30 rounded-xl focus:ring-2 focus:ring-indigo-400/70 focus:bg-white/40 outline-none transition text-gray-800 placeholder-gray-500";
  const glassSelect = "w-full p-3 bg-white/20 border border-white/30 rounded-xl focus:ring-2 focus:ring-indigo-400/70 focus:bg-white/40 outline-none transition text-gray-800";
  const glassButton = "px-4 py-2 bg-white/30 hover:bg-white/50 border border-white/40 rounded-xl transition text-gray-800 font-medium backdrop-blur-sm shadow-sm";
  const primaryButton = "px-6 py-2.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/30 transition font-medium backdrop-blur-sm";

  // --- FETCH DATA ---
  useEffect(() => {
    if (!authUser?.uid) return;
    fetchAndProcessEvents();
  }, [authUser]);

  const fetchAndProcessEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events`);
      const data = await res.json();
      
      if (data.success && Array.isArray(data.events)) {
        // Filter events created by this user
        const myEvents = data.events.filter(ev => ev.organizerId === authUser.uid);
        setOrganizerEvents(myEvents);
        calculateAnalytics(myEvents);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (events) => {
    let revenue = 0;
    let sold = 0;
    events.forEach(ev => {
        // Simple logic: (Total - Remaining) * Price
        const ticketsSold = ev.totalTickets - ev.remainingTickets;
        sold += ticketsSold;
        revenue += (ticketsSold * ev.price);
    });
    setAnalytics({
        totalRevenue: revenue,
        totalTicketsSold: sold,
        totalEvents: events.length
    });
  };

  // --- ACTIONS ---

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!authUser?.uid) return toast.error("Not authenticated");
    if (!coordinates) {
      return toast.error("Please select location on map");
    }


    try {
      const payload = {
        event: formData.event,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        category: formData.category,
        price: Number(formData.price),
        totalTickets: Number(formData.totalTickets),
        image: formData.image,
        organizerId: authUser.uid,
        earlyBird: formData.ebEnabled ? {
            enabled: true,
            discountPrice: Number(formData.ebPrice),
            endDate: formData.ebEndDate || null,
            maxTickets: Number(formData.ebMaxTickets) || null,
            soldCount: 0
        } : { enabled: false }
      };

      const res = await fetch('/api/organizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();

      if (res.ok) {
        toast.success("Event created successfully!");
        setFormData({ // Reset Form
            event: '', date: '', time: '', location: '', category: '',
            price: 0, totalTickets: 0, image: '',
            ebEnabled: false, ebPrice: 0, ebEndDate: '', ebMaxTickets: 0
        });
        await fetchAndProcessEvents(); // Refresh data
        setActiveTab('events'); // Go to list view
      } else {
        toast.error(data.message || "Failed to create event");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleDeleteEvent = async (id) => {
      if(!confirm("Are you sure you want to delete this event?")) return;
      try {
          const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
          if(res.ok) {
              toast.success("Event deleted");
              const updated = organizerEvents.filter(e => e._id !== id);
              setOrganizerEvents(updated);
              calculateAnalytics(updated);
          } else {
              toast.error("Delete failed");
          }
      } catch(err) {
          toast.error("Error deleting event");
      }
  }

  // --- RENDER ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br bg-white/10 backdrop-blur-sm">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-indigo-600 font-medium">Loading Dashboard...</p>
        </div>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={['organizer', 'admin']}>
      <div className="min-h-screen relative p-4 md:p-8 font-sans overflow-hidden bg-white/10 backdrop-blur-sm">
         {/* Background Blobs */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/30 blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/30 blur-[100px]"></div>
            <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-blue-300/20 blur-[80px]"></div>
         </div>

        <div className={`max-w-7xl mx-auto relative z-10 ${glassContainer} flex flex-col md:flex-row min-h-[850px]`}>
          
          {/* SIDEBAR NAVIGATION */}
          <aside className={`w-full md:w-72 flex-shrink-0 flex flex-col justify-between p-6 ${glassSidebar}`}>
            <div>
               <div className="mb-8 pl-2">
                 <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                   Organizer
                 </h2>
                 <p className="text-xs text-gray-500 font-medium tracking-wider uppercase mt-1">Dashboard</p>
               </div>

               <nav className="space-y-3">
                 <button 
                    onClick={() => setActiveTab('dashboard')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 outline-none focus:outline-none ${activeTab === 'dashboard' ? 'bg-white/60 text-indigo-700 shadow-md border border-white/60 backdrop-blur-md font-bold' : 'text-gray-600 font-medium hover:bg-white/30 hover:text-indigo-600 border border-transparent hover:shadow-sm'}`}
                 >
                    <DashboardIcon /> Overview
                 </button>
                 <button 
                    onClick={() => setActiveTab('events')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 outline-none focus:outline-none ${activeTab === 'events' ? 'bg-white/60 text-indigo-700 shadow-md border border-white/60 backdrop-blur-md font-bold' : 'text-gray-600 font-medium hover:bg-white/30 hover:text-indigo-600 border border-transparent hover:shadow-sm'}`}
                 >
                    <EventIcon /> My Events
                 </button>
                 <button 
                    onClick={() => setActiveTab('create')} 
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 outline-none focus:outline-none ${activeTab === 'create' ? 'bg-white/60 text-indigo-700 shadow-md border border-white/60 backdrop-blur-md font-bold' : 'text-gray-600 font-medium hover:bg-white/30 hover:text-indigo-600 border border-transparent hover:shadow-sm'}`}
                 >
                    <PlusIcon /> Create Event
                 </button>
               </nav>
            </div>
            
            <button 
                onClick={async () => { await logout(); router.push('/login'); }} 
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/20 hover:bg-white/50 border border-white/30 hover:border-white/60 text-gray-700 hover:text-indigo-700 transition-all text-sm font-bold shadow-sm outline-none focus:outline-none"
            >
                <LogOutIcon /> Sign Out
            </button>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className={`flex-1 p-6 md:p-10 ${glassContent} overflow-y-auto`}>
            
            {/* --- TAB 1: DASHBOARD ANALYTICS --- */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Performance Overview</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Revenue */}
                    <div className={`${glassCard} p-6 relative overflow-hidden group`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110">
                            <DollarIcon />
                        </div>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Total Revenue</p>
                        <h3 className="text-3xl font-bold text-indigo-700">${analytics.totalRevenue.toLocaleString()}</h3>
                    </div>

                    {/* Tickets Sold */}
                    <div className={`${glassCard} p-6 relative overflow-hidden group`}>
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110">
                            <UsersIcon />
                        </div>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Tickets Sold</p>
                        <h3 className="text-3xl font-bold text-purple-700">{analytics.totalTicketsSold}</h3>
                    </div>

                    {/* Active Events */}
                    <div className={`${glassCard} p-6 relative overflow-hidden group`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110">
                            <EventIcon />
                        </div>
                        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Active Events</p>
                        <h3 className="text-3xl font-bold text-blue-700">{organizerEvents.length}</h3>
                    </div>
                </div>

                {/* Recent List */}
                <div className={`${glassCard} p-6`}>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Events</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase border-b border-gray-200/50">
                                    <th className="pb-3 pl-2">Event</th>
                                    <th className="pb-3">Date</th>
                                    <th className="pb-3">Sales</th>
                                    <th className="pb-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {organizerEvents.slice(0, 5).map((ev) => (
                                    <tr key={ev._id} className="border-b border-gray-100/30 hover:bg-white/20 transition">
                                        <td className="py-3 pl-2 font-medium text-gray-800">{ev.event}</td>
                                        <td className="py-3 text-gray-500">{new Date(ev.date).toLocaleDateString()}</td>
                                        <td className="py-3 font-bold text-indigo-600">{ev.totalTickets - ev.remainingTickets}</td>
                                        <td className="py-3">
                                            {ev.remainingTickets === 0 ? 
                                                <span className="text-red-600 text-xs font-bold bg-red-100 px-2 py-1 rounded">Sold Out</span> : 
                                                <span className="text-green-600 text-xs font-bold bg-green-100 px-2 py-1 rounded">Active</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {organizerEvents.length === 0 && <p className="text-center text-gray-500 py-4">No events created yet.</p>}
                    </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: MY EVENTS LIST --- */}
            {activeTab === 'events' && (
              <div className="space-y-6 animate-fade-in">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">My Events</h2>
                    <button onClick={() => setActiveTab('create')} className={primaryButton}>+ Create New</button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {organizerEvents.map((ev) => (
                        <div key={ev._id} className={`${glassCard} p-5 flex flex-col md:flex-row items-center justify-between gap-4 group hover:border-indigo-300/50 transition`}>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="h-16 w-16 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0 shadow-sm">
                                    {ev.image ? <img src={ev.image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-indigo-100 flex items-center justify-center text-indigo-400"><EventIcon/></div>}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-lg">{ev.event}</h4>
                                    <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                        <span>{new Date(ev.date).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span>{ev.time}</span>
                                        <span>•</span>
                                        <span className="font-semibold text-indigo-600">${ev.price}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right mr-4">
                                    <div className="text-xs text-gray-500 uppercase">Stock</div>
                                    <div className="font-bold text-gray-700">{ev.remainingTickets} / {ev.totalTickets}</div>
                                </div>
                                <button onClick={() => handleDeleteEvent(ev._id)} className="p-2 bg-red-100/50 hover:bg-red-200/80 text-red-600 rounded-xl transition border border-red-200 outline-none focus:outline-none">
                                    <TrashIcon />
                                </button>
                            </div>
                        </div>
                    ))}
                    {organizerEvents.length === 0 && <div className="text-center py-10 text-gray-500">You have not created any events yet.</div>}
                  </div>
              </div>
            )}

            {/* --- TAB 3: CREATE EVENT FORM --- */}
            {activeTab === 'create' && (
              <div className="animate-fade-in max-w-4xl mx-auto">
                <div className={`${glassCard} p-8`}>
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Event</h2>
                    <form onSubmit={handleCreateSubmit} className="space-y-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Event Name</label>
                                <input required type="text" className={`${glassInput} w-full`} placeholder="Event Name" 
                                    value={formData.event} onChange={e => setFormData({...formData, event: e.target.value})} />
                            </div>
                            
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Category</label>
                                <select className={`${glassSelect} w-full`} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required>
                                    <option value="">Select Category</option>
                                    {["Art", "Sports", "Food And Drink", "Education", "Festival", "Music", "Other"].map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* LOCATION & MAP - FIXED ALIGNMENT */}
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                  Location Address
                                </label>
                                <input
                                  required
                                  type="text"
                                  className={`${glassInput} w-full`}
                                  placeholder="Enter physical address"
                                  value={formData.location}
                                  onChange={e =>
                                    setFormData({ ...formData, location: e.target.value })
                                  }
                                />
                                
                                <div className="mt-5 bg-white/30 p-4 md:p-6 rounded-2xl border border-white/50 shadow-sm backdrop-blur-md">
                                  <label className="block text-xs font-bold text-gray-600 uppercase mb-4 text-center">
                                    Pinpoint Location on Map
                                  </label>
                                  <div className="w-full flex justify-center items-center rounded-xl overflow-hidden shadow-inner bg-gray-100/50 min-h-[300px]">
                                    <LocationPicker setCoordinates={setCoordinates} />
                                  </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div  className='p-2'>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
                                <input required type="date" className={`${glassInput} w-full`}
                                    value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                            </div>
                            <div  className='p-2'>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Time</label>
                                <input required type="time" className={`${glassInput} w-full`}
                                    value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-white/20 rounded-2xl border border-white/40 shadow-sm">
                             <div  className='p-2'>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Price ($)</label>
                                <input required type="number" min="0" className={`${glassInput} w-full`}
                                    value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                            </div>
                            <div  className='p-2'>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Total Tickets</label>
                                <input required type="number" min="1" className={`${glassInput} w-full`}
                                    value={formData.totalTickets} onChange={e => setFormData({...formData, totalTickets: e.target.value})} />
                            </div>
                            <div className='p-2'> 
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Image URL</label>
                                <input type="text" className={`${glassInput} w-full`} placeholder="https://..."
                                    value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} />
                            </div>
                        </div>

                        {/* Early Bird Section */}
                        <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100/60 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <input type="checkbox" id="ebCheck" className="w-5 h-5 accent-indigo-600 cursor-pointer" 
                                    checked={formData.ebEnabled} onChange={e => setFormData({...formData, ebEnabled: e.target.checked})} />
                                <label htmlFor="ebCheck" className="font-bold text-gray-800 cursor-pointer select-none">Enable Early Bird Discount</label>
                            </div>

                            {formData.ebEnabled && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in mt-4">
                                    <div  className='p-2'>
                                        <label className="block text-xs font-bold text-indigo-800/70 mb-2 uppercase">Discount Price</label>
                                        <input type="number" min="0" className={`${glassInput} w-full`} 
                                            value={formData.ebPrice} onChange={e => setFormData({...formData, ebPrice: e.target.value})} />
                                    </div>
                                    <div className='p-2'>
                                        <label className="block text-xs font-bold text-indigo-800/70 mb-2 uppercase">End Date</label>
                                        <input type="date" className={`${glassInput} w-full`} 
                                            value={formData.ebEndDate} onChange={e => setFormData({...formData, ebEndDate: e.target.value})} />
                                    </div>
                                    <div className='p-2'>
                                        <label className="block text-xs font-bold text-indigo-800/70 mb-2 uppercase">Limit (Qty)</label>
                                        <input type="number" min="0" className={`${glassInput} w-full`} 
                                            value={formData.ebMaxTickets} onChange={e => setFormData({...formData, ebMaxTickets: e.target.value})} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 pt-6">
                            <button type="submit" className={`flex-1 ${primaryButton} shadow-lg shadow-indigo-200/50 outline-none focus:outline-none`}>Create Event</button>
                            <button type="button" onClick={() => setActiveTab('dashboard')} className={`${glassButton} outline-none focus:outline-none hover:bg-white/50`}>Cancel</button>
                        </div>
                    </form>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default OrganizerDashboard;