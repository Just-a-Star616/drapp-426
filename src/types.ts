
export interface BrandingConfig {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  tagline?: string;
}

export interface Application {
  id: string; // Corresponds to Firebase Auth UID
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  area: string;
  isLicensedDriver: boolean;

  // Optional details if licensed
  badgeNumber?: string;
  badgeExpiry?: string;
  issuingCouncil?: string;
  drivingLicenseNumber?: string;
  licenseExpiry?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleReg?: string;
  insuranceExpiry?: string;
  
  documents: {
    badgeDocumentUrl?: string;
    drivingLicenseDocumentUrl?: string;
    insuranceDocumentUrl?: string;
  };

  status: ApplicationStatus;
  createdAt: number; // Store timestamp for sorting/tracking
  isPartial?: boolean; // Flag to identify incomplete, auto-saved applications
}

export enum ApplicationStatus {
  Submitted = 'Submitted',
  UnderReview = 'Under Review',
  Contacted = 'Contacted',
  MeetingScheduled = 'Meeting Scheduled',
  Approved = 'Approved',
  Rejected = 'Rejected',
}