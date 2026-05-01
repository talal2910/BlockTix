'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

function formatRating(value) {
  const rating = Number(value || 0);
  return rating > 0 ? rating.toFixed(1) : 'No ratings yet';
}

export default function OrganizerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [organizer, setOrganizer] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingBusy, setFollowingBusy] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const loadOrganizer = async () => {
      try {
        setLoading(true);
        const qs = user?.uid ? `?viewerId=${encodeURIComponent(user.uid)}` : '';
        const res = await fetch(`/api/organizers/${encodeURIComponent(id)}${qs}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Organizer not found');
        }

        if (!cancelled) {
          setOrganizer(data.organizer);
          setEvents(data.events || []);
        }
      } catch (error) {
        if (!cancelled) toast.error(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadOrganizer();
    return () => { cancelled = true; };
  }, [id, user?.uid]);

  async function handleFollow() {
    if (!user?.uid) {
      toast.error('Login to follow organizers');
      router.push('/login');
      return;
    }

    try {
      setFollowingBusy(true);
      const res = await fetch(`/api/organizers/${encodeURIComponent(id)}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Unable to update follow');
        return;
      }

      setOrganizer((prev) => ({
        ...prev,
        isFollowing: data.isFollowing,
        followersCount: data.followersCount,
      }));
      toast.success(data.isFollowing ? 'Following organizer' : 'Unfollowed organizer');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setFollowingBusy(false);
    }
  }

  if (loading) return <main className="min-h-screen animate-pulse" />;

  if (!organizer) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="max-w-5xl mx-auto rounded-2xl border border-white/10 bg-white/10 p-8 text-white">
          Organizer not found.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 bg-white/10 backdrop-blur-sm">
      <section className="max-w-7xl mx-auto overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
        <div className="relative min-h-[330px] bg-gradient-to-br from-white/10 via-gray-900/60 to-[#FFA500]/10">
          <div className="absolute inset-0 bg-black/20" />

          {user?.uid !== organizer.firebase_uid && (
            <button
              onClick={handleFollow}
              disabled={followingBusy}
              className={`absolute right-5 top-5 z-20 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-md transition ${
                organizer.isFollowing
                  ? 'border border-white/20 bg-black/30 text-white hover:bg-black/45'
                  : 'bg-[#FFA500] text-white hover:opacity-90'
              }`}
            >
              {followingBusy ? 'Saving...' : organizer.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 p-7 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center gap-8">
              <div className="h-36 w-36 overflow-hidden rounded-full border-4 border-white/20 bg-gradient-to-br from-[#FFA500] to-gray-900 flex items-center justify-center text-5xl font-bold text-white shadow-xl shadow-black/30">
                {organizer.profilePicture ? (
                  <Image
                    src={organizer.profilePicture}
                    alt={organizer.name}
                    width={144}
                    height={144}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  organizer.name?.slice(0, 1)?.toUpperCase() || 'O'
                )}
              </div>

              <div className="flex-1">
                <h1 className="text-3xl md:text-5xl font-extrabold text-white">{organizer.name}</h1>
                <p className="mt-3 max-w-3xl text-white/75">
                  {organizer.bio || 'This organizer has not added a bio yet.'}
                </p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
                <div className="text-xs uppercase tracking-wider text-white/50">Followers</div>
                <div className="text-2xl font-bold text-[#FFA500]">{organizer.followersCount || 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
                <div className="text-xs uppercase tracking-wider text-white/50">Rating</div>
                <div className="text-2xl font-bold text-[#FFA500]">
                  {organizer.ratingsCount ? `${formatRating(organizer.averageRating)} / 5` : formatRating(0)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
                <div className="text-xs uppercase tracking-wider text-white/50">Events</div>
                <div className="text-2xl font-bold text-[#FFA500]">{events.length}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto mt-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Events by {organizer.name}</h2>
            <p className="text-white/60">Approved public events from this organizer.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-center text-white/60">
            No approved events available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <button
                key={event._id}
                onClick={() => router.push(`/event/${event.eventId}`)}
                className="group w-full text-left overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-lg shadow-black/10 backdrop-blur-md transition hover:-translate-y-1 hover:border-[#FFA500]/30 hover:bg-white/15 hover:shadow-xl hover:shadow-[#FFA500]/10"
              >
                <div className="relative h-56 bg-white/5 overflow-hidden">
                  {event.image ? (
                    <Image src={event.image} alt={event.event} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/50">No Image</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="truncate text-2xl font-bold text-white transition group-hover:text-[#FFA500]">{event.event}</h3>
                  <p className="mt-2 text-sm text-white/70">{new Date(event.date).toLocaleDateString()} at {event.time}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-white/60">{event.location}</p>
                  <div className="mt-4 text-[#FFA500] font-semibold transition group-hover:translate-x-1">View Details</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
