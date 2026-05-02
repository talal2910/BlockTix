//app/event/[id]/page.js
'use client';

<<<<<<< HEAD
import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
=======
import React, { useCallback, useEffect, useRef, useState } from 'react';
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaHeart, FaRegHeart } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import Skeleton from '@/app/components/Skeleton';

<<<<<<< HEAD
=======
// Fire-and-forget: must never throw or block the UI
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
function recordInteraction(firebase_uid, event_id, interaction_type) {
  if (!firebase_uid || !event_id) return;
  fetch('/api/recommendations/record', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ firebase_uid, event_id, interaction_type }),
  }).catch(() => {});
}

 const EventMap = dynamic(
    () => import('@/app/components/EventMap'),
    { ssr: false }
  );

function Event() {
  const params = useParams();
  const router = useRouter();
<<<<<<< HEAD
  const id     = params.id;   // eventId UUID
=======
  const id = params.id; // eventId UUID
  const checkoutFinalizedRef = useRef(false);
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)

  const [event,      setEvent]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [isBuying,   setIsBuying]   = useState(false);
  const [error,      setError]      = useState(null);
  const [isSaved,    setIsSaved]    = useState(false);
  const [savingWish, setSavingWish] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState('none');
  const [joiningWaitlist,setJoiningWaitlist]= useState(false);
  const [canBuy,         setCanBuy]         = useState(true);
  const [buyBlockMessage,setBuyBlockMessage]= useState(null);
  const [organizer,      setOrganizer]      = useState(null);
  const [organizerBusy,  setOrganizerBusy]  = useState(false);
  const [ratingSummary,  setRatingSummary]  = useState({
    averageRating: 0, ratingsCount: 0, canRate: false, userRating: null,
  });
  const [selectedRating, setSelectedRating] = useState(0);
  const ratingCommentRef = React.useRef('');
  const [submittingRating,setSubmittingRating] = useState(false);

  const { user } = useAuth();

<<<<<<< HEAD
=======
  const EventMap = dynamic(
    () => import('@/app/components/EventMap'),
    { ssr: false }
  );

