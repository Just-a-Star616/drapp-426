import { useEffect, useState } from 'react';
import { requestNotificationPermission, onMessageListener } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

/**
 * Hook to manage push notification permissions and FCM token
 */
export const useNotifications = () => {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    // Check current notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  /**
   * Request notification permission and save FCM token to Firestore
   */
  const requestPermission = async () => {
    console.log('requestPermission called');
    console.log('Current user:', auth.currentUser);
    console.log('Service Worker support:', 'serviceWorker' in navigator);

    const token = await requestNotificationPermission();
    console.log('Token received:', token);

    if (token) {
      setFcmToken(token);
      setNotificationPermission('granted');

      // Save token to Firestore
      const user = auth.currentUser;
      if (user && !user.isAnonymous) {
        console.log('Saving token to Firestore for user:', user.uid);
        try {
          await setDoc(doc(db, 'fcmTokens', user.uid), {
            token,
            updatedAt: Date.now(),
            userId: user.uid
          });
          console.log('FCM token saved to Firestore successfully!');
        } catch (error) {
          console.error('Error saving FCM token:', error);
        }
      } else {
        console.warn('User is anonymous or not logged in, token not saved');
      }
    } else {
      console.error('No token received from requestNotificationPermission');
    }
    return token;
  };

  /**
   * Listen for foreground messages
   */
  useEffect(() => {
    const unsubscribe = onMessageListener((payload) => {
      console.log('Foreground message received:', payload);

      // Show notification using browser's Notification API
      if (notificationPermission === 'granted') {
        new Notification(payload.notification?.title || 'Notification', {
          body: payload.notification?.body,
          icon: payload.notification?.icon,
        });
      }
    });

    return unsubscribe;
  }, [notificationPermission]);

  return {
    notificationPermission,
    fcmToken,
    requestPermission,
  };
};
