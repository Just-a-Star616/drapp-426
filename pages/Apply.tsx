import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Application, ApplicationStatus } from '../types';
import TextInput from '../components/TextInput';
import Checkbox from '../components/Checkbox';
import FileUpload from '../components/FileUpload';
import Button from '../components/Button';
import PasswordStrength from '../components/PasswordStrength';
import SubmissionModal from '../components/SubmissionModal';
import { usePasswordValidation } from '../hooks/usePasswordValidation';
import { auth, db, storage } from '../services/firebase';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAppContext } from '../contexts/AppContext';


// Helper to get user-friendly field labels
const getFieldLabel = (fieldId: string): string => {
  const fieldLabels: { [key: string]: string } = {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
    phone: 'Mobile Number',
    area: 'Area / City of Work',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    badgeNumber: 'Badge Number',
    badgeExpiry: 'Badge Expiry Date',
    issuingCouncil: 'Issuing Council',
    drivingLicenseNumber: 'Driving License Number',
    licenseExpiry: 'License Expiry Date',
    vehicleMake: 'Vehicle Make',
    vehicleModel: 'Vehicle Model',
    vehicleReg: 'Vehicle Registration',
    insuranceExpiry: 'Insurance Expiry Date',
  };
  return fieldLabels[fieldId] || fieldId;
};

