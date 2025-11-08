/**
 * Migration function to add missing fields to existing applicants
 * Deploy this as a Cloud Function and call it via HTTP
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.migrateApplicants = functions.https.onRequest(async (req, res) => {
  // Simple authentication - check for a secret key
  const authKey = req.query.key || req.body?.key;
  const expectedKey = functions.config().migration?.key || 'migrate123';

  if (authKey !== expectedKey) {
    return res.status(403).send('Unauthorized');
  }

  const db = admin.firestore();

  try {
    console.log('Starting applicant migration...');

    const applicationsRef = db.collection('applications');
    const snapshot = await applicationsRef.get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No applications found in database.'
      });
    }

    console.log(`Found ${snapshot.size} applications to check.`);

    let updateCount = 0;
    let skipCount = 0;
    const results = [];

    // Process each application
    for (const doc of snapshot.docs) {
      const appData = doc.data();
      const appId = doc.id;
      const updates = {};
      let needsUpdate = false;
      const changes = [];

      // Check if isLicensedDriver field exists
      if (appData.isLicensedDriver === undefined) {
        const isLicensed = !!(appData.badgeNumber || appData.drivingLicenseNumber);
        updates.isLicensedDriver = isLicensed;
        needsUpdate = true;
        changes.push(`Set isLicensedDriver: ${isLicensed}`);
      }

      // If unlicensed driver and missing unlicensedProgress
      if (appData.isLicensedDriver === false && !appData.unlicensedProgress) {
        updates.unlicensedProgress = {
          eligibilityChecked: false,
          dbsApplied: false,
          medicalBooked: false,
          knowledgeTestPassed: false,
          councilApplicationSubmitted: false,
          badgeReceived: false,
        };
        needsUpdate = true;
        changes.push('Added unlicensedProgress object');
      }

      // Ensure documents object exists
      if (!appData.documents) {
        updates.documents = {};
        needsUpdate = true;
        changes.push('Added documents object');
      }

      // Ensure hasOwnVehicle is set if they have vehicle details
      if (appData.hasOwnVehicle === undefined && (appData.vehicleMake || appData.vehicleModel || appData.vehicleReg)) {
        updates.hasOwnVehicle = true;
        needsUpdate = true;
        changes.push('Set hasOwnVehicle: true');
      }

      // Ensure createdAt exists
      if (!appData.createdAt) {
        updates.createdAt = Date.now();
        needsUpdate = true;
        changes.push('Added createdAt timestamp');
      }

      // Apply updates if needed
      if (needsUpdate) {
        await applicationsRef.doc(appId).update(updates);
        updateCount++;
        results.push({
          id: appId,
          name: `${appData.firstName} ${appData.lastName}`,
          changes: changes
        });
      } else {
        skipCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Migration complete!',
      updated: updateCount,
      skipped: skipCount,
      details: results
    });

  } catch (error) {
    console.error('Error during migration:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
