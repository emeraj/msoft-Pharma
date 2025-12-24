
import React, { useState, useEffect, useMemo } from 'react';
import type { CompanyProfile, SystemConfig, GstRate, PrinterProfile, SubUser, SubscriptionInfo } from '../types';
import Modal from './common/Modal';
import { CheckCircleIcon, DownloadIcon, UploadIcon, UserCircleIcon, AdjustmentsIcon, PercentIcon, PrinterIcon, TrashIcon, GlobeIcon, ArchiveIcon, CloudIcon, InformationCircleIcon, PlusIcon } from './icons/Icons';
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

type SettingsTab = 'profile' | 'subscription' | 'backup' | 'system' | 'gstMaster' | 'printers' | 'language' | 'users' | 'security';

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
            {/* Current Status Card */}
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
                    {!isPremium && (
                        <button onClick={onUpgrade} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all">
                            Upgrade Now
                        </button>
                    )}
                </div>
            </div>

            {/* Plan Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-3">Free Plan Includes:</h5>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <li className="flex items-center gap-2">✅ Standard Billing & Inventory</li>
                        <li className="flex items-center gap-2">✅ GST Reports</li>
                        <li className="flex items-center gap-2">❌ Limited AI Invoice Entries (5 Total)</li>
                        <li className="flex items-center gap-2">❌ Single User Only</li>
                        <li className="flex items-center gap-2">❌ Manual Backups Only</li>
                    </ul>
                </div>
                <div className="p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 shadow-lg">
                    <h5 className="font-bold text-indigo-600 dark:text-indigo-400 mb-3">Premium Plan Benefits:</h5>
                    <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-200">
                        <li className="flex items-center gap-2">🚀 Unlimited AI Invoice Processing</li>
                        <li className="flex items-center gap-2">🚀 Multi-User (Operator) Support</li>
                        <li className="flex items-center gap-2">🚀 Priority Support & Updates</li>
                        <li className="flex items-center gap-2">🚀 Advance Sales Analytics</li>
                    </ul>
                </div>
            </div>

            {/* Activation Section */}
            {!isPremium && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 text-center">
                    <h5 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Activation Process</h5>
                    <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 mx-auto mb-4 border p-2 rounded-lg bg-white" />
                    <p className="text-xl font-bold text-indigo-600">₹5,000 / Year</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <p>1. Scan the QR code to pay via any UPI app.</p>
                        <p>2. Send the payment screenshot to WhatsApp: <span className="font-bold">9890072651</span></p>
                        <p>3. Provide your account email: <span className="font-bold">{auth.currentUser?.email}</span></p>
                        <p className="text-indigo-500 font-medium">Your subscription will be activated within 2 hours.</p>
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

  useEffect(() => {
    if (isOpen) {
        setProfile(companyProfile);
        setConfig({
            ...systemConfig,
            mrpEditable: systemConfig.mrpEditable !== false,
            barcodeScannerOpenByDefault: systemConfig.barcodeScannerOpenByDefault !== false,
            maintainCustomerLedger: systemConfig.maintainCustomerLedger === true,
            enableSalesman: systemConfig.enableSalesman === true,
            aiInvoiceQuota: systemConfig.aiInvoiceQuota ?? 5,
        });
        if (['language', 'printers', 'users', 'security', 'subscription'].indexOf(activeTab) === -1) {
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
      } catch (e) { console.error(e); }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { alert("Max 500KB"); return; }
      const reader = new FileReader();
      reader.onloadend = () => { setProfile(prev => ({ ...prev, logo: reader.result as string })); };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => { onProfileChange(profile); onClose(); };
  
  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => {
        let finalValue: any = value;
        if (['mrpEditable', 'barcodeScannerOpenByDefault', 'maintainCustomerLedger', 'enableSalesman'].includes(name)) {
             finalValue = value === 'true';
        }
        return { ...prev, [name]: finalValue };
    });
  };

  const handleSaveConfig = () => { onSystemConfigChange(config); onClose(); };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value;
      const newConfig = { ...config, language: newLang };
      setConfig(newConfig);
      onSystemConfigChange(newConfig); 
  };

  const handleAddPrinter = () => {
      if (!newPrinterName) return;
      const updatedPrinters = [...(config.printers || []), { id: `printer_${Date.now()}`, name: newPrinterName, format: newPrinterFormat, isDefault: (config.printers || []).length === 0 }];
      const newConfig = { ...config, printers: updatedPrinters };
      setConfig(newConfig); onSystemConfigChange(newConfig); setNewPrinterName('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (passwords.new !== passwords.confirm) { setPasswordStatus({ type: 'error', msg: 'Mismatch' }); return; }
      const user = auth.currentUser;
      if (!user?.email) return;
      try {
          const credential = EmailAuthProvider.credential(user.email, passwords.current);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, passwords.new);
          setPasswordStatus({ type: 'success', msg: 'Updated!' });
      } catch (error: any) { setPasswordStatus({ type: 'error', msg: 'Failed' }); }
  };

  const renderContent = () => {
    switch (activeTab) {
        case 'profile':
            return (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                        <div className="flex-shrink-0">
                            {profile.logo ? (
                                <div className="relative group w-24 h-24 bg-white rounded-lg overflow-hidden border dark:border-slate-600 shadow-sm flex items-center justify-center">
                                    <img src={profile.logo} alt="Logo" className="w-full h-full object-contain" />
                                    <button onClick={() => setProfile(prev => ({...prev, logo: ''}))} className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" type="button"><TrashIcon className="h-6 w-6" /></button>
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
                            <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors">
                                Upload New <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                            </label>
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium">Shop Name</label><input type="text" name="name" value={profile.name || ''} onChange={handleProfileChange} className={formInputStyle} /></div>
                    <div><label className="block text-sm font-medium">Address</label><textarea name="address" value={profile.address || ''} onChange={handleProfileChange} className={formInputStyle} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Phone</label><input type="tel" name="phone" value={profile.phone || ''} onChange={handleProfileChange} className={formInputStyle} /></div>
                        <div><label className="block text-sm font-medium">GSTIN</label><input type="text" name="gstin" value={profile.gstin || ''} onChange={handleProfileChange} className={formInputStyle} /></div>
                    </div>
                    <div><label className="block text-sm font-medium">UPI ID (for QR Code)</label><input type="text" name="upiId" value={profile.upiId || ''} onChange={handleProfileChange} className={formInputStyle} /></div>
                     <div className="flex justify-end pt-4"><button type="button" onClick={handleSaveProfile} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700"><CheckCircleIcon className="h-5 w-5" /> Save Profile</button></div>
                </div>
            );
        case 'subscription':
            return <SubscriptionTab subscription={systemConfig.subscription} onUpgrade={() => {}} />;
        case 'backup':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div><h4 className="text-lg font-semibold mb-2">Backup Data</h4><button onClick={onBackupData} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700"><DownloadIcon className="h-5 w-5" /> Download Backup</button></div>
                </div>
            );
        case 'system':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div><h4 className="text-lg font-semibold mb-2">Software Mode</h4><div className="flex gap-4"><label className="flex items-center gap-2"><input type="radio" name="softwareMode" value="Pharma" checked={config.softwareMode === 'Pharma'} onChange={handleConfigChange} /> Pharma</label><label className="flex items-center gap-2"><input type="radio" name="softwareMode" value="Retail" checked={config.softwareMode === 'Retail'} onChange={handleConfigChange} /> Retail</label></div></div>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium">Remark Line 1</label><input type="text" name="remarkLine1" value={config.remarkLine1 || ''} onChange={handleConfigChange} className={formInputStyle} /></div>
                        <div><label className="block text-sm font-medium">Remark Line 2</label><input type="text" name="remarkLine2" value={config.remarkLine2 || ''} onChange={handleConfigChange} className={formInputStyle} /></div>
                    </div>
                    <div className="flex justify-end pt-4"><button onClick={handleSaveConfig} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700"><CheckCircleIcon className="h-5 w-5" /> Save Settings</button></div>
                </div>
            );
        case 'language':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="max-w-md"><label className="block text-sm font-medium mb-2">Interface Language</label><select name="language" value={config.language || 'en'} onChange={handleLanguageChange} className={formSelectStyle}>{languages.map(lang => (<option key={lang.code} value={lang.code}>{lang.label}</option>))}</select></div>
                </div>
            );
        case 'gstMaster': return <GstMaster gstRates={gstRates} onAdd={onAddGstRate} onUpdate={onUpdateGstRate} onDelete={onDeleteGstRate} />;
        case 'printers': return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border dark:border-slate-600">
                    <div className="flex-grow w-full"><label className="block text-sm font-medium mb-1">Printer Name</label><input type="text" value={newPrinterName} onChange={e => setNewPrinterName(e.target.value)} className={formInputStyle} /></div>
                    <button onClick={handleAddPrinter} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 whitespace-nowrap">Add Printer</button>
                </div>
                <div className="space-y-2">
                    {config.printers?.map(p => (
                        <div key={p.id} className="flex justify-between p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg">
                            <span>{p.name} ({p.format})</span>
                            <button onClick={() => { const up = config.printers?.filter(pr => pr.id !== p.id); onSystemConfigChange({...config, printers: up}); }} className="text-red-500"><TrashIcon className="h-4 w-4"/></button>
                        </div>
                    ))}
                </div>
            </div>
        );
        case 'users': return systemConfig.subscription?.isPremium ? <UserManagement currentUserUid={auth.currentUser?.uid || ''} subUsers={subUsers} onRefresh={fetchSubUsers} /> : <div className="p-10 text-center"><h4 className="text-xl font-bold">Premium Feature</h4><p className="text-slate-500">Upgrade to Premium to add multiple operators.</p></div>;
        case 'security': return (
            <div className="space-y-6 animate-fade-in">
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div><label className="block text-sm font-medium">Current Password</label><input type="password" required value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className={formInputStyle} /></div>
                    <div><label className="block text-sm font-medium">New Password</label><input type="password" required value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className={formInputStyle} /></div>
                    {passwordStatus.msg && <div className="text-sm p-2 bg-blue-100 text-blue-800 rounded">{passwordStatus.msg}</div>}
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Update Password</button>
                </form>
            </div>
        );
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="max-w-4xl">
      <div className="flex flex-col h-full">
        <div className="flex border-b dark:border-slate-700 mb-6 overflow-x-auto pb-1 flex-shrink-0 gap-1">
            <TabButton label="Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Subscription" isActive={activeTab === 'subscription'} onClick={() => setActiveTab('subscription')} icon={<CloudIcon className="h-5 w-5" />} />
            <TabButton label="Language" isActive={activeTab === 'language'} onClick={() => setActiveTab('language')} icon={<GlobeIcon className="h-5 w-5" />} />
            <TabButton label="Operators" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Security" isActive={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<LockClosedIcon className="h-5 w-5" />} />
            <TabButton label="Printers" isActive={activeTab === 'printers'} onClick={() => setActiveTab('printers')} icon={<PrinterIcon className="h-5 w-5" />} />
            <TabButton label="Backup" isActive={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<DownloadIcon className="h-5 w-5" />} />
            <TabButton label="System" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AdjustmentsIcon className="h-5 w-5" />} />
            <TabButton label="GST" isActive={activeTab === 'gstMaster'} onClick={() => setActiveTab('gstMaster')} icon={<PercentIcon className="h-5 w-5" />} />
        </div>
        
        <div className="flex-grow overflow-y-auto min-h-[60vh]">
            {renderContent()}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t dark:border-slate-700 flex-shrink-0">
            <button onClick={onClose} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300">
                Done
            </button>
        </div>
      </div>
       <style>{`
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
    `}</style>
    </Modal>
  );
};

export default SettingsModal;
