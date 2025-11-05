
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import StatusBar from '../components/StatusBar';
import Button from '../components/Button';
import NotificationBell from '../components/NotificationBell';
import DocumentPreview from '../components/DocumentPreview';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';

const InfoRow: React.FC<{ label: string, value?: string, children?: React.ReactNode }> = ({ label, value, children }) => {
    if (!value && !children) return null;
    return (
        <div className="grid grid-cols-3 gap-4 py-3 border-b border-sky-800">
            <dt className="text-sm font-medium text-slate-400">{label}</dt>
            <dd className="col-span-2 text-sm text-white">
                {children || value || <span className="text-slate-500">N/A</span>}
            </dd>
        </div>
    );
}

const Status = () => {
  const { application, setIsAuthenticated } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/home');
  };

  if (!application) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="bg-sky-900/70 p-8 rounded-2xl">
            <h2 className="text-xl font-bold text-white">Application Loading...</h2>
            <p className="mt-2 text-slate-300">If you have just applied, please wait a moment for the data to sync. If you see this for a long time, please contact support.</p>
            <div className="mt-6">
                 <Button onClick={() => navigate('/apply')}>Start a New Application</Button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
        <div className="bg-sky-900/70 p-8 rounded-2xl shadow-2xl border border-sky-800 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Your Application</h1>
                <div className="flex items-center gap-4">
                    <NotificationBell />
                    <button onClick={handleLogout} className="text-sm font-semibold text-slate-300 hover:text-white flex items-center gap-2">
                        <span>Log Out</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 p-6 bg-slate-900/50 rounded-lg border border-sky-800">
                    <h2 className="text-lg font-semibold text-white mb-6">Application Status</h2>
                    <StatusBar currentStatus={application.status} />
                </div>
                <div className="md:col-span-2 p-6 bg-slate-900/50 rounded-lg border border-sky-800 max-h-[70vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-white">Submitted Information</h2>
                    </div>

                    <dl>
                        <InfoRow label="First Name" value={application.firstName} />
                        <InfoRow label="Last Name" value={application.lastName} />
                        <InfoRow label="Email" value={application.email} />
                        <InfoRow label="Mobile" value={application.phone} />
                        <InfoRow label="Area" value={application.area} />
                        <InfoRow label="Existing License" value={application.isLicensedDriver ? 'Yes' : 'No'} />
                        {application.isLicensedDriver && <>
                            <div className="h-px bg-sky-800 my-4"></div>
                            <InfoRow label="Badge Number" value={application.badgeNumber} />
                            <InfoRow label="Badge Expiry" value={application.badgeExpiry} />
                            <InfoRow label="Issuing Council" value={application.issuingCouncil} />
                            <InfoRow label="Driving License No." value={application.drivingLicenseNumber} />
                            <InfoRow label="License Expiry" value={application.licenseExpiry} />
                            <div className="h-px bg-sky-800 my-4"></div>
                            <InfoRow label="Vehicle Make" value={application.vehicleMake} />
                            <InfoRow label="Vehicle Model" value={application.vehicleModel} />
                            <InfoRow label="Vehicle Reg" value={application.vehicleReg} />
                             <InfoRow label="Insurance Expiry" value={application.insuranceExpiry} />
                            <div className="h-px bg-sky-800 my-4"></div>
                            <h3 className="text-sm font-semibold text-white mb-3 mt-6">Uploaded Documents</h3>
                            <DocumentPreview label="Badge Document" url={application.documents.badgeDocumentUrl} />
                            <DocumentPreview label="Driving License" url={application.documents.drivingLicenseDocumentUrl} />
                            <DocumentPreview label="Insurance Certificate" url={application.documents.insuranceDocumentUrl} />
                        </>}
                    </dl>

                </div>
            </div>
        </div>
    </div>
  );
};

export default Status;
