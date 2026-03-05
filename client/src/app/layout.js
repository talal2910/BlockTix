

'use client';

import { AuthProvider } from '@/context/AuthContext';
import Navbar from './components/NavBar';
import Footer from './components/FooterPage';
import Ragchatbot from './components/Ragchatbot';
import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-white relative overflow-x-hidden">
        {/* Global background (matches Profile page): glass base + soft gradient blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/30 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/30 blur-[100px]"></div>
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-blue-300/20 blur-[80px]"></div>
        </div>

        <div className="relative z-10 min-h-screen">
          <Toaster position="top-right" reverseOrder={false} toastOptions={{ style: { marginTop: '4rem' } }} />
          <AuthProvider>
            <Navbar />
            {children}
            <Ragchatbot />
            <Footer />
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
