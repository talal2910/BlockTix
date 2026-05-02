"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useAuth } from '@/context/AuthContext';
import Skeleton from "../../components/Skeleton";
import TicketScannerPanel from "./TicketScannerPanel";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Colors for charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

function AdminTabs() {
  const { user } = useAuth();
  const [active, setActive] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actingOnEventId, setActingOnEventId] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- LOGIC STARTS: STRICTLY UNTOUCHED ---
  useEffect(() => {
    if (!user?.uid) return;
    fetch(`/api/events?includeAll=1&adminId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events);
        setLoading(false);
      });
  }, [user?.uid]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  const attendees = users.filter((u) => u.role === "user");
  const organizers = users.filter((u) => u.role === "organizer");

  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "users", label: "Attendees" },
    { key: "organizers", label: "Organizers" },
    { key: "approvals", label: "Approvals" },
    { key: "events", label: "Events" },
    { key: "scanner", label: "Ticket Scanner" },
  ];

  const fetchUsersAgain = () => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data));
  };

  const fetchEventsAgain = useCallback(() => {
    if (!user?.uid) return;
    fetch(`/api/events?includeAll=1&adminId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events));
  }, [user?.uid]);

  const fetchPendingEventsAgain = useCallback(() => {
    if (!user?.uid) return;
    setLoadingPending(true);
    fetch(`/api/admin/events/requests?adminId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setPendingEvents(data.events || []))
      .finally(() => setLoadingPending(false));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    fetchPendingEventsAgain();
  }, [user?.uid, fetchPendingEventsAgain]);

  const approveEvent = async (eventId) => {
    if (!user?.uid) return;
    setActingOnEventId(eventId);
    try {
      await fetch('/api/admin/events/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.uid, eventId, action: 'approve' }),
      });
      fetchPendingEventsAgain();
      fetchEventsAgain();
    } finally {
      setActingOnEventId(null);
    }
  };

  const rejectEvent = async (eventId) => {
    if (!user?.uid) return;
    const reason = prompt('Rejection reason (optional):') || '';
    setActingOnEventId(eventId);
    try {
      await fetch('/api/admin/events/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.uid, eventId, action: 'reject', rejectionReason: reason }),
      });
      fetchPendingEventsAgain();
      fetchEventsAgain();
    } finally {
      setActingOnEventId(null);
    }
  };

  const deleteUser = async (id) => {
    if (!confirm("Are you sure?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUsers(users.filter((u) => u._id !== id));
  };

  const updateUserRole = async (id) => {
    await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    fetchUsersAgain();
  };

  const deleteEvent = async (id) => {
    if (!confirm("Sure to delete event?")) return;
    await fetch(`/api/events/${id}?adminId=${user.uid}`, { method: "DELETE" });
    setEvents(events.filter((e) => e._id !== id));
  };

  const updateEvent = async (id) => {
    await fetch(`/api/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalTickets: 200, adminId: user.uid }),
    });
    fetchEventsAgain();
  };
  // --- LOGIC ENDS ---

  // --- NEW: CALCULATIONS FOR CHARTS ---
  const stats = useMemo(() => {
    // 1. Calculate Event Performance (Tickets Sold vs Total)
    const eventPerformance = events.map((e) => ({
      name: e.event,
      sold: e.totalTickets - e.remainingTickets,
      remaining: e.remainingTickets,
      total: e.totalTickets,
    }));

    // 2. User Distribution Data
    const userDistribution = [
      { name: "Attendees", value: attendees.length },
      { name: "Organizers", value: organizers.length },
      { name: "Admins", value: users.length - attendees.length - organizers.length },
    ];

    // 3. Global Stats
    const totalTicketsAvailable = events.reduce((acc, curr) => acc + curr.totalTickets, 0);
    const totalTicketsSold = events.reduce((acc, curr) => acc + (curr.totalTickets - curr.remainingTickets), 0);
    const sellRate = totalTicketsAvailable > 0 ? ((totalTicketsSold / totalTicketsAvailable) * 100).toFixed(1) : 0;

    return { eventPerformance, userDistribution, totalTicketsSold, sellRate };
  }, [events, users, attendees, organizers]);

  // Use the project's glass design tokens to match other dashboard pages
  const glassContainer = "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden";
  const glassSidebar = "bg-white/5 backdrop-blur-lg border-r border-white/10";
  const glassContent = "bg-transparent";
  const glassCard = "bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg transition-shadow";
  const glassPanel = "bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl shadow-sm";
  const panelHeaderClass = "bg-white/5 border-b border-white/10";
  const mutedText = "text-white/60";
  const mutedText2 = "text-white/70";
  const strongText = "text-white";

  if (loading) {
    return (
      <div className="min-h-screen relative p-4 md:p-8 font-sans overflow-hidden bg-white/10 backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#FFA500]/20 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/30 blur-[100px]"></div>
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-[#FFA500]/10 blur-[80px]"></div>
        </div>

        <div className={`max-w-7xl mx-auto relative z-10 ${glassContainer} flex flex-col md:flex-row min-h-[600px] p-6`}>
          <aside className={`w-full md:w-72 flex-shrink-0 flex flex-col p-4 ${glassSidebar}`}>
            <Skeleton className="h-8 w-3/4 mb-6" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </aside>

          <main className={`flex-1 p-4 md:p-8 ${glassContent} space-y-6`}>
            <Skeleton className="h-8 w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-3">
          <div className={`${glassSidebar} p-4`}> 
            <p className={`text-xs uppercase font-bold tracking-wider ${mutedText} mb-3`}>Menu</p>
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const isActive = active === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActive(tab.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-[#FFA500] text-white shadow-lg' : 'bg-white/10 text-white/80 hover:bg-white/20'} border border-white/10`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <section className="lg:col-span-9">
          {/* DASHBOARD - ENHANCED WITH CHARTS */}
          {active === "dashboard" && (
            <div className="space-y-6">
              <h2 className={`text-2xl font-bold ${strongText}`}>System Analytics</h2>

              {/* Top Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className={glassCard}>
                  <p className={`text-xs uppercase font-bold tracking-wider ${mutedText}`}>Total Users</p>
                  <p className={`text-3xl font-bold ${strongText} mt-2`}>{users.length}</p>
                  <div className="mt-2 text-xs text-green-600 font-medium">Active Accounts</div>
                </div>
                <div className={glassCard}>
                  <p className={`text-xs uppercase font-bold tracking-wider ${mutedText}`}>Total Events</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">{events.length}</p>
                  <div className="mt-2 text-xs text-indigo-600 font-medium">Currently Live</div>
                </div>
                <div className={glassCard}>
                  <p className={`text-xs uppercase font-bold tracking-wider ${mutedText}`}>Tickets Sold</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.totalTicketsSold}</p>
                  <div className="mt-2 text-xs text-emerald-600 font-medium">Confirmed Sales</div>
                </div>
                <div className={glassCard}>
                  <p className={`text-xs uppercase font-bold tracking-wider ${mutedText}`}>Sell-out Rate</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">{stats.sellRate}%</p>
                  <div className="mt-2 text-xs text-orange-600 font-medium">Avg. Capacity Reached</div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Sales Performance */}
                <div className={`${glassPanel} p-6`}>
                  <h3 className={`text-lg font-bold ${strongText} mb-4`}>Ticket Sales per Event</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.eventPerformance}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="name" hide /> {/* Hiding X labels if names are long */}
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-grey/80 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-white text-sm">
                                  <p className="font-bold text-[#FFA500] mb-1">{data.name}</p>
                                  <p>Sold: <span className="font-semibold">{data.sold}</span></p>
                                  <p>Remaining: <span className="font-semibold">{data.remaining}</span></p>
                                </div>
                              );
                            }
                            return null;
                          }}
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        />
                        <Legend />
                        <Bar dataKey="sold" name="Tickets Sold" fill="#8884d8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="remaining" name="Remaining" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: User Demographics */}
                <div className={`${glassPanel} p-6`}>
                  <h3 className={`text-lg font-bold ${strongText} mb-4`}>User Roles Distribution</h3>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.userDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.userDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Top Performing Table */}
              <div className={`${glassPanel} overflow-hidden`}>
                <div className={`px-6 py-4 ${panelHeaderClass}`}>
                  <h3 className={`font-semibold ${strongText}`}>Top Performing Events (by Sales)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-white/85">
                    <thead className={`bg-white/5 text-xs uppercase font-medium ${mutedText}`}>
                      <tr>
                        <th className="px-6 py-3">Event Name</th>
                        <th className="px-6 py-3 text-center">Sold</th>
                        <th className="px-6 py-3 text-center">Total</th>
                        <th className="px-6 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {stats.eventPerformance
                        .sort((a, b) => b.sold - a.sold)
                        .slice(0, 5)
                        .map((event, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className={`px-6 py-4 font-medium ${strongText}`}>{event.name}</td>
                            <td className="px-6 py-4 text-center font-semibold text-white">{event.sold}</td>
                            <td className="px-6 py-4 text-center font-semibold text-white">{event.total}</td>
                            <td className="px-6 py-4 text-right">
                              {event.remaining === 0 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-200 border border-red-400/20">
                                  Sold Out
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-200 border border-green-400/20">
                                  Available
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* USERS / ORGANIZERS (UNCHANGED LOGIC) */}
          {(active === "users" || active === "organizers") && (
            <div>
              <h2 className={`text-2xl font-bold ${strongText} mb-6`}>
                {active === "users" ? "Attendee Management" : "Organizer Management"}
              </h2>
              {(() => {
                const rows = active === 'users' ? attendees : organizers;
                const isOrganizerView = active === 'organizers';

                if (rows.length === 0) {
                  return (
                    <div className={`text-center py-12 ${mutedText}`}>
                      No {active === "users" ? "attendees" : "organizers"} found.
                    </div>
                  );
                }

                return (
                  <div className={`${glassPanel} overflow-hidden`}>
                    <div className={`px-6 py-4 ${panelHeaderClass}`}>
                      <h3 className={`font-semibold ${strongText}`}>
                        {active === 'users' ? 'Attendees' : 'Organizers'}
                      </h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className={`w-full text-left text-sm ${mutedText2}`}>
                        <thead className={`bg-white/5 text-xs uppercase font-medium ${mutedText}`}>
                          <tr>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Role</th>
                            {isOrganizerView && (
                              <>
                                <th className="px-6 py-3">Wallet</th>
                                <th className="px-6 py-3 text-right">Royalty Balance</th>
                                <th className="px-6 py-3 text-center">Default Royalty</th>
                              </>
                            )}
                            <th className="px-6 py-3">Created</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-white/10">
                          {rows.map((u) => (
                            <tr key={u._id} className="hover:bg-white/5 transition-colors">
                              <td className={`px-6 py-4 font-medium ${strongText} whitespace-nowrap`}>
                                {u.name}
                              </td>
                              <td className="px-6 py-4">
                                <div className="truncate max-w-[260px]">{u.email}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/10">
                                  {u.role}
                                </span>
                              </td>

                              {isOrganizerView && (
                                <>
                                  <td className="px-6 py-4">
                                    <div className={`truncate max-w-[220px] text-xs ${mutedText2}`}>
                                      {u.walletAddress || '—'}
                                    </div>
                                  </td>
                                  <td className={`px-6 py-4 text-right font-medium ${strongText} whitespace-nowrap`}>
                                    Rs {Number(u.royaltyBalance || 0).toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 text-center whitespace-nowrap">
                                    {typeof u.defaultRoyaltyBps === 'number'
                                      ? `${(u.defaultRoyaltyBps / 100).toFixed(2)}%`
                                      : '—'}
                                  </td>
                                </>
                              )}

                              <td className={`px-6 py-4 whitespace-nowrap ${mutedText}`}>
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex justify-end gap-2">
                                  {isOrganizerView && (
                                    <button
                                      onClick={() => updateUserRole(u._id)}
                                      className="px-3 py-1.5 text-xs font-medium bg-[#FFA500]/10 text-[#FFA500]/80 border border-[#FFA500]/20 rounded-lg hover:bg-[#FFA500]/15 transition-colors"
                                    >
                                      Make Admin
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteUser(u._id)}
                                    className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-200 border border-red-400/20 rounded-lg hover:bg-red-500/15 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* EVENTS (UNCHANGED LOGIC) */}
          {active === "events" && (
            <div>
              <h2 className={`text-2xl font-bold ${strongText} mb-6`}>Event Management</h2>
              {events.length === 0 ? (
                <div className={`text-center py-12 ${mutedText}`}>No events created yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {events.map((event) => {
                    const soldOut = event.remainingTickets === 0;
                    const availability = ((event.totalTickets - event.remainingTickets) / event.totalTickets) * 100;

                    return (
                      <div key={event._id} className={glassCard}>
                        <h3 className={`font-bold ${strongText} text-lg mb-3 line-clamp-1`}>{event.event}</h3>

                        <div className="mb-4">
                          <div className={`flex justify-between text-sm ${mutedText2} mb-1`}>
                            <span>Tickets</span>
                            <span>{event.remainingTickets} left</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${soldOut ? "bg-red-500" : availability > 80 ? "bg-orange-500" : "bg-green-500"
                                }`}
                              style={{ width: `${100 - availability}%` }}
                            ></div>
                          </div>
                          <p className={`text-xs ${mutedText} mt-1`}>
                            {event.totalTickets - event.remainingTickets} sold of {event.totalTickets}
                          </p>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => updateEvent(event._id)}
                            className="flex-1 py-2 text-sm font-medium bg-[#FFA500] text-white rounded-lg hover:bg-[#FFA500] transition-colors"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => deleteEvent(event._id)}
                            className="p-2 rounded-lg bg-red-400 text-white hover:bg-red-600 hover:scale-105 transition duration-200 shadow-sm"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* APPROVAL REQUESTS */}
          {active === 'approvals' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className={`text-2xl font-bold ${strongText}`}>Event Approval Requests</h2>
                  <p className={`${mutedText2} mt-1`}>New events created by organizers must be approved before they go live.</p>
                </div>
                <button
                  onClick={fetchPendingEventsAgain}
                  className="px-4 py-2 text-sm font-medium bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors text-white/80"
                >
                  Refresh
                </button>
              </div>

              <div className={`${glassPanel} overflow-hidden`}>
                <div className={`px-6 py-4 ${panelHeaderClass}`}>
                  <h3 className={`font-semibold ${strongText}`}>Pending Requests</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className={`w-full text-left text-sm ${mutedText2}`}>
                    <thead className={`bg_white/5 text-xs uppercase font-medium ${mutedText}`}>
                      <tr>
                        <th className="px-6 py-3">Event</th>
                        <th className="px-6 py-3">Organizer</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Location</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3 text-right">Price</th>
                        <th className="px-6 py-3 text-center">Tickets</th>
                        <th className="px-6 py-3">Submitted</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {loadingPending ? (
                        <tr>
                          <td colSpan={9} className={`px-6 py-10 text-center ${mutedText}`}>
                            Loading requests...
                          </td>
                        </tr>
                      ) : pendingEvents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className={`px-6 py-10 text-center ${mutedText}`}>
                            No pending approval requests.
                          </td>
                        </tr>
                      ) : (
                        pendingEvents.map((e) => {
                          const orgName = e.organizer?.name || e.organizerId || 'Unknown';
                          const orgEmail = e.organizer?.email || '';
                          const submitted = e.submittedAt || e.createdAt;
                          return (
                            <tr key={e._id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className={`font-medium ${strongText}`}>{e.event}</div>
                                <div className={`text-xs ${mutedText}`}>ID: {e.eventId}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className={`font-medium ${strongText}`}>{orgName}</div>
                                {orgEmail ? <div className={`text-xs ${mutedText}`}>{orgEmail}</div> : null}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                              <td className="px-6 py-4">{e.location}</td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFA500]/10 text-[#FFA500]/90 border border-[#FFA500]/20">
                                  {e.category}
                                </span>
                              </td>
                              <td className={`px-6 py-4 text-right font-medium ${strongText}`}>Rs {e.price}</td>
                              <td className="px-6 py-4 text-center">{e.totalTickets}</td>
                              <td className={`px-6 py-4 whitespace-nowrap ${mutedText}`}>
                                {submitted ? new Date(submitted).toLocaleString() : '—'}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    disabled={actingOnEventId === e._id}
                                    onClick={() => approveEvent(e._id)}
                                    className="px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-200 border border-green-400/20 rounded-lg hover:bg-green-500/15 transition-colors disabled:opacity-60"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    disabled={actingOnEventId === e._id}
                                    onClick={() => rejectEvent(e._id)}
                                    className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-200 border border-red-400/20 rounded-lg hover:bg-red-500/15 transition-colors disabled:opacity-60"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {active === 'scanner' && (
            <TicketScannerPanel adminId={user?.uid} />
          )}
        </section>
      </div>
    </>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen relative p-4 md:p-8 font-sans overflow-hidden bg-white/10 backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#FFA500]/20 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/30 blur-[100px]"></div>
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-[#FFA500]/10 blur-[80px]"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 p-6 md:p-8"> 
          <header className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-white/70 mt-1">Manage users, organizers, and events</p>
              </div>
            </div>
          </header>

          <AdminTabs />
        </div>
      </div>
    </ProtectedRoute>
  );
}