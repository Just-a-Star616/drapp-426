const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Cloud Function that triggers when a new application is created or updated
 * Sends notification to Google Chat when application status changes to "Submitted"
 */
exports.notifyNewApplication = functions.firestore
  .document('applications/{applicationId}')
  .onWrite(async (change, context) => {
    const applicationId = context.params.applicationId;

    // Get the new data
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;

    // Only send notification if:
    // 1. It's a new document AND status is "Submitted" AND not partial
    // 2. OR status changed from something else to "Submitted"
    // 3. OR isPartial changed from true to false (completing a partial application)
    const isNewSubmission = !oldData && newData && newData.status === 'Submitted' && !newData.isPartial;
    const statusChangedToSubmitted = oldData && newData &&
                                     oldData.status !== 'Submitted' &&
                                     newData.status === 'Submitted' &&
                                     !newData.isPartial;
    const partialCompleted = oldData && newData &&
                            oldData.isPartial === true &&
                            newData.isPartial === false &&
                            newData.status === 'Submitted';

    if (!isNewSubmission && !statusChangedToSubmitted && !partialCompleted) {
      console.log('Not a new submission, skipping notification');
      console.log('oldData:', oldData ? 'exists' : 'null');
      console.log('newData.isPartial:', newData?.isPartial);
      console.log('oldData.isPartial:', oldData?.isPartial);
      return null;
    }

    // Get the Google Chat webhook URL from environment config
    const webhookUrl = functions.config().googlechat?.webhook;

    if (!webhookUrl) {
      console.error('Google Chat webhook URL not configured');
      return null;
    }

    // Format the application data for the notification
    const message = {
      text: `🚗 *New Driver Application Submitted*`,
      cards: [{
        header: {
          title: "New Driver Application",
          subtitle: `${newData.firstName} ${newData.lastName}`,
          imageUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097170.png"
        },
        sections: [{
          widgets: [
            {
              keyValue: {
                topLabel: "Applicant Name",
                content: `${newData.firstName} ${newData.lastName}`
              }
            },
            {
              keyValue: {
                topLabel: "Email",
                content: newData.email
              }
            },
            {
              keyValue: {
                topLabel: "Phone",
                content: newData.phone
              }
            },
            {
              keyValue: {
                topLabel: "Area / City",
                content: newData.area
              }
            },
            {
              keyValue: {
                topLabel: "Licensed Driver",
                content: newData.isLicensedDriver ? "✅ Yes" : "❌ No"
              }
            }
          ]
        }]
      }],
      cardsV2: [{
        cardId: "application-" + applicationId,
        card: {
          header: {
            title: "🚗 New Driver Application",
            subtitle: `${newData.firstName} ${newData.lastName}`,
            imageUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097170.png",
            imageType: "CIRCLE"
          },
          sections: [
            {
              header: "Applicant Details",
              collapsible: false,
              widgets: [
                {
                  decoratedText: {
                    topLabel: "Name",
                    text: `${newData.firstName} ${newData.lastName}`,
                    startIcon: {
                      knownIcon: "PERSON"
                    }
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Email",
                    text: newData.email,
                    startIcon: {
                      knownIcon: "EMAIL"
                    }
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Phone",
                    text: newData.phone,
                    startIcon: {
                      knownIcon: "PHONE"
                    }
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Area / City",
                    text: newData.area,
                    startIcon: {
                      knownIcon: "MAP_PIN"
                    }
                  }
                }
              ]
            }
          ]
        }
      }]
    };

    // Add license details section if applicable
    if (newData.isLicensedDriver) {
      message.cardsV2[0].card.sections.push({
        header: "License Details",
        collapsible: true,
        widgets: [
          {
            decoratedText: {
              topLabel: "Badge Number",
              text: newData.badgeNumber || "N/A"
            }
          },
          {
            decoratedText: {
              topLabel: "Badge Expiry",
              text: newData.badgeExpiry || "N/A"
            }
          },
          {
            decoratedText: {
              topLabel: "Issuing Council",
              text: newData.issuingCouncil || "N/A"
            }
          },
          {
            decoratedText: {
              topLabel: "License Number",
              text: newData.drivingLicenseNumber || "N/A"
            }
          },
          {
            decoratedText: {
              topLabel: "Vehicle",
              text: `${newData.vehicleMake || ''} ${newData.vehicleModel || ''} (${newData.vehicleReg || 'N/A'})`
            }
          }
        ]
      });

      // Add documents section if any documents exist
      const hasDocuments = newData.documents?.badgeDocumentUrl ||
                          newData.documents?.drivingLicenseDocumentUrl ||
                          newData.documents?.insuranceDocumentUrl;

      if (hasDocuments) {
        const documentWidgets = [];

        if (newData.documents.badgeDocumentUrl) {
          documentWidgets.push({
            decoratedText: {
              text: "Badge Document",
              button: {
                text: "View",
                onClick: {
                  openLink: {
                    url: newData.documents.badgeDocumentUrl
                  }
                }
              }
            }
          });
        }

        if (newData.documents.drivingLicenseDocumentUrl) {
          documentWidgets.push({
            decoratedText: {
              text: "Driving License",
              button: {
                text: "View",
                onClick: {
                  openLink: {
                    url: newData.documents.drivingLicenseDocumentUrl
                  }
                }
              }
            }
          });
        }

        if (newData.documents.insuranceDocumentUrl) {
          documentWidgets.push({
            decoratedText: {
              text: "Insurance Certificate",
              button: {
                text: "View",
                onClick: {
                  openLink: {
                    url: newData.documents.insuranceDocumentUrl
                  }
                }
              }
            }
          });
        }

        message.cardsV2[0].card.sections.push({
          header: "Documents",
          collapsible: true,
          widgets: documentWidgets
        });
      }
    }

    // Add action button to view in Firebase Console
    message.cardsV2[0].card.sections.push({
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: "View in Firebase Console",
                onClick: {
                  openLink: {
                    url: `https://console.firebase.google.com/project/drapp-426/firestore/data/applications/${applicationId}`
                  }
                }
              }
            ]
          }
        }
      ]
    });

    // Send the notification to Google Chat
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Successfully sent notification to Google Chat');
      return null;
    } catch (error) {
      console.error('Error sending notification to Google Chat:', error);
      throw error;
    }
  });

