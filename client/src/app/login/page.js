'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().endsWith('.com');

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // New UI states
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (val) => (!val.trim() ? '' : isValidEmail(val) ? '' : 'Please enter a valid email');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const eErr = validateEmail(email);
    if (eErr) {
      setEmailError(eErr);
      return;
    }
    setEmailError('');
    setIsLoading(true);

    try {
      const { role, uid } = await login(email, password);
      setIsSuccess(true);

      // For attendees only: check if they have set preferences yet, If not, send them to /welcome first
      setTimeout(async () => {
        if (role === 'user') {
          try {
            const res  = await fetch(`/api/preferences/categories?firebase_uid=${uid}`);
            const data = await res.json();
            if (data.success && (!data.preferredCategories || data.preferredCategories.length === 0)) {
              router.push('/welcome');
              return;
            }
          } catch (_) {
            // If check fails, just proceed normally
          }
        }
        router.push(`/dashboard/${role}`);
      }, 1500);
      
    } catch (err) {
      setIsLoading(false);
      console.error("Login error:", err.code, err.message);

      if (err.message === "EMAIL_NOT_VERIFIED") {
        setError("Please verify your email first. Check your inbox (and spam).");
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/invalid-login-credentials"
      ) {
        setError("Email or password is incorrect.");
      } else {
        setError("Unexpected error. Please try again.");
      }
    }
  };
 return (
    <div className="min-h-[calc(100vh-100px)] w-full flex items-center justify-center py-10 overflow-x-hidden">
      <div
        className="rounded-3xl border border-white/15 bg-white/15 p-5 shadow-2xl backdrop-blur-xl overflow-hidden sm:p-8"
        style={{ width: '100%', maxWidth: 'min(448px, calc(100vw - 2rem))' }}
      >
        <div className="mb-8 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFA500]">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Login to BlockTix</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Sign in to manage your tickets, QR code, and saved events.
          </p>
        </div>

        {error && (
          <div className="mb-4 w-full rounded-lg border border-red-200 bg-red-100/80 p-3 text-center text-sm text-red-600 animate-in fade-in zoom-in duration-300">
            {error}
          </div>
        )}

        {isSuccess && (
          <div className="mb-4 w-full rounded-lg border border-green-200 bg-green-100/80 p-3 text-center text-sm text-green-700 animate-in fade-in zoom-in duration-300">
            Login successful! Redirecting...
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="label !mx-0">Email</label>
            <input
              className={`input ${emailError ? '!border-red-500' : ''} ${isLoading || isSuccess ? 'cursor-not-allowed opacity-50' : ''}`}
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setEmailError(validateEmail(email))}
              onFocus={() => setEmailError('')}
              disabled={isLoading || isSuccess}
              required
            />
            {emailError && <p className="ml-1 text-xs text-red-400">{emailError}</p>}
          </div>

          <div>
            <label className="label !mx-0">Password</label>
            <input
              className={`input ${isLoading || isSuccess ? 'cursor-not-allowed opacity-50' : ''}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading || isSuccess}
              required
            />
          </div>

          <div className="flex flex-col gap-1 py-1 text-left">
            <p className="text-xs text-white/70">
              Dont have an account?{' '}
              <Link href="/signup" className={`font-bold text-[#FFA500] hover:underline ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
                Sign up
              </Link>
            </p>
            <Link href="/resetPassword" className={`w-fit text-xs font-bold text-[#FFA500]/70 hover:underline ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className={`flex w-full items-center justify-center rounded-xl bg-[#FFA500] py-3.5 font-bold text-white shadow-lg shadow-[#FFA500]/20 transition-all active:scale-95 ${isLoading || isSuccess ? 'cursor-not-allowed opacity-80' : ''}`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Logging In...</span>
              </div>
            ) : isSuccess ? (
              <span>Success!</span>
            ) : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}