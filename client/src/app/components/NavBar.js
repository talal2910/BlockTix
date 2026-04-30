"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FaBell } from 'react-icons/fa';

function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const { user, logout } = useAuth();

  const isAuthed = !!user && user.emailVerified;

  const unreadCount = useMemo(
    () => (notifications || []).filter(n => !n.read).length,
    [notifications]
  );

  useEffect(() => {
    if (!isAuthed) {
      setNotifications([]);
      setIsNotifOpen(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingNotif(true);
        const res = await fetch(`/api/notifications?firebase_uid=${encodeURIComponent(user.uid)}&limit=20`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setNotifications(data.notifications || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingNotif(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthed, user?.uid]);

  async function toggleNotifications() {
    const next = !isNotifOpen;
    setIsNotifOpen(next);
    if (!next) return;

    if (!isAuthed) return;
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebase_uid: user.uid }),
      });
      setNotifications(prev => (prev || []).map(n => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  }




  const secondaryBtnClass = "bg-white/10 text-white hover:bg-white/20 font-bold py-2 px-4 rounded my-2 w-auto no-underline transition w-auto block text-center";
  const secondaryBtnClassDesktop = "bg-white/10 text-white hover:bg-white/20 font-bold py-2 px-4 rounded no-underline transition";
  const primaryBtnClass = "btn w-auto block text-center no-underline my-2";

  return (

    // NAVBAR CONTAINER
    <nav className="sticky top-0 z-50 border-b border-white/10 shadow-md">
      {/* Strong blur bar (blurs behind, not see-through) */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gray-900/85 backdrop-blur-2xl backdrop-saturate-150"
        />

        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16 relative">

        {/* Left side: Logo + Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-xl sm:text-2xl font-extrabold tracking-tight text-white transition no-underline"
          >
            BlockTix
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex gap-2">
            <Link href="/" className="link">Home</Link>
            <Link href="/discover" className="link">Discover</Link>
            <Link href="/marketplace" className="link">Marketplace</Link>
            {isAuthed && user.role !== 'user' && (
              <Link href="/dashboard/organizer" className="link">Dashboard</Link>
            )}
            {isAuthed && <Link href="/dashboard/user" className="link">My Tickets</Link>}
          </div>
        </div>

        {/* Right side: Desktop Buttons */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthed ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={toggleNotifications}
                  className="relative p-2 rounded-xl text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
                  aria-label="Notifications"
                >
                  <FaBell className="text-base" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-[#FFA500] text-black font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-2xl shadow-2xl">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">Notifications</span>
                      <button
                        onClick={() => setIsNotifOpen(false)}
                        className="text-white/70 hover:text-white text-xs"
                      >
                        Close
                      </button>
                    </div>

                    <div className="p-3">
                      {loadingNotif ? (
                        <div className="text-sm text-white/60">Loading…</div>
                      ) : (notifications?.length ? (
                        <div className="space-y-2">
                          {notifications.slice(0, 20).map((n) => (
                            <div key={n._id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="text-sm text-white">{n.message}</div>
                              {n.reservedUntil && (
                                <div className="mt-1 text-xs text-white/60">
                                  Reserved until: {new Date(n.reservedUntil).toLocaleString()}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] text-white/50">
                                {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-white/60">No notifications yet.</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link href="/profile" className={secondaryBtnClassDesktop}>Profile</Link>
              <button onClick={logout} className="btn w-auto no-underline">Log Out</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className={secondaryBtnClassDesktop}>Sign In</Link>
              <Link href="/signup" className="btn w-auto no-underline">Sign Up</Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="p-2.5 rounded-xl text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 7h12" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12h16" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 17h10" />
              </svg>
            )}
          </button>
        </div>
        </div>
      </div>

      {/* MOBILE MENU OVERLAY */}
      {
        isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full shadow-xl">
            <div className="relative">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gray-900/85 backdrop-blur-2xl backdrop-saturate-150 border-t border-white/10"></div>
              <div className="relative p-4 flex flex-col gap-3">

                {/* Mobile Links - styles match desktop font weight/color via 'link' class */}
                <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="link block py-2  font-medium">Home</Link>
                <Link href="/discover" onClick={() => setIsMobileMenuOpen(false)} className="link block py-2  font-medium">Discover</Link>
                <Link href="/marketplace" onClick={() => setIsMobileMenuOpen(false)} className="link block py-2  font-medium">Marketplace</Link>

                {isAuthed && user.role !== 'user' && (
                  <Link
                    href="/dashboard/organizer"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="link block py-2 font-medium"
                  >
                    Dashboard
                  </Link>
                )}
                {isAuthed && (
                  <Link href="/dashboard/user" onClick={() => setIsMobileMenuOpen(false)} className="link block py-2 font-medium">My Tickets</Link>
                )}

                <div className="border-t border-white/10 my-1"></div>

                {/* Mobile Auth Buttons */}
                {isAuthed ? (
                  <>
                    <Link href='/profile' onClick={() => setIsMobileMenuOpen(false)} className={secondaryBtnClass}>
                      Profile
                    </Link>
                    <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className={primaryBtnClass}>
                      Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className={secondaryBtnClass}>
                      Sign In
                    </Link>
                    <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className={primaryBtnClass}>
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }
    </nav >
  );
}

export default Navbar;