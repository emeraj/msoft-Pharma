import React, { useState, useEffect } from 'react';
import type { CompanyProfile } from '../types';
import Modal from './common/Modal';
import { UpdateIcon } from './icons/Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyProfile: CompanyProfile;
  onProfileChange: (profile: CompanyProfile) => void;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500";

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  companyProfile,
  onProfileChange,
}) => {
  const [profile, setProfile] = useState<CompanyProfile>(companyProfile);

  useEffect(() => {
    setProfile(companyProfile);
  }, [companyProfile, isOpen]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    onProfileChange(profile);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Shop Profile">
      <div className="space-y-6">
        
        {/* Shop Profile Section */}
        <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name</label>
              <input 
                type="text"
                name="name"
                value={profile.name || ''}
                onChange={handleProfileChange}
                className={formInputStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea
                name="address"
                value={profile.address || ''}
                onChange={handleProfileChange}
                className={formInputStyle}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input 
                    type="tel"
                    name="phone"
                    value={profile.phone || ''}
                    onChange={handleProfileChange}
                    className={formInputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    type="email"
                    name="email"
                    value={profile.email || ''}
                    onChange={handleProfileChange}
                    className={formInputStyle}
                  />
                </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
              <input 
                type="text"
                name="gstin"
                value={profile.gstin || ''}
                onChange={handleProfileChange}
                className={formInputStyle}
              />
            </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all"
          >
            <UpdateIcon className="h-5 w-5" />
            Update Profile
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;