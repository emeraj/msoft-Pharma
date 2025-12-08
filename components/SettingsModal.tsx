
import React, { useState, useEffect } from 'react';
import type { CompanyProfile, SystemConfig, GstRate, PrinterProfile, SubUser } from '../types';
import Modal from './common/Modal';
import { CheckCircleIcon, DownloadIcon, UploadIcon, UserCircleIcon, AdjustmentsIcon, PercentIcon, PrinterIcon, TrashIcon, GlobeIcon, ArchiveIcon } from './icons/Icons';
import GstMaster from './GstMaster';
import UserManagement from './UserManagement';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyProfile: CompanyProfile;
  onProfileChange: (profile: CompanyProfile) => void;
  systemConfig: SystemConfig;
  onSystemConfigChange: (config: SystemConfig) => void;
  onBackupData: () => void;
  gstRates: GstRate[];
  onAddGstRate: (rate: number) => void;
  onUpdateGstRate: (id: string, newRate: number) => void;
  onDeleteGstRate: (id: string, rateValue: number) => void;
}

type SettingsTab = 'profile' | 'backup' | 'system' | 'gstMaster' | 'printers' | 'language' | 'users' | 'security';

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi (हिंदी)' },
    { code: 'mr', label: 'Marathi (मराठी)' },
    { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
    { code: 'bn', label: 'Bengali (বাংলা)' },
    { code: 'ta', label: 'Tamil (தமிழ்)' },
    { code: 'te', label: 'Telugu (తెలుగు)' },
    { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
    { code: 'ml', label: 'Malayalam (മലയാളം)' },
    { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
    { code: 'or', label: 'Odia (ଓଡ଼ିଆ)' },
    { code: 'ur', label: 'Urdu (اردو)' },
];

// Security/Lock Icon
const LockClosedIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode; }> = ({ label, isActive, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
            isActive
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-700'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
        }`}
    >
        {icon}
        {label}
    </button>
);


const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  companyProfile,
  onProfileChange,
  systemConfig,
  onSystemConfigChange,
  onBackupData,
  gstRates,
  onAddGstRate,
  onUpdateGstRate,
  onDeleteGstRate,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);
  const [config, setConfig] = useState<SystemConfig>(systemConfig);
  
  // Local state for printer form
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterFormat, setNewPrinterFormat] = useState<'A4' | 'A5' | 'Thermal'>('Thermal');

  // User Management State
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);

  // Password Change State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState<{type: 'success' | 'error' | '', msg: ''}>({ type: '', msg: '' });

  useEffect(() => {
    if (isOpen) {
        setProfile(companyProfile);
        // Initialize config with defaults if undefined
        setConfig({
            ...systemConfig,
            mrpEditable: systemConfig.mrpEditable !== false,
            barcodeScannerOpenByDefault: systemConfig.barcodeScannerOpenByDefault !== false,
            maintainCustomerLedger: systemConfig.maintainCustomerLedger === true,
            enableSalesman: systemConfig.enableSalesman === true,
        });
        if (activeTab !== 'language' && activeTab !== 'printers' && activeTab !== 'users' && activeTab !== 'security') {
             setActiveTab('profile');
        }
        setPasswords({ current: '', new: '', confirm: '' });
        setPasswordStatus({ type: '', msg: '' });
        fetchSubUsers();
    }
  }, [companyProfile, systemConfig, isOpen]);

  const fetchSubUsers = async () => {
      if (!auth.currentUser) return;
      try {
          const snapshot = await getDocs(collection(db, `users/${auth.currentUser.uid}/subUsers`));
          const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubUser));
          setSubUsers(users);
      } catch (e) {
          console.error("Failed to fetch sub users", e);
      }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit
        alert("File size exceeds 500KB. Please choose a smaller image.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
      // Set to empty string instead of undefined to avoid Firestore errors
      setProfile(prev => ({ ...prev, logo: '' }));
  };

  const handleSaveProfile = () => {
    onProfileChange(profile);
    onClose();
  };
  
  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setConfig(prev => {
        let finalValue: any = value;
        
        if (name === 'mrpEditable' || name === 'barcodeScannerOpenByDefault' || name === 'maintainCustomerLedger' || name === 'enableSalesman') {
             finalValue = value === 'true';
        }

        const newConfig = { ...prev, [name]: finalValue };
        
        if (name === 'softwareMode') {
            if (value === 'Retail') {
                // Automatically remove 'Get Well Soon.' if it matches default Pharma remark
                if (newConfig.remarkLine2 === 'Get Well Soon.') {
                    newConfig.remarkLine2 = '';
                }
                // Also handle if it was in remarkLine1 by mistake
                if (newConfig.remarkLine1 === 'Get Well Soon.') {
                    newConfig.remarkLine1 = 'Thank you for your visit!';
                }
            } else if (value === 'Pharma') {
                // Restore default if empty
                if (!newConfig.remarkLine2) {
                    newConfig.remarkLine2 = 'Get Well Soon.';
                }
            }
        }
        return newConfig;
    });
  };

  const handleSaveConfig = () => {
    onSystemConfigChange(config);
    onClose();
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value;
      const newConfig = { ...config, language: newLang };
      setConfig(newConfig);
      onSystemConfigChange(newConfig); // Auto-save on change
  };

  const handleAddPrinter = () => {
      if (!newPrinterName) return;
      const newPrinter: PrinterProfile = {
          id: `printer_${Date.now()}`,
          name: newPrinterName,
          format: newPrinterFormat,
          isDefault: (config.printers || []).length === 0
      };
      const updatedPrinters = [...(config.printers || []), newPrinter];
      const newConfig = { ...config, printers: updatedPrinters };
      setConfig(newConfig);
      onSystemConfigChange(newConfig); // Save immediately
      setNewPrinterName('');
      setNewPrinterFormat('Thermal');
  };

  const handleDeletePrinter = (id: string) => {
      if (!window.confirm('Are you sure you want to remove this printer?')) return;
      const updatedPrinters = (config.printers || []).filter(p => p.id !== id);
      // If deleted default, make first one default if exists
      if ((config.printers?.find(p => p.id === id)?.isDefault) && updatedPrinters.length > 0) {
          updatedPrinters[0].isDefault = true;
      }
      const newConfig = { ...config, printers: updatedPrinters };
      setConfig(newConfig);
      onSystemConfigChange(newConfig);
  };

  const handleSetDefaultPrinter = (id: string) => {
      const updatedPrinters = (config.printers || []).map(p => ({
          ...p,
          isDefault: p.id === id
      }));
      const newConfig = { ...config, printers: updatedPrinters };
      setConfig(newConfig);
      onSystemConfigChange(newConfig);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordStatus({ type: '', msg: '' });

      if (passwords.new !== passwords.confirm) {
          setPasswordStatus({ type: 'error', msg: 'New passwords do not match.' });
          return;
      }

      if (passwords.new.length < 6) {
          setPasswordStatus({ type: 'error', msg: 'Password must be at least 6 characters.' });
          return;
      }

      const user = auth.currentUser;
      if (!user || !user.email) {
          setPasswordStatus({ type: 'error', msg: 'User not found.' });
          return;
      }

      try {
          // Re-authenticate
          const credential = EmailAuthProvider.credential(user.email, passwords.current);
          await reauthenticateWithCredential(user, credential);
          
          // Update Password
          await updatePassword(user, passwords.new);
          
          setPasswordStatus({ type: 'success', msg: 'Password updated successfully!' });
          setPasswords({ current: '', new: '', confirm: '' });
      } catch (error: any) {
          console.error("Password change error", error);
          let msg = "Failed to update password.";
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
              msg = "Incorrect current password.";
          } else if (error.code === 'auth/weak-password') {
              msg = "Password is too weak.";
          } else if (error.code === 'auth/requires-recent-login') {
              msg = "Please log out and log in again to perform this action.";
          }
          setPasswordStatus({ type: 'error', msg });
      }
  };

  const renderContent = () => {
    switch (activeTab) {
        case 'profile':
            return (
                <div className="space-y-4 animate-fade-in">
                    {/* Shop Logo Upload Section */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                        <div className="flex-shrink-0">
                            {profile.logo ? (
                                <div className="relative group w-24 h-24 bg-white rounded-lg overflow-hidden border dark:border-slate-600 shadow-sm flex items-center justify-center">
                                    <img src={profile.logo} alt="Logo" className="w-full h-full object-contain" />
                                    <button
                                        onClick={removeLogo}
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove Logo"
                                        type="button"
                                    >
                                        <TrashIcon className="h-6 w-6" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400">
                                    <UploadIcon className="h-8 w-8 mb-1" />
                                    <span className="text-xs font-medium">No Logo</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-grow w-full text-center sm:text-left">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Shop Logo</label>
                            <div className="flex items-center justify-center sm:justify-start gap-3">
                                <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors">
                                    Upload New
                                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                                </label>
                                {profile.logo && (
                                    <button onClick={removeLogo} type="button" className="px-4 py-2 bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-600 text-sm font-medium rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        Remove
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                Recommended size: 500KB max. PNG or JPG format.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Shop Name</label>
                        <input type="text" name="name" value={profile.name || ''} onChange={handleProfileChange} className={formInputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                        <textarea name="address" value={profile.address || ''} onChange={handleProfileChange} className={formInputStyle} rows={3} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                            <input type="tel" name="phone" value={profile.phone || ''} onChange={handleProfileChange} className={formInputStyle} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                            <input type="email" name="email" value={profile.email || ''} onChange={handleProfileChange} className={formInputStyle} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN</label>
                        <input type="text" name="gstin" value={profile.gstin || ''} onChange={handleProfileChange} className={formInputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UPI ID (for QR Code on Bill)</label>
                        <input type="text" name="upiId" value={profile.upiId || ''} onChange={handleProfileChange} className={formInputStyle} placeholder="e.g., yourname@oksbi" />
                    </div>
                     <div className="flex justify-end pt-4">
                        <button 
                            type="button"
                            onClick={handleSaveProfile} 
                            className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all"
                        >
                            <CheckCircleIcon className="h-5 w-5" />
                            Update Profile
                        </button>
                    </div>
                </div>
            );
        case 'backup':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Backup Data</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            Download a complete backup of all your application data (products, sales, purchases, etc.) as a single JSON file.
                        </p>
                        <button
                            onClick={onBackupData}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-colors">
                            <DownloadIcon className="h-5 w-5" />
                            Backup All Data
                        </button>
                    </div>
                    <div className="border-t dark:border-slate-700 pt-4">
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Restore Data</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            <strong className="text-red-500">Warning:</strong> Restoring from a backup will overwrite all current data. This action cannot be undone.
                        </p>
                        <button
                            onClick={() => alert('Restore functionality is not yet implemented.')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-500 text-white font-semibold rounded-lg shadow hover:bg-slate-600 transition-colors disabled:opacity-50"
                            disabled
                            >
                            <UploadIcon className="h-5 w-5" />
                            Restore from Backup (Coming Soon)
                        </button>
                    </div>
                </div>
            );
        case 'system':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Software Mode</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            Select the primary mode of operation for the software.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer w-full dark:border-slate-600 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/50 has-[:checked]:border-indigo-500">
                                <input
                                    type="radio"
                                    name="softwareMode"
                                    value="Pharma"
                                    checked={config.softwareMode === 'Pharma'}
                                    onChange={handleConfigChange}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                />
                                <span className="font-medium text-slate-700 dark:text-slate-300">Pharma</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer w-full dark:border-slate-600 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/50 has-[:checked]:border-indigo-500">
                                <input
                                    type="radio"
                                    name="softwareMode"
                                    value="Retail"
                                    checked={config.softwareMode === 'Retail'}
                                    onChange={handleConfigChange}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                />
                                <span className="font-medium text-slate-700 dark:text-slate-300">Retail</span>
                            </label>
                        </div>
                    </div>

                    <div className="border-t dark:border-slate-700 pt-4">
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Billing Settings</h4>
                        
                        {/* MRP Editable */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600 mb-3">
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">MRP Editable (Y/N)</label>
                             <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="mrpEditable" 
                                        value="true" 
                                        checked={config.mrpEditable !== false} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="mrpEditable" 
                                        value="false" 
                                        checked={config.mrpEditable === false} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">No</span>
                                </label>
                             </div>
                        </div>

                        {/* Maintain Customer Ledger */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600 mb-3">
                             <div className="flex flex-col">
                                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Maintain Customer Ledger? (Y/N)</label>
                                 <span className="text-xs text-slate-500 dark:text-slate-400">Enables credit sales tracking for customers.</span>
                             </div>
                             <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="maintainCustomerLedger" 
                                        value="true" 
                                        checked={config.maintainCustomerLedger === true} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="maintainCustomerLedger" 
                                        value="false" 
                                        checked={config.maintainCustomerLedger !== true} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">No</span>
                                </label>
                             </div>
                        </div>

                        {/* Enable Salesman */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600">
                             <div className="flex flex-col">
                                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Salesman? (Y/N)</label>
                                 <span className="text-xs text-slate-500 dark:text-slate-400">Add salesman name to bill.</span>
                             </div>
                             <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="enableSalesman" 
                                        value="true" 
                                        checked={config.enableSalesman === true} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="enableSalesman" 
                                        value="false" 
                                        checked={config.enableSalesman !== true} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">No</span>
                                </label>
                             </div>
                        </div>
                    </div>

                    <div className="border-t dark:border-slate-700 pt-4">
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Scanner Settings</h4>
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600">
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Barcode Scanner Open (Y/N)</label>
                             <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="barcodeScannerOpenByDefault" 
                                        value="true" 
                                        checked={config.barcodeScannerOpenByDefault !== false} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="barcodeScannerOpenByDefault" 
                                        value="false" 
                                        checked={config.barcodeScannerOpenByDefault === false} 
                                        onChange={handleConfigChange}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
                                    /> 
                                    <span className="text-sm text-slate-700 dark:text-slate-300">No</span>
                                </label>
                             </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 ml-1">
                            Only applicable in Retail mode.
                        </p>
                    </div>
                    
                    <div className="border-t dark:border-slate-700 pt-4">
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Bill Footer Remarks</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            Customize the text that appears at the bottom of printed bills.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Remark Line 1</label>
                                <input
                                    type="text"
                                    name="remarkLine1"
                                    value={config.remarkLine1 || ''}
                                    onChange={handleConfigChange}
                                    className={formInputStyle}
                                    placeholder="e.g., Thank you for your visit!"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Remark Line 2</label>
                                <input
                                    type="text"
                                    name="remarkLine2"
                                    value={config.remarkLine2 || ''}
                                    onChange={handleConfigChange}
                                    className={formInputStyle}
                                    placeholder="e.g., Get Well Soon."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bank Detail (Line 3)</label>
                                <input
                                    type="text"
                                    name="bankDetails"
                                    value={config.bankDetails || ''}
                                    onChange={handleConfigChange}
                                    className={formInputStyle}
                                    placeholder="e.g., Bank Name, Acc No, IFSC"
                                />
                            </div>
                        </div>
                    </div>

                     <div className="flex justify-end pt-4">
                        <button onClick={handleSaveConfig} className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all">
                            <CheckCircleIcon className="h-5 w-5" />
                            Save Configuration
                        </button>
                    </div>
                </div>
            );
        case 'language':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Language Selection</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Select your preferred language from the dropdown below. The application will update automatically.
                        </p>
                        
                        <div className="max-w-md">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Interface Language</label>
                            <div className="relative">
                                <select
                                    name="language"
                                    value={config.language || 'en'}
                                    onChange={handleLanguageChange}
                                    className={formSelectStyle}
                                >
                                    {languages.map(lang => (
                                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-300">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
      case 'gstMaster':
        return (
            <div className="animate-fade-in -m-6 p-0">
              <GstMaster
                  gstRates={gstRates}
                  onAdd={onAddGstRate}
                  onUpdate={onUpdateGstRate}
                  onDelete={onDeleteGstRate}
              />
            </div>
        );
      case 'printers':
          return (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Printer Management</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Configure the printers you use. When printing a bill, you can select which printer configuration (and format) to use.
                    </p>
                    
                    {/* Add Printer Form */}
                    <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border dark:border-slate-600">
                        <div className="flex-grow w-full sm:w-auto">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Printer Name</label>
                            <input 
                                type="text" 
                                value={newPrinterName}
                                onChange={e => setNewPrinterName(e.target.value)}
                                placeholder="e.g., Counter Thermal, Office A4"
                                className={formInputStyle}
                            />
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Format</label>
                            <select 
                                value={newPrinterFormat} 
                                onChange={e => setNewPrinterFormat(e.target.value as any)}
                                className={formSelectStyle}
                            >
                                <option value="Thermal">Thermal</option>
                                <option value="A5">A5</option>
                                <option value="A4">A4</option>
                            </select>
                        </div>
                        <button onClick={handleAddPrinter} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">
                            Add Printer
                        </button>
                    </div>

                    {/* List Printers */}
                    <div className="mt-4">
                        <h5 className="font-medium text-slate-800 dark:text-slate-200 mb-2">Configured Printers</h5>
                        {(config.printers && config.printers.length > 0) ? (
                            <div className="space-y-2">
                                {config.printers.map(printer => (
                                    <div key={printer.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-sm">
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                {printer.name}
                                                {printer.isDefault && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Default</span>}
                                            </p>
                                            <p className="text-sm text-slate-500">{printer.format} Format</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {!printer.isDefault && (
                                                <button onClick={() => handleSetDefaultPrinter(printer.id)} className="text-sm text-indigo-600 hover:underline">
                                                    Set as Default
                                                </button>
                                            )}
                                            <button onClick={() => handleDeletePrinter(printer.id)} className="text-red-500 hover:text-red-700 p-1">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-4 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed dark:border-slate-700">
                                No printers configured. Please add one above.
                            </p>
                        )}
                    </div>
                </div>
            </div>
          );
      case 'users':
          return (
              <UserManagement 
                currentUserUid={auth.currentUser?.uid || ''} 
                subUsers={subUsers} 
                onRefresh={fetchSubUsers}
              />
          );
      case 'security':
          return (
              <div className="space-y-6 animate-fade-in">
                  <div>
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Change Password</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                          For security, you must enter your current password before creating a new one.
                      </p>
                      
                      <form onSubmit={handleChangePassword} className="space-y-4 max-w-md p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
                              <input 
                                  type="password" 
                                  required
                                  value={passwords.current}
                                  onChange={e => setPasswords({...passwords, current: e.target.value})}
                                  className={formInputStyle} 
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                              <input 
                                  type="password" 
                                  required
                                  minLength={6}
                                  value={passwords.new}
                                  onChange={e => setPasswords({...passwords, new: e.target.value})}
                                  className={formInputStyle} 
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
                              <input 
                                  type="password" 
                                  required
                                  minLength={6}
                                  value={passwords.confirm}
                                  onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                  className={formInputStyle} 
                              />
                          </div>
                          
                          {passwordStatus.msg && (
                              <div className={`text-sm p-2 rounded ${passwordStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {passwordStatus.msg}
                              </div>
                          )}

                          <div className="flex justify-end pt-2">
                              <button 
                                  type="submit" 
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                              >
                                  Update Password
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          );
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="max-w-3xl">
      <div className="flex flex-col h-full">
        <div className="flex border-b dark:border-slate-700 mb-4 overflow-x-auto pb-1 flex-shrink-0">
            <TabButton label="Shop Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Language" isActive={activeTab === 'language'} onClick={() => setActiveTab('language')} icon={<GlobeIcon className="h-5 w-5" />} />
            <TabButton label="User Mgmt" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Security" isActive={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<LockClosedIcon className="h-5 w-5" />} />
            <TabButton label="Printers" isActive={activeTab === 'printers'} onClick={() => setActiveTab('printers')} icon={<PrinterIcon className="h-5 w-5" />} />
            <TabButton label="Backup" isActive={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<DownloadIcon className="h-5 w-5" />} />
            <TabButton label="System" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AdjustmentsIcon className="h-5 w-5" />} />
            <TabButton label="GST Master" isActive={activeTab === 'gstMaster'} onClick={() => setActiveTab('gstMaster')} icon={<PercentIcon className="h-5 w-5" />} />
        </div>
        
        <div className="flex-grow overflow-y-auto min-h-[50vh]">
            {renderContent()}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t dark:border-slate-700 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
                Close
            </button>
        </div>
      </div>
       <style>{`
        @keyframes fade-in {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
    `}</style>
    </Modal>
  );
};

export default SettingsModal;
