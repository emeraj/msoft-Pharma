import React, { useState, useEffect } from 'react';
import type { CompanyProfile, SystemConfig } from '../types';
import Modal from './common/Modal';
import { CheckCircleIcon, DownloadIcon, UploadIcon, UserCircleIcon, AdjustmentsIcon } from './icons/Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyProfile: CompanyProfile;
  onProfileChange: (profile: CompanyProfile) => void;
  systemConfig: SystemConfig;
  onSystemConfigChange: (config: SystemConfig) => void;
  onBackupData: () => void;
}

type SettingsTab = 'profile' | 'backup' | 'system';

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode; }> = ({ label, isActive, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
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
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);
  const [config, setConfig] = useState<SystemConfig>(systemConfig);

  useEffect(() => {
    if (isOpen) {
        setProfile(companyProfile);
        setConfig(systemConfig);
        setActiveTab('profile'); // Reset to default tab on open
    }
  }, [companyProfile, systemConfig, isOpen]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = () => {
    onProfileChange(profile);
    onClose();
  };
  
  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveConfig = () => {
    onSystemConfigChange(config);
    onClose();
  };

  const renderContent = () => {
    switch (activeTab) {
        case 'profile':
            return (
                <div className="space-y-4 animate-fade-in">
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
                     <div className="flex justify-end pt-4">
                        <button onClick={handleSaveProfile} className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all">
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
                        <div className="flex gap-4">
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
                         <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Invoice Printing Format</h4>
                         <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            Choose the default paper size for printing invoices.
                         </p>
                         <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer w-full dark:border-slate-600 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/50 has-[:checked]:border-indigo-500">
                                <input type="radio" name="invoicePrintingFormat" value="A4" checked={config.invoicePrintingFormat === 'A4'} onChange={handleConfigChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">A4</span>
                            </label>
                             <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer w-full dark:border-slate-600 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/50 has-[:checked]:border-indigo-500">
                                <input type="radio" name="invoicePrintingFormat" value="A5" checked={config.invoicePrintingFormat === 'A5'} onChange={handleConfigChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">A5</span>
                            </label>
                             <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer w-full dark:border-slate-600 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/50 has-[:checked]:border-indigo-500">
                                <input type="radio" name="invoicePrintingFormat" value="Thermal" checked={config.invoicePrintingFormat === 'Thermal'} onChange={handleConfigChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:checked:bg-indigo-500" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">Thermal</span>
                            </label>
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
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div>
        <div className="flex border-b dark:border-slate-700 mb-4">
            <TabButton label="Shop Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Backup & Restore" isActive={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<DownloadIcon className="h-5 w-5" />} />
            <TabButton label="System Configuration" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AdjustmentsIcon className="h-5 w-5" />} />
        </div>
        
        <div className="pt-4">
            {renderContent()}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t dark:border-slate-700">
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