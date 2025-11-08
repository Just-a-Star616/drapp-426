# Applicant Migration Guide

## Problem
Some old test applicants are missing the new licensing flow fields (`isLicensedDriver`, `unlicensedProgress`, etc.) and won't display correctly in the admin dashboard.

## Solution
A migration Cloud Function has been deployed at:
`https://us-central1-drapp-426.cloudfunctions.net/migrateApplicants`

## How to Run Migration

### Option 1: Via Firebase Console (Recommended - Most Secure)

1. Go to [Firebase Console - Cloud Functions](https://console.firebase.google.com/project/drapp-426/functions)
2. Find `migrateApplicants` function
3. Click the three dots menu → "Test function"
4. Add request body: `{ "key": "migrate123" }`
5. Click "Run function"
6. Check the results - it will show how many applications were updated

### Option 2: Make Function Public (Temporary)

If you want to call it via HTTP:

1. Go to [Google Cloud Console - Functions](https://console.cloud.google.com/functions/details/us-central1/migrateApplicants?project=drapp-426)
2. Click "PERMISSIONS" tab
3. Click "ADD PRINCIPAL"
4. Enter `allUsers` as the principal
5. Select role `Cloud Functions Invoker`
6. Click "SAVE"
7. Run this command:
   ```bash
   curl "https://us-central1-drapp-426.cloudfunctions.net/migrateApplicants?key=migrate123"
   ```
8. After migration completes, REMOVE the `allUsers` permission (go back to step 2-3, find `allUsers`, click delete)

### Option 3: Manual Update via Firebase Console

1. Go to [Firestore Database](https://console.firebase.google.com/project/drapp-426/firestore)
2. Navigate to `applications` collection
3. For each application document that's missing fields:
   - If they have `badgeNumber` or `drivingLicenseNumber`, add field `isLicensedDriver: true`
   - If they don't have these, add field `is LicensedDriver: false` and add object:
     ```
     unlicensedProgress: {
       eligibilityChecked: false,
       dbsApplied: false,
       medicalBooked: false,
       knowledgeTestPassed: false,
       councilApplicationSubmitted: false,
       badgeReceived: false
     }
     ```
   - If missing `documents` field, add empty object: `documents: {}`
   - If missing `createdAt`, add current timestamp

## What the Migration Does

The migration automatically:

1. **Sets `isLicensedDriver`**:
   - `true` if applicant has `badgeNumber` or `drivingLicenseNumber`
   - `false` otherwise

2. **Adds `unlicensedProgress`** for unlicensed drivers:
   - Creates progress tracking object with all stages set to `false`

3. **Adds `documents` object** if missing:
   - Ensures empty `documents: {}` exists

4. **Sets `hasOwnVehicle`** if they have vehicle details:
   - `true` if they have `vehicleMake`, `vehicleModel`, or `vehicleReg`

5. **Adds `createdAt` timestamp** if missing

## Migration Results

The function returns JSON with:
- `success`: boolean
- `updated`: number of applications updated
- `skipped`: number of applications that didn't need updates
- `details`: array of changes made to each application

## After Migration

Once the migration runs successfully:
- All applicants will display correctly in the admin dashboard
- Unlicensed drivers will see the 5-step licensing checklist
- Licensed drivers will see their existing details

## Cleanup

After migration completes successfully:
- The `migrateApplicants` function can be deleted if no longer needed
- Or keep it for future use when adding new fields
