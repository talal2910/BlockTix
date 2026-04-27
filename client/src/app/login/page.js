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
    <div className='flex items-center justify-center min-h-[calc(100vh-100px)] w-full px-4'>
      <div className='w-full max-w-[400px] bg-white/30 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/40 flex flex-col items-center'>
        
        <h2 className='text-3xl font-bold mb-6 text-white'>Login</h2>

        {/* Error Message */}
        {error && (
          <div className="w-full mb-4 p-3 rounded-lg bg-red-100/80 border border-red-200 text-red-600 text-sm text-center animate-in fade-in zoom-in duration-300">
            {error}
          </div>
        )}

        {/* Success Message */}
        {isSuccess && (
          <div className="w-full mb-4 p-3 rounded-lg bg-green-100/80 border border-green-200 text-green-700 text-sm text-center animate-in fade-in zoom-in duration-300">
            Login successful! Redirecting...
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full flex flex-col space-y-4">
          
          {/* Email Container */}
          <div className="w-full flex flex-col gap-1">
            <label className='text-sm font-semibold text-white/80 ml-1'>Email</label>
            <input
              className={`w-90 p-3 rounded-xl bg-white/10 border outline-none transition-all focus:ring-2 focus:ring-[#FFA500]/50 text-white placeholder-white/60 ${
                emailError ? 'border-red-500' : 'border-white/20'
              } ${isLoading || isSuccess ? 'opacity-50 cursor-not-allowed' : ''}`}
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => setEmailError(validateEmail(email))}
              onFocus={() => setEmailError('')}
              disabled={isLoading || isSuccess}
              required
            />
            {emailError && <p className="text-red-500 text-xs mt-1 ml-1">{emailError}</p>}
          </div>

          {/* Password Container */}
          <div className="w-full flex flex-col gap-1">
            <label className='text-sm font-semibold text-white/80 ml-1'>Password</label>
            <input
              className={`w-90 p-3 rounded-xl bg-white/10 border border-white/20 outline-none transition-all focus:ring-2 focus:ring-[#FFA500]/50 text-white placeholder-white/60 ${
                isLoading || isSuccess ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading || isSuccess}
              required
            />
          </div>

          {/* Helper Links */}
          <div className="flex flex-col space-y-1 py-1">
            <p className='text-xs text-white/70'>
              Dont have an account?{' '}
              <Link href="/signup" className={`text-[#FFA500] font-bold hover:underline ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>Sign up</Link>
            </p>
            <Link href="/resetPassword" title="Forgot Password?" className={`text-xs font-bold text-[#FFA500]/70 hover:underline w-fit ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
              Forgot Password?
            </Link>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isLoading || isSuccess}
            className={`w-full bg-[#FFA500] hover:bg-[#FFA500] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#FFA500]/20 transition-all active:scale-95 flex justify-center items-center ${
              (isLoading || isSuccess) ? 'opacity-80 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Logging In...</span>
              </div>
            ) : isSuccess ? (
              <span>Success!</span>
            ) : (
              "Log In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}