import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Application, ApplicationStatus, UnlicensedProgress } from '../types';
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
import UnlicensedDashboard from './UnlicensedDashboard';

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

const ApplyWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, application, branding } = useAppContext();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    area: '',
    isLicensedDriver: false,
    hasOwnVehicle: false,
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
    v5cDocument: null,
    phvLicenceDocument: null,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionErrors, setSubmissionErrors] = useState<{ field: string; message: string }[]>([]);
  const passwordValidation = usePasswordValidation(formData.password);

  const debounceTimeoutRef = useRef<number | null>(null);
  const hasLoadedInitialData = useRef(false);

  // Check if user is converting from unlicensed to licensed
  const convertingToLicensed = searchParams.get('convertToLicensed') === 'true';

  // Pre-fill form if a partial application exists
  useEffect(() => {
    if (application && !hasLoadedInitialData.current) {
      // Don't overwrite password fields from stored application
      const { password, confirmPassword, ...applicationData } = application as any;

      setFormData(prev => ({
        ...prev,
        ...applicationData,
        password: '',
        confirmPassword: '',
        hasOwnVehicle: application.hasOwnVehicle ?? false,
      }));

      // If converting to licensed, set the flag and skip to licensed flow
      if (convertingToLicensed && !application.isLicensedDriver) {
        setFormData(prev => ({ ...prev, isLicensedDriver: true }));
        setCurrentStep(2); // Start at badge details step
      }

      // Restore current step if saved
      if (application.currentStep) {
        setCurrentStep(application.currentStep);
      }

      hasLoadedInitialData.current = true;
    }
  }, [application, convertingToLicensed]);

  // If user completed basic info and chose unlicensed, show dashboard
  if (application && !application.isLicensedDriver && currentStep > 1 && !convertingToLicensed) {
    return <UnlicensedDashboard />;
  }

  const handleSavePartial = useCallback(async () => {
    if (!currentUser || !currentUser.isAnonymous) return;
    if (!formData.firstName && !formData.email) return;

    const partialData: any = {
      ...formData,
      id: currentUser.uid,
      status: ApplicationStatus.Submitted,
      createdAt: application?.createdAt || Date.now(),
      isPartial: true,
      currentStep,
    };

    delete partialData.password;
    delete partialData.confirmPassword;

    try {
      await setDoc(doc(db, 'applications', currentUser.uid), partialData, { merge: true });
    } catch (error) {
      console.error("Failed to save partial application", error);
    }
  }, [currentUser, formData, application, currentStep]);

  const debouncedSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
      handleSavePartial();
    }, 1500);
  }, [handleSavePartial]);

  useEffect(() => {
    if (currentUser?.isAnonymous && formData.firstName) {
      debouncedSave();
    }
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [formData, currentUser, debouncedSave]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, type, value } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
    if (errors[id]) {
      setErrors(prev => ({ ...prev, [id]: '' }));
    }
  };

  const handleFileChange = (docId: string) => (file: File | null) => {
    setDocuments(prev => ({ ...prev, [docId]: file }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (step === 1) {
      // Step 1: Personal details and account creation
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
      if (!formData.area.trim()) newErrors.area = 'Area is required';
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (!passwordValidation.isValid) {
        // Debug logging
        console.log('Password validation failed:', {
          password: formData.password,
          validation: passwordValidation,
          length: formData.password.length,
        });
        newErrors.password = 'Password does not meet requirements';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (step === 2 && formData.isLicensedDriver) {
      // Step 2: Badge details
      if (!formData.badgeNumber?.trim()) newErrors.badgeNumber = 'Badge number is required';
      if (!formData.badgeExpiry) newErrors.badgeExpiry = 'Badge expiry date is required';
      if (!formData.issuingCouncil) newErrors.issuingCouncil = 'Issuing council is required';
    }

    if (step === 3 && formData.isLicensedDriver) {
      // Step 3: Driving details
      if (!formData.drivingLicenseNumber?.trim()) {
        newErrors.drivingLicenseNumber = 'Driving license number is required';
      }
      if (!formData.licenseExpiry) newErrors.licenseExpiry = 'License expiry date is required';
    }

    if (step === 4 && formData.isLicensedDriver) {
      // Step 4: Documents
      if (!documents.badgeDocument && !application?.documents?.badgeDocumentUrl) {
        newErrors.badgeDocument = 'Badge document is required';
      }
      if (!documents.drivingLicenseDocument && !application?.documents?.drivingLicenseDocumentUrl) {
        newErrors.drivingLicenseDocument = 'Driving license document is required';
      }
    }

    if (step === 6 && formData.isLicensedDriver && formData.hasOwnVehicle) {
      // Step 6: Vehicle details (only if own vehicle)
      if (!formData.vehicleMake?.trim()) newErrors.vehicleMake = 'Vehicle make is required';
      if (!formData.vehicleModel?.trim()) newErrors.vehicleModel = 'Vehicle model is required';
      if (!formData.vehicleReg?.trim()) newErrors.vehicleReg = 'Vehicle registration is required';
      if (!formData.insuranceExpiry) newErrors.insuranceExpiry = 'Insurance expiry date is required';
      if (!documents.insuranceDocument && !application?.documents?.insuranceDocumentUrl) {
        newErrors.insuranceDocument = 'Insurance document is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      // Special handling for step 1
      if (currentStep === 1) {
        if (formData.isLicensedDriver) {
          setCurrentStep(2); // Go to licensed flow
        } else {
          // For unlicensed, create account and show dashboard
          handleUnlicensedSubmit();
        }
      } else if (currentStep === 5 && !formData.hasOwnVehicle) {
        // Skip vehicle details if no own vehicle
        setCurrentStep(7); // Go to review
      } else {
        setCurrentStep(prev => prev + 1);
      }
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentStep === 7 && !formData.hasOwnVehicle) {
      setCurrentStep(5); // Skip vehicle details when going back
    } else {
      setCurrentStep(prev => prev - 1);
    }
    window.scrollTo(0, 0);
  };

  const handleUnlicensedSubmit = async () => {
    setIsLoading(true);
    try {
      if (!currentUser) throw new Error('No user authenticated');

      // Create account
      const credential = EmailAuthProvider.credential(formData.email, formData.password);
      await linkWithCredential(currentUser, credential);

      // Initialize unlicensed progress
      const unlicensedProgress: UnlicensedProgress = {
        eligibilityChecked: false,
        dbsApplied: false,
        medicalBooked: false,
        knowledgeTestPassed: false,
        councilApplicationSubmitted: false,
        badgeReceived: false,
      };

      const applicationData: Partial<Application> = {
        id: currentUser.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        area: formData.area,
        isLicensedDriver: false,
        unlicensedProgress,
        documents: {},
        status: ApplicationStatus.Submitted,
        createdAt: Date.now(),
        isPartial: false,
        currentStep: 2,
      };

      await setDoc(doc(db, 'applications', currentUser.uid), applicationData);
      setCurrentStep(2); // This will trigger the UnlicensedDashboard to show
    } catch (error: any) {
      console.error('Submission error:', error);
      setErrors({ form: error.message || 'Failed to create account' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(currentStep)) return;
    if (currentStep < 7) {
      handleNext();
      return;
    }

    setIsLoading(true);
    setSubmissionErrors([]);

    try {
      if (!currentUser) throw new Error('No user authenticated');

      // Upload documents
      const documentUrls: any = { ...application?.documents };

      for (const [key, file] of Object.entries(documents)) {
        if (file) {
          const timestamp = Date.now();
          const storageRef = ref(storage, `documents/${currentUser.uid}/${timestamp}-${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);

          const urlKey = key.replace('Document', 'DocumentUrl');
          documentUrls[urlKey] = downloadURL;
        }
      }

      // Create account if not already created
      if (currentUser.isAnonymous) {
        const credential = EmailAuthProvider.credential(formData.email, formData.password);
        await linkWithCredential(currentUser, credential);
      }

      const applicationData: Partial<Application> = {
        id: currentUser.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        area: formData.area,
        isLicensedDriver: true,
        badgeNumber: formData.badgeNumber,
        badgeExpiry: formData.badgeExpiry,
        issuingCouncil: formData.issuingCouncil,
        drivingLicenseNumber: formData.drivingLicenseNumber,
        licenseExpiry: formData.licenseExpiry,
        hasOwnVehicle: formData.hasOwnVehicle,
        vehicleMake: formData.hasOwnVehicle ? formData.vehicleMake : undefined,
        vehicleModel: formData.hasOwnVehicle ? formData.vehicleModel : undefined,
        vehicleReg: formData.hasOwnVehicle ? formData.vehicleReg : undefined,
        insuranceExpiry: formData.hasOwnVehicle ? formData.insuranceExpiry : undefined,
        documents: documentUrls,
        status: ApplicationStatus.Submitted,
        createdAt: application?.createdAt || Date.now(),
        isPartial: false,
      };

      await setDoc(doc(db, 'applications', currentUser.uid), applicationData);

      setSubmissionSuccess(true);
      setShowModal(true);
    } catch (error: any) {
      console.error('Submission error:', error);
      setSubmissionSuccess(false);
      setSubmissionErrors([{ field: 'general', message: error.message || 'Submission failed' }]);
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (submissionSuccess) {
      navigate('/confirmation');
    }
  };

  const handleViewApplication = () => {
    navigate('/status');
  };

  const councils = [
    'Aberdeen City',
    'Aberdeenshire Council',
    'Adur District Council',
    'Amber Valley Borough Council',
    'Angus',
    'Argyll & Bute',
    'Arun District Council',
    'Ashfield District Council',
    'Ashford Borough Council',
    'Babergh District Council',
    'Badenoch & Strathspey (Kingussie)',
    'Barnsley Metropolitan Council',
    'Basildon District Council',
    'Basingstoke & Deane Borough Council',
    'Bassetlaw District Council',
    'Bath & North East Somerset Council',
    'Bedford Borough Council',
    'Birmingham (City of)',
    'Blaby District Council',
    'Blackburn with Darwen Borough Council',
    'Blackpool Borough Council',
    'Blaneau Gwent County Borough Council',
    'Blyth Valley Borough Council',
    'Bolsover District Council',
    'Bolton Metropolitan Borough Council',
    'Boston Borough Council',
    'Bournemouth Borough Council',
    'Bracknell Forest Borough Council',
    'Bradford (City of)',
    'Braintree District Council',
    'Breckland Council',
    'Brentwood Borough Council',
    'Bridgend County Borough Council',
    'Bridgnorth District Council',
    'Brighton & Hove Council',
    'Bristol City Council',
    'Broadland District Council',
    'Bromsgrove District Council',
    'Broxbourne Borough Council',
    'Broxtowe Borough Council',
    'Buckinghamshire Council',
    'Burnley Borough Council',
    'Bury Metropolitan Borough Council',
    'Caerphilly County Borough Council',
    'Caithness (Wick)',
    'Calderdale MetroBorough Council',
    'Cambridge City Council',
    'Cannock Chase District Council',
    'Canterbury City Council',
    'Cardiff County Council',
    'Carmarthenshire County Council',
    'Castle Point Borough Council',
    'Central Bedfordshire District Council',
    'Ceredigion County Council',
    'Charnwood Borough Council',
    'Chelmsford Borough Council',
    'Cheltenham Borough Council',
    'Cherwell District Council',
    'Cheshire East Council',
    'Cheshire West & Chester',
    'Chester City Council',
    'Chester-le-Street District Council',
    'Chesterfield Borough Council',
    'Chichester District Council',
    'Chorley Borough Council',
    'Christchurch Borough Council',
    'Clackmannanshire',
    'Colchester Borough Council',
    'Conwy County Borough Council',
    'Cornwall Council (Caradon Zone)',
    'Cornwall Council (Carrick Zone)',
    'Cornwall Council (Kerrier Zone)',
    'Cornwall Council (North Cornwall Zone)',
    'Cornwall Council (Penwith Zone)',
    'Cornwall Council (Restormel Zone)',
    'Cotswold District Council',
    'Coventry (City of)',
    'Crawley Borough Council',
    'Cumberland Council',
    'Dacorum Borough Council',
    'Darlington Borough Council',
    'Dartford Borough Council',
    'Denbighshire County Council',
    'Derby City Council',
    'Derbyshire Dales District Council',
    'Doncaster Metropolitan Council',
    'Dover District Council',
    'Dudley Metropolitan Borough',
    'Dumfries & Galloway',
    'Dundee City',
    'Durham City Council',
    'East Ayrshire',
    'East Cambridgeshire District Council',
    'East Devon District Council',
    'East Dorset District Council',
    'East Dunbartonshire',
    'East Hampshire District Council',
    'East Hertfordshire District Council',
    'East Kilbride',
    'East Lindsey District Council',
    'East Lothian',
    'East Renfrewshire',
    'East Riding Council',
    'East Staffordshire Borough Council',
    'East Suffolk Council',
    'Eastbourne Borough Council',
    'Eastleigh Borough Council',
    'Edinburgh (City of)',
    'Ellesmere Port & Neston Borough Council',
    'Elmbridge Borough Council',
    'Epping Forest Borough Council',
    'Epsom & Ewell Borough Council',
    'Erewash Borough Council',
    'Exeter City Council',
    'Falkirk',
    'Fareham Borough Council',
    'Fenland District Council',
    'Fife',
    'Flintshire County Council',
    'Folkestone & Hythe District Council',
    'Forest of Dean District Council',
    'Fylde Borough Council',
    'Gateshead Metropolitan Borough Council',
    'Gedling Borough Council',
    'Glasgow City',
    'Gloucester City Council',
    'Gosport Borough Council',
    'Gravesham Borough Council',
    'Great Yarmouth Borough Council',
    'Guildford Borough Council',
    'Gwynedd County Council',
    'Halton Borough Council',
    'Harborough District Council',
    'Harlow District Council',
    'Hart District Council',
    'Hartlepool Borough Council',
    'Hastings Borough Council',
    'Havant Borough Council',
    'Herefordshire Council',
    'Hertsmere Borough Council',
    'High Peak Borough Council',
    'Highland',
    'Hinckley & Bosworth Borough Council',
    'Horsham District Council',
    'Huntingdonshire District Council',
    'Hyndburn Borough Council',
    'Inverclyde',
    'Ipswich Borough Council',
    'Isle of Anglesey County Council',
    'Isle of Man (Douglas Borough Council)',
    'Isle of Wight Council',
    'Isles of Scilly Council',
    'Kennet District Council',
    'Kings Lynn & West Norfolk Borough Council',
    'Kingston Upon Hull City Council',
    'Kirklees Metropolitan Borough Council',
    'Knowsley Metropolitan Borough Council',
    'Lancaster City Council',
    'Leeds (City of )',
    'Leicester City Council',
    'Lewes District Council',
    'Lichfield District Council',
    'Lincoln City Council',
    'Liverpool (City of)',
    'Lochaber (Fort William)',
    'London (City of)',
    'Luton Borough Council',
    'Maidstone Borough Council',
    'Maldon District Council',
    'Malvern Hills District Council',
    'Manchester (City of)',
    'Mansfield District Council',
    'Medway Council',
    'Melton Borough Council',
    'Mendip District Council',
    'Merthyr Tydfil County Borough Council',
    'Mid Devon District Council',
    'Mid Suffolk District Council',
    'Mid Sussex District Council',
    'Middlesbrough Council',
    'Midlothian',
    'Milton Keynes Council',
    'Mole Valley District Council',
    'Monmouthshire County Council',
    'Moray',
    'Nairn',
    'Neath Port Talbot County Borough Council',
    'New Forest District Council',
    'Newark & Sherwood District Council',
    'Newcastle-under-Lyme Borough Council',
    'Newcastle-Upon-Tyne (City of)',
    'Newport County Borough Council',
    'North Ayrshire',
    'North Devon District Council',
    'North Dorset District Council',
    'North East Derbyshire District Council',
    'North East Lincolnshire Council',
    'North Hertfordshire District Council',
    'North Kesteven District Council',
    'North Lanarkshire',
    'North Lincolnshire Council',
    'North Norfolk District Council',
    'North Northamptonshire Council',
    'North Shropshire District Council',
    'North Somerset Council',
    'North Tyneside Metro Borough Council',
    'North Warwickshire  Borough Council',
    'North West Leicestershire  Borough Council',
    'North Yorkshire Council',
    'Northumberland County Council',
    'Norwich City Council',
    'Nottingham City Council',
    'Nuneaton & Bedworth Borough Council',
    'Oadby and Wigston Borough Council',
    'Oldham Metropolitan Borough Council',
    'Orkney Islands',
    'Oswestry Borough Council',
    'Oxford City Council',
    'Pembrokeshire County Council',
    'Pendle Borough Council',
    'Perth & Kinross',
    'Peterborough City Council',
    'Plymouth City Council',
    'Poole Borough Council',
    'Portsmouth City Council',
    'Powys County Council',
    'Preston Borough Council',
    'Purbeck District Council',
    'Reading Borough Council',
    'Redcar & Cleveland Council',
    'Redditch Borough Council',
    'Reigate & Banstead Borough Council',
    'Renfrewshire',
    'Rhondda Cynon Taff County Borough Council',
    'Ribble Valley Borough Council',
    'Rochdale Metropolitan Borough Council',
    'Rochford District Council',
    'Ross & Cromarty (Dingwall)',
    'Rossendale Borough Council',
    'Rother District Council',
    'Rotherham Borough Council',
    'Royal Borough Windsor & Maidenhead',
    'Rugby Borough Council',
    'Runnymede Borough Council',
    'Rushcliffe Borough Council',
    'Rushmoor Borough Council',
    'Rutland County Council',
    'Salford City Council',
    'Sandwell Metropolitan District',
    'Scottish Borders',
    'Sedgefield Borough Council',
    'Sedgemoor District Council',
    'Sefton Metropolitan Borough Council',
    'Sevenoaks District Council',
    'Sheffield (City of)',
    'Shetland Islands',
    'Shropshire Council',
    'Skye & Lochalsh (Isle Of Skye)',
    'Slough Borough Council',
    'Solihull Metropolitan Borough Council',
    'South Ayrshire',
    'South Cambridgeshire District Council',
    'South Derbyshire District Council',
    'South East and Metropolitan',
    'South Gloucestershire Council',
    'South Hams District Council',
    'South Holland District Council',
    'South KestevenDistrict Council',
    'South Lanarkshire Council',
    'South Norfolk District Council',
    'South OxfordshireDistrict Council',
    'South Ribble Borough Council',
    'South ShropshireDistrict Council',
    'South Somerset District Council',
    'South StaffordshireDistrict Council',
    'South Tyneside Borough Council',
    'Southampton City Council',
    'Southend-on-Sea Borough Council',
    'Spelthorne Borough Council',
    'St Albans City Council',
    'St Helens Metropolitan District Council',
    'Stafford Borough Council',
    'Staffordshire Moorlands District Council',
    'Stevenage Borough Council',
    'Stirling',
    'Stockport Metropolitan Borough Council',
    'Stockton-on-Tees Council',
    'Stoke-on-Trent City Council',
    'Stratford-on-Avon District Council',
    'Stroud District Council',
    'Sunderland (City of)',
    'Surrey Heath Borough Council',
    'Sutherland (Golspie)',
    'Swale Borough Council',
    'Swansea Council (City and County of)',
    'Swindon Borough Council',
    'Tameside Metropolitan Council',
    'Tamworth Borough Council',
    'Tandridge District Council',
    'Taunton Deane Borough Council',
    'Teesdale District Council',
    'Teignbridge District Council',
    'Telford & Wrekin Council',
    'Tendring District Council',
    'Test Valley Borough Council',
    'Tewkesbury Borough Council',
    'Thanet District Council',
    'Three Rivers District Council',
    'Thurrock Borough Council',
    'Tonbridge & Malling Borough Council',
    'Torbay Borough Council',
    'Torfaen County Borough Council',
    'Torridge District Council',
    'Trafford Borough Council',
    'Tunbridge Wells Borough Council',
    'Uttlesford District Council',
    'Vale of Glamorgan County Borough Council',
    'Vale of White Horse District Council',
    'Vale Royal Borough Council',
    'Walsall Metropolitan Borough Council',
    'Wakefield (City of)',
    'Wansbeck District Council',
    'Warrington Borough Council',
    'Warwick District Council',
    'Watford Borough Council',
    'Waverley Borough Council',
    'Wealden District Council',
    'Wear Valley District Council',
    'Welwyn Hatfield District  Council',
    'West Berkshire District Council',
    'West Devon Borough Council',
    'West Dorset District Council',
    'West Dunbartonshire',
    'West Lancashire District  Council',
    'West Lindsey District Council',
    'West Lothian',
    'West Northamptonshire Council',
    'West Oxfordshire District Council',
    'West Somerset District Council',
    'West Suffolk Council',
    'Western Isles',
    'Westmorland and Furness Council (Barrow Office)',
    'Westmorland and Furness Council (Kendall Office)',
    'Westmorland and Furness Council (Penrith Office)',
    'Weymouth & Portland  Borough Council',
    'Wigan Metropolitan  Borough Council',
    'Wiltshire District Council',
    'Winchester City Council',
    'Wirral Metropolitan  Borough Council',
    'Woking Borough Council',
    'Wokingham District Council',
    'Wolverhampton Metropolitan  Borough Council',
    'Worcester City Council',
    'Worthing Borough Council',
    'Wrexham County Borough Council',
    'Wychavon District Council',
    'Wyre Borough Council',
    'Wyre Forest District Council',
    'York Council (City of)',
  ];

  const renderProgressBar = () => {
    const totalSteps = formData.isLicensedDriver ? (formData.hasOwnVehicle ? 7 : 6) : 1;
    const progress = (currentStep / totalSteps) * 100;

    return (
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Step {currentStep} of {totalSteps}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-cyan-500 to-sky-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8 bg-sky-900/70 p-8 rounded-2xl shadow-2xl border border-sky-800 backdrop-blur-sm">
        {renderProgressBar()}

        {/* Step 1: Initial Information Capture */}
        {currentStep === 1 && (
          <>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Driver Application</h1>
              <p className="mt-2 text-slate-300">Join our team of professional drivers. Let's start with your basic information.</p>
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white border-b border-sky-800 pb-2">Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput id="firstName" label="First Name" value={formData.firstName} onChange={handleChange} error={errors.firstName} required />
                <TextInput id="lastName" label="Last Name" value={formData.lastName} onChange={handleChange} error={errors.lastName} required />
                <TextInput id="email" label="Email Address" type="email" value={formData.email} onChange={handleChange} error={errors.email} required />
                <TextInput id="phone" label="Mobile Number" type="tel" value={formData.phone} onChange={handleChange} error={errors.phone} required />
                <div className="md:col-span-2">
                  <TextInput id="area" label="Area / City of Work" value={formData.area} onChange={handleChange} error={errors.area} required />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white border-b border-sky-800 pb-2">Create Account</h2>
              <TextInput id="password" label="Password" type="password" value={formData.password} onChange={handleChange} error={errors.password} required />
              <PasswordStrength passwordValidation={passwordValidation} passwordEntered={formData.password.length > 0} />
              <TextInput id="confirmPassword" label="Confirm Password" type="password" value={formData.confirmPassword} onChange={handleChange} error={errors.confirmPassword} required />
            </div>

            <div className="space-y-4 p-6 bg-slate-900/50 rounded-lg border border-sky-800">
              <h2 className="text-xl font-semibold text-white">Licensing Status</h2>
              <Checkbox
                id="isLicensedDriver"
                label="I am an existing licensed private hire / taxi driver"
                checked={formData.isLicensedDriver}
                onChange={handleChange}
              />
              {!formData.isLicensedDriver && (
                <p className="text-sm text-slate-300 mt-2">
                  Don't worry! We'll guide you through the process of getting your taxi/PHV licence.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 2: Badge Details (Licensed Only) */}
        {currentStep === 2 && formData.isLicensedDriver && (
          <>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Badge Details</h1>
              <p className="mt-2 text-slate-300">Please provide your taxi/PHV badge information.</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput
                  id="badgeNumber"
                  label="Badge Number"
                  value={formData.badgeNumber}
                  onChange={handleChange}
                  error={errors.badgeNumber}
                  required
                />
                <TextInput
                  id="badgeExpiry"
                  label="Badge Expiry Date"
                  type="date"
                  value={formData.badgeExpiry}
                  onChange={handleChange}
                  error={errors.badgeExpiry}
                  required
                />
                <div className="md:col-span-2">
                  <label htmlFor="issuingCouncil" className="block text-sm font-medium text-slate-300 mb-1">
                    Issuing Council *
                  </label>
                  <select
                    id="issuingCouncil"
                    value={formData.issuingCouncil}
                    onChange={handleChange}
                    className="block w-full rounded-md shadow-sm sm:text-sm bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500"
                    required
                  >
                    <option value="">Select a council</option>
                    {councils.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.issuingCouncil && (
                    <p className="text-sm text-red-500 mt-1">{errors.issuingCouncil}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Driving License Details (Licensed Only) */}
        {currentStep === 3 && formData.isLicensedDriver && (
          <>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Driving License Details</h1>
              <p className="mt-2 text-slate-300">Please provide your driving license information.</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput
                  id="drivingLicenseNumber"
                  label="Driving License Number"
                  value={formData.drivingLicenseNumber}
                  onChange={handleChange}
                  error={errors.drivingLicenseNumber}
                  required
                />
                <TextInput
                  id="licenseExpiry"
                  label="License Expiry Date"
                  type="date"
                  value={formData.licenseExpiry}
                  onChange={handleChange}
                  error={errors.licenseExpiry}
                  required
                />
              </div>
            </div>
          </>
        )}

        {/* Step 4: Upload Documents (Licensed Only) */}
        {currentStep === 4 && formData.isLicensedDriver && (
          <>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Upload Documents</h1>
              <p className="mt-2 text-slate-300">Please upload clear photos of your documents.</p>
            </div>

            <div className="space-y-4">
              <FileUpload
                id="badgeDocument"
                label="Upload Badge Document *"
                file={documents.badgeDocument}
                onFileChange={handleFileChange('badgeDocument')}
                error={errors.badgeDocument}
              />
              <FileUpload
                id="drivingLicenseDocument"
                label="Upload Driving License (front and back) *"
                file={documents.drivingLicenseDocument}
                onFileChange={handleFileChange('drivingLicenseDocument')}
                error={errors.drivingLicenseDocument}
              />
            </div>
          </>
        )}

        {/* Step 5: Vehicle Ownership Question (Licensed Only) */}
        {currentStep === 5 && formData.isLicensedDriver && (
          <>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Vehicle Information</h1>
              <p className="mt-2 text-slate-300">Tell us about your vehicle situation.</p>
            </div>

            <div className="space-y-6 p-6 bg-slate-900/50 rounded-lg border border-sky-800">
              <h2 className="text-xl font-semibold text-white">Will you be using your own vehicle?</h2>
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="vehicleOwnership"
                    checked={formData.hasOwnVehicle === true}
                    onChange={() => setFormData(prev => ({ ...prev, hasOwnVehicle: true }))}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-white">Yes, I have my own vehicle</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="vehicleOwnership"
                    checked={formData.hasOwnVehicle === false}
                    onChange={() => setFormData(prev => ({ ...prev, hasOwnVehicle: false }))}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-white">No, I'll use a fleet vehicle or rent</span>
                </label>
              </div>
              {formData.hasOwnVehicle === false && (
                <p className="text-sm text-slate-300 mt-4">
                  That's fine! You can skip the vehicle details section.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 6: Vehicle Details (Licensed Only, Own Vehicle Only) */}
        {currentStep === 6 && formData.isLicensedDriver && formData.hasOwnVehicle && (
          <>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Vehicle & Insurance Details</h1>
              <p className="mt-2 text-slate-300">Please provide your vehicle information.</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput
                  id="vehicleMake"
                  label="Vehicle Make"
                  value={formData.vehicleMake}
                  onChange={handleChange}
                  error={errors.vehicleMake}
                  required
                />
                <TextInput
                  id="vehicleModel"
                  label="Vehicle Model"
                  value={formData.vehicleModel}
                  onChange={handleChange}
                  error={errors.vehicleModel}
                  required
                />
                <TextInput
                  id="vehicleReg"
                  label="Vehicle Registration"
                  value={formData.vehicleReg}
                  onChange={handleChange}
                  error={errors.vehicleReg}
                  required
                />
                <TextInput
                  id="insuranceExpiry"
                  label="Insurance Expiry Date"
                  type="date"
                  value={formData.insuranceExpiry}
                  onChange={handleChange}
                  error={errors.insuranceExpiry}
                  required
                />
              </div>

              <div className="space-y-4 pt-4">
                <FileUpload
                  id="insuranceDocument"
                  label="Upload Insurance Certificate (must show 'Hire & Reward') *"
                  file={documents.insuranceDocument}
                  onFileChange={handleFileChange('insuranceDocument')}
                  error={errors.insuranceDocument}
                />
                <FileUpload
                  id="v5cDocument"
                  label="Upload Vehicle Logbook (V5C) - Optional"
                  file={documents.v5cDocument}
                  onFileChange={handleFileChange('v5cDocument')}
                />
                <FileUpload
                  id="phvLicenceDocument"
                  label="Upload Vehicle's PHV Licence - Optional"
                  file={documents.phvLicenceDocument}
                  onFileChange={handleFileChange('phvLicenceDocument')}
                />
              </div>
            </div>
          </>
        )}

        {/* Step 7: Review & Submit (Licensed Only) */}
        {currentStep === 7 && formData.isLicensedDriver && (
          <>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">Review Your Application</h1>
              <p className="mt-2 text-slate-300">Please review your information before submitting.</p>
            </div>

            <div className="space-y-6">
              {/* Personal Details */}
              <div className="bg-slate-900/50 p-6 rounded-lg border border-sky-800">
                <h3 className="text-lg font-semibold text-white mb-4">Personal Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Name:</span>
                    <p className="text-white">{formData.firstName} {formData.lastName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <p className="text-white">{formData.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    <p className="text-white">{formData.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Area:</span>
                    <p className="text-white">{formData.area}</p>
                  </div>
                </div>
              </div>

              {/* Badge Details */}
              <div className="bg-slate-900/50 p-6 rounded-lg border border-sky-800">
                <h3 className="text-lg font-semibold text-white mb-4">Badge & License Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Badge Number:</span>
                    <p className="text-white">{formData.badgeNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Badge Expiry:</span>
                    <p className="text-white">{formData.badgeExpiry}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Issuing Council:</span>
                    <p className="text-white">{formData.issuingCouncil}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Driving License:</span>
                    <p className="text-white">{formData.drivingLicenseNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">License Expiry:</span>
                    <p className="text-white">{formData.licenseExpiry}</p>
                  </div>
                </div>
              </div>

              {/* Vehicle Details */}
              {formData.hasOwnVehicle && (
                <div className="bg-slate-900/50 p-6 rounded-lg border border-sky-800">
                  <h3 className="text-lg font-semibold text-white mb-4">Vehicle Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Make & Model:</span>
                      <p className="text-white">{formData.vehicleMake} {formData.vehicleModel}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Registration:</span>
                      <p className="text-white">{formData.vehicleReg}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Insurance Expiry:</span>
                      <p className="text-white">{formData.insuranceExpiry}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-cyan-900/30 p-4 rounded-lg border border-cyan-700">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 h-4 w-4 text-cyan-600 focus:ring-cyan-500 rounded"
                  />
                  <span className="text-sm text-slate-300">
                    I confirm that all details provided are correct and my documents are valid.
                  </span>
                </label>
              </div>
            </div>
          </>
        )}

        {errors.form && <p className="text-sm text-red-500 text-center">{errors.form}</p>}

        {/* Navigation Buttons */}
        <div className="flex gap-4 pt-4">
          {currentStep > 1 && (
            <Button
              type="button"
              onClick={handleBack}
              className="flex-1 bg-slate-700 hover:bg-slate-600"
            >
              Back
            </Button>
          )}
          <Button
            type={currentStep === 7 ? 'submit' : 'button'}
            onClick={currentStep === 7 ? undefined : handleNext}
            isLoading={isLoading}
            className="flex-1"
          >
            {currentStep === 7 ? 'Submit Application' : currentStep === 1 && !formData.isLicensedDriver ? 'Get Started' : 'Next'}
          </Button>
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

export default ApplyWizard;
