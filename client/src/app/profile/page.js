'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import Skeleton from '../components/Skeleton';

// ICONS
const UserIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
const LockIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
const TicketIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 12h.01M18 12h.01" /></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);
const LogOutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);
const CalendarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
const IdIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>);
const StarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>);

// ALL EVENT CATEGORIES
const ALL_CATEGORIES = ['Music', 'Sports', 'Art', 'Food And Drink', 'Education', 'Festival', 'Other'];
const CAT_ICONS = { Music: '🎵', Sports: '⚽', Art: '🎨', 'Food And Drink': '🍽️', Education: '📚', Festival: '🎪', Other: '✦' };

function UserProfile() {
  const router = useRouter();
  const { user: authUser, logout, updatePasswordFunc, updateEmailFunc, reauthenticate, deleteAccount } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Forms
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Re-Auth Modal State
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const [statusMsg, setStatusMsg] = useState({ type: '', msg: '' });

  // PREFERENCES STATE
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [prefCity, setPrefCity] = useState('');
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefMsg, setPrefMsg] = useState({ type: '', text: '' });

  // STYLING CONSTANTS
  const glassContainer = "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden";
  const glassSidebar = "bg-white/5 backdrop-blur-lg border-r border-white/10";
  const glassContent = "bg-transparent";
  const glassCard = "bg-white/10 backdrop-blur-md border border-white/10 shadow-lg rounded-2xl";
  const glassInput = "w-full p-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#FFA500]/60 focus:bg-white/15 outline-none transition text-white placeholder-white/60";
  const glassButton = "px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition text-white font-medium backdrop-blur-sm shadow-sm";
  const primaryButton = "px-6 py-2.5 bg-[#FFA500] hover:opacity-90 text-white rounded-xl shadow-lg shadow-[#FFA500]/30 transition font-medium backdrop-blur-sm";

  useEffect(() => {
    if (!authUser?.uid) return;
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${authUser.uid}`);
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setUserData(data);
        setNewName(data.name);
        setNewEmail(data.email);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [authUser?.uid]);

  // Load existing preferences when preferences tab is opened
  useEffect(() => {
    if (activeTab !== 'preferences' || !authUser?.uid) return;
    fetch(`/api/preferences/categories?firebase_uid=${authUser.uid}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSelectedCategories(data.preferredCategories || []);
          setPrefCity(data.city || '');
        }
      })
      .catch(console.error);
  }, [activeTab, authUser?.uid]);

  useEffect(() => {
    if (authUser?.mongoEmailSynced) {
      setStatusMsg({ type: 'success', msg: 'Email verified and updated in database successfully.' });
    }
  }, [authUser?.mongoEmailSynced]);

  // PREFERENCES HANDLERS
  const toggleCategory = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
    setPrefMsg({ type: '', text: '' });
  };

  const savePreferences = async () => {
    if (!authUser?.uid) return;
    setPrefSaving(true);
    setPrefMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/preferences/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: authUser.uid,
          categories: selectedCategories,
          city: prefCity,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPrefMsg({ type: 'success', text: 'Preferences saved! Your recommendations will update.' });
      } else {
        setPrefMsg({ type: 'error', text: data.message || 'Failed to save.' });
      }
    } catch {
      setPrefMsg({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setPrefSaving(false);
    }
  };

  // LOGIC HANDLERS
  const handleReauthSubmit = async (e) => {
    e.preventDefault();
    try {
      await reauthenticate(reauthPassword);
      setShowReauthModal(false);
      setReauthPassword('');
      setStatusMsg({ type: 'success', msg: 'Identity verified. Retrying update...' });
      if (pendingAction === 'email') executeEmailUpdate();
      if (pendingAction === 'password') executePasswordUpdate();
      if (pendingAction === 'delete') executeDeleteAccount();
    } catch (err) {
      console.error(err);
      alert("Incorrect password. Please try again.");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', msg: '' });
    try {
      const res = await fetch(`/api/users/${userData._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setUserData(updated.user);
      setIsEditingProfile(false);
      setStatusMsg({ type: 'success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setStatusMsg({ type: 'error', msg: err.message });
    }
  };

  const handleUpdateEmail = (e) => {
    e.preventDefault();
    if (newEmail === userData.email) return;
    executeEmailUpdate();
  };

  const executeEmailUpdate = async () => {
    try {
      setStatusMsg({ type: 'loading', msg: 'Processing email update...' });
      await updateEmailFunc(newEmail);
      setStatusMsg({ type: 'success', msg: `Verification link sent to ${newEmail}. Verify and re-login.` });
      setPendingAction(null);
      await logout();
      router.push('/login?emailUpdate=sent');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setPendingAction('email');
        setShowReauthModal(true);
      } else {
        setStatusMsg({ type: 'error', msg: err.message });
      }
    }
  };

  const handleUpdatePassword = (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', msg: 'Password must be at least 6 characters' });
      return;
    }
    executePasswordUpdate();
  };

  const executePasswordUpdate = async () => {
    try {
      setStatusMsg({ type: 'loading', msg: 'Updating password...' });
      await updatePasswordFunc(newPassword);
      setNewPassword('');
      setStatusMsg({ type: 'success', msg: 'Password changed successfully!' });
      setPendingAction(null);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setPendingAction('password');
        setShowReauthModal(true);
      } else {
        setStatusMsg({ type: 'error', msg: err.message });
      }
    }
  };

  const executeDeleteAccount = async () => {
    try {
      setStatusMsg({ type: 'loading', msg: 'Deleting account...' });
      await deleteAccount();
      await fetch(`/api/users/${userData._id}`, { method: 'DELETE' });
      await logout();
      router.push('/');
    } catch (err) {
      if (err?.code === 'auth/requires-recent-login') {
        setPendingAction('delete');
        setShowReauthModal(true);
      } else {
        setStatusMsg({ type: 'error', msg: err?.message || 'Delete failed' });
      }
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure? This action is permanent.")) return;
    executeDeleteAccount();
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U';
  };

  if (loading) return (
    <div className="min-h-screen relative p-4 md:p-8 font-sans overflow-hidden bg-white/10 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl flex flex-col md:flex-row min-h-[800px]">
        <aside className="w-full md:w-72 flex-shrink-0 flex flex-col p-6 border-r border-white/10">
          <Skeleton className="h-8 w-3/4 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="mt-auto pt-10"><Skeleton className="h-10 w-full" /></div>
        </aside>
        <main className="flex-1 p-6 md:p-10 space-y-6">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 flex items-center gap-6 border border-white/10">
            <Skeleton variant="circle" className="h-24 w-24" />
            <div className="space-y-2 flex-1">
              <Skeleton variant="text" className="w-1/3" />
              <Skeleton variant="text" className="w-1/4" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </main>
      </div>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={['user', 'admin', 'organizer']}>
      <div className="min-h-screen relative p-4 md:p-8 font-sans overflow-hidden bg-white/10 backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#FFA500]/20 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/30 blur-[100px]"></div>
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-[#FFA500]/10 blur-[80px]"></div>
        </div>

        <div className={`max-w-6xl mx-auto relative z-10 ${glassContainer} flex flex-col md:flex-row min-h-[800px]`}>

          {/* RE-AUTH MODAL */}
          {showReauthModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
              <div className="bg-gray-900/80 p-6 rounded-2xl shadow-2xl max-w-md w-full m-4 border border-white/10">
                <h3 className="text-xl font-bold text-white mb-2">Security Verification</h3>
                <p className="text-white/70 mb-4 text-sm">Please confirm your password to proceed with sensitive changes.</p>
                <form onSubmit={handleReauthSubmit} className="space-y-4">
                  <input type="password" placeholder="Current Password" value={reauthPassword} onChange={(e) => setReauthPassword(e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 text-white placeholder-white/60 rounded-xl focus:ring-2 focus:ring-[#FFA500]/60 outline-none" autoFocus />
                  <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => { setShowReauthModal(false); setPendingAction(null); }} className="px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-[#FFA500] text-white rounded-lg hover:opacity-90">Verify</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SIDEBAR NAVIGATION */}
          <aside className={`w-full md:w-72 flex-shrink-0 flex flex-col justify-between p-6 ${glassSidebar}`}>
            <div>
              <div className="mb-8 pl-2">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FFA500] to-[#FFA500]">
                  Account
                </h2>
                <p className="text-xs text-white/60 font-medium tracking-wider uppercase mt-1">Settings & Privacy</p>
              </div>

              <nav className="space-y-2">
                <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${activeTab === 'profile' ? 'bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30' : 'bg-white/10 text-white border border-white/20 hover:bg-white/30'}`}>
                  <UserIcon /> General Profile
                </button>

                {/* ── PREFERENCES TAB BUTTON (Fix 4) ── */}
                <button onClick={() => setActiveTab('preferences')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${activeTab === 'preferences' ? 'bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30' : 'bg-white/10 text-white border border-white/20 hover:bg-white/30'}`}>
                  <StarIcon /> Preferences
                </button>

                <button onClick={() => setActiveTab('security')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${activeTab === 'security' ? 'bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30' : 'bg-white/10 text-white border border-white/20 hover:bg-white/30'}`}>
                  <LockIcon /> Security
                </button>
                <button onClick={() => router.push('/dashboard/user')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 bg-white/10 text-white shadow-sm border border-white/20 hover:bg-white/30">
                  <TicketIcon /> My Tickets
                </button>
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4"></div>
                <button onClick={() => setActiveTab('danger')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 bg-red-500/10 text-red-600 border border-red-500/20">
                  <TrashIcon /> Delete Account
                </button>
              </nav>
            </div>

            <button onClick={async () => { await logout(); router.push('/login'); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white/80 transition-all text-sm font-medium">
              <LogOutIcon /> Sign Out
            </button>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className={`flex-1 p-6 md:p-10 ${glassContent} overflow-y-auto`}>

            {statusMsg.msg && (
              <div className={`mb-6 p-4 rounded-xl border backdrop-blur-md shadow-sm text-sm font-medium animate-fade-in ${statusMsg.type === 'success' ? 'bg-green-100/60 border-green-200 text-green-800' : statusMsg.type === 'error' ? 'bg-red-100/60 border-red-200 text-red-800' : 'bg-[#FFA500]/10 border-[#FFA500]/20 text-[#FFA500]'}`}>
                {statusMsg.msg}
              </div>
            )}

            {/* TAB: GENERAL PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-fade-in">
                <div className={`${glassCard} p-6 flex flex-col md:flex-row items-center md:items-start gap-6`}>
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#FFA500] to-[#FFA500] flex items-center justify-center text-white text-3xl font-bold shadow-lg border-4 border-white/50">
                    {getInitials(userData?.name)}
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-white">{userData?.name}</h2>
                      <span className="inline-block px-3 py-1 bg-[#FFA500]/10 text-[#FFA500]/90 border border-[#FFA500]/20 rounded-full text-xs font-bold uppercase tracking-wider">
                        {userData?.role}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm mb-4">{userData?.email}</p>
                    {!isEditingProfile && (
                      <button onClick={() => setIsEditingProfile(true)} className={glassButton}>
                        Edit Profile Details
                      </button>
                    )}
                  </div>
                </div>

                {isEditingProfile && (
                  <div className={`${glassCard} p-6 md:p-8 border-l-4 border-l-[#FFA500]`}>
                    <h3 className="text-lg font-bold text-white mb-4">Edit Details</h3>
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                      <div>
                        <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Full Name</label>
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className={glassInput} />
                      </div>
                      <div className="flex gap-3">
                        <button type="submit" className={primaryButton}>Save Changes</button>
                        <button type="button" onClick={() => { setIsEditingProfile(false); setNewName(userData.name); }} className={glassButton}>Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`${glassCard} p-5`}>
                    <div className="flex items-center gap-3 mb-2 text-[#FFA500]">
                      <IdIcon />
                      <span className="font-semibold text-sm">Account ID</span>
                    </div>
                    <p className="text-white/60 text-xs break-all font-mono bg-white/10 p-2 rounded-lg border border-white/10 select-all">
                      {userData?._id || userData?.firebase_uid}
                    </p>
                  </div>

                  <div className={`${glassCard} p-5`}>
                    <div className="flex items-center gap-3 mb-2 text-[#FFA500]">
                      <CalendarIcon />
                      <span className="font-semibold text-sm">Member Status</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-white/70">Active Member</p>
                      {userData?.createdAt && (
                        <p className="text-xs text-white/50">Joined: {new Date(userData.createdAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: PREFERENCES */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 animate-fade-in">
                <div className={`${glassCard} p-6 md:p-8`}>
                  <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    <StarIcon /> Event Preferences
                  </h2>
                  <p className="text-white/60 text-sm mb-6">
                    Select the categories you enjoy and your city. We use these to personalise your event recommendations.
                  </p>

                  {/* Category grid */}
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Favourite Categories</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
                    {ALL_CATEGORIES.map(cat => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => toggleCategory(cat)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                          style={{
                            border     : isSelected ? '1.5px solid #FFA500' : '1px solid rgba(255,255,255,0.15)',
                            background : isSelected ? 'rgba(255,165,0,0.18)' : 'rgba(255,255,255,0.06)',
                            color      : isSelected ? '#FFA500' : 'rgba(255,255,255,0.75)',
                          }}
                        >
                          <span>{CAT_ICONS[cat]}</span>
                          <span className="truncate">{cat}</span>
                          {isSelected && <span className="ml-auto text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* City input */}
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Your City</h3>
                  <input
                    type="text"
                    placeholder="e.g., Lahore, Karachi, Islamabad"
                    value={prefCity}
                    onChange={e => setPrefCity(e.target.value)}
                    className={`${glassInput} mb-6`}
                  />

                  {/* Status message */}
                  {prefMsg.text && (
                    <div className={`p-3 rounded-xl mb-4 text-sm ${prefMsg.type === 'success' ? 'bg-green-100/20 text-green-300 border border-green-500/30' : 'bg-red-100/20 text-red-300 border border-red-500/30'}`}>
                      {prefMsg.text}
                    </div>
                  )}

                  <button
                    onClick={savePreferences}
                    disabled={prefSaving}
                    className={primaryButton}
                    style={{ opacity: prefSaving ? 0.7 : 1 }}
                  >
                    {prefSaving ? 'Saving...' : 'Save Preferences'}
                  </button>

                  {selectedCategories.length > 0 && (
                    <p className="mt-3 text-xs text-white/40">
                      {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB: SECURITY */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-fade-in">
                <div className={`${glassCard} p-6 md:p-8`}>
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><LockIcon /> Login Credentials</h2>

                  <div className="mb-8">
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Update Email Address</label>
                    <form onSubmit={handleUpdateEmail} className="space-y-4">
                      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={glassInput} required />
                      <div className="flex justify-end">
                        <button type="submit" className={primaryButton}>Update Email</button>
                      </div>
                    </form>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Change Password</label>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password (min 6 chars)" className={glassInput} minLength={6} />
                      <div className="flex justify-end">
                        <button type="submit" disabled={!newPassword} className={primaryButton}>Change Password</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DANGER */}
            {activeTab === 'danger' && (
              <div className={`${glassCard} border-red-500/30 p-6 md:p-8 animate-fade-in relative overflow-hidden bg-red-500/10`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500/70"></div>
                <h2 className="text-xl font-bold text-red-300 mb-4">Danger Zone</h2>
                <p className="text-white/70 mb-8 max-w-lg">
                  Deleting your account is permanent. This action cannot be undone. All your data, including tickets and profile information, will be wiped immediately.
                </p>
                <div className="flex justify-end">
                  <button onClick={handleDelete} className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition font-medium">
                    Permanently Delete Account
                  </button>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default UserProfile;