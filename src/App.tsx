/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, Key } from 'react';
import { LogIn, CalendarDays, Download, ShieldCheck, MailQuestion, ArrowLeft, Upload as UploadIcon, X, LogOut, ChevronDown } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './lib/utils';
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    } else {
      alert("To install, look for the 'Add to Home Screen' option in your browser menu.");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setHasCheckedAuth(true);
      if (!u && !hasCheckedAuth) {
        setIsAuthOpen(true);
      }
    });
    return unsubscribe;
  }, [hasCheckedAuth]);

  const handleSignOut = async () => {
    const confirm = window.confirm(
      "Are you sure you want to log out? \n\nNote: Your timetable data is stored securely on our servers, so you won't lose anything. You can simply sign back in to access it again."
    );
    if (confirm) {
      setIsUserMenuOpen(false);
      await signOut(auth);
    }
  };

  const isAdmin = user?.email === 'aligilljutt150@gmail.com';

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (deferredPrompt && !isStandalone) {
      const timer = setTimeout(() => setShowInstallPrompt(true), 3000); // Wait 3s before subtle prompt
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt, isStandalone]);

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
      // alert("Failed to export users. Check permissions.");
    }
  };

  const PageTransition = ({ children }: { children: ReactNode; key?: Key }) => (
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
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <button onClick={() => setCurrentPage('dashboard')} className="flex items-center gap-2 md:gap-3 text-left group">
            <div className="bg-teal-600 p-1.5 md:p-2 rounded-lg shadow-sm group-hover:bg-teal-700 transition-colors">
              <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-display font-bold tracking-tight leading-none text-slate-900">Unitime</h1>
              <span className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest text-teal-600">Smart Schedule</span>
            </div>
          </button>

          <div className="flex items-center gap-2 md:gap-6">
            {!isStandalone && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-2 font-mono font-bold text-[9px] md:text-[10px] uppercase text-teal-600 hover:text-teal-700 transition-colors bg-teal-50 px-3 py-1.5 rounded-full"
              >
                <Download className="w-3 h-3 md:w-4 md:h-4" />
                Install
              </button>
            )}
            <button 
              onClick={() => {
                if (!user) setIsAuthOpen(true);
                else setIsUploadOpen(true);
              }}
              className="flex items-center gap-1.5 md:gap-2 font-mono font-bold text-[10px] md:text-xs uppercase tracking-widest text-teal-600 hover:text-teal-700 md:border-r border-slate-200 md:pr-4"
            >
              <UploadIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </button>
            {user ? (
              <div className="flex items-center gap-2 md:gap-4 relative">
                {isAdmin && (
                  <button 
                    onClick={exportUsersToCSV}
                    className="hidden lg:flex items-center gap-2 font-mono font-bold text-[10px] uppercase text-slate-500 hover:text-teal-600 border-r border-slate-200 pr-4 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                )}
                
                <div className="relative">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 md:gap-3 p-1 rounded-full md:rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                  >
                    <div className="hidden sm:flex flex-col items-end text-right">
                      <span className="text-xs font-bold text-slate-900 line-clamp-1 max-w-[100px]">{user.displayName || user.email?.split('@')[0]}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-mono font-black uppercase text-slate-400 tracking-tighter">My Account</span>
                        <ChevronDown className={cn("w-3 h-3 text-slate-300 transition-transform", isUserMenuOpen && "rotate-180")} />
                      </div>
                    </div>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-8 h-8 md:w-9 md:h-9 ring-2 ring-teal-100 rounded-full shadow-sm" />
                    ) : (
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-teal-50 shadow-sm flex items-center justify-center font-bold font-display text-sm md:text-lg text-teal-700 border border-teal-100">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 py-2 overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                            <p className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                            <p className="text-xs font-bold text-slate-900 truncate">{user.email}</p>
                          </div>
                          <div className="py-1">
                            <button 
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                setCurrentPage('support');
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                            >
                              <MailQuestion className="w-4 h-4 text-slate-400" />
                              Get Help
                            </button>
                            <button 
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                setCurrentPage('privacy');
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4 text-slate-400" />
                              Privacy Policy
                            </button>
                          </div>
                          <div className="mt-1 pt-1 border-t border-slate-50">
                            <button 
                              onClick={handleSignOut}
                              className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 md:gap-2 font-mono font-bold text-[10px] md:text-xs uppercase tracking-widest text-teal-600 hover:text-teal-700"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
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
                  <div className="flex items-center mb-10">
                    <ShieldCheck className="w-10 h-10 text-teal-600 mr-4" />
                    <div>
                      <h2 className="text-3xl font-display font-bold text-slate-900">Data & Privacy</h2>
                      <p className="text-xs font-mono font-bold uppercase text-slate-400 tracking-widest mt-1">Our commitment to your security</p>
                    </div>
                  </div>
                  <div className="prose prose-slate max-w-none space-y-6">
                    <p className="font-medium text-slate-600 text-lg leading-relaxed text-center">We respect your privacy and manage your university schedules with the highest security standards.</p>
                    
                    <div className="grid md:grid-cols-2 gap-8 pt-6">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-teal-200 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Secure Cloud Storage</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">All timetable data is stored securely on our encrypted cloud servers (Firebase). This ensures your schedule is synced and safe across all devices you use.</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-teal-200 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Authenticated Access</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">We use industry-standard Google Authentication. Only you can access your personal uploads. Our system verifies your identity for every request.</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-teal-200 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Full Data Ownership</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">You own your data. You can permanently delete any timetable or your entire account at any time, removing all records from our server storage immediately.</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-teal-200 transition-colors">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Support & Safety</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">Our AI processing is transient and focused only on extracting your schedule accurately. We do not store original files after successful extraction.</p>
                      </div>
                    </div>
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
        {isUploadOpen && user && (
          <UploadModal 
            isOpen={isUploadOpen} 
            onClose={() => setIsUploadOpen(false)}
            onSuccess={() => {
              // Now we use firebase, so Dashboard will auto-update naturally
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

      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-sm z-50 p-6 bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl text-white"
          >
            <button 
              onClick={() => setShowInstallPrompt(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-teal-500 p-2 rounded-lg">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-display font-bold leading-none mb-1">Install Smart Timetable</h4>
                <p className="text-[10px] uppercase font-mono tracking-widest text-white/50">Faster access & Offline support</p>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-6">Install our app for a smoother experience and instant access to your classes.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  handleInstallClick();
                  setShowInstallPrompt(false);
                }}
                className="flex-1 h-10 bg-teal-500 text-white font-mono font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-teal-400 transition-colors"
              >
                Install Now
              </button>
              <button 
                onClick={() => setShowInstallPrompt(false)}
                className="flex-1 h-10 border border-white/10 text-white font-mono font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-white/5 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
