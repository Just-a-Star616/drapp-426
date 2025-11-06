
import React, { useState, useMemo, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import ApplyWizard from './pages/ApplyWizard';
import Status from './pages/Status';
import Login from './pages/Login';
import Home from './pages/Home';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ApplicationConfirmation from './pages/ApplicationConfirmation';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import BrandingSettings from './pages/BrandingSettings';
import { BrandingConfig, Application, ApplicationStatus } from './types';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot, getDoc, getDocFromServer } from 'firebase/firestore';

const App: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [statusSteps, setStatusSteps] = useState([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [isBrandingLoaded, setIsBrandingLoaded] = useState(false);

  useEffect(() => {
    // Load branding directly from server (no cache) on mount
    const loadBranding = async () => {
      try {
        const configId = 'defaultConfig';
        const configRef = doc(db, 'configs', configId);

        // Force server fetch, bypass cache completely
        const docSnap = await getDocFromServer(configRef);

        if (docSnap.exists()) {
          const configData = docSnap.data();
          console.log('Branding loaded from server:', configData.branding?.companyName);
          setBranding(configData.branding);
          setStatusSteps(configData.statusSteps);
        } else {
          console.error("Branding configuration not found!");
        }
      } catch (error) {
        console.error("Error loading branding:", error);
      } finally {
        setIsBrandingLoaded(true);
      }
    };

    loadBranding();

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setIsAuthLoaded(true);
      } else {
        // No user, sign in anonymously to capture partial applications
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign-in failed:", error);
            setIsAuthLoaded(true); // Stop loading even if anon sign-in fails
        });
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (currentUser && !currentUser.isAnonymous) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
          setIsAdmin(adminDoc.exists());
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [currentUser]);

  useEffect(() => {
    let unsubApp: () => void = () => {};
    if (currentUser) {
      const appRef = doc(db, 'applications', currentUser.uid);
      unsubApp = onSnapshot(
        appRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setApplication(docSnap.data() as Application);
          } else {
            setApplication(null);
          }
        },
        (error) => {
          // Handle permission denied errors (e.g., when user logs out)
          console.log('Application listener error:', error.code);
          if (error.code === 'permission-denied') {
            setApplication(null);
          }
        }
      );
    } else {
      setApplication(null);
    }
    return () => unsubApp();
  }, [currentUser]);

  // Register Service Worker for Firebase Cloud Messaging
  // TEMPORARILY DISABLED - uncomment when push notifications are needed
  // useEffect(() => {
  //   if ('serviceWorker' in navigator) {
  //     navigator.serviceWorker.register('/service-worker.js')
  //       .then(swReg => {
  //         console.log('Service Worker is registered', swReg);
  //       })
  //       .catch(error => {
  //         console.error('Service Worker Error', error);
  //       });
  //   }
  // }, []);
  
  // An authenticated user is one who is logged in and NOT anonymous.
  const isAuthenticated = !!currentUser && !currentUser.isAnonymous;

  // Check if application is incomplete
  const hasIncompleteApplication = application?.isPartial === true;

  const contextValue = useMemo(() => ({
    branding: branding || {
      companyName: 'Loading...',
      logoUrl: '',
      primaryColor: 'sky'
    },
    statusSteps,
    application,
    setApplication: () => {}, // Firestore handles updates
    isAuthenticated,
    setIsAuthenticated: () => {}, // Auth state handles this
    currentUser
  }), [branding, statusSteps, application, isAuthenticated, currentUser]);

  // Only render the app when both auth and branding have loaded
  if (!isAuthLoaded || !isBrandingLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
         <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }

  return (
    <AppProvider value={contextValue}>
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <HashRouter>
          <Routes>
            {/* Always allow access to home page */}
            <Route path="/home" element={<Home />} />
            {/* Allow apply route if not authenticated or has incomplete application */}
            <Route path="/apply" element={!isAuthenticated || hasIncompleteApplication ? <ApplyWizard /> : <Navigate to="/status" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirmation" element={isAuthenticated ? <ApplicationConfirmation /> : <Navigate to="/login" />} />
            <Route path="/status" element={isAuthenticated ? <Status /> : <Navigate to="/login" />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={!isAdmin ? <AdminLogin /> : <Navigate to="/admin/dashboard" />} />
            <Route path="/admin/dashboard" element={isAdmin ? <AdminDashboard /> : <Navigate to="/admin/login" />} />
            <Route path="/admin/branding" element={isAdmin ? <BrandingSettings /> : <Navigate to="/admin/login" />} />

            <Route path="*" element={<Navigate to="/home" />} />
          </Routes>
        </HashRouter>
      </div>
    </AppProvider>
  );
};

export default App;
