import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { CompanyProfile, SystemConfig, GstRate, PrinterProfile, SubUser, SubscriptionInfo } from '../types';
import Modal from './common/Modal';
import Card from './common/Card';
import { CheckCircleIcon, DownloadIcon, UploadIcon, UserCircleIcon, AdjustmentsIcon, PercentIcon, PrinterIcon, TrashIcon, GlobeIcon, ArchiveIcon, CloudIcon, InformationCircleIcon, PlusIcon, XIcon, SearchIcon, CameraIcon, BluetoothIcon, SwitchHorizontalIcon } from './icons/Icons';
import GstMaster from './GstMaster';
import UserManagement from './UserManagement';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { BluetoothHelper } from '../utils/BluetoothHelper';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyProfile: CompanyProfile;
  onProfileChange: (profile: CompanyProfile) => void;
  systemConfig: SystemConfig;
  onSystemConfigChange: (config: SystemConfig) => void;
  onBackupData: () => void;
  onReWriteStock?: () => Promise<void>;
  onRestoreData?: (category: string, items: any[]) => Promise<void>;
  gstRates: GstRate[];
  onAddGstRate: (rate: number) => void;
  onUpdateGstRate: (id: string, newRate: number) => void;
  onDeleteGstRate: (id: string, rateValue: number) => void;
}

type SettingsTab = 'profile' | 'subscription' | 'backup' | 'system' | 'gstMaster' | 'printers' | 'language' | 'users' | 'security';

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 transition-all";
const formSelectStyle = `${formInputStyle} appearance-none`;

