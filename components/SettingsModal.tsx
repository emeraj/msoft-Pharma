
import React, { useState, useEffect } from 'react';
import type { CompanyProfile, SystemConfig, GstRate, PrinterProfile } from '../types';
import Modal from './common/Modal';
import { CheckCircleIcon, DownloadIcon, UploadIcon, UserCircleIcon, AdjustmentsIcon, PercentIcon, PrinterIcon, TrashIcon } from './icons/Icons';
import GstMaster from './GstMaster';

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

type SettingsTab = 'profile' | 'backup' | 'system' | 'gstMaster' | 'printers';

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
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UPI ID (for QR Code on Bill)</label>
                        <input type="text" name="upiId" value={profile.upiId || ''} onChange={handleProfileChange} className={formInputStyle} placeholder="e.g., yourname@oksbi" />
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
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Bill Footer Remarks</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            Customize the two lines of text that appear at the bottom of printed bills.
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
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div>
        <div className="flex border-b dark:border-slate-700 mb-4 overflow-x-auto">
            <TabButton label="Shop Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Printers" isActive={activeTab === 'printers'} onClick={() => setActiveTab('printers')} icon={<PrinterIcon className="h-5 w-5" />} />
            <TabButton label="Backup/Restore" isActive={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<DownloadIcon className="h-5 w-5" />} />
            <TabButton label="System" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AdjustmentsIcon className="h-5 w-5" />} />
            <TabButton label="GST Master" isActive={activeTab === 'gstMaster'} onClick={() => setActiveTab('gstMaster')} icon={<PercentIcon className="h-5 w-5" />} />
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
