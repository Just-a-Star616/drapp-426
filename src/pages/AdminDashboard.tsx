import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { auth, db, storage } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Application, ApplicationStatus } from '../types';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/Button';
import SendNotificationModal from '../components/SendNotificationModal';
import ActivityLogViewer from '../components/ActivityLogViewer';
import { logActivity } from '../services/activityLog';
import { ActivityType, ActivityActor } from '../types';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { statusSteps } = useAppContext();
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'All'>('All');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedForNotification, setSelectedForNotification] = useState<Application[]>([]);

  // Edit mode state
  const [isEditingApplication, setIsEditingApplication] = useState(false);
  const [editedDetails, setEditedDetails] = useState<Partial<Application>>({});

  // Document upload state
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  // Fetch applications in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'applications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps: Application[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Application;
        // Only show complete applications (not partial)
        if (!data.isPartial) {
          apps.push({ ...data, id: doc.id });
        }
      });
      setApplications(apps);
      setFilteredApplications(apps);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching applications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update selected application when applications data changes
  useEffect(() => {
    if (selectedApplication) {
      const updatedApp = applications.find(app => app.id === selectedApplication.id);
      if (updatedApp) {
        setSelectedApplication(updatedApp);
      }
    }
  }, [applications]);

  // Filter applications based on search and status
  useEffect(() => {
    let filtered = applications;

    // Filter by status
    if (statusFilter !== 'All') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(app =>
        app.firstName.toLowerCase().includes(term) ||
        app.lastName.toLowerCase().includes(term) ||
        app.email.toLowerCase().includes(term) ||
        app.phone.includes(term) ||
        app.area.toLowerCase().includes(term)
      );
    }

    setFilteredApplications(filtered);
  }, [searchTerm, statusFilter, applications]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin/login');
  };

  const handleStartEdit = () => {
    if (!selectedApplication) return;
    setEditedDetails({
      firstName: selectedApplication.firstName,
      lastName: selectedApplication.lastName,
      phone: selectedApplication.phone,
      area: selectedApplication.area,
      badgeNumber: selectedApplication.badgeNumber,
      badgeExpiry: selectedApplication.badgeExpiry,
      issuingCouncil: selectedApplication.issuingCouncil,
      drivingLicenseNumber: selectedApplication.drivingLicenseNumber,
      licenseExpiry: selectedApplication.licenseExpiry,
      vehicleMake: selectedApplication.vehicleMake,
      vehicleModel: selectedApplication.vehicleModel,
      vehicleReg: selectedApplication.vehicleReg,
      insuranceExpiry: selectedApplication.insuranceExpiry,
    });
    setIsEditingApplication(true);
  };

  const handleCancelEdit = () => {
    setIsEditingApplication(false);
    setEditedDetails({});
  };

  const handleSaveEdit = async () => {
    if (!selectedApplication) return;

    setIsUpdating(true);
    try {
      const updates: any = {};
      const changedFields: string[] = [];

      // Compare and track changes
      if (editedDetails.firstName !== selectedApplication.firstName) {
        updates.firstName = editedDetails.firstName;
        changedFields.push(`First Name: "${selectedApplication.firstName}" → "${editedDetails.firstName}"`);
      }
      if (editedDetails.lastName !== selectedApplication.lastName) {
        updates.lastName = editedDetails.lastName;
        changedFields.push(`Last Name: "${selectedApplication.lastName}" → "${editedDetails.lastName}"`);
      }
      if (editedDetails.phone !== selectedApplication.phone) {
        updates.phone = editedDetails.phone;
        changedFields.push(`Phone: "${selectedApplication.phone}" → "${editedDetails.phone}"`);
      }
      if (editedDetails.area !== selectedApplication.area) {
        updates.area = editedDetails.area;
        changedFields.push(`Area: "${selectedApplication.area}" → "${editedDetails.area}"`);
      }

      // Licensed driver fields
      if (selectedApplication.isLicensedDriver) {
        if (editedDetails.badgeNumber !== selectedApplication.badgeNumber) {
          updates.badgeNumber = editedDetails.badgeNumber;
          changedFields.push(`Badge Number: "${selectedApplication.badgeNumber || 'N/A'}" → "${editedDetails.badgeNumber}"`);
        }
        if (editedDetails.badgeExpiry !== selectedApplication.badgeExpiry) {
          updates.badgeExpiry = editedDetails.badgeExpiry;
          changedFields.push(`Badge Expiry: "${selectedApplication.badgeExpiry || 'N/A'}" → "${editedDetails.badgeExpiry}"`);
        }
        if (editedDetails.issuingCouncil !== selectedApplication.issuingCouncil) {
          updates.issuingCouncil = editedDetails.issuingCouncil;
          changedFields.push(`Issuing Council: "${selectedApplication.issuingCouncil || 'N/A'}" → "${editedDetails.issuingCouncil}"`);
        }
        if (editedDetails.drivingLicenseNumber !== selectedApplication.drivingLicenseNumber) {
          updates.drivingLicenseNumber = editedDetails.drivingLicenseNumber;
          changedFields.push(`License Number: "${selectedApplication.drivingLicenseNumber || 'N/A'}" → "${editedDetails.drivingLicenseNumber}"`);
        }
        if (editedDetails.licenseExpiry !== selectedApplication.licenseExpiry) {
          updates.licenseExpiry = editedDetails.licenseExpiry;
          changedFields.push(`License Expiry: "${selectedApplication.licenseExpiry || 'N/A'}" → "${editedDetails.licenseExpiry}"`);
        }

        // Vehicle details
        if (editedDetails.vehicleMake !== selectedApplication.vehicleMake) {
          updates.vehicleMake = editedDetails.vehicleMake;
          changedFields.push(`Vehicle Make: "${selectedApplication.vehicleMake || 'N/A'}" → "${editedDetails.vehicleMake}"`);
        }
        if (editedDetails.vehicleModel !== selectedApplication.vehicleModel) {
          updates.vehicleModel = editedDetails.vehicleModel;
          changedFields.push(`Vehicle Model: "${selectedApplication.vehicleModel || 'N/A'}" → "${editedDetails.vehicleModel}"`);
        }
        if (editedDetails.vehicleReg !== selectedApplication.vehicleReg) {
          updates.vehicleReg = editedDetails.vehicleReg;
          changedFields.push(`Vehicle Reg: "${selectedApplication.vehicleReg || 'N/A'}" → "${editedDetails.vehicleReg}"`);
        }
        if (editedDetails.insuranceExpiry !== selectedApplication.insuranceExpiry) {
          updates.insuranceExpiry = editedDetails.insuranceExpiry;
          changedFields.push(`Insurance Expiry: "${selectedApplication.insuranceExpiry || 'N/A'}" → "${editedDetails.insuranceExpiry}"`);
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'applications', selectedApplication.id), updates);

        // Log the activity
        if (auth.currentUser) {
          await logActivity({
            applicationId: selectedApplication.id,
            applicantName: `${selectedApplication.firstName} ${selectedApplication.lastName}`,
            applicantEmail: selectedApplication.email,
            activityType: ActivityType.InformationUpdated,
            actor: ActivityActor.Staff,
            actorId: auth.currentUser.uid,
            actorName: auth.currentUser.email || 'Admin Staff',
            details: `Staff updated applicant details: ${changedFields.join(', ')}`,
            metadata: {
              changedFields: changedFields,
              fieldsCount: changedFields.length,
            },
          });
        }

        setIsEditingApplication(false);
        setEditedDetails({});
      }
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDocumentUpload = async (file: File, documentType: string) => {
    if (!selectedApplication) return;

    setUploadingDocument(true);
    setUploadMessage(`Uploading ${documentType}...`);

    try {
      const storageRef = ref(storage, `documents/${selectedApplication.id}/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const updates: any = {};
      const applicantName = `${selectedApplication.firstName} ${selectedApplication.lastName}`;

      // Map document type to Firestore field
      const documentFieldMap: { [key: string]: string } = {
        'Badge Document': 'documents.badgeDocumentUrl',
        'Driving License': 'documents.drivingLicenseDocumentUrl',
        'Insurance Certificate': 'documents.insuranceDocumentUrl',
        'V5C Logbook': 'documents.v5cDocumentUrl',
        'PHV Licence': 'documents.phvLicenceDocumentUrl',
        'DBS Certificate': 'unlicensedProgress.dbsDocumentUrl',
        'Medical Certificate': 'unlicensedProgress.medicalDocumentUrl',
        'Knowledge Test Certificate': 'unlicensedProgress.knowledgeTestDocumentUrl',
      };

      const fieldPath = documentFieldMap[documentType];
      if (fieldPath) {
        updates[fieldPath] = downloadURL;
      }

      await updateDoc(doc(db, 'applications', selectedApplication.id), updates);

      // Log the document upload activity
      if (auth.currentUser) {
        await logActivity({
          applicationId: selectedApplication.id,
          applicantName,
          applicantEmail: selectedApplication.email,
          activityType: ActivityType.DocumentUploadedByStaff,
          actor: ActivityActor.Staff,
          actorId: auth.currentUser.uid,
          actorName: auth.currentUser.email || 'Admin Staff',
          details: `Staff uploaded ${documentType} for applicant`,
          metadata: { documentType },
        });
      }

      setUploadMessage(`${documentType} uploaded successfully!`);
      setTimeout(() => {
        setUploadMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error uploading document:', error);
      setUploadMessage(`Error uploading ${documentType}. Please try again.`);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleUnlicensedProgressUpdate = async (field: string, value: boolean) => {
    if (!selectedApplication || !selectedApplication.unlicensedProgress) return;

    setIsUpdating(true);
    try {
      const updates: any = {
        [`unlicensedProgress.${field}`]: value,
      };

      await updateDoc(doc(db, 'applications', selectedApplication.id), updates);

      // Log the progress update
      if (auth.currentUser) {
        const stepNames: { [key: string]: string } = {
          eligibilityChecked: 'Eligibility Check',
          dbsApplied: 'Enhanced DBS Check',
          medicalBooked: 'Medical Examination',
          knowledgeTestPassed: 'Knowledge & Safeguarding Test',
          councilApplicationSubmitted: 'Council Application Submitted',
        };

        await logActivity({
          applicationId: selectedApplication.id,
          applicantName: `${selectedApplication.firstName} ${selectedApplication.lastName}`,
          applicantEmail: selectedApplication.email,
          activityType: ActivityType.UnlicensedProgressUpdated,
          actor: ActivityActor.Staff,
          actorId: auth.currentUser.uid,
          actorName: auth.currentUser.email || 'Admin Staff',
          details: `Staff marked "${stepNames[field]}" as ${value ? 'complete' : 'incomplete'}`,
          metadata: {
            step: stepNames[field],
            oldValue: !value ? 'Complete' : 'Incomplete',
            newValue: value ? 'Complete' : 'Incomplete',
          },
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Failed to update progress. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusUpdate = async (applicationId: string, newStatus: ApplicationStatus) => {
    setIsUpdating(true);
    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application) return;

      const oldStatus = application.status;

      await updateDoc(doc(db, 'applications', applicationId), {
        status: newStatus,
        updatedAt: Date.now()
      });

      // Log the status update activity
      if (auth.currentUser) {
        await logActivity({
          applicationId,
          applicantName: `${application.firstName} ${application.lastName}`,
          applicantEmail: application.email,
          activityType: ActivityType.StatusUpdate,
          actor: ActivityActor.Staff,
          actorId: auth.currentUser.uid,
          actorName: auth.currentUser.email || 'Admin Staff',
          details: `Status updated from "${oldStatus}" to "${newStatus}"`,
          metadata: {
            oldValue: oldStatus,
            newValue: newStatus,
          },
        });
      }

      setSelectedApplication(null);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.Submitted:
        return 'bg-blue-900/50 text-blue-300';
      case ApplicationStatus.UnderReview:
        return 'bg-yellow-900/50 text-yellow-300';
      case ApplicationStatus.Contacted:
        return 'bg-purple-900/50 text-purple-300';
      case ApplicationStatus.MeetingScheduled:
        return 'bg-indigo-900/50 text-indigo-300';
      case ApplicationStatus.Approved:
        return 'bg-green-900/50 text-green-300';
      case ApplicationStatus.Rejected:
        return 'bg-red-900/50 text-red-300';
      default:
        return 'bg-slate-900/50 text-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto text-center">
        <div className="bg-sky-900/70 p-8 rounded-2xl">
          <h2 className="text-xl font-bold text-white">Loading applications...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="bg-sky-900/70 p-8 rounded-2xl shadow-2xl border border-sky-800 backdrop-blur-sm">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="mt-1 text-slate-300">Manage driver applications</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedForNotification([]);
                setShowNotificationModal(true);
              }}
              className="px-4 py-2 bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800/50 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Send Notification
            </button>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-2"
            >
              <span>Log Out</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/50 p-4 rounded-lg border border-sky-800">
            <p className="text-sm text-slate-400">Total Applications</p>
            <p className="text-2xl font-bold text-white">{applications.length}</p>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-sky-800">
            <p className="text-sm text-slate-400">Under Review</p>
            <p className="text-2xl font-bold text-yellow-300">
              {applications.filter(a => a.status === ApplicationStatus.UnderReview).length}
            </p>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-sky-800">
            <p className="text-sm text-slate-400">Approved</p>
            <p className="text-2xl font-bold text-green-300">
              {applications.filter(a => a.status === ApplicationStatus.Approved).length}
            </p>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-sky-800">
            <p className="text-sm text-slate-400">New (Submitted)</p>
            <p className="text-2xl font-bold text-blue-300">
              {applications.filter(a => a.status === ApplicationStatus.Submitted).length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name, email, phone, or area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 border border-slate-600 focus:border-cyan-500 focus:ring-cyan-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'All')}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-cyan-500"
          >
            <option value="All">All Statuses</option>
            {Object.values(ApplicationStatus).map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Applications Table */}
        <div className="bg-slate-900/50 rounded-lg border border-sky-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Area</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Licensed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      {searchTerm || statusFilter !== 'All' ? 'No applications match your filters.' : 'No applications yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-4 text-sm text-white">
                        {app.firstName} {app.lastName}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        <div>{app.email}</div>
                        <div className="text-xs text-slate-400">{app.phone}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">{app.area}</td>
                      <td className="px-4 py-4 text-sm">
                        {app.isLicensedDriver ? (
                          <span className="text-green-400">✓ Yes</span>
                        ) : (
                          <div>
                            <span className="text-slate-400">Licensing</span>
                            {app.unlicensedProgress && (
                              <div className="text-xs text-cyan-400 mt-1">
                                {[
                                  app.unlicensedProgress.eligibilityChecked,
                                  app.unlicensedProgress.dbsApplied,
                                  app.unlicensedProgress.medicalBooked,
                                  app.unlicensedProgress.knowledgeTestPassed,
                                  app.unlicensedProgress.councilApplicationSubmitted
                                ].filter(Boolean).length}/5 steps
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedApplication(app)}
                            className="text-cyan-400 hover:text-cyan-300 font-medium"
                          >
                            View / Update
                          </button>
                          <button
                            onClick={() => {
                              setSelectedForNotification([app]);
                              setShowNotificationModal(true);
                            }}
                            className="text-purple-400 hover:text-purple-300 font-medium"
                            title="Send notification to this applicant"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="mt-8 bg-slate-900/50 p-6 rounded-lg border border-sky-800">
          <ActivityLogViewer limit={15} />
        </div>
      </div>

      {/* Application Detail Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setSelectedApplication(null)}>
          <div className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-sky-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedApplication.firstName} {selectedApplication.lastName}
                  </h2>
                  <p className="text-slate-400">Application Details</p>
                </div>
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Edit Button Row */}
              {!isEditingApplication && (
                <div className="mb-4">
                  <button
                    onClick={handleStartEdit}
                    className="px-4 py-2 bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800/50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Applicant Details
                  </button>
                </div>
              )}

              {isEditingApplication && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg text-sm font-medium transition-colors"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* Upload Message */}
              {uploadMessage && (
                <div className={`mb-4 p-3 rounded-lg ${uploadMessage.includes('Error') || uploadMessage.includes('Failed') ? 'bg-red-900/20 border border-red-700 text-red-300' : 'bg-green-900/20 border border-green-700 text-green-300'}`}>
                  {uploadMessage}
                </div>
              )}

              {/* Contact Info */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                <h3 className="font-semibold text-white mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">First Name:</span>
                    {isEditingApplication ? (
                      <input
                        type="text"
                        value={editedDetails.firstName || ''}
                        onChange={(e) => setEditedDetails({ ...editedDetails, firstName: e.target.value })}
                        className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                      />
                    ) : (
                      <span className="ml-2 text-white">{selectedApplication.firstName}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400">Last Name:</span>
                    {isEditingApplication ? (
                      <input
                        type="text"
                        value={editedDetails.lastName || ''}
                        onChange={(e) => setEditedDetails({ ...editedDetails, lastName: e.target.value })}
                        className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                      />
                    ) : (
                      <span className="ml-2 text-white">{selectedApplication.lastName}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <span className="ml-2 text-white">{selectedApplication.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    {isEditingApplication ? (
                      <input
                        type="tel"
                        value={editedDetails.phone || ''}
                        onChange={(e) => setEditedDetails({ ...editedDetails, phone: e.target.value })}
                        className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                      />
                    ) : (
                      <span className="ml-2 text-white">{selectedApplication.phone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400">Area:</span>
                    {isEditingApplication ? (
                      <input
                        type="text"
                        value={editedDetails.area || ''}
                        onChange={(e) => setEditedDetails({ ...editedDetails, area: e.target.value })}
                        className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                      />
                    ) : (
                      <span className="ml-2 text-white">{selectedApplication.area}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400">Applied:</span>
                    <span className="ml-2 text-white">{new Date(selectedApplication.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Unlicensed Driver Progress */}
              {!selectedApplication.isLicensedDriver && selectedApplication.unlicensedProgress && (
                <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-white mb-3">Licensing Progress</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    This applicant is working towards obtaining their taxi/PHV driver license.
                  </p>

                  {/* Progress Steps */}
                  <div className="space-y-3 mb-4">
                    {/* Step 1: Eligibility */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.eligibilityChecked ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {selectedApplication.unlicensedProgress.eligibilityChecked ? (
                            <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          <span className="text-white text-sm font-medium">1. Eligibility Check</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedApplication.unlicensedProgress.eligibilityChecked}
                            onChange={(e) => handleUnlicensedProgressUpdate('eligibilityChecked', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                            disabled={isUpdating}
                          />
                          <span className="text-xs text-slate-400">Mark Complete</span>
                        </label>
                      </div>
                    </div>

                    {/* Step 2: DBS */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.dbsApplied ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {selectedApplication.unlicensedProgress.dbsApplied ? (
                              <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            <span className="text-white text-sm font-medium">2. Enhanced DBS Check</span>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedApplication.unlicensedProgress.dbsApplied}
                              onChange={(e) => handleUnlicensedProgressUpdate('dbsApplied', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                              disabled={isUpdating}
                            />
                            <span className="text-xs text-slate-400">Mark Complete</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2 ml-8">
                          {selectedApplication.unlicensedProgress.dbsDocumentUrl ? (
                            <a
                              href={selectedApplication.unlicensedProgress.dbsDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                            >
                              View Document
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">No document uploaded</span>
                          )}
                          <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                            <input
                              type="file"
                              onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'DBS Certificate')}
                              className="hidden"
                              disabled={uploadingDocument}
                            />
                            Upload Document
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Medical */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.medicalBooked ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {selectedApplication.unlicensedProgress.medicalBooked ? (
                              <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            <span className="text-white text-sm font-medium">3. Medical Examination</span>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedApplication.unlicensedProgress.medicalBooked}
                              onChange={(e) => handleUnlicensedProgressUpdate('medicalBooked', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                              disabled={isUpdating}
                            />
                            <span className="text-xs text-slate-400">Mark Complete</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2 ml-8">
                          {selectedApplication.unlicensedProgress.medicalDocumentUrl ? (
                            <a
                              href={selectedApplication.unlicensedProgress.medicalDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                            >
                              View Document
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">No document uploaded</span>
                          )}
                          <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                            <input
                              type="file"
                              onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'Medical Certificate')}
                              className="hidden"
                              disabled={uploadingDocument}
                            />
                            Upload Document
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Knowledge Test */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.knowledgeTestPassed ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {selectedApplication.unlicensedProgress.knowledgeTestPassed ? (
                              <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            <span className="text-white text-sm font-medium">4. Knowledge & Safeguarding Test</span>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedApplication.unlicensedProgress.knowledgeTestPassed}
                              onChange={(e) => handleUnlicensedProgressUpdate('knowledgeTestPassed', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                              disabled={isUpdating}
                            />
                            <span className="text-xs text-slate-400">Mark Complete</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2 ml-8">
                          {selectedApplication.unlicensedProgress.knowledgeTestDocumentUrl ? (
                            <a
                              href={selectedApplication.unlicensedProgress.knowledgeTestDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                            >
                              View Certificate
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">No certificate uploaded</span>
                          )}
                          <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                            <input
                              type="file"
                              onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'Knowledge Test Certificate')}
                              className="hidden"
                              disabled={uploadingDocument}
                            />
                            Upload Certificate
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Step 5: Council Application */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.councilApplicationSubmitted ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {selectedApplication.unlicensedProgress.councilApplicationSubmitted ? (
                            <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          <span className="text-white text-sm font-medium">5. Council Application Submitted</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedApplication.unlicensedProgress.councilApplicationSubmitted}
                            onChange={(e) => handleUnlicensedProgressUpdate('councilApplicationSubmitted', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                            disabled={isUpdating}
                          />
                          <span className="text-xs text-slate-400">Mark Complete</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Progress Summary */}
                  <div className="mt-4 p-3 bg-cyan-900/30 rounded-lg border border-cyan-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white text-sm font-medium">Overall Progress</span>
                      <span className="text-cyan-400 font-bold text-sm">
                        {[
                          selectedApplication.unlicensedProgress.eligibilityChecked,
                          selectedApplication.unlicensedProgress.dbsApplied,
                          selectedApplication.unlicensedProgress.medicalBooked,
                          selectedApplication.unlicensedProgress.knowledgeTestPassed,
                          selectedApplication.unlicensedProgress.councilApplicationSubmitted
                        ].filter(Boolean).length} / 5 Complete
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-sky-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${(([
                            selectedApplication.unlicensedProgress.eligibilityChecked,
                            selectedApplication.unlicensedProgress.dbsApplied,
                            selectedApplication.unlicensedProgress.medicalBooked,
                            selectedApplication.unlicensedProgress.knowledgeTestPassed,
                            selectedApplication.unlicensedProgress.councilApplicationSubmitted
                          ].filter(Boolean).length) / 5) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle Details for Unlicensed Drivers (if they've added a vehicle) */}
              {!selectedApplication.isLicensedDriver && (selectedApplication.vehicleMake || selectedApplication.hasOwnVehicle !== undefined) && (
                <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-white mb-3">Vehicle Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="col-span-2">
                      <span className="text-slate-400">Vehicle Ownership:</span>
                      <span className="ml-2 text-white">
                        {selectedApplication.hasOwnVehicle === true ? 'Own Vehicle' : selectedApplication.hasOwnVehicle === false ? 'Fleet Vehicle' : 'Not Specified'}
                      </span>
                    </div>
                    {(selectedApplication.vehicleMake || selectedApplication.vehicleModel || isEditingApplication) && (
                      <>
                        <div>
                          <span className="text-slate-400">Vehicle Make:</span>
                          {isEditingApplication ? (
                            <input
                              type="text"
                              value={editedDetails.vehicleMake || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, vehicleMake: e.target.value })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.vehicleMake}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Vehicle Model:</span>
                          {isEditingApplication ? (
                            <input
                              type="text"
                              value={editedDetails.vehicleModel || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, vehicleModel: e.target.value })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.vehicleModel}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Vehicle Registration:</span>
                          {isEditingApplication ? (
                            <input
                              type="text"
                              value={editedDetails.vehicleReg || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, vehicleReg: e.target.value.toUpperCase() })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.vehicleReg || 'N/A'}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Insurance Expiry:</span>
                          {isEditingApplication ? (
                            <input
                              type="date"
                              value={editedDetails.insuranceExpiry || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, insuranceExpiry: e.target.value })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.insuranceExpiry || 'N/A'}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Vehicle Documents for Unlicensed */}
                  {(selectedApplication.documents?.insuranceDocumentUrl ||
                    selectedApplication.documents?.v5cDocumentUrl ||
                    selectedApplication.documents?.phvLicenceDocumentUrl) && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Vehicle Documents:</h4>
                      <div className="flex gap-2 flex-wrap">
                        {selectedApplication.documents.insuranceDocumentUrl && (
                          <a
                            href={selectedApplication.documents.insuranceDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            Insurance Certificate
                          </a>
                        )}
                        {selectedApplication.documents.v5cDocumentUrl && (
                          <a
                            href={selectedApplication.documents.v5cDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            V5C Logbook
                          </a>
                        )}
                        {selectedApplication.documents.phvLicenceDocumentUrl && (
                          <a
                            href={selectedApplication.documents.phvLicenceDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            PHV Licence
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* License Details */}
              {selectedApplication.isLicensedDriver && (
                <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-white mb-3">License & Vehicle Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Badge Number:</span>
                      {isEditingApplication ? (
                        <input
                          type="text"
                          value={editedDetails.badgeNumber || ''}
                          onChange={(e) => setEditedDetails({ ...editedDetails, badgeNumber: e.target.value })}
                          className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                        />
                      ) : (
                        <span className="ml-2 text-white">{selectedApplication.badgeNumber || 'N/A'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400">Badge Expiry:</span>
                      {isEditingApplication ? (
                        <input
                          type="date"
                          value={editedDetails.badgeExpiry || ''}
                          onChange={(e) => setEditedDetails({ ...editedDetails, badgeExpiry: e.target.value })}
                          className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                        />
                      ) : (
                        <span className="ml-2 text-white">{selectedApplication.badgeExpiry || 'N/A'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400">Issuing Council:</span>
                      {isEditingApplication ? (
                        <input
                          type="text"
                          value={editedDetails.issuingCouncil || ''}
                          onChange={(e) => setEditedDetails({ ...editedDetails, issuingCouncil: e.target.value })}
                          className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                        />
                      ) : (
                        <span className="ml-2 text-white">{selectedApplication.issuingCouncil || 'N/A'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400">Driving License No.:</span>
                      {isEditingApplication ? (
                        <input
                          type="text"
                          value={editedDetails.drivingLicenseNumber || ''}
                          onChange={(e) => setEditedDetails({ ...editedDetails, drivingLicenseNumber: e.target.value })}
                          className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                        />
                      ) : (
                        <span className="ml-2 text-white">{selectedApplication.drivingLicenseNumber || 'N/A'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400">License Expiry:</span>
                      {isEditingApplication ? (
                        <input
                          type="date"
                          value={editedDetails.licenseExpiry || ''}
                          onChange={(e) => setEditedDetails({ ...editedDetails, licenseExpiry: e.target.value })}
                          className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                        />
                      ) : (
                        <span className="ml-2 text-white">{selectedApplication.licenseExpiry || 'N/A'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400">DBS Check Number:</span>
                      <span className="ml-2 text-white">{selectedApplication.dbsCheckNumber || 'N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Vehicle Ownership:</span>
                      <span className="ml-2 text-white">
                        {selectedApplication.hasOwnVehicle === true ? 'Own Vehicle' : selectedApplication.hasOwnVehicle === false ? 'Fleet Vehicle' : 'Not Specified'}
                      </span>
                    </div>
                    {(selectedApplication.vehicleMake || selectedApplication.vehicleModel || isEditingApplication) && (
                      <>
                        <div>
                          <span className="text-slate-400">Vehicle Make:</span>
                          {isEditingApplication ? (
                            <input
                              type="text"
                              value={editedDetails.vehicleMake || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, vehicleMake: e.target.value })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.vehicleMake}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Vehicle Model:</span>
                          {isEditingApplication ? (
                            <input
                              type="text"
                              value={editedDetails.vehicleModel || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, vehicleModel: e.target.value })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.vehicleModel}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Vehicle Registration:</span>
                          {isEditingApplication ? (
                            <input
                              type="text"
                              value={editedDetails.vehicleReg || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, vehicleReg: e.target.value.toUpperCase() })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.vehicleReg || 'N/A'}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Insurance Expiry:</span>
                          {isEditingApplication ? (
                            <input
                              type="date"
                              value={editedDetails.insuranceExpiry || ''}
                              onChange={(e) => setEditedDetails({ ...editedDetails, insuranceExpiry: e.target.value })}
                              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white border border-slate-600 focus:border-cyan-500 w-full mt-1"
                            />
                          ) : (
                            <span className="ml-2 text-white">{selectedApplication.insuranceExpiry || 'N/A'}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Documents */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Documents:</h4>
                    <div className="space-y-2">
                      {/* Badge Document */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-32">Badge Document:</span>
                        {selectedApplication.documents?.badgeDocumentUrl ? (
                          <a
                            href={selectedApplication.documents.badgeDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Document
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Not uploaded</span>
                        )}
                        <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                          <input
                            type="file"
                            onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'Badge Document')}
                            className="hidden"
                            disabled={uploadingDocument}
                          />
                          Upload
                        </label>
                      </div>

                      {/* Driving License */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-32">Driving License:</span>
                        {selectedApplication.documents?.drivingLicenseDocumentUrl ? (
                          <a
                            href={selectedApplication.documents.drivingLicenseDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Document
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Not uploaded</span>
                        )}
                        <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                          <input
                            type="file"
                            onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'Driving License')}
                            className="hidden"
                            disabled={uploadingDocument}
                          />
                          Upload
                        </label>
                      </div>

                      {/* Insurance Certificate */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-32">Insurance:</span>
                        {selectedApplication.documents?.insuranceDocumentUrl ? (
                          <a
                            href={selectedApplication.documents.insuranceDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Document
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Not uploaded</span>
                        )}
                        <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                          <input
                            type="file"
                            onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'Insurance Certificate')}
                            className="hidden"
                            disabled={uploadingDocument}
                          />
                          Upload
                        </label>
                      </div>

                      {/* V5C Logbook */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-32">V5C Logbook:</span>
                        {selectedApplication.documents?.v5cDocumentUrl ? (
                          <a
                            href={selectedApplication.documents.v5cDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Document
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Not uploaded</span>
                        )}
                        <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                          <input
                            type="file"
                            onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'V5C Logbook')}
                            className="hidden"
                            disabled={uploadingDocument}
                          />
                          Upload
                        </label>
                      </div>

                      {/* PHV Licence */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-32">PHV Licence:</span>
                        {selectedApplication.documents?.phvLicenceDocumentUrl ? (
                          <a
                            href={selectedApplication.documents.phvLicenceDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Document
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Not uploaded</span>
                        )}
                        <label className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs hover:bg-purple-800/50 cursor-pointer">
                          <input
                            type="file"
                            onChange={(e) => e.target.files && handleDocumentUpload(e.target.files[0], 'PHV Licence')}
                            className="hidden"
                            disabled={uploadingDocument}
                          />
                          Upload
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                <h3 className="font-semibold text-white mb-3">Update Status</h3>
                <p className="text-sm text-slate-400 mb-3">
                  Current status: <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedApplication.status)}`}>
                    {selectedApplication.status}
                  </span>
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.values(ApplicationStatus).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(selectedApplication.id, status)}
                      disabled={isUpdating || status === selectedApplication.status}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        status === selectedApplication.status
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800/50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                {isUpdating && (
                  <p className="mt-2 text-sm text-cyan-400">Updating status and sending notification...</p>
                )}
              </div>

              {/* Activity Log */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                <ActivityLogViewer applicationId={selectedApplication.id} limit={20} />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      <SendNotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        applications={applications}
        selectedApplications={selectedForNotification}
      />
    </div>
  );
};

export default AdminDashboard;