const ToggleRow: React.FC<{ 
    label: string; 
    description?: string; 
    value: boolean; 
    onChange: (val: boolean) => void; 
}> = ({ label, description, value, onChange }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg group hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
        <div className="flex-grow pr-4">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">{label}</p>
            {description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>
        <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-full w-32 shrink-0">
            <button 
                type="button"
                onClick={() => onChange(true)}
                className={`flex-1 py-1 text-[10px] font-black rounded-full flex items-center justify-center gap-1 transition-all ${value ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <div className={`w-2 h-2 rounded-full border-2 border-current ${value ? 'bg-white' : ''}`}></div> YES
            </button>
            <button 
                type="button"
                onClick={() => onChange(false)}
                className={`flex-1 py-1 text-[10px] font-black rounded-full flex items-center justify-center gap-1 transition-all ${!value ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <div className={`w-2 h-2 rounded-full border-2 border-current ${!value ? 'bg-white' : ''}`}></div> NO
            </button>
        </div>
    </div>
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
  onReWriteStock,
  onRestoreData,
  gstRates,
  onAddGstRate,
  onUpdateGstRate,
  onDeleteGstRate,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);
  const [config, setConfig] = useState<SystemConfig>(systemConfig);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterFormat, setNewPrinterFormat] = useState<'A4' | 'A5' | 'Thermal' | 'Bluetooth'>('Thermal');
  const [newPrinterOrientation, setNewPrinterOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isBtConnected, setIsBtConnected] = useState(BluetoothHelper.isConnected);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState<{type: 'success' | 'error' | '', msg: string}>({ type: '', msg: '' });
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setProfile(companyProfile);
        setConfig(systemConfig);
        setPasswords({ current: '', new: '', confirm: '' });
        setPasswordStatus({ type: '', msg: '' });
        setIsBtConnected(BluetoothHelper.isConnected);
        fetchSubUsers();
    }
  }, [companyProfile, systemConfig, isOpen]);

  const fetchSubUsers = async () => {
      if (!auth.currentUser) return;
      try {
          const snapshot = await getDocs(collection(db, `users/${auth.currentUser.uid}/subUsers`));
          const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubUser));
          setSubUsers(users);
      } catch (e) { console.error(e); }
  };

  const handleSaveProfile = () => { 
    const sanitizedProfile: CompanyProfile = {
        name: profile.name || '',
        address: profile.address || '',
        gstin: profile.gstin || '',
        phone: profile.phone || '',
        email: profile.email || '',
        upiId: profile.upiId || '',
        logo: profile.logo || ''
    };
    onProfileChange(sanitizedProfile); 
    onClose(); 
  };

  const handleSaveConfig = () => { onSystemConfigChange(config); onClose(); };

  const handleBtConnect = async () => {
      const success = await BluetoothHelper.connect();
      setIsBtConnected(success);
      if (success) {
          alert("Connected to BT-Printer!");
      }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        alert("Image too large. Please select a file smaller than 800KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRewriteAction = async () => {
    if (!onReWriteStock) return;
    setIsRecalculating(true);
    await onReWriteStock();
    setIsRecalculating(false);
  };

  const renderContent = () => {
    switch (activeTab) {
        case 'profile':
            return (
                <div className="space-y-6 animate-fade-in pb-4">
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/50">
                        <div className="relative">
                            <div className="w-28 h-28 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm">
                                {profile.logo ? (
                                    <img src={profile.logo} alt="Business Logo" className="w-full h-full object-contain p-1" />
                                ) : (
                                    <div className="text-slate-300 dark:text-slate-600 text-center">
                                        <CloudIcon className="h-12 w-12 mx-auto" />
                                        <span className="text-[10px] font-black uppercase mt-1 block">No Logo</span>
                                    </div>
                                )}
                            </div>
                            <label htmlFor="logo-upload" className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-indigo-700 transition-all transform active:scale-90">
                                <CameraIcon className="h-5 w-5" />
                                <input type="file" id="logo-upload" accept="image/*" onChange={handleLogoChange} className="hidden" />
                            </label>
                        </div>
                        <div className="flex-grow text-center sm:text-left">
                            <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Business Logo</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">This logo will appear on all your digital and printed invoices.</p>
                            <div className="flex gap-3 justify-center sm:justify-start">
                                <label htmlFor="logo-upload" className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-black rounded-lg cursor-pointer hover:bg-indigo-200 transition-all uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">
                                    {profile.logo ? 'Change Image' : 'Select Image'}
                                </label>
                                {profile.logo && (
                                    <button 
                                        onClick={() => setProfile({ ...profile, logo: '' })}
                                        className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black rounded-lg hover:bg-rose-100 transition-all uppercase tracking-widest border border-rose-100 dark:border-rose-900/40"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Shop Name</label>
                            <input type="text" name="name" value={profile.name || ''} onChange={(e) => setProfile({...profile, name: e.target.value})} className={formInputStyle} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Address</label>
                            <textarea name="address" value={profile.address || ''} onChange={(e) => setProfile({...profile, address: e.target.value})} className={formInputStyle} rows={3} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Phone</label>
                            <input type="tel" name="phone" value={profile.phone || ''} onChange={(e) => setProfile({...profile, phone: e.target.value})} className={formInputStyle} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">GSTIN</label>
                            <input type="text" name="gstin" value={profile.gstin || ''} onChange={(e) => setProfile({...profile, gstin: e.target.value})} className={formInputStyle} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">UPI ID (for QR Code)</label>
                            <input type="text" name="upiId" value={profile.upiId || ''} onChange={(e) => setProfile({...profile, upiId: e.target.value})} className={formInputStyle} placeholder="example@upi" />
                        </div>
                    </div>
                     <div className="flex justify-end pt-8 border-t dark:border-slate-700">
                        <button type="button" onClick={handleSaveProfile} className="flex items-center gap-3 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 transform active:scale-95 transition-all uppercase tracking-widest text-sm">
                            <CheckCircleIcon className="h-6 w-6" /> Update Profile
                        </button>
                    </div>
                </div>
            );
        case 'language':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Language Selection</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Select your preferred language from the dropdown below. The application will update automatically.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Interface Language</label>
                        <div className="relative">
                            <select 
                                value={config.language || 'en'} 
                                onChange={(e) => setConfig({...config, language: e.target.value})}
                                className={formSelectStyle}
                            >
                                <option value="en">English</option>
                                <option value="hi">Hindi (हिन्दी)</option>
                                <option value="mr">Marathi (मराठी)</option>
                                <option value="gu">Gujarati (ગુજરાતી)</option>
                                <option value="bn">Bengali (বাংলা)</option>
                                <option value="ta">Tamil (தமிழ்)</option>
                                <option value="te">Telugu (తెలుగు)</option>
                                <option value="kn">Kannada (ಕನ್ನಡ)</option>
                                <option value="ml">Malayalam (മലയാളം)</option>
                                <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                                <option value="or">Oriya (ଓଡ଼ିଆ)</option>
                                <option value="ur">Urdu (اردو)</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t dark:border-slate-700">
                        <button 
                            onClick={handleSaveConfig} 
                            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <CheckCircleIcon className="h-5 w-5" /> Save Language Setting
                        </button>
                    </div>
                </div>
            );
        case 'backup':
            return (
                <div className="space-y-8 animate-fade-in">
                    <Card title="Data Backup" className="bg-slate-50 dark:bg-slate-800/50 border-indigo-100">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">Download a full snapshot of your business data to your device.</p>
                            <button onClick={onBackupData} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-black rounded-xl shadow-lg hover:bg-green-700 transition-all"><DownloadIcon className="h-5 w-5" /> Backup Now</button>
                        </div>
                    </Card>
                </div>
            );
        case 'system':
            return (
                <div className="space-y-8 animate-fade-in pb-10">
                    <div>
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest">Select Software Mode</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setConfig({...config, softwareMode: 'Pharma'})}
                                className={`flex items-center justify-start gap-4 p-5 rounded-2xl border-2 transition-all group ${config.softwareMode === 'Pharma' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${config.softwareMode === 'Pharma' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-500'}`}>
                                    {config.softwareMode === 'Pharma' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                </div>
                                <div className="text-left"><span className="block font-black text-xl text-slate-800 dark:text-slate-100">Pharma</span></div>
                            </button>
                            <button 
                                onClick={() => setConfig({...config, softwareMode: 'Retail'})}
                                className={`flex items-center justify-start gap-4 p-5 rounded-2xl border-2 transition-all group ${config.softwareMode === 'Retail' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${config.softwareMode === 'Retail' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-500'}`}>
                                    {config.softwareMode === 'Retail' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                </div>
                                <div className="text-left"><span className="block font-black text-xl text-slate-800 dark:text-slate-100">Retail</span></div>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 border-b-2 border-indigo-500 pb-1 w-fit">Inventory Tools</h4>
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex-grow">
                                    <h5 className="font-bold text-amber-800 dark:text-amber-300 uppercase text-[11px] tracking-widest">Audit & Recalculate Stock</h5>
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">If live stock values show mismatches, use this tool to re-audit all items based on transaction history.</p>
                                </div>
                                <button 
                                    onClick={handleRewriteAction}
                                    disabled={isRecalculating}
                                    className="px-6 py-2.5 bg-amber-600 text-white rounded-lg font-black text-[10px] uppercase shadow hover:bg-amber-700 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                >
                                    {isRecalculating ? <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div> : <SwitchHorizontalIcon className="h-4 w-4" />}
                                    Re-Write Stock
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 border-b-2 border-indigo-500 pb-1 w-fit">Billing Settings</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <ToggleRow label="MRP Editable (Y/N)" value={!!config.mrpEditable} onChange={(v) => setConfig({...config, mrpEditable: v})} />
                            <ToggleRow label="Maintain Customer Ledger? (Y/N)" description="Enables credit sales tracking for customers." value={!!config.maintainCustomerLedger} onChange={(v) => setConfig({...config, maintainCustomerLedger: v})} />
                            <ToggleRow label="Enable Salesman? (Y/N)" description="Add salesman name to bill." value={!!config.enableSalesman} onChange={(v) => setConfig({...config, enableSalesman: v})} />
                        </div>
                    </div>

                    <div className="flex justify-end pt-8 border-t dark:border-slate-700">
                        <button onClick={handleSaveConfig} className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 transform active:scale-95 transition-all">
                            <CheckCircleIcon className="h-6 w-6" /> Save Configuration
                        </button>
                    </div>
                </div>
            );
        case 'gstMaster': return <GstMaster gstRates={gstRates} onAdd={onAddGstRate} onUpdate={onUpdateGstRate} onDelete={onDeleteGstRate} />;
        case 'printers': return (
            <div className="space-y-6 animate-fade-in pb-4">
                {/* Bluetooth Direct Connect Status Card */}
                <div className={`p-4 rounded-xl border-2 transition-all ${isBtConnected ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-emerald-800'}`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-full ${isBtConnected ? 'bg-emerald-500' : 'bg-indigo-500'} text-white shadow-lg`}>
                                <BluetoothIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Web Bluetooth Status</p>
                                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    Direct Connect: 
                                    <span className={isBtConnected ? 'text-emerald-600' : 'text-slate-400'}>
                                        {isBtConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                    </span>
                                </h4>
                            </div>
                        </div>
                        <button 
                            onClick={handleBtConnect}
                            className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95 ${isBtConnected ? 'bg-white text-emerald-600 border border-emerald-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {isBtConnected ? 'Reconnect' : 'Scan & Connect'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Printer Name</label>
                            <input type="text" value={newPrinterName} onChange={e => setNewPrinterName(e.target.value)} className={formInputStyle} placeholder="Counter 1 / BT-Printer" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Format</label>
                            <select value={newPrinterFormat} onChange={e => setNewPrinterFormat(e.target.value as any)} className={formSelectStyle}>
                                <option value="Thermal">Thermal</option>
                                <option value="A5">A5 Page</option>
                                <option value="A4">A4 Full Page</option>
                                <option value="Bluetooth">Web Bluetooth Direct Connect</option>
                            </select>
                        </div>
                    </div>
                    {newPrinterFormat !== 'Thermal' && newPrinterFormat !== 'Bluetooth' && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Orientation</label>
                            <select value={newPrinterOrientation} onChange={e => setNewPrinterOrientation(e.target.value as any)} className={formSelectStyle}>
                                <option value="Portrait">Portrait</option>
                                <option value="Landscape">Landscape</option>
                            </select>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button onClick={() => { 
                            if(!newPrinterName) return; 
                            const isBluetooth = newPrinterFormat === 'Bluetooth';
                            const actualFormat = isBluetooth ? 'Thermal' : newPrinterFormat;
                            const connectionType = isBluetooth ? 'bluetooth' : 'system';

                            const newPrinter: PrinterProfile = { 
                                id: `p_${Date.now()}`, 
                                name: newPrinterName, 
                                format: actualFormat as 'A4' | 'A5' | 'Thermal', 
                                orientation: (actualFormat === 'Thermal') ? undefined : newPrinterOrientation, 
                                isDefault: (config.printers || []).length === 0,
                                connectionType: connectionType as any
                            };

                            onSystemConfigChange({...config, printers: [...(config.printers || []), newPrinter]}); 
                            setNewPrinterName(''); 
                        }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700">Add Printer</button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Configured Printers</label>
                    {config.printers?.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border rounded-lg shadow-sm">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-100">{p.name} {p.isDefault && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full uppercase">Default</span>}</p>
                                <p className="text-[11px] text-slate-500">
                                    {p.format} - {p.connectionType === 'bluetooth' ? 'Web Bluetooth (Direct)' : (p.orientation || 'Portrait')}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {!p.isDefault && (<button onClick={() => onSystemConfigChange({...config, printers: config.printers?.map(pr => ({...pr, isDefault: pr.id === p.id}))})} className="text-[10px] font-black text-indigo-600 hover:underline px-2">SET DEFAULT</button>)}
                                <button onClick={() => onSystemConfigChange({...config, printers: config.printers?.filter(pr => pr.id !== p.id)})} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><TrashIcon className="h-5 w-5"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'users': return <UserManagement currentUserUid={auth.currentUser?.uid || ''} subUsers={subUsers} onRefresh={fetchSubUsers} />;
        default: return <div className="py-20 text-center text-slate-400">Section under development</div>;
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="max-w-4xl">
      <div className="flex flex-col h-full">
        <div className="flex border-b dark:border-slate-700 mb-6 overflow-x-auto pb-1 flex-shrink-0 gap-1">
            <TabButton label="Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Language" isActive={activeTab === 'language'} onClick={() => setActiveTab('language')} icon={<GlobeIcon className="h-5 w-5" />} />
            <TabButton label="Backup" isActive={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<ArchiveIcon className="h-5 w-5" />} />
            <TabButton label="Operators" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Printers" isActive={activeTab === 'printers'} onClick={() => setActiveTab('printers')} icon={<PrinterIcon className="h-5 w-5" />} />
            <TabButton label="System" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AdjustmentsIcon className="h-5 w-5" />} />
            <TabButton label="GST" isActive={activeTab === 'gstMaster'} onClick={() => setActiveTab('gstMaster')} icon={<PercentIcon className="h-5 w-5" />} />
        </div>
        
        <div className="flex-grow overflow-y-auto min-h-[60vh] px-1">
            {renderContent()}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t dark:border-slate-700 flex-shrink-0">
            <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-black hover:bg-slate-700 transition-all">Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;