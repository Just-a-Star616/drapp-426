/**
 * Migration Script: Add Missing Fields to Existing Applicants
 *
 * This script updates all existing application documents in Firestore to ensure
 * they have all the required fields for the licensing flow.
 *
 * Run with: node migrate-applicants.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateApplicants() {
  console.log('Starting applicant migration...\n');

  try {
    // Get all applications
    const applicationsRef = db.collection('applications');
    const snapshot = await applicationsRef.get();

    if (snapshot.empty) {
      console.log('No applications found in database.');
      return;
    }

    console.log(`Found ${snapshot.size} applications to check.\n`);

    let updateCount = 0;
    let skipCount = 0;

    // Process each application
    for (const doc of snapshot.docs) {
      const appData = doc.data();
      const appId = doc.id;
      const updates = {};
      let needsUpdate = false;

      console.log(`Checking application: ${appId} (${appData.firstName} ${appData.lastName})`);

      // Check if isLicensedDriver field exists
      if (appData.isLicensedDriver === undefined) {
        // Default to true if they have badge details, false otherwise
        const isLicensed = !!(appData.badgeNumber || appData.drivingLicenseNumber);
        updates.isLicensedDriver = isLicensed;
        needsUpdate = true;
        console.log(`  ✓ Setting isLicensedDriver: ${isLicensed}`);
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
        console.log('  ✓ Adding unlicensedProgress object');
      }

      // Ensure documents object exists
      if (!appData.documents) {
        updates.documents = {};
        needsUpdate = true;
        console.log('  ✓ Adding documents object');
      }

      // Ensure hasOwnVehicle is set if they have vehicle details
      if (appData.hasOwnVehicle === undefined && (appData.vehicleMake || appData.vehicleModel || appData.vehicleReg)) {
        updates.hasOwnVehicle = true;
        needsUpdate = true;
        console.log('  ✓ Setting hasOwnVehicle: true (vehicle details exist)');
      }

      // Ensure createdAt exists
      if (!appData.createdAt) {
        updates.createdAt = Date.now();
        needsUpdate = true;
        console.log('  ✓ Adding createdAt timestamp');
      }

      // Apply updates if needed
      if (needsUpdate) {
        await applicationsRef.doc(appId).update(updates);
        updateCount++;
        console.log(`  ✅ Updated successfully\n`);
      } else {
        skipCount++;
        console.log(`  ⏭️  No updates needed\n`);
      }
    }

    console.log('Migration complete!');
    console.log(`Updated: ${updateCount} applications`);
    console.log(`Skipped: ${skipCount} applications (already up to date)`);

  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrateApplicants();
