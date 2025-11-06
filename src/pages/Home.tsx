import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/Button';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const { branding } = useAppContext();

    console.log('HOME PAGE - Branding data:', {
        companyName: branding.companyName,
        logoUrl: branding.logoUrl,
        tagline: branding.tagline,
        primaryColor: branding.primaryColor
    });

    return (
        <div className="w-full max-w-md mx-auto text-center">
            <div className="bg-sky-900/70 p-8 rounded-2xl shadow-2xl border border-sky-800 backdrop-blur-sm">
                <img className="mx-auto h-20 w-20 rounded-md mb-6" src={branding.logoUrl} alt={`${branding.companyName} Logo`} />
                <h1 className="text-4xl font-bold text-white mb-8">{branding.companyName}</h1>
                {branding.tagline && <p className="text-lg text-slate-300 mb-8">{branding.tagline}</p>}

                <div className="space-y-4">
                    <Button onClick={() => navigate('/login')}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2m4 0h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2V7a2 2 0 012-2m4 0h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2V7a2 2 0 012-2z" />
                         </svg>
                        Returning Applicant
                    </Button>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-sky-900/0 px-2 text-slate-400 backdrop-blur-sm">OR</span>
                        </div>
                    </div>
                    <Button onClick={() => navigate('/apply')} variant="secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Sign Up as Driver
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Home;