const Apply: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, application } = useAppContext();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    area: '',
    isLicensedDriver: false,
    badgeNumber: '',
    badgeExpiry: '',
    issuingCouncil: '',
    drivingLicenseNumber: '',
    licenseExpiry: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleReg: '',
    insuranceExpiry: '',
  });
  const [documents, setDocuments] = useState<{ [key: string]: File | null }>({
    badgeDocument: null,
    drivingLicenseDocument: null,
    insuranceDocument: null,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionErrors, setSubmissionErrors] = useState<{ field: string; message: string }[]>([]);
  const passwordValidation = usePasswordValidation(formData.password);

  const debounceTimeoutRef = useRef<number | null>(null);

  // Pre-fill form if a partial application exists
  useEffect(() => {
    if (application) {
        setFormData(prev => ({
            ...prev,
            ...application
        }));
    }
  }, [application]);

  const handleSavePartial = useCallback(async () => {
    if (!currentUser || !currentUser.isAnonymous) return;
    if (!formData.firstName && !formData.email) return; // Don't save empty forms

    const partialData: any = {
        ...formData,
        id: currentUser.uid,
        status: ApplicationStatus.Submitted, // Placeholder status
        createdAt: application?.createdAt || Date.now(), // Preserve original creation date
        isPartial: true,
    };
    // Don't save passwords in partials
    delete partialData.password;
    delete partialData.confirmPassword;

    try {
        await setDoc(doc(db, 'applications', currentUser.uid), partialData, { merge: true });
    } catch (error) {
        console.error("Failed to save partial application", error);
    }
  }, [currentUser, formData, application]);

  const debouncedSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
        handleSavePartial();
    }, 1500); // Auto-save 1.5s after user stops editing
  }, [handleSavePartial]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const { checked } = e.target as HTMLInputElement;

    setFormData(prev => ({
      ...prev,
      [id]: isCheckbox ? checked : value,
    }));
    debouncedSave();
  };

  const handleFileChange = (id: string) => (file: File | null) => {
    setDocuments(prev => ({ ...prev, [id]: file }));
    // Note: Files are not saved in partials, only on final submission.
  };
  
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email address is invalid';
    if (!formData.phone) newErrors.phone = 'Mobile number is required';
    else if (!/^07\d{9}$/.test(formData.phone.replace(/[\s-()]/g, ''))) newErrors.phone = 'Please enter a valid 11-digit UK mobile number starting with 07';
    if (!formData.area) newErrors.area = 'Area / City of work is required';
    if (passwordValidation.score < 5) newErrors.password = 'Password does not meet all requirements.';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';

    setErrors(newErrors);

    // Convert errors to structured format for modal
    if (Object.keys(newErrors).length > 0) {
      const structuredErrors = Object.keys(newErrors).map(fieldId => ({
        field: getFieldLabel(fieldId),
        message: newErrors[fieldId]
      }));
      setSubmissionErrors(structuredErrors);
      setSubmissionSuccess(false);
      setShowModal(true);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !currentUser) return;
    
    setIsLoading(true);
    setErrors({});

    try {
      // 1. Upgrade anonymous account to permanent email/password account
      if (currentUser.isAnonymous) {
          const credential = EmailAuthProvider.credential(formData.email, formData.password);
          await linkWithCredential(currentUser, credential);
      }
      
      const user = auth.currentUser;
      if (!user) throw new Error("User not found after linking.");

      // 2. Upload documents to Cloud Storage
      const documentUrls: { [key: string]: string } = {};
      for (const key in documents) {
        const file = documents[key];
        if (file) {
          const storageRef = ref(storage, `applications/${user.uid}/${key}-${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          documentUrls[`${key}Url`] = await getDownloadURL(snapshot.ref);
        }
      }

      // 3. Create/update final application document in Firestore
      const applicationData: Application = {
        id: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        area: formData.area,
        isLicensedDriver: formData.isLicensedDriver,
        badgeNumber: formData.badgeNumber,
        badgeExpiry: formData.badgeExpiry,
        issuingCouncil: formData.issuingCouncil,
        drivingLicenseNumber: formData.drivingLicenseNumber,
        licenseExpiry: formData.licenseExpiry,
        vehicleMake: formData.vehicleMake,
        vehicleModel: formData.vehicleModel,
        vehicleReg: formData.vehicleReg,
        insuranceExpiry: formData.insuranceExpiry,
        documents: {
            badgeDocumentUrl: documentUrls.badgeDocumentUrl || application?.documents?.badgeDocumentUrl,
            drivingLicenseDocumentUrl: documentUrls.drivingLicenseDocumentUrl || application?.documents?.drivingLicenseDocumentUrl,
            insuranceDocumentUrl: documentUrls.insuranceDocumentUrl || application?.documents?.insuranceDocumentUrl,
        },
        status: ApplicationStatus.Submitted,
        createdAt: application?.createdAt || Date.now(),
        isPartial: false, // Mark as complete
      };

      await setDoc(doc(db, 'applications', user.uid), applicationData);

      // Show success modal
      setSubmissionSuccess(true);
      setSubmissionErrors([]);
      setShowModal(true);

    } catch (error: any) {
      console.error("Application submission error:", error);
      const errorList: { field: string; message: string }[] = [];

      if (error.code === 'auth/email-already-in-use') {
        errorList.push({
          field: 'Email Address',
          message: 'This email address is already in use by another account. Please use a different email or try logging in.'
        });
        setErrors({ email: 'This email address is already in use by another account.' });
      } else if (error.code === 'auth/credential-already-in-use') {
        errorList.push({
          field: 'Email Address',
          message: 'This email address is already linked to another account. Please use a different email.'
        });
        setErrors({ email: 'This email address is already linked to another account.' });
      } else if (error.code === 'storage/unauthorized') {
        errorList.push({
          field: 'File Upload',
          message: 'File upload failed due to permission error. Please try again or contact support.'
        });
      } else if (error.code === 'storage/canceled') {
        errorList.push({
          field: 'File Upload',
          message: 'File upload was canceled. Please try submitting again.'
        });
      } else if (error.code === 'auth/weak-password') {
        errorList.push({
          field: 'Password',
          message: 'Password is too weak. Please choose a stronger password.'
        });
        setErrors({ password: 'Password is too weak.' });
      } else if (error.code === 'auth/invalid-email') {
        errorList.push({
          field: 'Email Address',
          message: 'Email address format is invalid. Please check and try again.'
        });
        setErrors({ email: 'Email address format is invalid.' });
      } else {
        errorList.push({
          field: 'Application Submission',
          message: 'An unexpected error occurred while submitting your application. Please try again. If the problem persists, contact support.'
        });
      }

      setSubmissionErrors(errorList);
      setSubmissionSuccess(false);
      setShowModal(true);
    } finally {
        setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    // Scroll to first error field if there are errors
    if (!submissionSuccess && Object.keys(errors).length > 0) {
      const firstErrorField = Object.keys(errors)[0];
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }
  };

  const handleViewApplication = () => {
    // Navigate to confirmation page
    window.location.assign('/#/confirmation');
  };

  const councils = [ 'Aberdeen City', 'Other' ]; // Truncated for brevity

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8 bg-sky-900/70 p-8 rounded-2xl shadow-2xl border border-sky-800 backdrop-blur-sm">
        <div className="text-left">
          <h1 className="text-3xl font-bold text-white">Driver Application</h1>
          <p className="mt-2 text-slate-300">Join our team of professional drivers. Please fill out the form below to get started.</p>
        </div>

        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white border-b border-sky-800 pb-2">Personal Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput id="firstName" label="First Name" value={formData.firstName} onChange={handleChange} error={errors.firstName} required />
                <TextInput id="lastName" label="Last Name" value={formData.lastName} onChange={handleChange} error={errors.lastName} required />
                <TextInput id="email" label="Email Address" type="email" value={formData.email} onChange={handleChange} error={errors.email} required />
                <TextInput id="phone" label="Mobile Number" type="tel" value={formData.phone} onChange={handleChange} error={errors.phone} required />
                <TextInput id="area" label="Area / City of Work" value={formData.area} onChange={handleChange} error={errors.area} required />
            </div>
        </div>

        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white border-b border-sky-800 pb-2">Create Account</h2>
             <TextInput id="password" label="Password" type="password" value={formData.password} onChange={handleChange} error={errors.password} required />
            <PasswordStrength passwordValidation={passwordValidation} passwordEntered={formData.password.length > 0} />
            <TextInput id="confirmPassword" label="Confirm Password" type="password" value={formData.confirmPassword} onChange={handleChange} error={errors.confirmPassword} required />
        </div>

        <div className="space-y-4">
            <Checkbox id="isLicensedDriver" label="I am an existing licensed private hire driver" checked={formData.isLicensedDriver} onChange={handleChange} />
        </div>
        
        {formData.isLicensedDriver && (
            <div className="space-y-6 p-6 bg-slate-900/50 rounded-lg border border-sky-800">
                 <h2 className="text-xl font-semibold text-white border-b border-sky-800 pb-2">License & Vehicle Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextInput id="badgeNumber" label="Badge Number" value={formData.badgeNumber} onChange={handleChange} />
                    <TextInput id="badgeExpiry" label="Badge Expiry Date" type="date" value={formData.badgeExpiry} onChange={handleChange} />
                    <div className="md:col-span-2">
                        <label htmlFor="issuingCouncil" className="block text-sm font-medium text-slate-300 mb-1">Issuing Council</label>
                        <select id="issuingCouncil" value={formData.issuingCouncil} onChange={handleChange} className="block w-full rounded-md shadow-sm sm:text-sm bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500">
                             <option value="">Select a council</option>
                            {councils.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <TextInput id="drivingLicenseNumber" label="Driving License Number" value={formData.drivingLicenseNumber} onChange={handleChange} />
                    <TextInput id="licenseExpiry" label="License Expiry Date" type="date" value={formData.licenseExpiry} onChange={handleChange} />
                    <TextInput id="vehicleMake" label="Vehicle Make" value={formData.vehicleMake} onChange={handleChange} />
                    <TextInput id="vehicleModel" label="Vehicle Model" value={formData.vehicleModel} onChange={handleChange} />
                    <TextInput id="vehicleReg" label="Vehicle Registration" value={formData.vehicleReg} onChange={handleChange} />
                    <TextInput id="insuranceExpiry" label="Insurance Expiry Date" type="date" value={formData.insuranceExpiry} onChange={handleChange} />
                </div>
                 <div className="space-y-4 pt-4">
                     <FileUpload id="badgeDocument" label="Upload Badge Document" file={documents.badgeDocument} onFileChange={handleFileChange('badgeDocument')} />
                    <FileUpload id="drivingLicenseDocument" label="Upload Driving License" file={documents.drivingLicenseDocument} onFileChange={handleFileChange('drivingLicenseDocument')} />
                    <FileUpload id="insuranceDocument" label="Upload Insurance Certificate" file={documents.insuranceDocument} onFileChange={handleFileChange('insuranceDocument')} />
                 </div>
            </div>
        )}

        {errors.form && <p className="text-sm text-red-500 text-center">{errors.form}</p>}
        
        <div className="pt-4">
             <Button type="submit" isLoading={isLoading}>Submit Application</Button>
        </div>

        <div className="text-center text-sm">
          <span className="text-slate-400">Already applied? </span>
          <Link to="/login" className="font-medium text-cyan-400 hover:text-cyan-300">
            Track your application
          </Link>
        </div>

      </form>

      <SubmissionModal
        isOpen={showModal}
        isSuccess={submissionSuccess}
        errors={submissionErrors}
        onClose={handleModalClose}
        onViewApplication={handleViewApplication}
      />
    </div>
  );
};

export default Apply;