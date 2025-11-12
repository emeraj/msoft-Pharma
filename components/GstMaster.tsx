import React, { useState, useEffect, useMemo } from 'react';
import type { GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, PencilIcon, TrashIcon } from './icons/Icons';

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

interface AddEditGstModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rate: number) => void;
  existingRate?: GstRate | null;
}

const AddEditGstModal: React.FC<AddEditGstModalProps> = ({ isOpen, onClose, onSave, existingRate }) => {
  const [rate, setRate] = useState('');
  const isEditing = !!existingRate;

  useEffect(() => {
    if (existingRate) {
      setRate(String(existingRate.rate));
    } else {
      setRate('');
    }
  }, [existingRate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rateValue = parseFloat(rate);
    if (!isNaN(rateValue) && rateValue >= 0) {
      onSave(rateValue);
      onClose();
    } else {
      alert('Please enter a valid, non-negative number for the GST rate.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit GST Rate' : 'Add New GST Rate'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="gst-rate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            GST Rate (%)
          </label>
          <input
            id="gst-rate"
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={formInputStyle}
            required
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700">
            Save Rate
          </button>
        </div>
      </form>
    </Modal>
  );
};

interface GstMasterProps {
  gstRates: GstRate[];
  onAdd: (rate: number) => void;
  onUpdate: (id: string, newRate: number) => void;
  onDelete: (id: string, rateValue: number) => void;
}

const GstMaster: React.FC<GstMasterProps> = ({ gstRates, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<GstRate | null>(null);

  const sortedRates = useMemo(() => [...gstRates].sort((a, b) => a.rate - b.rate), [gstRates]);

  const handleOpenAddModal = () => {
    setEditingRate(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rate: GstRate) => {
    setEditingRate(rate);
    setIsModalOpen(true);
  };

  const handleSave = (rateValue: number) => {
    if (editingRate) {
      onUpdate(editingRate.id, rateValue);
    } else {
      onAdd(rateValue);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">GST Master</h1>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors duration-200"
          >
            <PlusIcon className="h-5 w-5" /> Add New GST Rate
          </button>
        </div>
      </Card>

      <Card title="Existing GST Rates">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
            <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
              <tr>
                <th scope="col" className="px-6 py-3">Rate (%)</th>
                <th scope="col" className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.map(rate => (
                <tr key={rate.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{rate.rate}%</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={() => handleOpenEditModal(rate)} title="Edit Rate" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => onDelete(rate.id, rate.rate)} title="Delete Rate" className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedRates.length === 0 && (
            <div className="text-center py-10 text-slate-600 dark:text-slate-400">
              <p>No GST rates have been added yet.</p>
            </div>
          )}
        </div>
      </Card>

      <AddEditGstModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        existingRate={editingRate}
      />
    </div>
  );
};

export default GstMaster;
