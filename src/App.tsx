/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { CalendarDays, ShieldCheck, MailQuestion, ArrowLeft, Upload as UploadIcon, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';

type Page = 'dashboard' | 'privacy' | 'support';

export default function App() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

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
            <div className="bg-blue-600 p-2 rounded-lg shadow-sm group-hover:bg-blue-700 transition-colors">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight leading-none text-slate-900">Smart Time Table</h1>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600">Assistant</span>
            </div>
          </button>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-widest text-blue-600 hover:text-blue-700 hover:underline"
            >
              <UploadIcon className="w-4 h-4" />
              Upload Timetable
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentPage === 'dashboard' && (
            <PageTransition key="dashboard">
              <div className="max-w-7xl mx-auto px-4 mt-8">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-blue-900">100% Private & Local Storage</h3>
                    <p className="text-sm text-blue-800">Your timetable data is stored entirely on your device (in localStorage) to conserve server space and guarantee privacy. No login required.</p>
                  </div>
                </div>
              </div>
              <Dashboard onAddClick={() => setIsUploadOpen(true)} />
            </PageTransition>
          )}

          {currentPage === 'privacy' && (
            <PageTransition key="privacy">
              <div className="max-w-4xl mx-auto px-4 py-16">
                <button onClick={() => setCurrentPage('dashboard')} className="flex items-center text-blue-600 font-bold mb-8 hover:underline">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </button>
                <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center mb-6">
                    <ShieldCheck className="w-8 h-8 text-blue-600 mr-4" />
                    <h2 className="text-3xl font-display font-bold text-slate-900">Privacy Policy</h2>
                  </div>
                  <div className="prose prose-slate max-w-none space-y-6">
                    <p className="font-medium text-slate-600 text-lg">Your privacy is important to us. This policy outlines how we handle your data.</p>
                    
                    <h3 className="text-xl font-bold text-slate-800">1. Local Storage</h3>
                    <p className="text-slate-600">Your timetables are saved directly to your browser's local storage. This means your data never enters a centralized database, saving server space and keeping it private.</p>

                    <h3 className="text-xl font-bold text-slate-800">2. Processing Images</h3>
                    <p className="text-slate-600">When you upload an image, it is sent to Google's Gemini AI strictly for the purpose of extracting the schedule data. The image is not retained.</p>

                    <h3 className="text-xl font-bold text-slate-800">3. Your Rights</h3>
                    <p className="text-slate-600">You retain full ownership of your data. You can delete timetables from the dashboard at any time, which permanently removes them from your device.</p>
                  </div>
                </div>
              </div>
            </PageTransition>
          )}

          {currentPage === 'support' && (
            <PageTransition key="support">
              <div className="max-w-3xl mx-auto px-4 py-16">
                <button onClick={() => setCurrentPage('dashboard')} className="flex items-center text-blue-600 font-bold mb-8 hover:underline">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </button>
                <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
                  <MailQuestion className="w-16 h-16 text-blue-600 mx-auto mb-6" />
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
                    <a href="mailto:aligilljutt150@gmail.com" className="inline-block mt-2 font-display font-bold text-blue-600 text-xl hover:text-blue-700 transition-colors">
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
            <button onClick={() => setCurrentPage('support')} className="font-mono font-bold text-[10px] uppercase text-slate-500 tracking-widest hover:text-blue-600 hover:underline transition-colors">Support</button>
            <button onClick={() => setCurrentPage('privacy')} className="font-mono font-bold text-[10px] uppercase text-slate-500 tracking-widest hover:text-blue-600 hover:underline transition-colors">Privacy</button>
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
              window.dispatchEvent(new Event('storage'));
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
