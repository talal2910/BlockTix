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
    <form onSubmit={handleSignup} className="flex flex-col items-center justify-center min-h-screen">
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      <div className='w-[400px] h-[auto] mx-auto bg-white/20 backdrop-blur-md p-10 rounded-lg '>
        <h2 className='font-bold mb-4'>Create An Account</h2>

        {/* Name */}
        <div>
          <label className='label'>Full Name</label>
          <input
            className={`input ${nameError ? 'border-red-500' : ''}`}
            type="text"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={() => setNameError('')}
            onBlur={() => setNameError(validateNameField(name))}
            required
          />
          {nameError && <p style={{ color: 'red', fontSize: '0.875rem', marginTop: '0.25rem' }}>{nameError}</p>}
        </div>

        {/* Email */}
        <div>
          <label className='label'>Email</label>
          <input
            className={`input ${emailError ? 'border-red-500' : ''}`}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={() => setEmailError('')}
            onBlur={() => setEmailError(validateEmailField(email))}
            required
          />
          {emailError && <p style={{ color: 'red', fontSize: '0.875rem', marginTop: '0.25rem' }}>{emailError}</p>}
        </div>

        {/* Password */}
        <div>
          <label className='label'>Password</label>
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
                color: '#555',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <br />

          <label className='label'>Confirm Password</label>
          <input
            className="input"
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={checkPassword}
            onChange={(e) => setCheckPassword(e.target.value)}
            required
          />
        </div>

        {/* Role */}
        <div>
          <label >User </label>
          <input type='radio' value='user' checked={role === 'user'} onChange={e => setRole(e.target.value)} />
          <label >Organizer</label>
          <input type='radio' value='organizer' checked={role === 'organizer'} onChange={e => setRole(e.target.value)} />
        </div>

        <button
          type="submit"
          className='btn w-[417px]'
          disabled={loading}
          style={{ opacity: loading ? 0.75 : 1 }}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </div>
    </form>
  );
}