/**
 * Cloud Function that sends push notifications to applicants when their status changes
 */
exports.sendPushNotification = functions.firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const applicationId = context.params.applicationId;
    const oldData = change.before.data();
    const newData = change.after.data();

    // Only send notification if status actually changed
    if (oldData.status === newData.status) {
      console.log('Status unchanged, skipping push notification');
      return null;
    }

    console.log(`Status changed from ${oldData.status} to ${newData.status} for ${applicationId}`);

    // Get user's FCM token
    try {
      const tokenDoc = await admin.firestore().doc(`fcmTokens/${applicationId}`).get();

      if (!tokenDoc.exists) {
        console.log('No FCM token found for user:', applicationId);
        return null;
      }

      const fcmToken = tokenDoc.data().token;

      // Get branding info from configs
      const configDoc = await admin.firestore().doc('configs/defaultConfig').get();
      const branding = configDoc.exists ? configDoc.data().branding : null;

      // Create push notification message
      const message = {
        notification: {
          title: `${branding?.companyName || 'Driver Recruitment'} - Application Update`,
          body: `Your application status has been updated to: ${newData.status}`,
          icon: branding?.logoUrl || '/logo.png',
        },
        data: {
          status: newData.status,
          applicationId: applicationId,
          companyName: branding?.companyName || 'Driver Recruitment',
          logoUrl: branding?.logoUrl || '/logo.png',
        },
        token: fcmToken,
      };

      // Send push notification
      const response = await admin.messaging().send(message);
      console.log('Successfully sent push notification:', response);
      return response;

    } catch (error) {
      console.error('Error sending push notification:', error);
      // Don't throw - we don't want to fail the status update if notification fails
      return null;
    }
  });

