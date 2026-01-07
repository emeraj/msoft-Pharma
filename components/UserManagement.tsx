
import React, { useState, useEffect } from 'react';
import { SubUser, UserPermissions } from '../types';
import { PlusIcon, TrashIcon, CheckCircleIcon, XIcon, PencilIcon } from './icons/Icons';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { firebaseConfig, db } from '../firebase';
import { doc, setDoc, collection, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';

interface UserManagementProps {
  currentUserUid: string;
  subUsers: SubUser[];
  onRefresh: () => void;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

const PermissionCheckbox: React.FC<{
    label: string;
    checked: boolean;
    onChange: () => void;
}> = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-2 cursor-pointer p-2 border rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 dark:border-slate-500 select-none">
        <input 
            type="checkbox" 
            checked={checked} 
            onChange={onChange}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
        />
        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300">{label}</span>
    </label>
);

const UserManagement: React.FC<UserManagementProps> = ({ currentUserUid, subUsers, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<SubUser | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  
  const initialPermissions: UserPermissions = {
    canMasterLedger: false, canMasterProduct: false, canMasterBatch: false,
    canVoucherSale: true, canVoucherPurchase: false, canVoucherSaleReturn: false, canVoucherPurchaseReturn: false, canVoucherJournal: false, canVoucherNotes: false,
    canInventory: false,
    canReportDashboard: false, canReportDaybook: false, canReportCustomerLedger: false, canReportSupplierLedger: false, canReportSales: false, canReportSalesman: false, canReportCompanySales: false, canReportProfit: false, canReportCheque: false,
    canReportGst: false,
  };

  const [permissions, setPermissions] = useState<UserPermissions>(initialPermissions);

  const handlePermissionChange = (key: keyof UserPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetForm = () => {
      setFormData({ name: '', email: '', password: '' });
      setPermissions(initialPermissions);
      setEditingUser(null);
      setShowAddForm(false);
  };

  const handleEditClick = (user: SubUser) => {
      setEditingUser(user);
      setFormData({ name: user.name, email: user.email, password: '' });
      setPermissions(user.permissions);
      setShowAddForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingUser) {
          const userRef = doc(db, `users/${currentUserUid}/subUsers`, editingUser.id);
          await updateDoc(userRef, {
              name: formData.name,
              permissions: permissions
          });
          alert('Operator updated successfully!');
          onRefresh();
          resetForm();
      } else {
          let secondaryApp;
          try {
            secondaryApp = getApp("Secondary");
          } catch (e) {
            secondaryApp = initializeApp(firebaseConfig, "Secondary");
          }
          
          const secondaryAuth = getAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
          const newUid = userCredential.user.uid;
          
          await updateProfile(userCredential.user, { displayName: formData.name });
          await signOut(secondaryAuth);

          const subUser: SubUser = {
            id: newUid,
            name: formData.name,
            email: formData.email,
            role: 'operator',
            permissions: permissions,
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, `users/${currentUserUid}/subUsers`, newUid), subUser);
          await setDoc(doc(db, 'userMappings', newUid), {
            ownerId: currentUserUid,
            role: 'operator'
          });

          alert('Operator created successfully!');
          onRefresh();
          resetForm();
      }

    } catch (error: any) {
      console.error("Error saving user:", error);
      alert(error.message || "Failed to save user.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure? This will revoke access for this user immediately.")) return;
    try {
      await deleteDoc(doc(db, `users/${currentUserUid}/subUsers`, userId));
      await deleteDoc(doc(db, 'userMappings', userId));
      onRefresh();
    } catch (e) {
      console.error("Error deleting user", e);
      alert("Failed to remove user access.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">User Management</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">Manage operators and their granular menu permissions.</p>
        </div>
        {!showAddForm && (
            <button 
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
            >
                <PlusIcon className="h-5 w-5" /> Add Operator
            </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-700 shadow-xl border-indigo-100">
            <div className="flex justify-between items-center mb-6">
                <h5 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">{editingUser ? 'Edit Operator Access' : 'Register New Operator'}</h5>
                <button type="button" onClick={resetForm} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all">
                    <XIcon className="h-6 w-6" />
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Full Name</label>
                    <input type="text" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={formInputStyle} required />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Email (Login ID)</label>
                    <input type="email" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={`${formInputStyle} ${editingUser ? 'bg-slate-200 cursor-not-allowed' : ''}`} required readOnly={!!editingUser} />
                </div>
                {!editingUser && (
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Password</label>
                        <input type="password" placeholder="Min 6 chars" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={formInputStyle} required minLength={6} />
                    </div>
                )}
            </div>
            
            <div className="space-y-8">
                {/* Master Data Section */}
                <section>
                    <h6 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3 border-b pb-1 border-indigo-100 dark:border-indigo-900/50">Master Data Access</h6>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <PermissionCheckbox label="Ledger Master" checked={permissions.canMasterLedger} onChange={() => handlePermissionChange('canMasterLedger')} />
                        <PermissionCheckbox label="Product Master" checked={permissions.canMasterProduct} onChange={() => handlePermissionChange('canMasterProduct')} />
                        <PermissionCheckbox label="Batch Master" checked={permissions.canMasterBatch} onChange={() => handlePermissionChange('canMasterBatch')} />
                    </div>
                </section>

                {/* Vouchers Section */}
                <section>
                    <h6 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3 border-b pb-1 border-indigo-100 dark:border-indigo-900/50">Voucher Entry Access</h6>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <PermissionCheckbox label="Sale Entry (Billing)" checked={permissions.canVoucherSale} onChange={() => handlePermissionChange('canVoucherSale')} />
                        <PermissionCheckbox label="Purchase Entry" checked={permissions.canVoucherPurchase} onChange={() => handlePermissionChange('canVoucherPurchase')} />
                        <PermissionCheckbox label="Sale Return" checked={permissions.canVoucherSaleReturn} onChange={() => handlePermissionChange('canVoucherSaleReturn')} />
                        <PermissionCheckbox label="Purchase Return" checked={permissions.canVoucherPurchaseReturn} onChange={() => handlePermissionChange('canVoucherPurchaseReturn')} />
                        <PermissionCheckbox label="Journal Entry" checked={permissions.canVoucherJournal} onChange={() => handlePermissionChange('canVoucherJournal')} />
                        <PermissionCheckbox label="Debit/Credit Notes" checked={permissions.canVoucherNotes} onChange={() => handlePermissionChange('canVoucherNotes')} />
                    </div>
                </section>

                {/* Inventory Section */}
                <section>
                    <h6 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3 border-b pb-1 border-indigo-100 dark:border-indigo-900/50">Inventory & Stock</h6>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <PermissionCheckbox label="Inventory (Live Stock)" checked={permissions.canInventory} onChange={() => handlePermissionChange('canInventory')} />
                    </div>
                </section>

                {/* Reports Section */}
                <section>
                    <h6 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3 border-b pb-1 border-indigo-100 dark:border-indigo-900/50">Financial Reports Access</h6>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <PermissionCheckbox label="Sales Dashboard" checked={permissions.canReportDashboard} onChange={() => handlePermissionChange('canReportDashboard')} />
                        <PermissionCheckbox label="Day Book" checked={permissions.canReportDaybook} onChange={() => handlePermissionChange('canReportDaybook')} />
                        <PermissionCheckbox label="Customer Ledger" checked={permissions.canReportCustomerLedger} onChange={() => handlePermissionChange('canReportCustomerLedger')} />
                        <PermissionCheckbox label="Supplier Ledger" checked={permissions.canReportSupplierLedger} onChange={() => handlePermissionChange('canReportSupplierLedger')} />
                        <PermissionCheckbox label="Sales Report" checked={permissions.canReportSales} onChange={() => handlePermissionChange('canReportSales')} />
                        <PermissionCheckbox label="Salesman Report" checked={permissions.canReportSalesman} onChange={() => handlePermissionChange('canReportSalesman')} />
                        <PermissionCheckbox label="Company-wise Sale" checked={permissions.canReportCompanySales} onChange={() => handlePermissionChange('canReportCompanySales')} />
                        <PermissionCheckbox label="Profit Analysis" checked={permissions.canReportProfit} onChange={() => handlePermissionChange('canReportProfit')} />
                        <PermissionCheckbox label="Cheque Print" checked={permissions.canReportCheque} onChange={() => handlePermissionChange('canReportCheque')} />
                    </div>
                </section>

                {/* GST Section */}
                <section>
                    <h6 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3 border-b pb-1 border-indigo-100 dark:border-indigo-900/50">Tax & Compliance</h6>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <PermissionCheckbox label="GST Reports (GSTR-3B/HSN)" checked={permissions.canReportGst} onChange={() => handlePermissionChange('canReportGst')} />
                    </div>
                </section>
            </div>

            <div className="flex justify-end gap-3 mt-10 pt-6 border-t dark:border-slate-700">
                <button type="button" onClick={resetForm} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50 transform active:scale-95 transition-all">
                    {isLoading ? 'Processing...' : (editingUser ? 'Update Permissions' : 'Register Operator')}
                </button>
            </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
            <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest border-b dark:border-slate-700">
                <tr>
                    <th className="px-6 py-4">Operator Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Active Rights</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {subUsers.map(user => {
                    const activeCount = Object.values(user.permissions).filter(Boolean).length;
                    return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white uppercase tracking-tight">{user.name}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{user.email}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${activeCount > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {activeCount} Menus Active
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditClick(user)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Edit Rights">
                                    <PencilIcon className="h-5 w-5" />
                                </button>
                                <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all" title="Delete Operator">
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </td>
                    </tr>
                )})}
                {subUsers.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-slate-500 font-bold italic">No operators currently managed.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