>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
  const fetchEvent = useCallback(async () => {
    try {
      const res  = await fetch(`/api/events/${id}`);
      const data = await res.json();
      setEvent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch event on mount
  useEffect(() => {
    if (id) fetchEvent();
<<<<<<< HEAD
   }, [id, fetchEvent]);
=======
  }, [id, fetchEvent]);
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)

  useEffect(() => {
    if (!event?.organizerId) return;
    let cancelled = false;
    const fetchOrganizer = async () => {
      try {
        const qs  = user?.uid ? `?viewerId=${encodeURIComponent(user.uid)}` : '';
        const res = await fetch(`/api/organizers/${encodeURIComponent(event.organizerId)}${qs}`);
        const data = await res.json();
        if (!cancelled && res.ok && data.success) setOrganizer(data.organizer);
      } catch {
        if (!cancelled) setOrganizer(null);
      }
    };
    fetchOrganizer();
    return () => { cancelled = true; };
  }, [event?.organizerId, user?.uid]);

  const fetchRatings = useCallback(async () => {
    if (!id) return;
    try {
      const qs   = user?.uid ? `?userId=${encodeURIComponent(user.uid)}` : '';
      const res  = await fetch(`/api/events/${id}/ratings${qs}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRatingSummary({
          averageRating: data.averageRating || 0,
          ratingsCount : data.ratingsCount  || 0,
          canRate      : Boolean(data.canRate),
          userRating   : data.userRating    || null,
        });
        setSelectedRating(data.userRating?.rating || 0);
        ratingCommentRef.current = data.userRating?.comment || '';
      }
    } catch {}
  }, [id, user?.uid]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  useEffect(() => {
    if (id && user?.uid && event) recordInteraction(user.uid, id, 'view');
  }, [id, user?.uid, event]);

  useEffect(() => {
    if (!user?.uid || !id) return;
    fetch(`/api/wishlist?firebase_uid=${user.uid}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const alreadySaved = data.savedEvents.some(e => e.eventId === id);
          setIsSaved(alreadySaved);
        }
      })
      .catch(() => {});
  }, [user?.uid, id]);

  useEffect(() => {
    if (!user?.uid || !id) return;
    fetch(`/api/waitlist?firebase_uid=${user.uid}&event_id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setWaitlistStatus(data.status || (data.joined ? 'waiting' : 'none'));
        }
      })
      .catch(() => {});
  }, [user?.uid, id]);

  const refreshAvailability = useCallback(async () => {
    if (!id) return;
    try {
      const qs = user?.uid
        ? `?event_id=${encodeURIComponent(id)}&firebase_uid=${encodeURIComponent(user.uid)}`
        : `?event_id=${encodeURIComponent(id)}`;
      const res = await fetch(`/api/waitlist/availability${qs}`);
      const data = await res.json();
      if (data.success) {
        setCanBuy(!!data.canBuy);
        setBuyBlockMessage(data.message || null);
      }
    } catch {
      // ignore
    }
  }, [id, user?.uid]);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  useEffect(() => {
    if (!id) return;
    // Poll lightly so the buy button updates after restocks
    const interval = setInterval(() => {
      refreshAvailability();
    }, 15000);
    return () => clearInterval(interval);
  }, [id, refreshAvailability]);

  async function handleJoinWaitlist() {
    if (!user) { toast.error('Login to join waitlist'); return; }
    try {
      setJoiningWaitlist(true);
      const res  = await fetch('/api/waitlist', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ firebase_uid: user.uid, event_id: id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Unable to join waitlist'); return; }
      setWaitlistStatus('waiting');
      toast.success('Joined waitlist');
      refreshAvailability();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoiningWaitlist(false);
    }
  }

  async function handleToggleWishlist() {
    if (!user) { toast.error('Login to save events'); return; }
    try {
      setSavingWish(true);
      const res  = await fetch('/api/wishlist', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ firebase_uid: user.uid, event_id: id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Something went wrong'); return; }
      setIsSaved(data.saved);
      toast.success(data.saved ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingWish(false);
    }
  }

  async function handleToggleOrganizerFollow() {
    if (!user?.uid) { toast.error('Login to follow organizers'); router.push('/login'); return; }
    if (!event?.organizerId) return;
    try {
      setOrganizerBusy(true);
      const res  = await fetch(`/api/organizers/${encodeURIComponent(event.organizerId)}/follow`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Unable to update follow'); return; }
      setOrganizer(prev => ({ ...(prev || {}), isFollowing: data.isFollowing, followersCount: data.followersCount }));
      toast.success(data.isFollowing ? 'Following organizer' : 'Unfollowed organizer');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOrganizerBusy(false);
    }
<<<<<<< HEAD
  }

  async function handleSubmitRating() {
    if (!user?.uid)      { toast.error('Login to rate events'); return; }
    if (!selectedRating) { toast.error('Choose a rating first'); return; }
    try {
      setSubmittingRating(true);
      const res  = await fetch(`/api/events/${id}/ratings`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, rating: selectedRating, comment: ratingCommentRef.current }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || 'Unable to save rating'); return; }
      setRatingSummary(prev => ({
        ...prev,
        averageRating: data.averageRating || 0,
        ratingsCount : data.ratingsCount  || 0,
        userRating   : data.rating,
      }));
      toast.success('Rating saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingRating(false);
    }
  }

  async function handleBuyTicket() {
    if (!user) { toast.error('Login to buy tickets'); return; }
    try {
      setIsBuying(true);
      const res  = await fetch('/api/tickets', {
=======
    if (!event || event.remainingTickets <= 0) {
      toast.error('This event is sold out');
      return;
    }

    try {
      setIsBuying(true);
      const res = await fetch('/api/stripe/checkout', {
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          eventId: id,
          userId: user.uid,
          userEmail: user.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Something went wrong'); return; }
<<<<<<< HEAD
      toast.success('🎟️ Ticket purchased successfully!');
      recordInteraction(user.uid, id, 'purchase');
      fetchEvent();
      refreshAvailability();
=======
      if (!data.url) { toast.error('Unable to open Stripe Checkout'); return; }

      window.location.href = data.url;
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsBuying(false);
    }
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const checkoutStatus = searchParams.get('checkout');
    const stripeSessionId = searchParams.get('session_id');

    if (checkoutStatus === 'cancelled') {
      toast.error('Payment cancelled. No ticket was created.');
      router.replace(`/event/${id}`, { scroll: false });
      return;
    }

    if (
      checkoutStatus !== 'success' ||
      !stripeSessionId ||
      !user?.uid ||
      !event?._id ||
      checkoutFinalizedRef.current
    ) {
      return;
    }

    checkoutFinalizedRef.current = true;

    async function finalizeTicketPurchase() {
      try {
        setIsBuying(true);
        const res = await fetch('/api/tickets', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            eventId: event._id,
            userId: user.uid,
            stripeSessionId,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error || 'Payment verified, but ticket creation failed.');
          return;
        }

        toast.success(data.alreadyProcessed ? 'Ticket already issued for this payment.' : 'Ticket purchased successfully!');
        recordInteraction(user.uid, id, 'purchase');
        await fetchEvent();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setIsBuying(false);
        router.replace(`/event/${id}`, { scroll: false });
      }
    }

    finalizeTicketPurchase();
  }, [user?.uid, event?._id, id, router, fetchEvent]);

  if (loading) {
    return (
      <div className="min-h-screen">
        {/* HERO SKELETON */}
        <div className="p-4 md:p-8">
          <div className="relative flex h-[500px] w-full items-end rounded-3xl overflow-hidden shadow-2xl">
            <Skeleton className="absolute inset-0 rounded-3xl" />
            <div className="relative z-10 w-full p-8">
              <div className="mx-auto max-w-7xl space-y-4">
                <Skeleton className="h-12 w-3/4" variant="rect" />
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-10 w-32" variant="rect" />
                  <Skeleton className="h-10 w-32" variant="rect" />
                  <Skeleton className="h-10 w-32" variant="rect" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT GRID SKELETON */}
        <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* ABOUT SKELETON */}
          <div className="lg:col-span-2 rounded-3xl bg-white/10 backdrop-blur-md p-10 shadow-lg border border-white/10">
            <Skeleton className="h-8 w-40 mb-6" variant="rect" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" variant="text" />
              <Skeleton className="h-4 w-full" variant="text" />
              <Skeleton className="h-4 w-3/4" variant="text" />
            </div>
          </div>

          {/* TICKETS SKELETON */}
          <div className="lg:col-span-1 lg:row-span-2 rounded-3xl border border-white/10 bg-white/10 p-8 shadow-xl backdrop-blur-md">
            <Skeleton className="h-8 w-32 mx-auto mb-8" variant="rect" />
            <div className="mb-8 text-center space-y-4">
              <Skeleton className="h-10 w-24 mx-auto" variant="rect" />
              <Skeleton className="h-6 w-32 mx-auto" variant="rect" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" variant="rect" />
          </div>

          {/* LOCATION SKELETON */}
          <div className="lg:col-span-2 rounded-3xl bg-white/10 backdrop-blur-md p-8 shadow-lg border border-white/10">
            <Skeleton className="h-8 w-40 mb-6" variant="rect" />
            <Skeleton className="h-64 w-full rounded-2xl" variant="rect" />
          </div>
        </div>
      </div>
    );
  }
  if (error)   return <p className="p-6 text-red-500">{error}</p>;
  if (!event)  return <p className="p-6">No event found</p>;

  const googleMapsUrl = event.latitude && event.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
    : null;

<<<<<<< HEAD
  const eb              = event.earlyBird;
  const now             = new Date();
  const isTimeValid     = eb?.enabled && eb.endDate && now <= new Date(eb.endDate);
  const isQuotaValid    = eb?.enabled && typeof eb.maxTickets === 'number' && (eb.soldCount ?? 0) < eb.maxTickets;
  const earlyBirdActive = eb?.enabled && (isTimeValid || isQuotaValid);
=======
  const eb           = event.earlyBird;
  const now          = new Date();
  const isTimeValid  = eb?.enabled && eb.endDate && now <= new Date(eb.endDate);
  const isQuotaValid = eb?.enabled && typeof eb.maxTickets === 'number' && (eb.soldCount ?? 0) < eb.maxTickets;
  const earlyBirdActive = eb?.enabled && isTimeValid && isQuotaValid;
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)

  const organizerRatingLabel = organizer?.ratingsCount
    ? `${Number(organizer.averageRating || 0).toFixed(1)} / 5`
    : 'No ratings yet';
  const eventRatingLabel = ratingSummary.ratingsCount
    ? `${Number(ratingSummary.averageRating || 0).toFixed(1)} / 5`
    : 'No ratings yet';

  const cardBase = 'rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-lg';

  return (
    <div className="min-h-screen">

      {/* ── HERO ── */}
      <div className="p-4 md:p-8">
        <div
          className="relative flex h-[500px] w-full items-end bg-cover bg-center rounded-3xl overflow-hidden shadow-2xl"
          style={{ backgroundImage: `url(${event.image})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {user && (
            <button
              onClick={handleToggleWishlist}
              disabled={savingWish}
              className="absolute top-6 right-6 z-20 flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-white backdrop-blur-md hover:bg-black/60 transition disabled:opacity-60"
              title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              {isSaved
                ? <FaHeart    className="text-red-400 text-lg" />
                : <FaRegHeart className="text-white  text-lg" />
              }
            </button>
          )}

          <div className="relative z-10 w-full p-8">
            <div className="mx-auto max-w-7xl space-y-4 text-white">
              <h1 className="text-4xl md:text-5xl font-extrabold">{event.event}</h1>
              <div className="flex flex-wrap gap-3">
                <span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur-md">
                  <FaCalendarAlt /> {new Date(event.date).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur-md">
                  <FaClock /> {event.time}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur-md">
                  <FaMapMarkerAlt /> {event.location}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="mx-auto max-w-7xl px-4 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── TICKET PANEL — sticky sidebar, spans all rows ── */}
        <div className="lg:col-start-3 lg:row-start-1 lg:row-span-5 lg:sticky lg:top-20 self-start">
          <div className={`${cardBase} p-8`}>
            <h2 className="mb-6 text-center text-2xl font-bold text-white">Get Tickets</h2>

            {buyBlockMessage && (
              <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70 leading-relaxed">
                {buyBlockMessage}
              </div>
            )}

            <div className="mb-6 text-center">
              {earlyBirdActive ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-green-400">
                    Early Bird
                  </span>
                  <span className="text-4xl font-extrabold text-green-400">
                    Rs {event.earlyBird.discountPrice}
                  </span>
                  <span className="text-base line-through text-white/40">
                    Rs {event.price}
                  </span>
                </div>
              ) : (
                <span className="text-4xl font-extrabold text-[#FFA500]">
                  Rs {event.price}
                </span>
              )}
            </div>

          <button
            onClick={handleBuyTicket}
<<<<<<< HEAD
            disabled={event.remainingTickets === 0 || !canBuy}
            className={`w-full rounded-xl py-4 px-6 text-lg font-semibold shadow-lg transition cursor-pointer
              ${event.remainingTickets > 0 && canBuy
=======
            disabled={event.remainingTickets === 0 || isBuying}
            className={`w-full rounded-xl py-4 px-6 text-lg font-semibold shadow-lg transition cursor-pointer
              ${event.remainingTickets > 0 && !isBuying
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
                ? 'bg-gradient-to-r from-[#FFA500] to-indigo-600 text-white'
                : 'bg-white/10 text-white/50 cursor-not-allowed'
              }`}
          >
<<<<<<< HEAD
            {event.remainingTickets > 0 && canBuy ? 'Buy Tickets' : 'Sold Out'}
=======
            {event.remainingTickets === 0 ? 'Sold Out' : isBuying ? 'Preparing Checkout...' : 'Buy Tickets'}
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
          </button>

            {!canBuy && user && (
              <div className="mt-4">
                {waitlistStatus === 'waiting' || waitlistStatus === 'notified' ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/70">
                    You are on the waitlist
                  </div>
                ) : (
                  <button
                    onClick={handleJoinWaitlist}
                    disabled={joiningWaitlist}
                    className="w-full rounded-2xl border border-white/20 bg-white/5 py-3 px-6 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
                  >
                    {joiningWaitlist ? 'Joining…' : 'Join Waitlist'}
                  </button>
                )}
              </div>
            )}

            {event.remainingTickets > 0 && (
              <p className="mt-4 text-center text-xs text-white/40">
                {event.remainingTickets} ticket{event.remainingTickets === 1 ? '' : 's'} remaining
              </p>
            )}
          </div>
        </div>

        {/* ── ABOUT ── */}
        <div className={`lg:col-span-2 ${cardBase} p-8`}>
          <h3 className="mb-4 text-2xl font-bold text-white">About This Event</h3>
          <p className="text-base leading-relaxed text-white/70">
            {event.description || 'Join us for an unforgettable experience! This event promises to deliver amazing moments and create lasting memories.'}
          </p>
        </div>

        {/* ── ORGANIZER ── */}
        <div className={`lg:col-span-2 ${cardBase} overflow-hidden`}>
          {/* header strip — uses the same glass style, accent with a subtle orange tint */}
          <div className="relative flex items-center gap-5 p-6 md:p-8 border-b border-white/10">

            {/* Avatar */}
            <button
              onClick={() => event.organizerId && router.push(`/organizer/${event.organizerId}`)}
              className="h-20 w-20 flex-shrink-0 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-3xl font-bold text-[#FFA500] overflow-hidden hover:opacity-80 transition"
            >
              {organizer?.profilePicture ? (
                <Image
                  src={organizer.profilePicture}
                  alt={organizer.name}
                  width={80} height={80}
                  className="h-full w-full object-cover"
                />
              ) : (
                organizer?.name?.slice(0, 1)?.toUpperCase() || 'O'
              )}
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Organizer</p>
              <button
                onClick={() => event.organizerId && router.push(`/organizer/${event.organizerId}`)}
                className="text-xl font-bold text-black/80 hover:text-[#FFA500] transition truncate block"
              >
                {organizer?.name || 'Organizer'}
              </button>
              <p className="mt-1 text-sm text-white/50">
                <span className="text-[#FFA500] font-semibold">{organizerRatingLabel}</span>
                <span className="mx-2 text-white/20">·</span>
                {organizer?.followersCount || 0} followers
              </p>
            </div>

            {/* Follow button — only for other users */}
            {user?.uid !== event.organizerId && (
              <button
                onClick={handleToggleOrganizerFollow}
                disabled={organizerBusy}
                className={`flex-shrink-0 rounded-xl px-5 py-2 text-sm font-semibold border transition disabled:opacity-50
                  ${organizer?.isFollowing
                    ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                    : 'border-[#FFA500] bg-[#FFA500]/10 text-[#FFA500] hover:bg-[#FFA500]/20'
                  }`}
              >
                {organizerBusy ? 'Saving…' : organizer?.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Bio / extra info if available */}
          {organizer?.bio && (
            <p className="px-6 md:px-8 py-5 text-sm text-white/60 leading-relaxed">
              {organizer.bio}
            </p>
          )}
        </div>

        {/* ── RATINGS ── */}
        <div className={`lg:col-span-2 ${cardBase} p-8 min-h-[280px]`}>
          <h3 className="mb-1 text-2xl font-bold text-white">Event Ratings</h3>
          <p className="mb-6 text-sm text-white/50">
            <span className="text-[#FFA500] font-semibold">{eventRatingLabel}</span>
            {ratingSummary.ratingsCount > 0 && (
              <span className="ml-2">
                ({ratingSummary.ratingsCount} rating{ratingSummary.ratingsCount === 1 ? '' : 's'})
              </span>
            )}
          </p>

          {ratingSummary.canRate ? (
            <div className="space-y-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star)}
                    className={`text-3xl transition-transform hover:scale-110 bg-transparent border-none outline-none ${selectedRating >= star ? 'text-[#FFA500]' : 'text-white/20'}`}
                    aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                defaultValue={ratingSummary.userRating?.comment || ''}
                onChange={e => { ratingCommentRef.current = e.target.value; }}
                maxLength={1000}
                placeholder="Leave an optional comment…"
                className="w-full h-[96px] rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-[#FFA500]/40 resize-none"
              />
              <button
                onClick={handleSubmitRating}
                disabled={submittingRating}
                className="rounded-2xl bg-[#FFA500]/10 border border-[#FFA500]/30 text-[#FFA500] px-6 py-2.5 text-sm font-semibold hover:bg-[#FFA500]/20 transition disabled:opacity-50"
              >
                {submittingRating ? 'Saving…' : ratingSummary.userRating ? 'Update Rating' : 'Submit Rating'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/50 leading-relaxed">
              {!user
                  ? 'Login to rate this event.'
                  : 'Only users who purchased a ticket can leave a rating'}
            </div>
          )}
        </div>

        {/* LOCATION */}
        <div className={`lg:col-span-2 ${cardBase} p-8`}>
          <h3 className="mb-6 text-2xl font-bold text-white">Event Location</h3>
          {event.latitude && event.longitude && (
            <EventMap
              latitude={event.latitude}
              longitude={event.longitude}
              title={event.event}
            />
          )}
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[#FFA500]/30 bg-[#FFA500]/10 px-5 py-2.5 text-sm font-semibold text-[#FFA500] hover:bg-[#FFA500]/20 transition no-underline"
            >
              Open in Google Maps
            </a>
          )}
        </div>
      </div>

      {/* BUYING OVERLAY */}
      {isBuying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl">
<<<<<<< HEAD
          <div className="text-white text-xl animate-pulse">Processing Ticket…</div>
=======
          <div className="rounded-2xl border border-white/10 bg-gray-950/90 px-8 py-6 text-center shadow-2xl">
            <div className="text-white text-xl font-semibold animate-pulse">Securing your ticket...</div>
            <p className="mt-2 text-sm text-white/60">Keep this page open while payment and ticket issuance finish.</p>
          </div>
>>>>>>> bad86bf (feat: integrate stripe and ticket metadata logic)
        </div>
      )}
    </div>
  );
}

export default Event;
