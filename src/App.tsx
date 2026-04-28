/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LogIn, CalendarDays, Download, ShieldCheck, MailQuestion, ArrowLeft } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import AuthModal from './components/AuthModal';

type Page = 'dashboard' | 'privacy' | 'support';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

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

  const PageTransition = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 text-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button onClick={() => setCurrentPage('dashboard')} className="flex items-center gap-3 text-left group">
            <div className="bg-teal-600 p-2 rounded-lg shadow-sm group-hover:bg-teal-700 transition-colors">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight leading-none text-slate-900">Smart Time Table</h1>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-teal-600">Assistant</span>
            </div>
          </button>

          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <button 
                    onClick={exportUsersToCSV}
                    className="hidden sm:flex items-center gap-2 font-mono font-bold text-[10px] uppercase text-slate-500 hover:text-teal-600 border-r border-slate-200 pr-4 mr-1 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export Users
                  </button>
                )}
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-900">{user.displayName || user.email?.split('@')[0]}</span>
                  <button 
                    onClick={handleSignOut}
                    className="text-[10px] font-mono font-bold uppercase text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Logout
                  </button>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-10 h-10 ring-2 ring-teal-100 rounded-full shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-teal-50 shadow-sm flex items-center justify-center font-bold font-display text-lg text-teal-700 border border-teal-100">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-widest text-teal-600 hover:text-teal-700 hover:underline"
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
        <AnimatePresence mode="wait">
          {currentPage === 'dashboard' && (
            <PageTransition key="dashboard">
              <Dashboard onAddClick={() => {
                if (!user) setIsAuthOpen(true);
                else setIsUploadOpen(true);
              }} />
            </PageTransition>
          )}

          {currentPage === 'privacy' && (
            <PageTransition key="privacy">
              <div className="max-w-4xl mx-auto px-4 py-16">
                <button onClick={() => setCurrentPage('dashboard')} className="flex items-center text-teal-600 font-bold mb-8 hover:underline">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </button>
                <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center mb-6">
                    <ShieldCheck className="w-8 h-8 text-teal-600 mr-4" />
                    <h2 className="text-3xl font-display font-bold text-slate-900">Privacy Policy</h2>
                  </div>
                  <div className="prose prose-slate max-w-none space-y-6">
                    <p className="font-medium text-slate-600 text-lg">Your privacy is important to us. This policy outlines how we handle your data.</p>
                    
                    <h3 className="text-xl font-bold text-slate-800">1. Data We Collect</h3>
                    <p className="text-slate-600">We collect your email, name, and uploaded timetables to provide this service. We do not sell this data to third parties.</p>

                    <h3 className="text-xl font-bold text-slate-800">2. How We Use It</h3>
                    <p className="text-slate-600">Timetable images are processed by Google's Gemini AI to extract schedules. Your data is strictly used to display your timetable natively.</p>

                    <h3 className="text-xl font-bold text-slate-800">3. Authentication</h3>
                    <p className="text-slate-600">We use Firebase Authentication (Google). This ensures your passwords and login state are handled securely using industry-standard cryptography.</p>

                    <h3 className="text-xl font-bold text-slate-800">4. Your Rights</h3>
                    <p className="text-slate-600">You retain full ownership of the data you upload. You may delete any timetables you have uploaded at any time using the dashboard tools.</p>
                  </div>
                </div>
              </div>
            </PageTransition>
          )}

          {currentPage === 'support' && (
            <PageTransition key="support">
              <div className="max-w-3xl mx-auto px-4 py-16">
                <button onClick={() => setCurrentPage('dashboard')} className="flex items-center text-teal-600 font-bold mb-8 hover:underline">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </button>
                <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
                  <MailQuestion className="w-16 h-16 text-teal-600 mx-auto mb-6" />
                  <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">Support & Help</h2>
                  <p className="text-slate-600 text-lg mb-8 max-w-md mx-auto">
                    If you encounter any issues with AI scanning, logging in, or visualizing your timetables, we are here to help.
                  </p>
                  
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-left space-y-4 max-w-xl mx-auto">
                    <div>
                      <span className="font-bold text-slate-900 block mb-1">Q: My timetable wasn't parsed correctly.</span>
                      <p className="text-slate-600 text-sm">A: Ensure the image is clear and well-lit. Screenshots of PDFs work best. The AI thrives on clear column headers.</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block mb-1">Q: I don't see my classes.</span>
                      <p className="text-slate-600 text-sm">A: Use the drop-down menu on the dashboard to select your specific section and timetable group.</p>
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t border-slate-100">
                    <p className="text-slate-500 font-medium">For direct assistance, email the administrator:</p>
                    <a href="mailto:aligilljutt150@gmail.com" className="inline-block mt-2 font-display font-bold text-teal-600 text-xl hover:text-teal-700 transition-colors">
                      aligilljutt150@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </PageTransition>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="font-display font-bold text-lg text-slate-900">&copy; 2026 Developed by Muhammad Shahid</p>
            <p className="text-[11px] font-mono font-bold uppercase text-slate-400 mt-1">Smart Time Table - Assistant</p>
          </div>
          <div className="flex gap-8">
            <button onClick={() => setCurrentPage('support')} className="font-mono font-bold text-[10px] uppercase text-slate-500 tracking-widest hover:text-teal-600 hover:underline transition-colors">Support</button>
            <button onClick={() => setCurrentPage('privacy')} className="font-mono font-bold text-[10px] uppercase text-slate-500 tracking-widest hover:text-teal-600 hover:underline transition-colors">Privacy</button>
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
