import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import Button from '../components/Button';
import TextInput from '../components/TextInput';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const checkAdminStatus = async (user: any) => {
    // Check if user is an admin
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));

    if (!adminDoc.exists()) {
      // Check by email as fallback
      const adminsSnapshot = await getDoc(doc(db, 'configs', 'adminEmails'));
      const adminEmails = adminsSnapshot.data()?.emails || [];

      if (!adminEmails.includes(user.email)) {
        // Not an admin - sign them out
        await auth.signOut();
        setError('Access denied. You are not authorized as an administrator.');
        setIsLoading(false);
        return false;
      }
    }
    return true;
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Sign in with Google
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const isAdmin = await checkAdminStatus(user);
      if (isAdmin) {
        // User is admin, navigate to dashboard
        navigate('/admin/dashboard');
      }
    } catch (error: any) {
      console.error('Admin login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google Sign-In. Please contact support.');
      } else {
        setError('An error occurred during sign-in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    try {
      // Sign in with email/password
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const isAdmin = await checkAdminStatus(user);
      if (isAdmin) {
        // User is admin, navigate to dashboard
        navigate('/admin/dashboard');
      }
    } catch (error: any) {
      console.error('Admin email login error:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError('An error occurred during sign-in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-sky-900/70 p-8 rounded-2xl shadow-2xl border border-sky-800 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Admin Portal</h1>
          <p className="mt-2 text-slate-300">Sign in with your authorized account</p>
        </div>

        {/* Login Method Toggle */}
        <div className="mt-6 flex gap-2 p-1 bg-slate-900/50 rounded-lg">
          <button
            onClick={() => setLoginMethod('google')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMethod === 'google'
                ? 'bg-cyan-900/50 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Google Sign-In
          </button>
          <button
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMethod === 'email'
                ? 'bg-cyan-900/50 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Email / Password
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {loginMethod === 'google' ? (
          <div className="mt-8">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              isLoading={isLoading}
              className="w-full flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>
          </div>
        ) : (
          <form onSubmit={handleEmailSignIn} className="mt-8 space-y-6">
            <TextInput
              id="email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <TextInput
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Only authorized staff members can access the admin dashboard.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