/**
 * Cloud Function to send custom notifications to one or multiple applicants
 * Can send immediately or schedule for later
 */
exports.sendCustomNotification = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { recipients, title, message, scheduledFor, sendNow } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).send('Recipients array is required');
    return;
  }

  if (!title || !message) {
    res.status(400).send('Title and message are required');
    return;
  }

  try {
    // Get branding info
    const configDoc = await admin.firestore().doc('configs/defaultConfig').get();
    const branding = configDoc.exists ? configDoc.data().branding : null;

    if (sendNow) {
      // Send notifications immediately
      const results = [];

      for (const recipientId of recipients) {
        // Get FCM token
        const tokenDoc = await admin.firestore().doc(`fcmTokens/${recipientId}`).get();

        if (!tokenDoc.exists) {
          console.log(`No FCM token found for user: ${recipientId}`);
          results.push({ recipientId, status: 'no_token' });
          continue;
        }

        const fcmToken = tokenDoc.data().token;

        // Create push notification message
        const notificationMessage = {
          notification: {
            title: title,
            body: message,
            icon: branding?.logoUrl || '/logo.png',
          },
          data: {
            title: title,
            message: message,
            companyName: branding?.companyName || 'Driver Recruitment',
            logoUrl: branding?.logoUrl || '/logo.png',
            customNotification: 'true',
          },
          token: fcmToken,
        };

        try {
          const response = await admin.messaging().send(notificationMessage);
          console.log(`Successfully sent notification to ${recipientId}:`, response);
          results.push({ recipientId, status: 'sent', messageId: response });
        } catch (error) {
          console.error(`Error sending to ${recipientId}:`, error);
          results.push({ recipientId, status: 'error', error: error.message });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Notifications sent',
        results: results
      });

    } else {
      // Schedule notification for later
      const scheduledNotification = {
        recipients,
        title,
        message,
        scheduledFor,
        branding: branding,
        status: 'scheduled',
        createdAt: Date.now(),
      };

      // Store in Firestore for later processing
      const docRef = await admin.firestore().collection('scheduledNotifications').add(scheduledNotification);

      res.status(200).json({
        success: true,
        message: 'Notification scheduled',
        notificationId: docRef.id,
        scheduledFor: scheduledFor
      });
    }

  } catch (error) {
    console.error('Error in sendCustomNotification:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Scheduled function to process scheduled notifications
 * Runs every minute to check for notifications that need to be sent
 */
exports.processScheduledNotifications = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    const now = Date.now();

    // Get all scheduled notifications that are due
    const scheduledSnapshot = await admin.firestore()
      .collection('scheduledNotifications')
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', now)
      .get();

    if (scheduledSnapshot.empty) {
      console.log('No scheduled notifications due');
      return null;
    }

    console.log(`Processing ${scheduledSnapshot.size} scheduled notifications`);

    const promises = [];

    scheduledSnapshot.forEach((doc) => {
      const notification = doc.data();

      promises.push(
        (async () => {
          const results = [];

          for (const recipientId of notification.recipients) {
            // Get FCM token
            const tokenDoc = await admin.firestore().doc(`fcmTokens/${recipientId}`).get();

            if (!tokenDoc.exists) {
              console.log(`No FCM token found for user: ${recipientId}`);
              results.push({ recipientId, status: 'no_token' });
              continue;
            }

            const fcmToken = tokenDoc.data().token;

            // Create push notification message
            const message = {
              notification: {
                title: notification.title,
                body: notification.message,
                icon: notification.branding?.logoUrl || '/logo.png',
              },
              data: {
                title: notification.title,
                message: notification.message,
                companyName: notification.branding?.companyName || 'Driver Recruitment',
                logoUrl: notification.branding?.logoUrl || '/logo.png',
                customNotification: 'true',
              },
              token: fcmToken,
            };

            try {
              const response = await admin.messaging().send(message);
              console.log(`Successfully sent scheduled notification to ${recipientId}`);
              results.push({ recipientId, status: 'sent', messageId: response });
            } catch (error) {
              console.error(`Error sending to ${recipientId}:`, error);
              results.push({ recipientId, status: 'error', error: error.message });
            }
          }

          // Update notification status
          await doc.ref.update({
            status: 'sent',
            sentAt: Date.now(),
            results: results
          });
        })()
      );
    });

    await Promise.all(promises);
    console.log('Finished processing scheduled notifications');
    return null;
  });

