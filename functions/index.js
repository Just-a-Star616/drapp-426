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
