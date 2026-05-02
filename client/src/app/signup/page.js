'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff } from 'lucide-react'; 


const isValidName = (name) => /^[a-zA-Z\s]+$/.test(name.trim());
const isValidEmail = (email) => {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.endsWith('.com');
};


export default function SignupPage() {
  const router = useRouter();
  const { signup, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkPassword, setCheckPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Validation state
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateNameField = (val) => {
    if (!val.trim()) return '';
    return isValidName(val) ? '' : 'Please enter a valid name';
  };

  const validateEmailField = (val) => {
    if (!val.trim()) return '';
    return isValidEmail(val) ? '' : 'Please enter a valid email';
  };

  const handleSignup = async (e) => {

  e.preventDefault();
  setError('');
  setSuccessMessage('');

  const nErr = validateNameField(name);
  const eErr = validateEmailField(email);
  setNameError(nErr);
  setEmailError(eErr);

  if (nErr || eErr) return;

  if (password !== checkPassword) {
    setError('Passwords do not match');
    return;
  }

  setLoading(true);
  try {
    const { role: userRole, verificationSent } = await signup(email, password, name, role);

    setSuccessMessage(
      'Account created! We have sent a verification link to your email. Please verify than log in.'
    );
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  } catch (err) {
  console.error(err);

  // Firebase Auth error handling

  if (err.code === 'auth/email-already-in-use') {
    setError('This email is already in use. Please log in or reset your password.');
  } else if (err.code === 'auth/invalid-email') {
    setError('This email address is not valid.');
  } else if (err.code === 'auth/weak-password') {
    setError('Password is too weak. Please choose a stronger one.');
  } else {
    setError('Something went wrong. Please try again.');
  }
} finally {
  setLoading(false);
}

};

return (
    <form onSubmit={handleSignup} className="min-h-[calc(100vh-100px)] w-full flex items-center justify-center py-6 overflow-x-hidden">
      <div
        className="rounded-3xl border border-white/15 bg-white/15 p-4 shadow-2xl backdrop-blur-xl overflow-hidden sm:p-6"
        style={{ width: '100%', maxWidth: 'min(448px, calc(100vw - 2rem))' }}
      >
        <div className="mb-8 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFA500]">Join now</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Create an account</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Pick your role, verify your email, and start using BlockTix.
          </p>
        </div>

        {error && (
          <div className="mb-4 w-full rounded-lg border border-red-200 bg-red-100/80 p-3 text-center text-sm text-red-600 animate-in fade-in zoom-in duration-300">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 w-full rounded-lg border border-green-200 bg-green-100/80 p-3 text-center text-sm text-green-700 animate-in fade-in zoom-in duration-300">
            {successMessage}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label !mx-0">Full Name</label>
            <input
              className={`input ${nameError ? '!border-red-500' : ''}`}
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setNameError('')}
              onBlur={() => setNameError(validateNameField(name))}
              required
            />
            {nameError && <p className="ml-1 text-xs text-red-400">{nameError}</p>}
          </div>

          <div>
            <label className="label !mx-0">Email</label>
            <input
              className={`input ${emailError ? '!border-red-500' : ''}`}
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setEmailError('')}
              onBlur={() => setEmailError(validateEmailField(email))}
              required
            />
            {emailError && <p className="ml-1 text-xs text-red-400">{emailError}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#888',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label className="label !mx-0 mt-4 block">Confirm Password</label>
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat password"
              value={checkPassword}
              onChange={(e) => setCheckPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="label !mx-0 mb-2 block">Role</div>
            <div className="grid grid-cols-2 gap-3">
              <label className={`cursor-pointer rounded-2xl border px-4 py-3 transition ${role === 'user' ? 'border-[#FFA500] bg-[#FFA500]/15 shadow-[0_0_0_1px_rgba(255,165,0,0.25)]' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}>
                <input
                  type="radio"
                  value="user"
                  checked={role === 'user'}
                  onChange={e => setRole(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">User</div>
                    <div className="text-xs text-white/60">Buy, store, and scan tickets</div>
                  </div>
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${role === 'user' ? 'border-[#FFA500] bg-[#FFA500]' : 'border-white/40'}`} />
                </div>
              </label>

              <label className={`cursor-pointer rounded-2xl border px-4 py-3 transition ${role === 'organizer' ? 'border-[#FFA500] bg-[#FFA500]/15 shadow-[0_0_0_1px_rgba(255,165,0,0.25)]' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}>
                <input
                  type="radio"
                  value="organizer"
                  checked={role === 'organizer'}
                  onChange={e => setRole(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Organizer</div>
                    <div className="text-xs text-white/60">Create and manage events</div>
                  </div>
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${role === 'organizer' ? 'border-[#FFA500] bg-[#FFA500]' : 'border-white/40'}`} />
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ opacity: loading ? 0.75 : 1 }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      </div>
    </form>
  );
}