/**
 * Cloud Function that triggers when a new activity log is created
 * Sends webhook notifications to staff for important activities
 */
exports.notifyStaffOfActivity = functions.firestore
  .document('activityLogs/{logId}')
  .onCreate(async (snapshot, context) => {
    const logId = context.params.logId;
    const activityLog = snapshot.data();

    // Get the Google Chat webhook URL from environment config
    const webhookUrl = functions.config().googlechat?.webhook;

    if (!webhookUrl) {
      console.log('Google Chat webhook URL not configured, skipping notification');
      return null;
    }

    // Determine if this activity should trigger a webhook notification
    // We'll notify staff for all applicant actions and status updates
    const shouldNotify =
      activityLog.actor === 'Applicant' ||
      activityLog.activityType === 'Status Update' ||
      activityLog.activityType === 'Notification Sent';

    if (!shouldNotify) {
      console.log('Activity type does not require staff notification:', activityLog.activityType);
      return null;
    }

    // Determine icon and color based on activity type
    let icon = '📋';
    let color = '#3B82F6'; // blue

    if (activityLog.activityType === 'Document Uploaded by Applicant') {
      icon = '📄';
      color = '#10B981'; // green
    } else if (activityLog.activityType === 'Vehicle Added') {
      icon = '🚗';
      color = '#8B5CF6'; // purple
    } else if (activityLog.activityType === 'DBS Number Added') {
      icon = '🔐';
      color = '#F59E0B'; // amber
    } else if (activityLog.activityType === 'Status Update') {
      icon = '🔄';
      color = '#06B6D4'; // cyan
    } else if (activityLog.activityType === 'Information Updated') {
      icon = '✏️';
      color = '#6366F1'; // indigo
    } else if (activityLog.activityType === 'Unlicensed Progress Updated') {
      icon = '✅';
      color = '#14B8A6'; // teal
    }

    // Format timestamp
    const timestamp = new Date(activityLog.timestamp);
    const formattedTime = timestamp.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create Google Chat message
    const message = {
      text: `${icon} Activity Log Update`,
      cardsV2: [{
        cardId: `activity-${logId}`,
        card: {
          header: {
            title: `${icon} ${activityLog.activityType}`,
            subtitle: activityLog.applicantName,
            imageUrl: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
            imageType: "CIRCLE"
          },
          sections: [
            {
              header: "Activity Details",
              collapsible: false,
              widgets: [
                {
                  decoratedText: {
                    topLabel: "Applicant",
                    text: `${activityLog.applicantName} (${activityLog.applicantEmail})`,
                    startIcon: {
                      knownIcon: "PERSON"
                    }
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Action",
                    text: activityLog.details,
                    startIcon: {
                      knownIcon: "DESCRIPTION"
                    }
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Performed By",
                    text: `${activityLog.actorName} (${activityLog.actor})`,
                    startIcon: {
                      knownIcon: "PERSON"
                    }
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Time",
                    text: formattedTime,
                    startIcon: {
                      knownIcon: "CLOCK"
                    }
                  }
                }
              ]
            }
          ]
        }
      }]
    };

    // Add metadata section if present
    if (activityLog.metadata && Object.keys(activityLog.metadata).length > 0) {
      const metadataWidgets = [];

      // Document uploads - show document types
      if (activityLog.metadata.documentType) {
        metadataWidgets.push({
          decoratedText: {
            topLabel: "Documents",
            text: activityLog.metadata.documentType
          }
        });
      }

      // Status updates - show old and new values
      if (activityLog.metadata.oldValue && activityLog.metadata.newValue) {
        metadataWidgets.push({
          decoratedText: {
            topLabel: "Change",
            text: `${activityLog.metadata.oldValue} → ${activityLog.metadata.newValue}`
          }
        });
      }

      // Vehicle details
      if (activityLog.metadata.vehicleMake && activityLog.metadata.vehicleModel) {
        metadataWidgets.push({
          decoratedText: {
            topLabel: "Vehicle",
            text: `${activityLog.metadata.vehicleMake} ${activityLog.metadata.vehicleModel} (${activityLog.metadata.vehicleReg || 'N/A'})`
          }
        });
      }

      // DBS number (partially masked for security)
      if (activityLog.metadata.dbsCheckNumber) {
        const maskedDBS = activityLog.metadata.dbsCheckNumber.substring(0, 4) + '****';
        metadataWidgets.push({
          decoratedText: {
            topLabel: "DBS Check Number",
            text: maskedDBS
          }
        });
      }

      if (metadataWidgets.length > 0) {
        message.cardsV2[0].card.sections.push({
          header: "Additional Information",
          collapsible: true,
          widgets: metadataWidgets
        });
      }
    }

    // Add action button to view application
    message.cardsV2[0].card.sections.push({
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: "View Application",
                onClick: {
                  openLink: {
                    url: `https://console.firebase.google.com/project/drapp-426/firestore/data/applications/${activityLog.applicationId}`
                  }
                }
              }
            ]
          }
        }
      ]
    });

    // Send the notification to Google Chat
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Successfully sent activity notification to Google Chat');
      return null;
    } catch (error) {
      console.error('Error sending activity notification to Google Chat:', error);
      // Don't throw - we don't want activity logging to fail if webhook fails
      return null;
    }
  });

