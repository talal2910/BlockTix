'use client';
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  signOut,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "firebase/auth";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState();
  const [loading, setLoading] = useState(true);


const signup = async (email, password, name, role) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firebase_uid: user.uid,
      email,
      name,
      role,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Failed to save user to database");
  }

  await sendEmailVerification(user);
  await signOut(auth);
  setCurrentUser(null);

  return { role: data.role, verificationSent: true };
};

const login = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  let firebaseUser = userCredential.user;

  // Ensure freshest user fields (email, emailVerified) right after sign-in.
  try {
    await firebaseUser.reload();
    firebaseUser = auth.currentUser || firebaseUser;
  } catch (e) {
    console.warn('User reload (login) failed:', e);
  }

  // Block unverified email
  if (!firebaseUser.emailVerified) {
    await signOut(auth);
    const error = new Error("EMAIL_NOT_VERIFIED"); // ✅ underscore, matches UI check
    throw error;
  }

  const firebaseUID = firebaseUser.uid;

  const res = await fetch(`/api/users/${firebaseUID}`);
  const user = await res.json();

  if (!res.ok) {
    throw new Error("Failed to fetch user role");
  }

  // If user clicked the verification link for an email change,
  // Firebase email may have changed. Sync Mongo to Firebase (best-effort).
  try {
    if (firebaseUser.email && user?.email && firebaseUser.email !== user.email) {
      await fetch(`/api/users/${firebaseUID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: firebaseUser.email }),
      });
    }
  } catch (e) {
    console.error('Mongo email sync (login) error:', e);
  }

  return { role: user.role, uid: firebaseUID };
};

const resetPassword = (email) => {
  return sendPasswordResetEmail(auth, email);
};

const reauthenticate = (password) => {
    if (!auth.currentUser) throw new Error("No user");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    return reauthenticateWithCredential(auth.currentUser, credential);
  };

  // UPDATED: Use verifyBeforeUpdateEmail (Solves "Operation Not Allowed")
  const updateEmailFunc = (newEmail) => {
    if (!auth.currentUser) throw new Error("No user");
    const actionCodeSettings =
      typeof window !== 'undefined'
        ? {
            url: `${window.location.origin}/login?emailUpdate=verified`,
            handleCodeInApp: false,
          }
        : undefined;

    return verifyBeforeUpdateEmail(auth.currentUser, newEmail, actionCodeSettings);
  }

  const updatePasswordFunc= (newPassword) => {
    if (!auth.currentUser) throw new Error("No user");
    return updatePassword(auth.currentUser, newPassword);
  }
  const deleteAccount = async () => {
    if (!auth.currentUser) throw new Error("No user");
    return deleteUser(auth.currentUser);
  };

const logout = () => {
    return signOut(auth);
 };

useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const refreshedUser = firebaseUser;

          // During signup we sign the user out after sending verification.
          // Avoid fetching role for unverified users to prevent noisy 404s/races.
          if (!refreshedUser.emailVerified) {
            // Treat as logged-out until verified.
            setCurrentUser(null);
            setLoading(false);
            return;
          }

          const res = await fetch(`/api/users/${refreshedUser.uid}`);
          if (!res.ok) {
            if (res.status === 404) {
              setCurrentUser({
                ...refreshedUser,
                role: null,
              });
              setLoading(false);
              return;
            }
            throw new Error("Failed to fetch role");
          }

          let userData = await res.json();
          let mongoEmailSynced = false;

          // Sync Mongo email only AFTER Firebase email actually changes (post verification).
          if (refreshedUser.email && userData?.email && refreshedUser.email !== userData.email) {
            try {
              const syncRes = await fetch(`/api/users/${refreshedUser.uid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: refreshedUser.email }),
              });

              if (syncRes.ok) {
                const syncJson = await syncRes.json();
                if (syncJson?.user) userData = syncJson.user;
                mongoEmailSynced = true;
              }
            } catch (syncErr) {
              console.error('Mongo email sync (auth state) error:', syncErr);
            }
          }

          setCurrentUser({
            ...refreshedUser,
            role: userData.role,
            mongoEmailSynced,
          });
        } catch (error) {
          console.error("Error fetching user role:", error);
          setCurrentUser(firebaseUser);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user: currentUser, signup, loading, login, logout,resetPassword,updateEmailFunc,updatePasswordFunc,reauthenticate,deleteAccount }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};