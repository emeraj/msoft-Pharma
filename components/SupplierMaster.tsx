
import React, { useState, useMemo } from 'react';
import type { Supplier } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, SearchIcon, XIcon } from './icons/Icons';

interface SupplierMasterProps {
  suppliers: Supplier[];
  onAdd: (data: Omit<Supplier, 'id'>) => Promise<Supplier | null>;
  onUpdate: (id: string, data: Partial<Supplier>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const inputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

const exportToCsv = (filename: string, data: any[]) => {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        if (/[",\n]/.test(cell)) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const AddEditSupplierModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Supplier, 'id'>) => void;
  onUpdate: (id: string, data: Partial<Supplier>) => void;
  editingSupplier?: Supplier | null;
}> = ({ isOpen, onClose, onSave, onUpdate, editingSupplier }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', gstin: '', openingBalance: 0 });

  React.useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name || '',
        phone: editingSupplier.phone || '',
        address: editingSupplier.address || '',
        gstin: editingSupplier.gstin || '',
        openingBalance: editingSupplier.openingBalance || 0
      });
    } else {
      setFormData({ name: '', phone: '', address: '', gstin: '', openingBalance: 0 });
    }
  }, [editingSupplier, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    if (editingSupplier) {
      onUpdate(editingSupplier.id, formData);
    } else {
      onSave(formData);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Supplier Name (Ledger Name)*</label>
          <input autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputStyle} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
            <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN</label>
            <input value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value})} className={inputStyle} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
          <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={inputStyle} rows={2} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Balance (₹)</label>
          <input type="number" step="0.01" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: parseFloat(e.target.value) || 0})} className={inputStyle} />
          <p className="text-[10px] text-slate-400 mt-1 italic">Use negative for credit (payable), positive for debit.</p>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold">Cancel</button>
          <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black shadow-lg hover:bg-indigo-700 transform active:scale-95 transition-all">
            {editingSupplier ? 'UPDATE' : 'ADD'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const SupplierMaster: React.FC<SupplierMasterProps> = ({ suppliers, onAdd, onUpdate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const filtered = useMemo(() => 
    suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.phone && s.phone.includes(searchTerm)) ||
      (s.gstin && s.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a,b) => a.name.localeCompare(b.name))
  , [suppliers, searchTerm]);

  const handleExcelExport = () => {
    const data = filtered.map(s => ({
      'Ledger Name': s.name,
      'Group': 'Suppliers',
      'Phone': s.phone || '',
      'Address': s.address || '',
      'GSTIN': s.gstin || '',
      'Opening Balance': s.openingBalance || 0
    }));
    exportToCsv('suppliers_master', data);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card title={
        <div className="flex justify-between items-center w-full">
          <span className="text-xl font-black uppercase tracking-tight">Suppliers Master (Ledger)</span>
          <div className="flex gap-2">
            <button onClick={handleExcelExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md uppercase tracking-tighter">
                <DownloadIcon className="h-4 w-4" /> Excel
            </button>
            <button onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md uppercase tracking-tighter">
                <PlusIcon className="h-4 w-4" /> Add New
            </button>
          </div>
        </div>
      }>
        <div className="mb-6 relative">
          <input 
            type="text" 
            placeholder="Find by Ledger Name, GSTIN or Phone..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className={`${inputStyle} h-12 text-lg px-4`}
          />
          <SearchIcon className="absolute right-4 top-3.5 h-5 w-5 text-slate-400" />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-50 dark:bg-slate-900/20">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest border-b dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Ledger Name</th>
                <th className="px-6 py-4">Phone / GSTIN</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4 text-right">Op. Balance</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
              {filtered.map((s, idx) => (
                <tr key={s.id} className="hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 transition-colors group">
                  <td className="px-6 py-3.5 font-mono text-[11px] text-slate-500 uppercase">S-{s.id.slice(-4)}</td>
                  <td className="px-6 py-3.5 font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{s.name}</td>
                  <td className="px-6 py-3.5">
                      <div className="font-bold text-indigo-600 dark:text-indigo-400">{s.phone || '-'}</div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase">{s.gstin || 'NO GSTIN'}</div>
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400 max-w-xs truncate">{s.address || '-'}</td>
                  <td className={`px-6 py-3.5 text-right font-black ${s.openingBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₹{Math.abs(s.openingBalance).toFixed(2)} {s.openingBalance < 0 ? 'Cr' : 'Dr'}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex justify-center items-center gap-3">
                      <button onClick={() => { setEditingSupplier(s); setIsModalOpen(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all" title="Edit">
                          <PencilIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => onDelete(s.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all" title="Delete">
                          <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-500 italic font-medium">
                    No suppliers found in the registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddEditSupplierModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={onAdd} 
        onUpdate={onUpdate} 
        editingSupplier={editingSupplier} 
      />
    </div>
  );
};

export default SupplierMaster;
