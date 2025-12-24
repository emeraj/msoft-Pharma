import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { CompanyProfile, SystemConfig, GstRate, PrinterProfile, SubUser, SubscriptionInfo } from '../types';
import Modal from './common/Modal';
import Card from './common/Card';
import { CheckCircleIcon, DownloadIcon, UploadIcon, UserCircleIcon, AdjustmentsIcon, PercentIcon, PrinterIcon, TrashIcon, GlobeIcon, ArchiveIcon, CloudIcon, InformationCircleIcon, PlusIcon, XIcon } from './icons/Icons';
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

const SubscriptionTab: React.FC<{ subscription?: SubscriptionInfo; onUpgrade: () => void }> = ({ subscription, onUpgrade }) => {
    const isPremium = subscription?.isPremium || false;
    const planName = subscription?.planType || 'Free';
    const expiry = subscription?.expiryDate ? new Date(subscription.expiryDate) : null;
    const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    const upiId = "9890072651@upi"; // M. Soft India
    const amount = "5000";
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("M. Soft India")}&am=${amount}&cu=INR`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className={`p-6 rounded-2xl border-2 ${isPremium ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'} shadow-sm`}>
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            {isPremium ? <CheckCircleIcon className="h-6 w-6 text-indigo-500" /> : <InformationCircleIcon className="h-6 w-6 text-slate-400" />}
                            Current Plan: {planName}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {isPremium 
                                ? `Expires on ${expiry?.toLocaleDateString()} (${daysLeft} days remaining)`
                                : 'You are currently using the limited free version.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-3">Free Plan Includes:</h5>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-center gap-2">✅ Standard Billing & Inventory</li>
                        <li className="flex items-center gap-2">✅ GST Reports</li>
                        <li className="flex items-center gap-2">❌ Limited AI Invoice Entries</li>
                    </ul>
                </div>
                <div className="p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-lg">
                    <h5 className="font-bold text-indigo-600 dark:text-indigo-400 mb-3">Premium Plan Benefits:</h5>
                    <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
                        <li className="flex items-center gap-2">🚀 Unlimited AI Invoice Processing</li>
                        <li className="flex items-center gap-2">🚀 Multi-User (Operator) Support</li>
                    </ul>
                </div>
            </div>

            {!isPremium && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 text-center">
                    <h5 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Activation Process</h5>
                    <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 mx-auto mb-4 border p-2 rounded-lg bg-white" />
                    <p className="text-xl font-bold text-indigo-600">₹5,000 / Year</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <p>Scan to pay & send screenshot to WhatsApp: <span className="font-bold">9890072651</span></p>
                    </div>
                </div>
            )}
        </div>
    );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  companyProfile,
  onProfileChange,
  systemConfig,
  onSystemConfigChange,
  onBackupData,
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
  const [newPrinterFormat, setNewPrinterFormat] = useState<'A4' | 'A5' | 'Thermal'>('Thermal');
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState<{type: 'success' | 'error' | '', msg: string}>({ type: '', msg: '' });

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedRestoreData, setParsedRestoreData] = useState<any>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        setProfile(companyProfile);
        setConfig(systemConfig);
        setPasswords({ current: '', new: '', confirm: '' });
        setPasswordStatus({ type: '', msg: '' });
        setRestoreFile(null);
        setParsedRestoreData(null);
        setSelectedModels([]);
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

  const handleSaveProfile = () => { onProfileChange(profile); onClose(); };
  const handleSaveConfig = () => { onSystemConfigChange(config); onClose(); };

  const renderContent = () => {
    switch (activeTab) {
        case 'profile':
            return (
                <div className="space-y-4 animate-fade-in">
                    <div><label className="block text-sm font-medium">Shop Name</label><input type="text" name="name" value={profile.name || ''} onChange={(e) => setProfile({...profile, name: e.target.value})} className={formInputStyle} /></div>
                    <div><label className="block text-sm font-medium">Address</label><textarea name="address" value={profile.address || ''} onChange={(e) => setProfile({...profile, address: e.target.value})} className={formInputStyle} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Phone</label><input type="tel" name="phone" value={profile.phone || ''} onChange={(e) => setProfile({...profile, phone: e.target.value})} className={formInputStyle} /></div>
                        <div><label className="block text-sm font-medium">GSTIN</label><input type="text" name="gstin" value={profile.gstin || ''} onChange={(e) => setProfile({...profile, gstin: e.target.value})} className={formInputStyle} /></div>
                    </div>
                     <div className="flex justify-end pt-4"><button type="button" onClick={handleSaveProfile} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700"><CheckCircleIcon className="h-5 w-5" /> Save Profile</button></div>
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

                    {onRestoreData && (
                        <Card title="Snapshot Restore (Last 7 Days or Older)" className="border-orange-100 bg-orange-50/20">
                            <div className="py-10 text-center text-slate-400">Restore feature UI...</div>
                        </Card>
                    )}
                </div>
            );
        case 'system':
            return (
                <div className="space-y-8 animate-fade-in pb-10">
                    {/* Mode Selector */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest">Select the primary mode of operation for the software.</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setConfig({...config, softwareMode: 'Pharma'})}
                                className={`flex items-center justify-start gap-4 p-5 rounded-2xl border-2 transition-all group ${config.softwareMode === 'Pharma' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${config.softwareMode === 'Pharma' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-500'}`}>
                                    {config.softwareMode === 'Pharma' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                </div>
                                <div className="text-left">
                                    <span className="block font-black text-xl text-slate-800 dark:text-slate-100">Pharma</span>
                                </div>
                            </button>
                            <button 
                                onClick={() => setConfig({...config, softwareMode: 'Retail'})}
                                className={`flex items-center justify-start gap-4 p-5 rounded-2xl border-2 transition-all group ${config.softwareMode === 'Retail' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${config.softwareMode === 'Retail' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-500'}`}>
                                    {config.softwareMode === 'Retail' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                </div>
                                <div className="text-left">
                                    <span className="block font-black text-xl text-slate-800 dark:text-slate-100">Retail</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Billing Settings */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 border-b-2 border-indigo-500 pb-1 w-fit">Billing Settings</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <ToggleRow label="MRP Editable (Y/N)" value={!!config.mrpEditable} onChange={(v) => setConfig({...config, mrpEditable: v})} />
                            <ToggleRow label="Maintain Customer Ledger? (Y/N)" description="Enables credit sales tracking for customers." value={!!config.maintainCustomerLedger} onChange={(v) => setConfig({...config, maintainCustomerLedger: v})} />
                            <ToggleRow label="Enable Salesman? (Y/N)" description="Add salesman name to bill." value={!!config.enableSalesman} onChange={(v) => setConfig({...config, enableSalesman: v})} />
                        </div>
                    </div>

                    {/* Scanner Settings */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 border-b-2 border-indigo-500 pb-1 w-fit">Scanner Settings</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <ToggleRow label="Barcode Scanner Open (Y/N)" value={!!config.barcodeScannerOpenByDefault} onChange={(v) => setConfig({...config, barcodeScannerOpenByDefault: v})} />
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-2">Only applicable in Retail mode.</p>
                        </div>
                    </div>

                    {/* Footer Remarks */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 border-b-2 border-indigo-500 pb-1 w-fit">Bill Footer Remarks</h4>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remark Line 1</label><input type="text" value={config.remarkLine1 || ''} onChange={(e) => setConfig({...config, remarkLine1: e.target.value})} className={formInputStyle} placeholder="Thank you for your visit!" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remark Line 2</label><input type="text" value={config.remarkLine2 || ''} onChange={(e) => setConfig({...config, remarkLine2: e.target.value})} className={formInputStyle} placeholder="Contact:9890072651" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bank Detail (Line 3)</label><input type="text" value={config.bankDetails || ''} onChange={(e) => setConfig({...config, bankDetails: e.target.value})} className={formInputStyle} placeholder="SBI, A/C 10319428920, IFSC: SBIN0001922" /></div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-8 border-t dark:border-slate-700">
                        <button 
                            onClick={handleSaveConfig} 
                            className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 transform active:scale-95 transition-all"
                        >
                            <CheckCircleIcon className="h-6 w-6" /> Save Configuration
                        </button>
                    </div>
                </div>
            );
        case 'gstMaster': return <GstMaster gstRates={gstRates} onAdd={onAddGstRate} onUpdate={onUpdateGstRate} onDelete={onDeleteGstRate} />;
        case 'printers': return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border dark:border-slate-600">
                    <div className="flex-grow w-full"><label className="block text-sm font-medium mb-1">Printer Name</label><input type="text" value={newPrinterName} onChange={e => setNewPrinterName(e.target.value)} className={formInputStyle} /></div>
                    <button onClick={() => { if(!newPrinterName) return; onSystemConfigChange({...config, printers: [...(config.printers || []), { id: `p_${Date.now()}`, name: newPrinterName, format: 'Thermal', isDefault: false }]}); setNewPrinterName(''); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Add Printer</button>
                </div>
                <div className="space-y-2">
                    {config.printers?.map(p => (
                        <div key={p.id} className="flex justify-between p-3 bg-white dark:bg-slate-800 border rounded-lg">
                            <span>{p.name}</span>
                            <button onClick={() => onSystemConfigChange({...config, printers: config.printers?.filter(pr => pr.id !== p.id)})} className="text-red-500"><TrashIcon className="h-4 w-4"/></button>
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
            <TabButton label="Subscription" isActive={activeTab === 'subscription'} onClick={() => setActiveTab('subscription')} icon={<CloudIcon className="h-5 w-5" />} />
            <TabButton label="Backup & Restore" isActive={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<ArchiveIcon className="h-5 w-5" />} />
            <TabButton label="Operators" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Printers" isActive={activeTab === 'printers'} onClick={() => setActiveTab('printers')} icon={<PrinterIcon className="h-5 w-5" />} />
            <TabButton label="System" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AdjustmentsIcon className="h-5 w-5" />} />
            <TabButton label="GST" isActive={activeTab === 'gstMaster'} onClick={() => setActiveTab('gstMaster')} icon={<PercentIcon className="h-5 w-5" />} />
        </div>
        
        <div className="flex-grow overflow-y-auto min-h-[60vh]">
            {renderContent()}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t dark:border-slate-700 flex-shrink-0">
            <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-black hover:bg-slate-700 transition-all">
                Close
            </button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;