import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';

const NotificationBell: React.FC = () => {
    const { branding } = useAppContext();
    const { notificationPermission, fcmToken, requestPermission } = useNotifications();
    const [isLoading, setIsLoading] = useState(false);

    const isSubscribed = notificationPermission === 'granted' && !!fcmToken;
    const isSupported = 'Notification' in window;

    const handleToggleSubscription = async () => {
        if (!isSupported) return;

        if (isSubscribed) {
            // User wants to disable - can't actually revoke permission via code
            // Show message to user to disable in browser settings
            alert('To disable notifications, please update your browser settings for this site.');
            return;
        }

        setIsLoading(true);
        await requestPermission();
        setIsLoading(false);
    };
    
    if (!isSupported || isLoading) {
        return (
            <button className={`p-2 rounded-full bg-slate-700 text-slate-400 cursor-wait`} disabled>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
        );
    }

    if (notificationPermission === 'denied') {
        return (
            <div className="relative group">
                <button className="p-2 rounded-full bg-red-900/50 text-red-400 cursor-not-allowed" disabled>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                </button>
                <div className="absolute bottom-full mb-2 w-60 right-0 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    Notifications are blocked by your browser. Please update your site settings to enable them.
                </div>
            </div>
        );
    }
    
    const buttonColor = isSubscribed ? branding.primaryColor : 'slate';
    const hoverColor = isSubscribed ? branding.primaryColor : 'slate';
    const ringColor = isSubscribed ? branding.primaryColor : 'slate';

    return (
        <div className="relative group">
             <button
                onClick={handleToggleSubscription}
                className={`p-2 rounded-full bg-${buttonColor}-800/50 text-${buttonColor}-300 hover:bg-${hoverColor}-700/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${ringColor}-500 focus:ring-offset-slate-900 transition-colors`}
                aria-label={isSubscribed ? "Disable notifications" : "Enable notifications"}
            >
                {isSubscribed ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                )}
            </button>
            <div className="absolute bottom-full mb-2 w-40 text-center right-0 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                {isSubscribed ? 'Click to disable notifications' : 'Click to enable notifications'}
            </div>
        </div>
       
    );
};

export default NotificationBell;
