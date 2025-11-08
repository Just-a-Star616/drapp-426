import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/Button';

const BrandingSettings: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useAppContext();
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('');
  const [textColor, setTextColor] = useState('');
  const [tagline, setTagline] = useState('');

  // Load current branding on mount
  useEffect(() => {
    if (branding) {
      setCompanyName(branding.companyName || '');
      setLogoUrl(branding.logoUrl || '');
      setPrimaryColor(branding.primaryColor || '#0ea5e9');
      setSecondaryColor(branding.secondaryColor || '#0c4a6e');
      setAccentColor(branding.accentColor || '#06b6d4');
      setBackgroundColor(branding.backgroundColor || '#0f172a');
      setTextColor(branding.textColor || '#ffffff');
      setTagline(branding.tagline || '');
    }
  }, [branding]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin/login');
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName || !logoUrl || !primaryColor) {
      setMessage('Company name, logo URL, and primary color are required');
      setMessageType('error');
      return;
    }

    setIsUpdating(true);
    setMessage('');

    try {
      const configRef = doc(db, 'configs', 'defaultConfig');
      const configDoc = await getDoc(configRef);

      if (!configDoc.exists()) {
        throw new Error('Configuration document not found');
      }

      const currentConfig = configDoc.data();

      // Update only the branding fields
      const newBranding = {
        companyName,
        logoUrl,
        primaryColor,
        secondaryColor: secondaryColor || '#0c4a6e',
        accentColor: accentColor || '#06b6d4',
        backgroundColor: backgroundColor || '#0f172a',
        textColor: textColor || '#ffffff',
        tagline: tagline || '',
      };

      console.log('Saving branding colors:', newBranding);

      await updateDoc(configRef, {
        branding: newBranding,
        // Preserve other fields like statusSteps
        statusSteps: currentConfig.statusSteps || [],
      });

      setMessage('Branding updated successfully! Changes will be visible after page reload.');
      setMessageType('success');

      // Reload the page after a short delay to show the new branding
      // Use hard reload to clear all caches
      setTimeout(() => {
        window.location.href = window.location.href.split('#')[0] + '#/admin/branding?t=' + Date.now();
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error updating branding:', error);
      setMessage('Failed to update branding. Please try again.');
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetToDefault = () => {
    setCompanyName(branding?.companyName || '');
    setLogoUrl(branding?.logoUrl || '');
    setPrimaryColor(branding?.primaryColor || '#0ea5e9');
    setSecondaryColor(branding?.secondaryColor || '#0c4a6e');
    setAccentColor(branding?.accentColor || '#06b6d4');
    setBackgroundColor(branding?.backgroundColor || '#0f172a');
    setTextColor(branding?.textColor || '#ffffff');
    setTagline(branding?.tagline || '');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur-sm border-b border-sky-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {branding?.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-10 w-auto" />
              )}
              <h1 className="text-xl font-bold text-white">Branding Settings</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Back to Dashboard
              </button>
              <Button onClick={handleLogout} variant="secondary">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-sky-800 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Company Branding</h2>
            <p className="text-slate-400">
              Customize your company's branding across the application. Changes will be visible to all users.
            </p>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                messageType === 'success'
                  ? 'bg-green-900/20 border border-green-700 text-green-300'
                  : 'bg-red-900/20 border border-red-700 text-red-300'
              }`}
            >
              {message}
            </div>
          )}

          {/* Preview Section */}
          <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-sky-700">
            <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>
            <div className="flex items-center gap-4 mb-6">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo Preview"
                  className="h-16 w-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
                  }}
                />
              )}
              <div>
                <h4 className="text-xl font-bold text-white">{companyName || 'Company Name'}</h4>
                {tagline && <p className="text-sm text-slate-400">{tagline}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-24">Primary:</span>
                <div className="w-12 h-8 rounded border border-slate-600" style={{ backgroundColor: primaryColor }}></div>
                <span className="text-xs text-slate-300 font-mono">{primaryColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-24">Secondary:</span>
                <div className="w-12 h-8 rounded border border-slate-600" style={{ backgroundColor: secondaryColor }}></div>
                <span className="text-xs text-slate-300 font-mono">{secondaryColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-24">Accent:</span>
                <div className="w-12 h-8 rounded border border-slate-600" style={{ backgroundColor: accentColor }}></div>
                <span className="text-xs text-slate-300 font-mono">{accentColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-24">Background:</span>
                <div className="w-12 h-8 rounded border border-slate-600" style={{ backgroundColor: backgroundColor }}></div>
                <span className="text-xs text-slate-300 font-mono">{backgroundColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-24">Text:</span>
                <div className="w-12 h-8 rounded border border-slate-600" style={{ backgroundColor: textColor }}></div>
                <span className="text-xs text-slate-300 font-mono">{textColor}</span>
              </div>
            </div>
          </div>

          {/* Branding Form */}
          <form onSubmit={handleSaveBranding} className="space-y-6">
            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-slate-300 mb-2">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                placeholder="Enter company name"
                required
              />
            </div>

            {/* Logo URL */}
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-slate-300 mb-2">
                Logo URL <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                placeholder="https://example.com/logo.png"
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter a direct link to your company logo image (PNG, JPG, or SVG)
              </p>
            </div>

            {/* Primary Color */}
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium text-slate-300 mb-2">
                Primary Color <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-16 rounded cursor-pointer bg-slate-800 border border-slate-600"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-mono"
                  placeholder="#0ea5e9"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  required
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Main brand color used for buttons and key elements
              </p>
            </div>

            {/* Secondary Color */}
            <div>
              <label htmlFor="secondaryColor" className="block text-sm font-medium text-slate-300 mb-2">
                Secondary Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  id="secondaryColor"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-12 w-16 rounded cursor-pointer bg-slate-800 border border-slate-600"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-mono"
                  placeholder="#0c4a6e"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Supporting color for secondary elements (default: #0c4a6e)
              </p>
            </div>

            {/* Accent Color */}
            <div>
              <label htmlFor="accentColor" className="block text-sm font-medium text-slate-300 mb-2">
                Accent Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  id="accentColor"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-12 w-16 rounded cursor-pointer bg-slate-800 border border-slate-600"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-mono"
                  placeholder="#06b6d4"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Highlight color for links and special elements (default: #06b6d4)
              </p>
            </div>

            {/* Background Color */}
            <div>
              <label htmlFor="backgroundColor" className="block text-sm font-medium text-slate-300 mb-2">
                Background Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  id="backgroundColor"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-12 w-16 rounded cursor-pointer bg-slate-800 border border-slate-600"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-mono"
                  placeholder="#0f172a"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Main background color for the application (default: #0f172a)
              </p>
            </div>

            {/* Text Color */}
            <div>
              <label htmlFor="textColor" className="block text-sm font-medium text-slate-300 mb-2">
                Text Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  id="textColor"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-12 w-16 rounded cursor-pointer bg-slate-800 border border-slate-600"
                />
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-mono"
                  placeholder="#ffffff"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Primary text color for content (default: #ffffff)
              </p>
            </div>

            {/* Tagline */}
            <div>
              <label htmlFor="tagline" className="block text-sm font-medium text-slate-300 mb-2">
                Tagline (Optional)
              </label>
              <input
                type="text"
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                placeholder="Your company tagline"
              />
              <p className="mt-2 text-xs text-slate-500">
                Optional tagline displayed below company name
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 px-6 py-3 bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Saving...' : 'Save Branding'}
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isUpdating}
                className="px-6 py-3 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Help Section */}
          <div className="mt-8 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-300 mb-2">Tips:</h4>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>• Logo should be a transparent PNG for best results</li>
              <li>• Recommended logo dimensions: 200x60 pixels or similar aspect ratio</li>
              <li>• Primary color will be used for buttons, links, and accent elements</li>
              <li>• Changes will be visible across all pages after saving</li>
              <li>• All users will see the updated branding immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingSettings;
