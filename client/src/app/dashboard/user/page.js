// app/dashboard/user/page.js
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [notifications,  setNotifications]  = useState([]);
  const [notifLoading,   setNotifLoading]   = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [qrToken,        setQrToken]        = useState('');
  const [qrLoading,      setQrLoading]      = useState(false);
  const [showQrModal,    setShowQrModal]    = useState(false);
  const [claiming,       setClaiming]       = useState(false);
  const [reselling,      setReselling]      = useState(false);
  const [delisting,      setDelisting]      = useState(false);
  const { user } = useAuth();
  const router   = useRouter();

  const copyToClipboard = async (value, label) => {
    if (!value) {
      toast.error(`${label} is not available yet`);
      return;
    }

    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const getContractAddress = useCallback((ticket) => (
    ticket?.contractAddress || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''
  ), []);

  const openTicketModal = useCallback((ticket) => {
    setSelectedTicket(ticket);
    setQrToken('');
    setShowQrModal(true);
  }, []);

  const closeTicketModal = useCallback(() => {
    setShowQrModal(false);
    setQrToken('');
  }, []);

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

  // Fetch notifications (waitlist + others)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res  = await fetch(`/api/notifications?firebase_uid=${user.uid}`);
        const data = await res.json();
        if (data.success) setNotifications(data.notifications || []);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setNotifLoading(false);
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
  const fetchQrCode = useCallback(async (ticketId, { showLoading = false } = {}) => {
    try {
      if (showLoading) setQrLoading(true);
      const res  = await fetch(`/api/tickets/${ticketId}/qr`);
      const data = await res.json();
      if (data.qrCode) setQrToken(data.qrCode);
    } catch (error) {
      console.error('Error fetching QR:', error);
    } finally {
      if (showLoading) setQrLoading(false);
    }
  }, []);

  const selectedTicketId = selectedTicket?.ticketId;

  useEffect(() => {
    let interval;
    if (showQrModal && selectedTicketId) {
      fetchQrCode(selectedTicketId, { showLoading: true });
      interval = setInterval(() => fetchQrCode(selectedTicketId), 45000);
    }
    return () => clearInterval(interval);
  }, [showQrModal, selectedTicketId, fetchQrCode]);

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

  const promptForResalePrice = (ticketId) => {
    const price = prompt('Enter resale price (Rs):');
    const parsedPrice = parseFloat(price);

    if (!price) return;
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    handleResale(ticketId, parsedPrice);
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
  const ticketStats = useMemo(() => {
    const now = new Date();
    const upcoming = tickets.filter(t => t.eventId?.date && new Date(t.eventId.date) >= now);
    const past = tickets.filter(t => t.eventId?.date && new Date(t.eventId.date) < now);
    const spent = tickets.reduce((sum, t) => sum + (t.eventId?.price || 0), 0);

    return { upcoming, past, spent };
  }, [tickets]);

  const upcomingTickets = ticketStats.upcoming;
  const pastTickets     = ticketStats.past;
  const totalSpent      = ticketStats.spent;

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
            onClick={() => openTicketModal(ticket)}
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

  function InfoTile({ label, value, className = '' }) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{label}</div>
        <div className="mt-1 text-sm font-semibold text-white break-words">{value || '-'}</div>
      </div>
    );
  }

  function CopyField({ label, value, copyLabel = label, helper }) {
    const hasValue = value !== null && value !== undefined && value !== '';

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{label}</div>
            {helper && <div className="mt-1 text-xs leading-relaxed text-white/55">{helper}</div>}
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(value, copyLabel)}
            disabled={!hasValue}
            className="shrink-0 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copy
          </button>
        </div>
        <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 font-mono text-xs leading-relaxed text-white/85 break-all">
          {hasValue ? value : 'Not available'}
        </div>
      </div>
    );
  }

  function TicketStatus({ ticket }) {
    if (ticket.isForResale) {
      return <span className="rounded-full bg-[#FFA500]/20 px-3 py-1 text-xs font-semibold text-[#FFA500]">Listed for resale</span>;
    }

    if (ticket.custodial) {
      return <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">Platform custody</span>;
    }

    return <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-200">In wallet</span>;
  }

  function TicketModal() {
    const ticket = selectedTicket;
    const event = ticket?.eventId;
    if (!ticket || !event) return null;

    const contractAddress = getContractAddress(ticket);
    const royaltyBps = typeof ticket.royaltyBps === 'number' ? ticket.royaltyBps : 0;
    const royaltyPercent = `${Math.max(0, Math.min(1000, royaltyBps)) / 100}%`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
        <div className="flex h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950 text-white shadow-2xl">
          <div className="shrink-0 flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <TicketStatus ticket={ticket} />
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/65">Sepolia ERC-721</span>
              </div>
              <h2 className="truncate text-2xl font-bold">{event.event}</h2>
              <p className="mt-1 text-sm text-white/60">Ticket, QR access, blockchain details, and wallet import information.</p>
            </div>
            <button
              type="button"
              onClick={closeTicketModal}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="relative h-56 w-full bg-white/5">
                  {event.image ? (
                    <Image
                      src={event.image}
                      alt={event.event || 'Event'}
                      fill
                      sizes="(max-width: 1024px) 100vw, 700px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/50">No event image</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFA500]">BlockTix Ticket</div>
                    <div className="mt-1 line-clamp-2 text-3xl font-black leading-tight text-white">{event.event}</div>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoTile label="Date" value={event.date ? new Date(event.date).toLocaleDateString() : '-'} />
                    <InfoTile label="Time" value={event.time || '-'} />
                    <InfoTile label="Location" value={event.location || '-'} className="sm:col-span-2" />
                    <InfoTile label="Ticket ID" value={ticket.ticketId} />
                    <InfoTile label="Token ID" value={ticket.tokenId ?? 'Not minted yet'} />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm font-bold text-white">Import in MetaMask</div>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">
                      Open MetaMask, switch to Sepolia, go to NFTs, choose Import NFT, then paste the contract address and token ID below.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <CopyField label="Contract Address" value={contractAddress} copyLabel="Contract address" />
                      <CopyField label="Token ID" value={ticket.tokenId} copyLabel="Token ID" />
                    </div>
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Entry QR</div>
                  <div className="mt-3 flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-white p-4">
                    {qrToken ? (
                      <QRCodeCanvas value={qrToken} size={190} />
                    ) : (
                      <div className="flex h-[190px] w-[190px] items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500">
                        {qrLoading ? 'Generating QR...' : 'QR unavailable'}
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/55">The QR refreshes automatically. Keep this screen open at entry.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-sm font-bold">Blockchain Summary</div>
                  <div className="mt-4 space-y-3 text-xs">
                    <CopyField label="Mint Tx" value={ticket.txHash} copyLabel="Mint transaction" />
                    <InfoTile label="Royalty" value={royaltyPercent} />
                    {ticket.royaltyReceiverWallet && (
                      <CopyField label="Royalty Receiver" value={ticket.royaltyReceiverWallet} copyLabel="Royalty receiver" />
                    )}
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              {ticket.custodial ? (
                <div className="space-y-3">
                  {!ticket.isForResale && (
                    <button onClick={() => handleClaim(ticket.ticketId)} disabled={claiming} className="w-full rounded-xl bg-[#FFA500] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                      {claiming ? 'Transferring...' : 'Claim to My MetaMask'}
                    </button>
                  )}
                  {!ticket.isForResale && (
                    <button
                      onClick={() => promptForResalePrice(ticket.ticketId)}
                      disabled={reselling}
                      className="w-full rounded-xl border border-[#FFA500]/30 bg-white/5 px-4 py-3 text-sm font-semibold text-[#FFA500] transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {reselling ? 'Listing...' : 'List for Resale'}
                    </button>
                  )}
                  {ticket.isForResale && (
                    <>
                      <div className="rounded-xl border border-[#FFA500]/20 bg-[#FFA500]/10 p-4 text-sm font-medium text-[#FFA500]">
                        Listed for resale at Rs {ticket.resalePrice}
                      </div>
                      <button onClick={() => handleDelist(ticket.ticketId)} disabled={delisting} className="w-full rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 disabled:opacity-50">
                        {delisting ? 'Removing...' : 'Cancel Listing'}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-green-400/20 bg-green-500/10 p-4 text-sm font-medium text-green-200">
                    This ticket is currently in your private wallet.
                  </div>
                  {!ticket.isForResale && (
                    <button
                      onClick={() => promptForResalePrice(ticket.ticketId)}
                      disabled={reselling}
                      className="w-full rounded-xl border border-[#FFA500]/30 bg-white/5 px-4 py-3 text-sm font-semibold text-[#FFA500] transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {reselling ? 'Listing...' : 'List for Resale'}
                    </button>
                  )}
                </div>
              )}
            </div>
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
              { key: 'notifications', label: `Notifications (${notifications.length})` },
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
                <p className="text-gray-700 dark:text-white/70">You have not attended any events yet.</p>
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
                  Save events by clicking the button on any event page.
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

          {/* Notifications */}
          {activeTab === 'notifications' && (
            notifLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white/10 rounded-lg p-4 border border-white/10">
                    <Skeleton variant="text" className="w-3/4 mb-2" />
                    <Skeleton variant="text" className="w-1/2" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Notifications</h3>
                <p className="text-gray-700 dark:text-white/70">
                  Waitlist and system updates will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white/80"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="font-semibold text-white">{n.type || 'notification'}</div>
                      <div className="text-xs text-white/60 whitespace-nowrap">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                      </div>
                    </div>
                    <div className="mt-1 text-white/80">{n.message}</div>
                    {n.reservedUntil && (
                      <div className="mt-1 text-sm text-white/70">
                        Reserved until {new Date(n.reservedUntil).toLocaleString()}
                      </div>
                    )}
                    {n.eventId?.eventId && (
                      <button
                        onClick={() => router.push(`/event/${n.eventId.eventId}`)}
                        className="btn-sm mt-3"
                      >
                        View Event
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {showQrModal && selectedTicket && <TicketModal />}
      </main>
    </ProtectedRoute>
  );
}
