import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, X, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleAuthSuccess = async (user: any) => {
    // Store user data in database
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      name: user.displayName || name || 'Student',
      createdAt: serverTimestamp()
    }, { merge: true });
    
    onClose();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await handleAuthSuccess(cred.user);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(cred.user, { displayName: name });
        }
        await handleAuthSuccess({ ...cred.user, displayName: name });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered. Please sign in instead.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('We couldn\'t find an account matching these details. Please check your email and password, and try again.');
      } else {
        setError('We encountered a problem signing you in securely. Please ensure Email/Password login is enabled or try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(auth, provider);
      await handleAuthSuccess(cred.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-white border border-slate-200 shadow-xl p-8 rounded-2xl"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 transition-colors text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-3xl font-display mb-2 font-bold text-slate-900">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-sm font-medium text-slate-500 mb-8">
          {isLogin ? 'Sign in to manage your timetables.' : 'Join to upload and share your timetables.'}
        </p>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div className="relative group">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
              <input 
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-12 bg-white border border-slate-300 pl-12 pr-4 font-sans font-medium text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-lg transition-shadow"
              />
            </div>
          )}

          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
            <input 
              type="email"
              placeholder="University Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 bg-white border border-slate-300 pl-12 pr-4 font-sans font-medium text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-lg transition-shadow"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
            <input 
              type="password"
              placeholder="Password (Min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-12 bg-white border border-slate-300 pl-12 pr-4 font-sans font-medium text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-lg transition-shadow"
            />
          </div>

          {error && (
            <p className="text-red-500 font-medium text-xs mt-2 bg-red-50 p-2 rounded">{error}</p>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4 rounded-lg shadow-sm"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="font-mono font-bold text-[10px] text-slate-400 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        <button 
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full h-12 bg-white border border-slate-200 text-slate-700 font-mono font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 rounded-lg hover:border-slate-300"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
          Continue with Google
        </button>

        <p className="text-center mt-8 text-xs font-medium text-slate-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="font-bold text-teal-600 hover:text-teal-700 hover:underline transition-colors"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