/**
 * Cloud Function that triggers when a new message is created
 * Sends notification to Google Chat when applicants send messages to staff
 */
exports.notifyStaffOfNewMessage = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data();
    const messageId = context.params.messageId;

    // Only notify staff when applicants send messages (not when staff send messages)
    if (messageData.senderType !== 'Applicant') {
      console.log('Message from staff, skipping notification');
      return null;
    }

    // Get the Google Chat webhook URL from environment config
    const webhookUrl = functions.config().googlechat?.webhook;

    if (!webhookUrl) {
      console.error('Google Chat webhook URL not configured');
      return null;
    }

    // Get applicant details from the application
    let applicantDetails = {
      name: messageData.senderName,
      email: 'Unknown'
    };

    try {
      const applicationDoc = await admin.firestore()
        .collection('applications')
        .doc(messageData.applicationId)
        .get();

      if (applicationDoc.exists) {
        const appData = applicationDoc.data();
        applicantDetails = {
          name: `${appData.firstName} ${appData.lastName}`,
          email: appData.email
        };
      }
    } catch (error) {
      console.error('Error fetching application details:', error);
    }

    // Create the notification message
    const message = {
      text: `💬 New Message from Applicant: ${applicantDetails.name}`,
      cardsV2: [{
        cardId: "message-" + messageId,
        card: {
          header: {
            title: "💬 New Applicant Message",
            subtitle: applicantDetails.name,
            imageUrl: "https://cdn-icons-png.flaticon.com/512/1370/1370907.png",
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: "From",
                    text: applicantDetails.name
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Email",
                    text: applicantDetails.email
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Message",
                    text: messageData.message.length > 200
                      ? messageData.message.substring(0, 200) + '...'
                      : messageData.message,
                    wrapText: true
                  }
                },
                {
                  decoratedText: {
                    topLabel: "Time",
                    text: new Date(messageData.timestamp).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  }
                }
              ]
            },
            {
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: "View in Admin Dashboard",
                        onClick: {
                          openLink: {
                            url: `https://drapp-426.vercel.app/#/admin/dashboard`
                          }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      }]
    };

    // Send the notification to Google Chat
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Successfully sent message notification to Google Chat');
      return null;
    } catch (error) {
      console.error('Error sending message notification to Google Chat:', error);
      // Don't throw - we don't want message sending to fail if webhook fails
      return null;
    }
  });
