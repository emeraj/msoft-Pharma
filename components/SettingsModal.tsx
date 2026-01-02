import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { CompanyProfile, SystemConfig, GstRate, PrinterProfile, SubUser, SubscriptionInfo } from '../types';
import Modal from './common/Modal';
import Card from './common/Card';
import { CheckCircleIcon, DownloadIcon, UploadIcon, UserCircleIcon, AdjustmentsIcon, PercentIcon, PrinterIcon, TrashIcon, GlobeIcon, ArchiveIcon, CloudIcon, InformationCircleIcon, PlusIcon, XIcon, SearchIcon, CameraIcon, BluetoothIcon, SwitchHorizontalIcon, UserGroupIcon } from './icons/Icons';
import GstMaster from './GstMaster';
import UserManagement from './UserManagement';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';
import { BluetoothHelper } from '../utils/BluetoothHelper';

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
  onReWriteStock?: () => Promise<void>;
}

type SettingsTab = 'profile' | 'backup' | 'system' | 'gstMaster' | 'printers' | 'language' | 'users' | 'maintenance';

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 transition-all";

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
  isOpen, onClose, companyProfile, onProfileChange, systemConfig, onSystemConfigChange, onBackupData, gstRates, onAddGstRate, onUpdateGstRate, onDeleteGstRate, onReWriteStock
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);
  const [config, setConfig] = useState<SystemConfig>(systemConfig);
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setProfile(companyProfile);
        setConfig(systemConfig);
        fetchSubUsers();
    }
  }, [companyProfile, systemConfig, isOpen]);

  const fetchSubUsers = async () => {
      if (!auth.currentUser) return;
      try {
          const snapshot = await getDocs(collection(db, `users/${auth.currentUser.uid}/subUsers`));
          setSubUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubUser)));
      } catch (e) { console.error(e); }
  };

  const handleAuditAction = async () => {
      if (!onReWriteStock) return;
      setIsProcessing(true);
      await onReWriteStock();
      setIsProcessing(false);
  };

  const renderContent = () => {
    switch (activeTab) {
        case 'profile':
            return (
                <div className="space-y-6 animate-fade-in pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Shop Name</label>
                            <input type="text" value={profile.name || ''} onChange={(e) => setProfile({...profile, name: e.target.value})} className={formInputStyle} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Address</label>
                            <textarea value={profile.address || ''} onChange={(e) => setProfile({...profile, address: e.target.value})} className={formInputStyle} rows={3} />
                        </div>
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Phone</label><input type="tel" value={profile.phone || ''} onChange={(e) => setProfile({...profile, phone: e.target.value})} className={formInputStyle} /></div>
                        <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">GSTIN</label><input type="text" value={profile.gstin || ''} onChange={(e) => setProfile({...profile, gstin: e.target.value})} className={formInputStyle} /></div>
                    </div>
                     <div className="flex justify-end pt-8 border-t dark:border-slate-700">
                        <button type="button" onClick={() => { onProfileChange(profile); onClose(); }} className="flex items-center gap-3 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 uppercase tracking-widest text-sm">Update Profile</button>
                    </div>
                </div>
            );
        case 'system':
            return (
                <div className="space-y-8 animate-fade-in pb-10">
                    <div>
                        <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest">Select Software Mode</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setConfig({...config, softwareMode: 'Pharma'})} className={`p-5 rounded-2xl border-2 transition-all ${config.softwareMode === 'Pharma' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>Pharma</button>
                            <button onClick={() => setConfig({...config, softwareMode: 'Retail'})} className={`p-5 rounded-2xl border-2 transition-all ${config.softwareMode === 'Retail' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>Retail</button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 border-b-2 border-indigo-500 pb-1 w-fit">Billing Settings</h4>
                        <ToggleRow label="MRP Editable (Y/N)" value={!!config.mrpEditable} onChange={(v) => setConfig({...config, mrpEditable: v})} />
                        <ToggleRow label="Maintain Customer Ledger?" value={!!config.maintainCustomerLedger} onChange={(v) => setConfig({...config, maintainCustomerLedger: v})} />
                    </div>
                    <div className="flex justify-end pt-8 border-t dark:border-slate-700">
                        <button onClick={() => { onSystemConfigChange(config); onClose(); }} className="px-10 py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl hover:bg-indigo-700 uppercase tracking-widest text-sm">Save Configuration</button>
                    </div>
                </div>
            );
        case 'gstMaster': return <GstMaster gstRates={gstRates} onAdd={onAddGstRate} onUpdate={onUpdateGstRate} onDelete={onDeleteGstRate} />;
        case 'maintenance':
            return (
                <div className="space-y-6 animate-fade-in pb-10">
                    <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex-grow">
                                <h5 className="font-black text-amber-800 dark:text-amber-300 uppercase text-sm tracking-widest">Inventory Health Utility</h5>
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                                    Rebuild your live stock levels by auditing the transaction ledger (Opening + Purchases - Sales - Returns).
                                </p>
                            </div>
                            <button 
                                onClick={handleAuditAction}
                                disabled={isProcessing}
                                className="px-8 py-3 bg-amber-600 text-white rounded-xl font-black text-xs uppercase shadow-xl hover:bg-amber-700 transition-all transform active:scale-95 flex items-center gap-2"
                            >
                                {isProcessing ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> : <SwitchHorizontalIcon className="h-5 w-5" />}
                                Stock Audit
                            </button>
                        </div>
                    </Card>
                </div>
            );
        case 'users': return <UserManagement currentUserUid={auth.currentUser?.uid || ''} subUsers={subUsers} onRefresh={fetchSubUsers} />;
        case 'backup': return <div className="p-4 bg-indigo-50 dark:bg-slate-800 rounded-xl text-center"><button onClick={onBackupData} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold">Download Backup JSON</button></div>;
        default: return <div className="py-20 text-center text-slate-400">Section under development</div>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="max-w-4xl">
      <div className="flex flex-col h-full">
        <div className="flex border-b dark:border-slate-700 mb-6 overflow-x-auto pb-1 gap-1">
            <TabButton label="Profile" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserCircleIcon className="h-5 w-5" />} />
            <TabButton label="Backup" isActive={activeTab === 'backup'} onClick={() => setActiveTab('backup')} icon={<ArchiveIcon className="h-5 w-5" />} />
            <TabButton label="Operators" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserGroupIcon className="h-5 w-5" />} />
            <TabButton label="System" isActive={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AdjustmentsIcon className="h-5 w-5" />} />
            <TabButton label="GST" isActive={activeTab === 'gstMaster'} onClick={() => setActiveTab('gstMaster')} icon={<PercentIcon className="h-5 w-5" />} />
            <TabButton label="Audit" isActive={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={<CheckCircleIcon className="h-5 w-5" />} />
        </div>
        <div className="flex-grow overflow-y-auto min-h-[60vh] px-1">{renderContent()}</div>
        <div className="flex justify-end pt-4 mt-4 border-t dark:border-slate-700"><button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-black hover:bg-slate-700">Close</button></div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
