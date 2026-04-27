'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { useAuth }             from '@/context/AuthContext';

const ALL_CATEGORIES = [
  'Music', 'Sports', 'Art', 'Food And Drink', 'Education', 'Festival', 'Other',
];

const CAT_ICONS = {
  Music          : '🎵',
  Sports         : '⚽',
  Art            : '🎨',
  'Food And Drink': '🍽️',
  Education      : '📚',
  Festival       : '🎪',
  Other          : '',
};

export default function WelcomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [selected, setSelected] = useState([]);
  const [city,     setCity]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    // Organizers don't need category preferences — redirect to login
    if (user.role && user.role !== 'user') {
      router.replace('/login');
      return;
    }

    // If the user already has preferences saved, skip onboarding
    fetch(`/api/preferences/categories?firebase_uid=${user.uid}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.preferredCategories?.length > 0) {
          router.replace('/login');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [user, authLoading, router]);

  function toggle(cat) {
    setSelected(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  async function handleSave() {
    if (!user) return;
    if (selected.length === 0) {
      setError('Please select at least one category to continue.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const res  = await fetch('/api/preferences/categories', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          firebase_uid: user.uid,
          categories  : selected,
          city        : city.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to save. Please try again.');
        return;
      }

      router.replace('/dashboard/user');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    router.replace('/dashboard/user');
  }

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#FFA500] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8 md:p-10">

        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Welcome to BlockTix
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Tell us what you like so we can personalize events for you.
          </p>
        </div>

        <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
          Categories
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {ALL_CATEGORIES.map(cat => {
            const isSelected = selected.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  border    : isSelected ? '1.5px solid #FFA500' : '1px solid rgba(255,255,255,0.15)',
                  background: isSelected ? 'rgba(255,165,0,0.18)' : 'rgba(255,255,255,0.06)',
                  color     : isSelected ? '#FFA500' : 'rgba(255,255,255,0.75)',
                }}
              >
                <span className="text-lg">{CAT_ICONS[cat]}</span>
                <span className="truncate">{cat}</span>
                {isSelected && <span className="ml-auto text-xs font-bold">✓</span>}
              </button>
            );
          })}
        </div>

        <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
          Your City
        </h2>
        <input
          type="text"
          placeholder="e.g. Lahore, Karachi, Islamabad"
          value={city}
          onChange={e => setCity(e.target.value)}
          className="w-full p-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#FFA500]/60 focus:bg-white/15 outline-none transition text-white placeholder-white/60 mb-6"
        />

        {error && (
          <div className="p-3 rounded-xl mb-4 text-sm bg-red-100/20 text-red-300 border border-red-500/30">
            {error}
          </div>
        )}

        {selected.length > 0 && (
          <p className="text-xs text-white/40 mb-4">
            {selected.length} categor{selected.length === 1 ? 'y' : 'ies'} selected
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-[#FFA500] hover:opacity-90 text-white rounded-xl shadow-lg shadow-[#FFA500]/30 font-semibold transition"
            style={{ opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Get Started'}
          </button>

          <button
            onClick={handleSkip}
            disabled={saving}
            className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white/70 rounded-xl font-medium transition text-sm"
          >
            Skip for now
          </button>
        </div>

        <p className="text-center text-xs text-white/30 mt-4">
          You can update these anytime from your profile
        </p>
      </div>
    </div>
  );
}