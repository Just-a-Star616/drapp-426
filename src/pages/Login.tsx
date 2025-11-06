
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import TextInput from '../components/TextInput';
import Button from '../components/Button';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const Login = () => {
  const navigate = useNavigate();
  const { branding } = useAppContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  console.log('LOGIN PAGE - Branding data:', {
    companyName: branding.companyName,
    logoUrl: branding.logoUrl,
    tagline: branding.tagline,
    primaryColor: branding.primaryColor
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/status');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError('An unexpected error occurred. Please try again.');
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
        <div className="bg-sky-900/70 p-8 rounded-2xl shadow-2xl border border-sky-800 backdrop-blur-sm text-center">
        <img className="mx-auto h-16 w-16 rounded-md mb-4" src={branding.logoUrl} alt={`${branding.companyName} Logo`} />
        <h1 className="text-3xl font-bold text-white">{branding.companyName}</h1>
        {branding.tagline && <p className="mt-2 text-lg text-slate-300">{branding.tagline}</p>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6 text-left">
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email Address"
            />
            <div>
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
              />
              <div className="text-right mt-2">
                  <Link to="/forgot-password" className={`text-sm font-medium text-${branding.primaryColor}-400 hover:text-${branding.primaryColor}-300`}>
                      Forgot password?
                  </Link>
              </div>
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button type="submit" isLoading={isLoading}>
              Login
            </Button>
            <div className="text-center text-sm">
                <Link to="/home" className={`font-medium text-${branding.primaryColor}-400 hover:text-${branding.primaryColor}-300`}>
                    Back to role selection
                </Link>
            </div>
          </form>
        </div>
    </div>
  );
};

export default Login;
