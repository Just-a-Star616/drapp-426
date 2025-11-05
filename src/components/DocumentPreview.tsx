import React, { useState } from 'react';

interface DocumentPreviewProps {
  label: string;
  url?: string;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ label, url }) => {
  const [showModal, setShowModal] = useState(false);
  const hasDocument = url && url.trim() !== '';
  const fileName = hasDocument
    ? decodeURIComponent(url.split('/').pop()?.split('?')[0] || '').split('-').slice(1).join('-')
    : 'Not provided';

  // Determine file type from URL
  const isImage = hasDocument && /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isPDF = hasDocument && /\.pdf$/i.test(url);

  return (
    <>
      <div className="py-3 border-b border-sky-800">
        <p className="text-sm font-medium text-slate-400 mb-2">{label}</p>
        <div className="flex items-center justify-between text-sm">
          <p className="text-white truncate max-w-xs">{fileName}</p>
          <div className="flex gap-2">
            {hasDocument ? (
              <>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-900/50 text-cyan-300 border border-cyan-700/50 hover:bg-cyan-800/50 transition-colors"
                >
                  Preview
                </button>
                <a
                  href={url}
                  download
                  className="px-3 py-1 rounded-full text-xs font-medium bg-sky-900/50 text-sky-300 border border-sky-700/50 hover:bg-sky-800/50 transition-colors"
                >
                  Download
                </a>
              </>
            ) : (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-400 border border-slate-600">
                Not uploaded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showModal && hasDocument && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-slate-900 rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden border border-sky-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-sky-800">
              <h3 className="text-lg font-semibold text-white">{label}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-auto max-h-[calc(90vh-120px)]">
              {isImage ? (
                <img
                  src={url}
                  alt={label}
                  className="w-full h-auto rounded-lg"
                />
              ) : isPDF ? (
                <iframe
                  src={url}
                  className="w-full h-[70vh] rounded-lg"
                  title={label}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400 mb-4">Preview not available for this file type</p>
                  <a
                    href={url}
                    download
                    className="inline-block px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-sky-800">
              <a
                href={url}
                download
                className="px-4 py-2 rounded-lg bg-sky-700 text-white hover:bg-sky-600 transition-colors text-sm font-medium"
              >
                Download
              </a>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentPreview;
