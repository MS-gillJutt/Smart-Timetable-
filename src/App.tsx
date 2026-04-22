/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LogIn, CalendarDays, Download } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import AuthModal from './components/AuthModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setHasCheckedAuth(true);
      // Auto-open auth modal if they are not logged in and we just finished checking
      if (!u && !hasCheckedAuth) {
        setIsAuthOpen(true);
      }
    });
    return unsubscribe;
  }, [hasCheckedAuth]);

  const handleSignOut = () => signOut(auth);

  const isAdmin = user?.email === 'aligilljutt150@gmail.com';

  const exportUsersToCSV = async () => {
    if (!isAdmin) return;
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "UID,Name,Email\n"; // Header

      usersSnap.forEach(doc => {
        const data = doc.data();
        csvContent += `${doc.id},"${data.name || ''}","${data.email || ''}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "unitime_users.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export users", err);
      alert("Failed to export users. Check permissions.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Navigation */}
      <nav className="border-b border-[#141414] bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#141414] p-2">
              <CalendarDays className="w-6 h-6 text-[#FAF9F6]" />
            </div>
            <div>
              <h1 className="text-xl font-serif italic tracking-tight leading-none">UniTime</h1>
              <span className="text-[9px] font-mono uppercase tracking-widest opacity-40">Schedule Assistant</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <button 
                    onClick={exportUsersToCSV}
                    className="hidden sm:flex items-center gap-2 font-mono text-[10px] uppercase text-black/60 hover:text-black border-r border-black/10 pr-4 mr-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Export Users
                  </button>
                )}
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-medium">{user.displayName || user.email?.split('@')[0]}</span>
                  <button 
                    onClick={handleSignOut}
                    className="text-[10px] font-mono uppercase text-black/40 hover:text-black transition-colors"
                  >
                    Logout
                  </button>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-10 h-10 border border-black rounded-full" />
                ) : (
                  <div className="w-10 h-10 border border-black rounded-full bg-black/5 flex items-center justify-center font-bold font-serif text-lg">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest hover:underline"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Manage
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <Dashboard onAddClick={() => {
          if (!user) setIsAuthOpen(true);
          else setIsUploadOpen(true);
        }} />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#141414] py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="font-serif italic text-lg">&copy; 2026 UniTime Assistant</p>
            <p className="text-[10px] font-mono uppercase text-black/40 mt-1">Smart scheduling for university students</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="font-mono text-[10px] uppercase tracking-widest hover:underline">Support</a>
            <a href="#" className="font-mono text-[10px] uppercase tracking-widest hover:underline">Docs</a>
            <a href="#" className="font-mono text-[10px] uppercase tracking-widest hover:underline">Privacy</a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {isUploadOpen && (
          <UploadModal 
            isOpen={isUploadOpen} 
            onClose={() => setIsUploadOpen(false)}
            onSuccess={() => {
              // Dashboard handles refresh automatically via onSnapshot
            }}
          />
        )}
        {isAuthOpen && (
          <AuthModal 
            isOpen={isAuthOpen} 
            onClose={() => setIsAuthOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
