'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import dynamic from "next/dynamic";
import Skeleton from "@/app/components/Skeleton";

// ICONS
const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>);
const EventIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>);
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);
const DollarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const LogOutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);


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

  const [organizerWallet, setOrganizerWallet] = useState('');
  const [royaltyBalance, setRoyaltyBalance] = useState(0);
  const [savingWallet, setSavingWallet] = useState(false);

  const [defaultRoyaltyBps, setDefaultRoyaltyBps] = useState(500);
  const [savingRoyaltySettings, setSavingRoyaltySettings] = useState(false);

  const [royaltyReport, setRoyaltyReport] = useState({ totalRoyaltyEarned: 0, resaleCount: 0, recent: [] });
  const [loadingRoyaltyReport, setLoadingRoyaltyReport] = useState(false);

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
  const glassCard = "bg-white/10 backdrop-blur-md border border-white/10 shadow-lg rounded-2xl";
  const glassInput = "w-full p-3 bg-white/10 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#FFA500]/50 focus:bg-white/15 outline-none transition text-white placeholder-white/60";
  const glassSelect = "w-full p-3 bg-white/10 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#FFA500]/50 focus:bg-white/15 outline-none transition text-white";
  const glassButton = "px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition text-white/80 font-medium backdrop-blur-sm shadow-sm";
  const primaryButton = "px-6 py-2.5 bg-[#FFA500] hover:opacity-90 text-white rounded-xl shadow-lg shadow-[#FFA500]/30 transition font-medium backdrop-blur-sm";

  // --- FETCH DATA ---
  const calculateAnalytics = React.useCallback((events) => {
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
  }, []);

  const fetchAndProcessEvents = React.useCallback(async () => {
    if (!authUser?.uid) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/events?organizerId=${authUser.uid}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.events)) {
        // Events are already scoped to this organizer
        const myEvents = data.events;
        setOrganizerEvents(myEvents);
        calculateAnalytics(myEvents);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [authUser?.uid, calculateAnalytics]);

  const fetchOrganizerProfile = React.useCallback(async () => {
    if (!authUser?.uid) return;

    try {
      const res = await fetch(`/api/users/${authUser.uid}`);
      const data = await res.json();
      if (res.ok) {
        setOrganizerWallet(data.walletAddress || '');
        setRoyaltyBalance(data.royaltyBalance || 0);
        setDefaultRoyaltyBps(typeof data.defaultRoyaltyBps === 'number' ? data.defaultRoyaltyBps : 500);
      }
    } catch (error) {
      console.error(error);
    }
  }, [authUser?.uid]);

  const fetchOrganizerRoyalties = React.useCallback(async () => {
    if (!authUser?.uid) return;

    try {
      setLoadingRoyaltyReport(true);
      const res = await fetch(`/api/organizer/royalties?organizerId=${authUser.uid}`);
      const data = await res.json();

      if (res.ok) {
        setRoyaltyReport({
          totalRoyaltyEarned: data.totalRoyaltyEarned || 0,
          resaleCount: data.resaleCount || 0,
          recent: Array.isArray(data.recent) ? data.recent : [],
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingRoyaltyReport(false);
    }
  }, [authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid) return;
    fetchAndProcessEvents();
    fetchOrganizerProfile();
    fetchOrganizerRoyalties();
  }, [authUser?.uid, fetchAndProcessEvents, fetchOrganizerProfile, fetchOrganizerRoyalties]);

  const clampRoyaltyBps = (bps) => {
    const num = Number(bps);
    if (Number.isNaN(num)) return 0;
    return Math.max(0, Math.min(1000, Math.round(num)));
  };

  const saveRoyaltySettings = async () => {
    if (!authUser?.uid) return;
    try {
      setSavingRoyaltySettings(true);
      const res = await fetch(`/api/users/${authUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: organizerWallet,
          defaultRoyaltyBps: clampRoyaltyBps(defaultRoyaltyBps),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Royalty settings saved. New mints will use this royalty rate (max 10%).');
        await fetchOrganizerProfile();
      } else {
        toast.error(data.error || 'Failed to save royalty settings');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save royalty settings');
    } finally {
      setSavingRoyaltySettings(false);
    }
  };

  const saveOrganizerWallet = async () => {
    if (!authUser?.uid) return;
    try {
      setSavingWallet(true);
      const res = await fetch(`/api/users/${authUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: organizerWallet })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Organizer wallet saved. New mints will send royalties to this address (when payments are implemented).');
        await fetchOrganizerProfile();
      } else {
        toast.error(data.error || 'Failed to save wallet');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to save wallet');
    } finally {
      setSavingWallet(false);
    }
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
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Event deleted");
        const updated = organizerEvents.filter(e => e._id !== id);
        setOrganizerEvents(updated);
        calculateAnalytics(updated);
      } else {
        toast.error("Delete failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error deleting event");
    }
  }

  // --- RENDER ---
  if (loading) return (
    <div className="min-h-screen relative p-4 md:p-8 font-sans overflow-hidden bg-white/10 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl flex flex-col md:flex-row min-h-[850px]">
        {/* Skeleton Sidebar */}
        <aside className="w-full md:w-72 flex-shrink-0 flex flex-col p-6 border-r border-white/10">
          <Skeleton className="h-8 w-3/4 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="mt-auto pt-10">
            <Skeleton className="h-10 w-full" />
          </div>
        </aside>
        {/* Skeleton Content */}
        <main className="flex-1 p-6 md:p-10 space-y-8">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={['organizer', 'admin']}>
      <div className="min-h-screen relative p-4 md:p-8 font-sans overflow-hidden bg-white/10 backdrop-blur-sm">
        {/* Background Blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#FFA500]/20 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/30 blur-[100px]"></div>
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-[#FFA500]/10 blur-[80px]"></div>
        </div>

        <div className={`max-w-7xl mx-auto relative z-10 ${glassContainer} flex flex-col md:flex-row min-h-[850px]`}>

          {/* SIDEBAR NAVIGATION */}
          <aside className={`w-full md:w-72 flex-shrink-0 flex flex-col justify-between p-6 ${glassSidebar}`}>
            <div>
              <div className="mb-8 pl-2">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FFA500] to-[#FFA500]">
                  Organizer
                </h2>
                <p className="text-xs text-white/60 font-medium tracking-wider uppercase mt-1">Dashboard</p>
              </div>

              <nav className="space-y-2">
                <button onClick={() => setActiveTab('dashboard')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 bg-white/10 hover:bg-white/30 text-white/80 shadow-sm border border-white/10 break-words">
                  <DashboardIcon /> Overview
                </button>
                <button onClick={() => setActiveTab('royalties')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 bg-white/10 hover:bg-white/30 text-white/80 shadow-sm border border-white/10`}>
                  <DollarIcon /> Royalty Info
                </button>
                <button onClick={() => setActiveTab('events')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 bg-white/10 hover:bg-white/30 text-white/80 shadow-sm border border-white/10`}>
                  <EventIcon /> My Events
                </button>
                <button onClick={() => setActiveTab('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 bg-white/10 hover:bg-white/30 text-white/80 shadow-sm border border-white/10`}>
                  <PlusIcon /> Create Event
                </button>
              </nav>
            </div>

            <button onClick={async () => { await logout(); router.push('/login'); }} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/30 border border-white/10 text-white/80 transition-all text-sm font-medium`}>
              <LogOutIcon /> Sign Out
            </button>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className={`flex-1 p-6 md:p-10 ${glassContent} overflow-y-auto`}>

            {/* --- TAB 1: DASHBOARD ANALYTICS --- */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Performance Overview</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Revenue */}
                  <div className={`${glassCard} p-6 relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110">
                      <DollarIcon />
                    </div>
                    <p className="text-white/60 text-sm font-medium uppercase tracking-wider mb-1">Total Revenue</p>
                      <h3 className="text-3xl font-bold text-[#FFA500]">${analytics.totalRevenue.toLocaleString()}</h3>
                  </div>

                  {/* Tickets Sold */}
                  <div className={`${glassCard} p-6 relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110">
                      <UsersIcon />
                    </div>
                    <p className="text-white/60 text-sm font-medium uppercase tracking-wider mb-1">Tickets Sold</p>
                    <h3 className="text-3xl font-bold text-[#FFA500]">{analytics.totalTicketsSold}</h3>
                  </div>

                  {/* Active Events */}
                  <div className={`${glassCard} p-6 relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110">
                      <EventIcon />
                    </div>
                    <p className="text-white/60 text-sm font-medium uppercase tracking-wider mb-1">Active Events</p>
                      <h3 className="text-3xl font-bold text-[#FFA500]">{organizerEvents.length}</h3>
                  </div>
                </div>

                {/* Recent List */}
                <div className={`${glassCard} p-6`}>
                  <h3 className="text-lg font-bold text-white mb-4">Recent Events</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs text-white/60 uppercase border-b border-white/10">
                          <th className="pb-3 pl-2">Event</th>
                          <th className="pb-3">Date</th>
                          <th className="pb-3">Sales</th>
                          <th className="pb-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {organizerEvents.slice(0, 5).map((ev) => (
                          <tr key={ev._id} className="border-b border-white/10 hover:bg-white/10 transition">
                            <td className="py-3 pl-2 font-medium text-white">{ev.event}</td>
                            <td className="py-3 text-white/60">{new Date(ev.date).toLocaleDateString()}</td>
                            <td className="py-3 font-bold text-[#FFA500]">{ev.totalTickets - ev.remainingTickets}</td>
                            <td className="py-3">
                              {ev.remainingTickets === 0 ?
                                <span className="text-red-200 text-xs font-bold bg-red-500/10 px-2 py-1 rounded border border-red-400/20">Sold Out</span> :
                                <span className="text-green-200 text-xs font-bold bg-green-500/10 px-2 py-1 rounded border border-green-400/20">Active</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {organizerEvents.length === 0 && <p className="text-center text-white/60 py-4">No events created yet.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB: ROYALTY INFO --- */}
            {activeTab === 'royalties' && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Royalty Info</h2>
                </div>

                {/* Royalty Settings (off-chain ledger) */}
                <div className={`${glassCard} p-6`}>
                  <h3 className="text-lg font-bold text-white mb-2">Royalty Settings</h3>
                

                  <div className="flex flex-col lg:flex-row lg:items-end gap-10 mb-4">
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                        Organizer Wallet Address
                      </label>
                      <input
                        value={organizerWallet}
                        onChange={(e) => setOrganizerWallet(e.target.value)}
                        placeholder="0x..."
                        className={glassInput}
                      />
                    </div>

                    <button
                      onClick={saveOrganizerWallet}
                      disabled={savingWallet}
                      className={`${primaryButton}`}
                    >
                      {savingWallet ? 'Saving...' : 'Save Wallet'}
                    </button>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-end gap-10">
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                        Default Royalty (max 10%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={Number(defaultRoyaltyBps || 0) / 100}
                        onChange={(e) => {
                          const percent = Number(e.target.value);
                          const bps = Math.round((Number.isNaN(percent) ? 0 : percent) * 100);
                          setDefaultRoyaltyBps(clampRoyaltyBps(bps));
                        }}
                        className={glassInput}
                      />
                      <p className="mt-1 text-xs text-white/60">
                        Saved as bps. Example: 5% = 500 bps.
                      </p>
                    </div>

                    <button
                      onClick={saveRoyaltySettings}
                      disabled={savingRoyaltySettings}
                      className={`${primaryButton} mb-8`}
                    >
                      {savingRoyaltySettings ? 'Saving...' : 'Save Royalty Settings'}
                    </button>
                  </div>

                  <div className="mt-4 text-sm text-white/80">
                    <span className="font-semibold">Unpaid Royalty Balance:</span> Rs {Number(royaltyBalance || 0).toFixed(2)}
                  </div>
                </div>

                {/* Royalty Earnings */}
                <div className={`${glassCard} p-6`}>
                  <h3 className="text-lg font-bold text-white mb-2">Royalty Earnings</h3>
                  <p className="text-sm text-white/70 mb-4">
                    Computed from resale history (off-chain). This helps you audit what you’ve earned.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div className="text-xs text-white/60 font-semibold uppercase tracking-wider">Total Earned</div>
                      <div className="text-xl font-bold text-[#FFA500]">Rs {Number(royaltyReport.totalRoyaltyEarned || 0).toFixed(2)}</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div className="text-xs text-white/60 font-semibold uppercase tracking-wider">Resales</div>
                      <div className="text-xl font-bold text-[#FFA500]">{royaltyReport.resaleCount || 0}</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-end justify-end">
                      <button
                        onClick={fetchOrganizerRoyalties}
                        disabled={loadingRoyaltyReport}
                        className={glassButton}
                      >
                        {loadingRoyaltyReport ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs text-white/60 uppercase border-b border-white/10">
                          <th className="pb-3 pl-2">Event</th>
                          <th className="pb-3">Date</th>
                          <th className="pb-3">Royalty</th>
                          <th className="pb-3">Price</th>
                          <th className="pb-3">From</th>
                          <th className="pb-3">To</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {(royaltyReport.recent || []).map((row, idx) => (
                          <tr key={`${row.ticketId || 't'}-${idx}`} className="border-b border-white/10 hover:bg-white/10 transition">
                            <td className="py-3 pl-2 font-medium text-white">{row.event?.event || '—'}</td>
                            <td className="py-3 text-white/60">
                              {row.resale?.transactionDate ? new Date(row.resale.transactionDate).toLocaleString() : '—'}
                            </td>
                            <td className="py-3 font-bold text-[#FFA500]">Rs {Number(row.resale?.royaltyAmount || 0).toFixed(2)}</td>
                            <td className="py-3 text-white/80">Rs {Number(row.resale?.resalePrice || 0).toFixed(2)}</td>
                            <td className="py-3 text-white/70">{row.resale?.sellerId || '—'}</td>
                            <td className="py-3 text-white/70">{row.resale?.buyerId || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {(!royaltyReport.recent || royaltyReport.recent.length === 0) && (
                      <p className="text-center text-white/60 py-4">
                        {loadingRoyaltyReport ? 'Loading royalty history...' : 'No resale royalties recorded yet.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: MY EVENTS LIST --- */}
            {activeTab === 'events' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white">My Events</h2>
                  <button onClick={() => setActiveTab('create')} className={primaryButton}>+ Create New</button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {organizerEvents.map((ev) => (
                    <div key={ev._id} className={`${glassCard} p-5 flex flex-col md:flex-row items-center justify-between gap-4 group hover:border-[#FFA500]/30 transition`}>
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="h-16 w-16 rounded-xl bg-white/5 overflow-hidden flex-shrink-0 shadow-sm relative border border-white/10">
                          {ev.image ? (
                            <Image src={ev.image} alt="" fill sizes="64px" className="object-cover" />
                          ) : (
                            <div className="h-full w-full bg-white/5 flex items-center justify-center text-white/60"><EventIcon /></div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-lg">{ev.event}</h4>
                          <div className="flex gap-3 text-xs text-white/60 mt-1">
                            <span>{new Date(ev.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{ev.time}</span>
                            <span>•</span>
                            <span className="font-semibold text-[#FFA500]">${ev.price}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-right mr-4">
                          <div className="text-xs text-white/60 uppercase">Stock</div>
                          <div className="font-bold text-white/80">{ev.remainingTickets} / {ev.totalTickets}</div>
                        </div>
                        <button onClick={() => handleDeleteEvent(ev._id)} className="p-2 bg-red-500/10 hover:bg-red-500/15 text-red-200 rounded-xl transition border border-red-400/20">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                  {organizerEvents.length === 0 && <div className="text-center py-10 text-white/60">You have not created any events yet.</div>}
                </div>
              </div>
            )}

            {/* --- TAB 3: CREATE EVENT FORM --- */}
            {activeTab === 'create' && (
              <div className="animate-fade-in max-w-4xl mx-auto pb-10">
                <div className={`${glassCard} p-6 md:p-10`}>
                  <h2 className="text-2xl font-bold text-white mb-8 border-b border-white/10 pb-4">Create New Event</h2>
                  <form onSubmit={handleCreateSubmit} className="space-y-8">

                    {/* Top Section: Name and Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2 ml-1">Event Name</label>
                        <input required type="text" className={`${glassInput} w-full py-3 px-4`} placeholder="e.g. Summer Music Festival"
                          value={formData.event} onChange={e => setFormData({ ...formData, event: e.target.value })} />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2 ml-1">Category</label>
                        <select className={`${glassSelect} w-full py-3 px-4`} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                          <option value="">Select Category</option>
                          {["Art", "Sports", "Food And Drink", "Education", "Festival", "Music", "Other"].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Location Section - Full Width to prevent squashing */}
                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-white/60 uppercase mb-2 ml-1">Location Address</label>
                          <input required type="text" className={`${glassInput} w-full py-3 px-4`} placeholder="Enter physical address"
                            value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                        </div>

                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-sm backdrop-blur-md">
                          <label className="block text-xs font-bold text-white/70 uppercase mb-3 text-center">Pinpoint Location</label>
                          <div className="w-full rounded-xl overflow-hidden shadow-inner bg-white/5 min-h-[320px] flex justify-center border border-white/10">
                            <LocationPicker setCoordinates={setCoordinates} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Date and Time - Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 px-2">
                        <label className="block text-xs font-bold text-white/60 uppercase ml-1">Date</label>
                        <input required type="date" className={`${glassInput} w-full py-3 px-4`}
                          value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                      </div>
                      <div className="space-y-2 px-2">
                        <label className="block text-xs font-bold text-white/60 uppercase ml-1">Time</label>
                        <input required type="time" className={`${glassInput} w-full py-3 px-4`}
                          value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                      </div>
                    </div>

                    {/* Pricing and Logistics Group */}
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 shadow-sm space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className=" px-2">
                          <label className="block text-xs font-bold text-white/60 uppercase mb-2 ml-1">Price (Rs)</label>
                          <input required type="number" min="0" className={`${glassInput} w-full py-3 px-4`}
                            value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                        </div>
                        <div className=" px-2">
                          <label className="block text-xs font-bold text-white/60 uppercase mb-2 ml-1">Total Tickets</label>
                          <input required type="number" min="1" className={`${glassInput} w-full py-3 px-4`}
                            value={formData.totalTickets} onChange={e => setFormData({ ...formData, totalTickets: e.target.value })} />
                        </div>
                        <div className="px-2">
                          <label className="block text-xs font-bold text-white/60 uppercase mb-2 ml-1">Image URL</label>
                          <input type="text" className={`${glassInput} w-full py-3 px-4`} placeholder="https://..."
                            value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    {/* Early Bird Section - Enhanced spacing */}
                    <div className="p-6 bg-[#FFA500]/10 rounded-2xl border border-[#FFA500]/20 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <input type="checkbox" id="ebCheck" className="w-5 h-5 accent-[#FFA500] cursor-pointer shadow-sm"
                          checked={formData.ebEnabled} onChange={e => setFormData({ ...formData, ebEnabled: e.target.checked })} />
                        <label htmlFor="ebCheck" className="font-bold text-white cursor-pointer select-none text-sm">Enable Early Bird Discount</label>
                      </div>

                      {formData.ebEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in pt-2">
                          <div className="space-y-2 px-2">
                            <label className="block text-xs font-bold text-white/80 uppercase ml-1">Discount Price (Rs)</label>
                            <input type="number" min="0" className={`${glassInput} w-full py-3 px-4`}
                              value={formData.ebPrice} onChange={e => setFormData({ ...formData, ebPrice: e.target.value })} />
                          </div>
                          <div className="space-y-2 px-2">
                            <label className="block text-xs font-bold text-white/80 uppercase ml-1">Offer Ends On</label>
                            <input type="date" className={`${glassInput} w-full py-3 px-4`}
                              value={formData.ebEndDate} onChange={e => setFormData({ ...formData, ebEndDate: e.target.value })} />
                          </div>
                          <div className="space-y-2 px-2">
                            <label className="block text-xs font-bold text-white/80 uppercase ml-1">Max Discount Tickets</label>
                            <input type="number" min="0" className={`${glassInput} w-full py-3 px-4`}
                              value={formData.ebMaxTickets} onChange={e => setFormData({ ...formData, ebMaxTickets: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col md:flex-row gap-4 pt-6">
                      <button type="submit" className={`flex-[2] ${primaryButton} py-4 shadow-lg shadow-[#FFA500]/20 outline-none hover:scale-[1.01] transition-transform`}>
                        Create Event
                      </button>
                      <button type="button" onClick={() => setActiveTab('dashboard')} className={`${glassButton} flex-1 py-4 outline-none`}>
                        Cancel
                      </button>
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