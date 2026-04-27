'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import Skeleton from '../../components/Skeleton';

export default function Dashboard() {
  const [tickets,        setTickets]        = useState([]);
  const [savedEvents,    setSavedEvents]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [wishlistLoading,setWishlistLoading]= useState(true);
  const [activeTab,      setActiveTab]      = useState('upcoming');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [qrToken,        setQrToken]        = useState('');
  const [showQrModal,    setShowQrModal]    = useState(false);
  const [claiming,       setClaiming]       = useState(false);
  const [reselling,      setReselling]      = useState(false);
  const [delisting,      setDelisting]      = useState(false);

  const { user } = useAuth();
  const router   = useRouter();

  // Fetch tickets
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res  = await fetch(`/api/tickets?userId=${user.uid}`);
        const data = await res.json();
        setTickets(data.tickets);
      } catch (error) {
        console.error('Error fetching tickets:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Fetch wishlist
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res  = await fetch(`/api/wishlist?firebase_uid=${user.uid}`);
        const data = await res.json();
        if (data.success) setSavedEvents(data.savedEvents);
      } catch (error) {
        console.error('Error fetching wishlist:', error);
      } finally {
        setWishlistLoading(false);
      }
    })();
  }, [user]);

  // Remove event from wishlist
  async function handleRemoveFromWishlist(eventId) {
    try {
      const res  = await fetch('/api/wishlist', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ firebase_uid: user.uid, event_id: eventId }),
      });
      const data = await res.json();
      if (data.success && !data.saved) {
        setSavedEvents(prev => prev.filter(e => e.eventId !== eventId));
        toast.success('Removed from wishlist');
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  // QR code rotation
  const fetchQrCode = async (ticketId) => {
    try {
      const res  = await fetch(`/api/tickets/${ticketId}/qr`);
      const data = await res.json();
      if (data.qrCode) setQrToken(data.qrCode);
    } catch (error) {
      console.error('Error fetching QR:', error);
    }
  };

  useEffect(() => {
    let interval;
    if (showQrModal && selectedTicket) {
      fetchQrCode(selectedTicket.ticketId);
      interval = setInterval(() => fetchQrCode(selectedTicket.ticketId), 45000);
    }
    return () => clearInterval(interval);
  }, [showQrModal, selectedTicket]);

  // Claim / resale / delist
  const handleClaim = async (ticketId) => {
    if (!window.ethereum) { toast.error('Please install MetaMask!'); return; }
    try {
      setClaiming(true);
      const accounts     = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const walletAddress = accounts[0];
      const res  = await fetch(`/api/tickets/${ticketId}/claim`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ userWallet: walletAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Ticket claimed to your wallet!');
        await refreshTickets();
        setShowQrModal(false);
      } else {
        toast.error(data.error || 'Claim failed');
      }
    } catch (error) { toast.error(error.message); }
    finally { setClaiming(false); }
  };

  const refreshTickets = async () => {
    try {
      const res  = await fetch(`/api/tickets?userId=${user.uid}`);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets);
        if (selectedTicket) {
          const updated = data.tickets.find(t => t.ticketId === selectedTicket.ticketId);
          if (updated) setSelectedTicket(updated);
        }
      }
    } catch (err) { console.error('Error refreshing tickets:', err); }
  };

  const handleResale = async (ticketId, price) => {
    if (!user) { toast.error('Please login to list tickets'); return; }
    try {
      setReselling(true);
      const res  = await fetch(`/api/tickets/${ticketId}/resale`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ action: 'list', price: parseFloat(price), sellerId: user.uid }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Ticket listed for resale! NFT is now in platform custody.');
        await refreshTickets();
      } else { toast.error(data.error || 'Listing failed'); }
    } catch (error) { toast.error(error.message); }
    finally { setReselling(false); }
  };

  const handleDelist = async (ticketId) => {
    if (!user) return;
    try {
      setDelisting(true);
      const res  = await fetch(`/api/tickets/${ticketId}/resale`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ action: 'delist', sellerId: user.uid }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Ticket removed from marketplace.');
        await refreshTickets();
      } else { toast.error(data.error || 'Failed to delist'); }
    } catch (error) { toast.error(error.message); }
    finally { setDelisting(false); }
  };

  // Derived data
  const now             = new Date();
  const upcomingTickets = tickets.filter(t => t.eventId?.date && new Date(t.eventId.date) >= now);
  const pastTickets     = tickets.filter(t => t.eventId?.date && new Date(t.eventId.date) < now);
  const totalSpent      = tickets.reduce((sum, t) => sum + (t.eventId?.price || 0), 0);

  // Ticket card component
  function TicketCard({ ticket }) {
    const event = ticket.eventId;
    if (!event) return (
      <div className="border p-4 rounded-lg shadow-md text-red-600 dark:text-red-300 bg-black/5 dark:bg-white/10 backdrop-blur-md border-black/10 dark:border-white/10">
        Invalid Ticket Data
      </div>
    );

    return (
      <div className="bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg shadow-md hover:shadow-lg hover:shadow-[#FFA500]/20 transition w-full overflow-hidden relative">
        {ticket.isForResale && (
          <div className="absolute top-3 right-3 bg-[#FFA500] text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow">
            Listed for Resale
          </div>
        )}
        {ticket.custodial && !ticket.isForResale && (
          <div className="absolute top-3 right-3 bg-gray-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow">
            Platform Custody
          </div>
        )}
        {!ticket.custodial && (
          <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow">
            In Your Wallet
          </div>
        )}

        {event.image ? (
          <div className="w-full h-48 overflow-hidden relative">
            <Image src={event.image} alt="Event" fill sizes="360px" className="object-cover" />
          </div>
        ) : (
          <div className="h-48 bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-white/60 border-b border-black/10 dark:border-white/10">
            No Image
          </div>
        )}

        <div className="p-4">
          <h3 className="text-xl font-bold text-white truncate">{event.event}</h3>
          <p className="text-white/70">
            <strong>Date:</strong> {new Date(event.date).toLocaleDateString()}
          </p>
          <p className="text-white/70"><strong>Time:</strong> {event.time}</p>
          <p className="text-[#FFA500] font-medium mt-2 text-sm">Price: Rs {event.price}</p>
          {ticket.isForResale && (
            <p className="text-[#FFA500] font-medium text-sm">Resale: Rs {ticket.resalePrice}</p>
          )}
          <button
            onClick={() => { setSelectedTicket(ticket); setShowQrModal(true); }}
            className="btn-sm w-full mt-4"
          >
            {ticket.isForResale ? 'Manage Listing' : 'View Ticket / QR'}
          </button>
        </div>
      </div>
    );
  }

  // Wishlist event card
  function WishlistCard({ event }) {
    return (
      <div className="bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg shadow-md hover:shadow-lg hover:shadow-[#FFA500]/20 transition overflow-hidden">
        {event.image ? (
          <div className="w-full h-40 overflow-hidden relative">
            <Image src={event.image} alt={event.event} fill sizes="360px" className="object-cover" />
          </div>
        ) : (
          <div className="h-40 bg-black/5 dark:bg-white/5 flex items-center justify-center text-white/50">
            No Image
          </div>
        )}
        <div className="p-4">
          <h3 className="text-lg font-bold text-white truncate">{event.event}</h3>
          <p className="text-white/70 text-sm">
            {new Date(event.date).toLocaleDateString()}
          </p>
          <p className="text-white/70 text-sm">{event.location}</p>
          <p className="text-[#FFA500] font-semibold text-sm mt-1">Rs {event.price}</p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => router.push(`/event/${event.eventId}`)}
              className="btn-sm flex-1"
            >
              View Event
            </button>
            <button
              onClick={() => handleRemoveFromWishlist(event.eventId)}
              className="flex-1 py-1.5 px-3 text-sm rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 transition"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render
  return (
    <ProtectedRoute>
      <main className="min-h-screen px-6 py-8 bg-white/10 backdrop-blur-sm">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">My Tickets</h1>
          <p className="text-lg text-gray-700 dark:text-white/70 mt-2">
            Manage your event tickets and saved events.
          </p>
        </div>

        {/* Stats */}
        <div className="max-w-7xl mx-auto bg-black/5 dark:bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-md mb-8 border border-black/10 dark:border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : (
              <>
                <div className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg p-6 flex flex-col items-center">
                  <p className="text-gray-700 dark:text-white/70">Total Tickets</p>
                  <h3 className="text-3xl font-bold text-[#FFA500] mt-1">{tickets.length}</h3>
                </div>
                <div className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg p-6 flex flex-col items-center">
                  <p className="text-gray-700 dark:text-white/70">Upcoming</p>
                  <h3 className="text-3xl font-bold text-[#FFA500] mt-1">{upcomingTickets.length}</h3>
                </div>
                <div className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg p-6 flex flex-col items-center">
                  <p className="text-gray-700 dark:text-white/70">Saved Events</p>
                  <h3 className="text-3xl font-bold text-[#FFA500] mt-1">{savedEvents.length}</h3>
                </div>
                <div className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg p-6 flex flex-col items-center">
                  <p className="text-gray-700 dark:text-white/70">Total Spent</p>
                  <h3 className="text-3xl font-bold text-[#FFA500] mt-1">Rs {totalSpent}</h3>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto bg-black/5 dark:bg-white/10 backdrop-blur-md p-4 rounded-lg shadow-md mb-8 border border-black/10 dark:border-white/10">
          <div className="flex w-full bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/10 p-1 rounded-full">
            {[
              { key: 'upcoming', label: `Upcoming (${upcomingTickets.length})` },
              { key: 'past',     label: `Past (${pastTickets.length})` },
              { key: 'saved',    label: `Saved (${savedEvents.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 text-center px-4 py-2 rounded-full font-semibold transition-all duration-300 ${
                  activeTab === tab.key
                    ? 'bg-[#FFA500] text-white shadow-md'
                    : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-7xl mx-auto bg-black/5 dark:bg-white/10 backdrop-blur-md p-10 rounded-lg border border-black/10 dark:border-white/10">

          {/* Upcoming */}
          {activeTab === 'upcoming' && (
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white/10 rounded-lg p-6 h-64 border border-white/10">
                    <Skeleton className="h-40 w-full mb-4" />
                    <Skeleton variant="text" className="w-3/4 mb-2" />
                    <Skeleton variant="text" className="w-1/2" />
                  </div>
                ))}
              </div>
            ) : upcomingTickets.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Upcoming Events</h3>
                <p className="text-gray-700 dark:text-white/70 mb-5">
                  You do not have any upcoming events. Discover new ones to attend!
                </p>
                <button onClick={() => router.push('/discover')} className="btn-sm">
                  Browse Events
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingTickets.map(ticket => <TicketCard key={ticket._id} ticket={ticket} />)}
              </div>
            )
          )}

          {/* Past */}
          {activeTab === 'past' && (
            pastTickets.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Past Events</h3>
                <p className="text-gray-700 dark:text-white/70">You haven't attended any events yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastTickets.map(ticket => <TicketCard key={ticket._id} ticket={ticket} />)}
              </div>
            )
          )}

          {/* Saved / Wishlist*/}
          {activeTab === 'saved' && (
            wishlistLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white/10 rounded-lg p-6 h-64 border border-white/10">
                    <Skeleton className="h-40 w-full mb-4" />
                    <Skeleton variant="text" className="w-3/4 mb-2" />
                    <Skeleton variant="text" className="w-1/2" />
                  </div>
                ))}
              </div>
            ) : savedEvents.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Saved Events</h3>
                <p className="text-gray-700 dark:text-white/70 mb-5">
                  Save events by clicking the ❤️ button on any event page.
                </p>
                <button onClick={() => router.push('/discover')} className="btn-sm">
                  Browse Events
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedEvents.map(event => <WishlistCard key={event._id} event={event} />)}
              </div>
            )
          )}
        </div>

        {/* QR & Management Modal — identical to original */}
        {showQrModal && selectedTicket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900/80 border border-white/10 text-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 md:p-8 relative overflow-hidden backdrop-blur-xl">
              <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-black hover:text-grey p-2">✕</button>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-4">{selectedTicket.eventId?.event}</h2>

                <div className="w-full flex flex-col md:flex-row rounded-3xl overflow-hidden border border-white/10 shadow-inner bg-white/5 mb-6">
                  <div className="flex-1">
                    <div className="relative h-44 md:h-56 w-full">
                      {selectedTicket.eventId?.image ? (
                        <Image src={selectedTicket.eventId.image} alt={selectedTicket.eventId?.event || 'Event'} fill sizes="(max-width: 768px) 100vw, 70vw" className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#FFA500]/20 to-indigo-100" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 text-left">
                        <div className="text-white font-extrabold tracking-wide text-2xl md:text-3xl leading-tight">EVENT TICKET</div>
                        <div className="text-white/90 text-sm mt-1 line-clamp-1">{selectedTicket.eventId?.event}</div>
                      </div>
                    </div>

                    <div className="p-5 text-left">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">Date</div>
                          <div className="text-white font-bold">{selectedTicket.eventId?.date ? new Date(selectedTicket.eventId.date).toLocaleDateString() : '—'}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">Time</div>
                          <div className="text-white font-bold">{selectedTicket.eventId?.time || '—'}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 sm:col-span-2">
                          <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">Location</div>
                          <div className="text-white font-bold line-clamp-1">{selectedTicket.eventId?.location || '—'}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">Ticket Id</div>
                          <div className="text-white font-mono text-xs break-all">{selectedTicket.ticketId}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">Token Id</div>
                          <div className="text-white font-bold">{selectedTicket.tokenId ?? '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 bg-white/5 border-t md:border-t-0 md:border-l border-white/10 p-5 flex flex-col justify-between">
                    <div className="text-left">
                      <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">Entry QR (rotates)</div>
                      <div className="mt-3 bg-white/5 rounded-2xl border border-white/10 shadow-sm p-3 flex items-center justify-center">
                        {qrToken ? (
                          <QRCodeCanvas value={qrToken} size={140} />
                        ) : (
                          <div className="w-[140px] h-[140px] flex items-center justify-center text-white/60 text-sm">Generating...</div>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-white/60">⚠️ QR rotates every 60 seconds. Do not screenshot.</div>
                    </div>

                    <div className="mt-5">
                      <div className="h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex">
                        {Array.from({ length: 36 }).map((_, i) => (
                          <div key={i} className={`h-full ${i % 3 === 0 ? 'w-[3px]' : 'w-[2px]'} ${i % 4 === 0 ? 'bg-white/70' : 'bg-white/20'}`} />
                        ))}
                      </div>
                      <div className="mt-3 space-y-2 text-left text-xs">
                        <div>
                          <div className="text-white/60">Royalty</div>
                          <div className="font-semibold text-white">
                            {(() => { const bps = typeof selectedTicket.royaltyBps === 'number' ? selectedTicket.royaltyBps : 0; return `${Math.max(0, Math.min(1000, bps)) / 100}%`; })()}
                          </div>
                        </div>
                        {selectedTicket.royaltyReceiverWallet && (
                          <div>
                            <div className="text-white/60">Receiver</div>
                            <div className="font-mono break-all text-[11px] text-white/80">{selectedTicket.royaltyReceiverWallet}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-white/60">Mint Tx</div>
                          <div className="font-mono break-all text-[11px] text-white/80">{selectedTicket.txHash || '—'}</div>
                        </div>
                        <div>
                          <div className="text-white/60">Claim Tx</div>
                          <div className="font-mono break-all text-[11px] text-white/80">{selectedTicket.claimTxHash || '—'}</div>
                        </div>
                        <div>
                          <div className="text-white/60">Last On-Chain Tx</div>
                          <div className="font-mono break-all text-[11px] text-white/80">{selectedTicket.lastOnChainTxHash || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedTicket.custodial ? (
                    <>
                      {!selectedTicket.isForResale && (
                        <button onClick={() => handleClaim(selectedTicket.ticketId)} disabled={claiming} className="w-full py-2.5 text-sm bg-[#FFA500] text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">
                          {claiming ? 'Transferring...' : 'Claim to My MetaMask'}
                        </button>
                      )}
                      {!selectedTicket.isForResale && (
                        <button
                          onClick={() => { const p = prompt('Enter resale price (Rs):'); if (p && !isNaN(parseFloat(p)) && parseFloat(p) > 0) { handleResale(selectedTicket.ticketId, p); } else if (p) { toast.error('Please enter a valid price'); } }}
                          disabled={reselling}
                          className="w-full py-2.5 text-sm bg-white/10 border border-[#FFA500]/30 text-[#FFA500]/80 rounded-lg font-semibold hover:bg-white/15 transition disabled:opacity-50"
                        >
                          {reselling ? 'Listing...' : 'List for Resale'}
                        </button>
                      )}
                      {selectedTicket.isForResale && (
                        <>
                          <div className="p-4 bg-[#FFA500]/10 text-[#FFA500]/90 rounded-xl text-sm font-medium border border-[#FFA500]/20">✓ Listed for resale at Rs {selectedTicket.resalePrice}</div>
                          <button onClick={() => handleDelist(selectedTicket.ticketId)} disabled={delisting} className="w-full py-2.5 text-sm bg-red-500/10 border border-red-400/20 text-red-200 rounded-lg font-semibold hover:bg-red-500/15 transition disabled:opacity-50">
                            {delisting ? 'Removing...' : 'Cancel Listing & Remove from Marketplace'}
                          </button>
                          <p className="text-xs text-white/60 text-center">After cancelling, you can claim the ticket back to your wallet.</p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="p-4 bg-green-500/10 text-green-200 rounded-xl text-sm font-medium border border-green-400/20 mb-3">✓ This ticket is in your private wallet</div>
                      {!selectedTicket.isForResale && (
                        <button
                          onClick={() => { const p = prompt('Enter resale price (Rs):'); if (p && !isNaN(parseFloat(p)) && parseFloat(p) > 0) { handleResale(selectedTicket.ticketId, p); } else if (p) { toast.error('Please enter a valid price'); } }}
                          disabled={reselling}
                          className="w-full py-2.5 text-sm bg-white/10 border border-[#FFA500]/30 text-[#FFA500]/80 rounded-lg font-semibold hover:bg-white/15 transition disabled:opacity-50"
                        >
                          {reselling ? 'Listing (returning to platform custody)...' : 'List for Resale'}
                        </button>
                      )}
                      {selectedTicket.isForResale && (
                        <>
                          <div className="p-4 bg-[#FFA500]/10 text-[#FFA500]/90 rounded-xl text-sm font-medium border border-[#FFA500]/20">✓ Listed for resale at Rs {selectedTicket.resalePrice}</div>
                          <button onClick={() => handleDelist(selectedTicket.ticketId)} disabled={delisting} className="w-full py-2.5 text-sm bg-red-500/10 border border-red-400/20 text-red-200 rounded-lg font-semibold hover:bg-red-500/15 transition disabled:opacity-50">
                            {delisting ? 'Removing...' : 'Cancel Listing & Remove from Marketplace'}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}