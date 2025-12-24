
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, query, where, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserMapping, SystemConfig, SubscriptionInfo } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PencilIcon, CheckCircleIcon, CloudIcon, UserCircleIcon, AdjustmentsIcon, PlusIcon } from './icons/Icons';

const inputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const selectStyle = "w-full p-2 bg-yellow-100 text-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 appearance-none";

interface ManageSubModalProps {
    isOpen: boolean;
    onClose: () => void;
    mapping: UserMapping;
    onUpdate: () => void;
}

const ManageSubModal: React.FC<ManageSubModalProps> = ({ isOpen, onClose, mapping, onUpdate }) => {
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        }
    }, [isOpen, mapping]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, `users/${mapping.ownerId}/systemConfig`, 'config');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setConfig(snap.data() as SystemConfig);
            } else {
                // If config doesn't exist, provide a default template
                setConfig({
                    softwareMode: 'Retail',
                    invoicePrintingFormat: 'Thermal',
                    subscription: { isPremium: false, planType: 'Free' },
                    aiInvoiceQuota: 5,
                    aiInvoiceUsageCount: 0
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config) return;
        setSaving(true);
        try {
            const docRef = doc(db, `users/${mapping.ownerId}/systemConfig`, 'config');
            await setDoc(docRef, config as any, { merge: true });
            alert("Subscription updated successfully!");
            onUpdate();
            onClose();
        } catch (e) {
            alert("Update failed");
        } finally {
            setSaving(false);
        }
    };

    const updateSub = (updates: Partial<SubscriptionInfo>) => {
        if (!config) return;
        setConfig({
            ...config,
            subscription: {
                ...(config.subscription || { isPremium: false, planType: 'Free' }),
                ...updates
            }
        });
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage: ${mapping.email}`}>
            {loading ? (
                <div className="py-10 text-center">Loading settings...</div>
            ) : config ? (
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg mb-4">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">User: {mapping.name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">UID: {mapping.ownerId}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Plan Type</label>
                        <select 
                            value={config.subscription?.planType || 'Free'} 
                            onChange={e => updateSub({ planType: e.target.value as any, isPremium: e.target.value !== 'Free' })}
                            className={selectStyle}
                        >
                            <option value="Free">Free</option>
                            <option value="Basic">Basic</option>
                            <option value="Premium">Premium</option>
                            <option value="Enterprise">Enterprise</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Expiry Date</label>
                        <input 
                            type="date" 
                            value={config.subscription?.expiryDate?.split('T')[0] || ''} 
                            onChange={e => updateSub({ expiryDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                            className={inputStyle}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">AI Usage Count</label>
                            <input 
                                type="number" 
                                value={config.aiInvoiceUsageCount || 0} 
                                onChange={e => setConfig({ ...config, aiInvoiceUsageCount: parseInt(e.target.value) || 0 })}
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">AI Quota (Limit)</label>
                            <input 
                                type="number" 
                                value={config.aiInvoiceQuota || 5} 
                                onChange={e => setConfig({ ...config, aiInvoiceQuota: parseInt(e.target.value) || 0 })}
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button>
                        <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700">
                            {saving ? 'Saving...' : 'Save Subscription'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="py-10 text-center text-red-500">Could not load config.</div>
            )}
        </Modal>
    );
};

const AddMappingModal: React.FC<{ isOpen: boolean, onClose: () => void, onRefresh: () => void }> = ({ isOpen, onClose, onRefresh }) => {
    const [formData, setFormData] = useState({ ownerId: '', email: '', name: '' });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.ownerId || !formData.email) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'userMappings', formData.ownerId), {
                ...formData,
                role: 'admin'
            });
            alert("User record added to registry!");
            onRefresh();
            onClose();
        } catch (e) {
            alert("Failed to add record.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manual User Registration">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 p-2 rounded border-l-4 border-indigo-500">
                    Enter the User UID exactly as seen in the Firebase Authentication console to link it.
                </p>
                <div>
                    <label className="block text-sm font-medium mb-1">User UID*</label>
                    <input required value={formData.ownerId} onChange={e => setFormData({...formData, ownerId: e.target.value})} placeholder="Paste Firebase UID here" className={inputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Email Address*</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="user@example.com" className={inputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Display Name</label>
                    <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Shop or Owner Name" className={inputStyle} />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button>
                    <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700">
                        {saving ? 'Registering...' : 'Add to Registry'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const SubscriptionAdmin: React.FC = () => {
    const [mappings, setMappings] = useState<UserMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMapping, setSelectedMapping] = useState<UserMapping | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        fetchMappings();
    }, []);

    const fetchMappings = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'userMappings'), where('role', '==', 'admin'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => d.data() as UserMapping);
            setMappings(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        if (!searchTerm) return mappings;
        const s = searchTerm.toLowerCase();
        return mappings.filter(m => m.email?.toLowerCase().includes(s) || m.name?.toLowerCase().includes(s));
    }, [mappings, searchTerm]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <AdjustmentsIcon className="h-7 w-7 text-indigo-600" />
                    Subscription Control Center
                </h1>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all"
                >
                    <PlusIcon className="h-5 w-5" /> REGISTER NEW UID
                </button>
            </div>

            <Card>
                <div className="relative mb-6">
                    <input 
                        type="text" 
                        placeholder="Search users by email or name..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`${inputStyle} pl-10 h-12 text-lg`}
                    />
                    <div className="absolute left-3 top-3.5 text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border dark:border-slate-700">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase text-xs font-bold border-b dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4">User Details</th>
                                <th className="px-6 py-4">UID</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={3} className="px-6 py-10 text-center">Loading registry...</td></tr>
                            ) : filtered.map((m, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold">
                                                {m.email?.[0].toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-200">{m.name || 'Unnamed'}</p>
                                                <p className="text-xs text-slate-500">{m.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{m.ownerId}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => setSelectedMapping(m)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                                        >
                                            MANAGE
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filtered.length === 0 && (
                                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-500 italic">No users found match your search.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {selectedMapping && (
                <ManageSubModal 
                    isOpen={!!selectedMapping} 
                    onClose={() => setSelectedMapping(null)} 
                    mapping={selectedMapping} 
                    onUpdate={fetchMappings}
                />
            )}

            <AddMappingModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                onRefresh={fetchMappings} 
            />
        </div>
    );
};

export default SubscriptionAdmin;
