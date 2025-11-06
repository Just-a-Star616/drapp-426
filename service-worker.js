// service-worker.js
// Firebase Cloud Messaging Service Worker

// Import Firebase scripts for FCM
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCxUVjvmrjUcKAPP86c9v_bk9AQThZOtj8",
  authDomain: "drapp-426.firebaseapp.com",
  projectId: "drapp-426",
  storageBucket: "drapp-426.firebasestorage.app",
  messagingSenderId: "602539304557",
  appId: "1:602539304557:web:e11d9d44fa47f663b08164"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Driver Recruitment';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: payload.notification?.icon || payload.data?.logoUrl || '/logo.png',
    badge: payload.data?.logoUrl || '/logo.png',
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  // Use dynamic branding from notification payload, with fallback defaults
  const title = data.title || data.companyName || 'Driver Recruitment';
  const options = {
    body: data.body || 'Your application status has been updated.',
    icon: data.logoUrl || data.icon || '/logo.png',
    badge: data.logoUrl || data.badge || '/logo.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // This looks for an open window with the app's URL and focuses it.
  // If no window is open, it opens a new one.
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's a window open with the same URL.
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        // The URL to focus/open.
        if (client.url === self.location.origin + '/#/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is found, open one.
      if (clients.openWindow) {
        return clients.openWindow('/#/');
      }
    })
  );
});
