import React, { useEffect } from 'react';
import Button from './Button';

interface SubmissionModalProps {
  isOpen: boolean;
  isSuccess: boolean;
  errors?: { field: string; message: string }[];
  onClose: () => void;
  onViewApplication?: () => void;
}

const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  isSuccess,
  errors = [],
  onClose,
  onViewApplication,
}) => {
  useEffect(() => {
    if (isOpen && isSuccess && onViewApplication) {
      // Auto-redirect after 3 seconds on success
      const timer = setTimeout(() => {
        onViewApplication();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isSuccess, onViewApplication]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-sky-800 overflow-hidden animate-[slideUp_0.3s_ease-out]">
        {isSuccess ? (
          // Success State
          <div className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 mb-6 animate-[scaleIn_0.4s_ease-out]">
              <svg
                className="h-12 w-12 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Application Submitted!</h2>
            <p className="text-slate-300 mb-6">
              Your application has been successfully submitted. You'll be redirected to your application dashboard shortly.
            </p>
            <div className="space-y-3">
              <Button onClick={onViewApplication}>View Application Now</Button>
              <p className="text-sm text-slate-400">Auto-redirecting in 3 seconds...</p>
            </div>
          </div>
        ) : (
          // Error State
          <div className="p-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500 mb-6">
              <svg
                className="h-12 w-12 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 text-center">Submission Failed</h2>
            <p className="text-slate-300 mb-6 text-center">
              We couldn't submit your application. Please correct the following issues:
            </p>

            {/* Error List */}
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
              <ul className="space-y-3">
                {errors.map((error, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg
                      className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="font-semibold text-red-300">{error.field}</p>
                      <p className="text-sm text-red-200 mt-1">{error.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <Button onClick={onClose}>Fix Errors</Button>
              <p className="text-sm text-slate-400 text-center">
                Scroll down to review and correct the highlighted fields
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default SubmissionModal;
