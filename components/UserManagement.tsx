
import React, { useState, useEffect } from 'react';
import { SubUser, UserPermissions } from '../types';
import { PlusIcon, TrashIcon, CheckCircleIcon, XIcon, PencilIcon } from './icons/Icons';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { firebaseConfig, db } from '../firebase';
import { doc, setDoc, collection, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';

interface UserManagementProps {
  currentUserUid: string;
  subUsers: SubUser[];
  onRefresh: () => void;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

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
    canBill: true,
    canInventory: false,
    canPurchase: false,
    canPayment: false,
    canReports: false,
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
      // Scroll to form
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingUser) {
          // --- UPDATE LOGIC ---
          const userRef = doc(db, `users/${currentUserUid}/subUsers`, editingUser.id);
          await updateDoc(userRef, {
              name: formData.name,
              permissions: permissions
          });
          alert('Operator updated successfully!');
          onRefresh(); // Refresh list
          resetForm();
      } else {
          // --- CREATE LOGIC ---
          // 1. Create User in Firebase Auth using a secondary app instance
          const secondaryApp = initializeApp(firebaseConfig, "Secondary");
          const secondaryAuth = getAuth(secondaryApp);
          
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
          const newUid = userCredential.user.uid;
          
          await updateProfile(userCredential.user, { displayName: formData.name });
          await signOut(secondaryAuth); // Clean up session immediately

          // 2. Create SubUser record in Admin's collection
          const subUser: SubUser = {
            id: newUid,
            name: formData.name,
            email: formData.email,
            role: 'operator',
            permissions: permissions,
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, `users/${currentUserUid}/subUsers`, newUid), subUser);

          // 3. Create Global Mapping for Login Resolution
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
      let msg = "Failed to save user.";
      if (error.code === 'auth/email-already-in-use') msg = "Email is already in use.";
      if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      alert(msg);
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
            <p className="text-sm text-slate-600 dark:text-slate-400">Manage operators and their permissions.</p>
        </div>
        {!showAddForm && (
            <button 
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
                <PlusIcon className="h-5 w-5" /> Add Operator
            </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border dark:border-slate-600">
            <div className="flex justify-between items-center mb-4">
                <h5 className="font-medium text-slate-800 dark:text-slate-200">{editingUser ? 'Edit Operator' : 'New Operator Details'}</h5>
                <button type="button" onClick={resetForm} className="text-slate-500 hover:text-slate-700">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input 
                    type="text" 
                    placeholder="Name" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className={formInputStyle} 
                    required 
                />
                <input 
                    type="email" 
                    placeholder="Email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    className={`${formInputStyle} ${editingUser ? 'bg-slate-200 cursor-not-allowed' : ''}`}
                    required 
                    readOnly={!!editingUser}
                />
                {!editingUser && (
                    <input 
                        type="password" 
                        placeholder="Password (min 6 chars)" 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        className={formInputStyle} 
                        required 
                        minLength={6}
                    />
                )}
            </div>
            
            <h6 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Access Permissions</h6>
            <div className="flex flex-wrap gap-4 mb-6">
                {[
                    { key: 'canBill', label: 'Billing' },
                    { key: 'canInventory', label: 'Inventory' },
                    { key: 'canPurchase', label: 'Purchases' },
                    { key: 'canPayment', label: 'Payments' },
                    { key: 'canReports', label: 'Reports' },
                ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 cursor-pointer p-2 border rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 dark:border-slate-500 select-none">
                        <input 
                            type="checkbox" 
                            checked={permissions[perm.key as keyof UserPermissions]} 
                            onChange={() => handlePermissionChange(perm.key as keyof UserPermissions)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{perm.label}</span>
                    </label>
                ))}
            </div>

            <div className="flex justify-end gap-3">
                <button 
                    type="button" 
                    onClick={resetForm}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : (editingUser ? 'Update Operator' : 'Create Operator')}
                </button>
            </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
            <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Permissions</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                </tr>
            </thead>
            <tbody>
                {subUsers.map(user => (
                    <tr key={user.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <td className="px-4 py-3 font-medium">{user.name}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(user.permissions).map(([key, val]) => val && (
                                    <span key={key} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full capitalize">
                                        {key.replace('can', '')}
                                    </span>
                                ))}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleEditClick(user)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit User">
                                    <PencilIcon className="h-5 w-5" />
                                </button>
                                <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-800 p-1" title="Delete User">
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
                {subUsers.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No operators found.</td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
