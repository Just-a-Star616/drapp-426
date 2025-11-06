import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { Application, ApplicationStatus } from '../types';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/Button';
import SendNotificationModal from '../components/SendNotificationModal';

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

  const handleStatusUpdate = async (applicationId: string, newStatus: ApplicationStatus) => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'applications', applicationId), {
        status: newStatus,
        updatedAt: Date.now()
      });
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

              {/* Contact Info */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                <h3 className="font-semibold text-white mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <span className="ml-2 text-white">{selectedApplication.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    <span className="ml-2 text-white">{selectedApplication.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Area:</span>
                    <span className="ml-2 text-white">{selectedApplication.area}</span>
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
                    </div>

                    {/* Step 2: DBS */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.dbsApplied ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
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
                        {selectedApplication.unlicensedProgress.dbsDocumentUrl && (
                          <a
                            href={selectedApplication.unlicensedProgress.dbsDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Document
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Step 3: Medical */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.medicalBooked ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
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
                        {selectedApplication.unlicensedProgress.medicalDocumentUrl && (
                          <a
                            href={selectedApplication.unlicensedProgress.medicalDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Document
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Step 4: Knowledge Test */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.knowledgeTestPassed ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
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
                        {selectedApplication.unlicensedProgress.knowledgeTestDocumentUrl && (
                          <a
                            href={selectedApplication.unlicensedProgress.knowledgeTestDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            View Certificate
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Step 5: Council Application */}
                    <div className={`p-3 rounded-lg border ${selectedApplication.unlicensedProgress.councilApplicationSubmitted ? 'bg-green-900/20 border-green-700' : 'bg-slate-900/50 border-sky-800'}`}>
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

              {/* License Details */}
              {selectedApplication.isLicensedDriver && (
                <div className="mb-6 p-4 bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-white mb-3">License & Vehicle Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Badge Number:</span>
                      <span className="ml-2 text-white">{selectedApplication.badgeNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Badge Expiry:</span>
                      <span className="ml-2 text-white">{selectedApplication.badgeExpiry || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Council:</span>
                      <span className="ml-2 text-white">{selectedApplication.issuingCouncil || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">License Number:</span>
                      <span className="ml-2 text-white">{selectedApplication.drivingLicenseNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">DBS Check Number:</span>
                      <span className="ml-2 text-white">{selectedApplication.dbsCheckNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Vehicle:</span>
                      <span className="ml-2 text-white">
                        {selectedApplication.vehicleMake} {selectedApplication.vehicleModel} ({selectedApplication.vehicleReg || 'N/A'})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Insurance Expiry:</span>
                      <span className="ml-2 text-white">{selectedApplication.insuranceExpiry || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Documents */}
                  {(selectedApplication.documents?.badgeDocumentUrl ||
                    selectedApplication.documents?.drivingLicenseDocumentUrl ||
                    selectedApplication.documents?.insuranceDocumentUrl ||
                    selectedApplication.documents?.v5cDocumentUrl ||
                    selectedApplication.documents?.phvLicenceDocumentUrl) && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Documents:</h4>
                      <div className="flex gap-2 flex-wrap">
                        {selectedApplication.documents.badgeDocumentUrl && (
                          <a
                            href={selectedApplication.documents.badgeDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            Badge Document
                          </a>
                        )}
                        {selectedApplication.documents.drivingLicenseDocumentUrl && (
                          <a
                            href={selectedApplication.documents.drivingLicenseDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            Driving License
                          </a>
                        )}
                        {selectedApplication.documents.insuranceDocumentUrl && (
                          <a
                            href={selectedApplication.documents.insuranceDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-cyan-900/50 text-cyan-300 rounded text-xs hover:bg-cyan-800/50"
                          >
                            Insurance
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
