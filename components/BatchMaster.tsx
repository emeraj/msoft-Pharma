import React, { useState, useMemo } from 'react';
import type { Product, Batch, SystemConfig } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { SearchIcon, PencilIcon, CheckCircleIcon, InformationCircleIcon } from './icons/Icons';

interface BatchMasterProps {
    products: Product[];
    systemConfig: SystemConfig;
    onUpdateProduct: (id: string, product: Partial<Product>) => Promise<void>;
}

const inputStyle = "w-full p-2 bg-yellow-100 text-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm";

const BatchMaster: React.FC<BatchMasterProps> = ({ products, systemConfig, onUpdateProduct }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingBatch, setEditingBatch] = useState<{ productId: string, batch: Batch } | null>(null);
    const isPharma = systemConfig.softwareMode === 'Pharma';

    const allBatches = useMemo(() => {
        return products.flatMap(p => 
            (p.batches || []).map(b => ({
                ...b,
                productId: p.id,
                productName: p.name,
                company: p.company,
                unitsPerStrip: p.unitsPerStrip || 1
            }))
        ).filter(item => {
            const term = searchTerm.toLowerCase();
            return item.productName.toLowerCase().includes(term) || item.batchNumber.toLowerCase().includes(term);
        }).sort((a, b) => a.productName.localeCompare(b.productName));
    }, [products, searchTerm]);

    const handleSaveBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBatch) return;

        const product = products.find(p => p.id === editingBatch.productId);
        if (product) {
            const updatedBatches = product.batches.map(b => 
                b.id === editingBatch.batch.id ? editingBatch.batch : b
            );
            await onUpdateProduct(product.id, { batches: updatedBatches });
            setEditingBatch(null);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center border border-indigo-500">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter">Batch Master Control</h1>
                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1 opacity-80">Global Audit & Price Correction Utility</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl border border-white/20">
                    <InformationCircleIcon className="h-8 w-8" />
                </div>
            </div>

            <Card>
                <div className="mb-6 relative">
                    <input 
                        type="text" 
                        placeholder="Search Batch No. or Product Name..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full p-4 bg-yellow-100 text-slate-900 border rounded-xl pl-12 text-lg font-medium shadow-inner focus:ring-4 focus:ring-indigo-500/20" 
                    />
                    <SearchIcon className="absolute left-4 top-4.5 h-6 w-6 text-slate-400" />
                </div>

                <div className="overflow-x-auto rounded-xl border dark:border-slate-700 shadow-sm">
                    <table className="w-full text-[13px] text-left border-collapse">
                        <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-widest sticky top-0">
                            <tr>
                                <th className="px-6 py-4">Product / Company</th>
                                <th className="px-6 py-4">Batch Details</th>
                                <th className="px-6 py-4 text-right">MRP</th>
                                <th className="px-6 py-4 text-right">Sale Rate</th>
                                <th className="px-6 py-4 text-right">P. Price</th>
                                <th className="px-6 py-4 text-center">Stock</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700 bg-white dark:bg-slate-800">
                            {allBatches.map((item, idx) => (
                                <tr key={`${item.productId}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-3">
                                        <div className="font-bold text-slate-800 dark:text-slate-100">{item.productName}</div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{item.company}</div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">#{item.batchNumber}</div>
                                        <div className="text-[10px] font-black text-rose-500">EXP: {item.expiryDate}</div>
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium">₹{item.mrp.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right font-black text-emerald-600">₹{(item.saleRate || item.mrp).toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right text-slate-500">₹{item.purchasePrice.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded font-bold text-slate-700 dark:text-slate-300">
                                            {item.stock} Units
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <button onClick={() => setEditingBatch({ productId: item.productId, batch: { ...item } })} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {editingBatch && (
                <Modal isOpen={!!editingBatch} onClose={() => setEditingBatch(null)} title="Edit Batch Financials">
                    <form onSubmit={handleSaveBatch} className="space-y-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                             <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Editing Batch for</p>
                             <p className="font-bold text-slate-800 dark:text-white">{editingBatch.batch.productName}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-black text-slate-500 uppercase mb-1">Batch Number</label><input value={editingBatch.batch.batchNumber} onChange={e => setEditingBatch({...editingBatch, batch: {...editingBatch.batch, batchNumber: e.target.value}})} className={inputStyle} required /></div>
                            <div><label className="block text-xs font-black text-slate-500 uppercase mb-1">Expiry (YYYY-MM)</label><input value={editingBatch.batch.expiryDate} onChange={e => setEditingBatch({...editingBatch, batch: {...editingBatch.batch, expiryDate: e.target.value}})} className={inputStyle} required /></div>
                            <div><label className="block text-xs font-black text-slate-500 uppercase mb-1">MRP</label><input type="number" step="0.01" value={editingBatch.batch.mrp} onChange={e => setEditingBatch({...editingBatch, batch: {...editingBatch.batch, mrp: parseFloat(e.target.value) || 0}})} className={inputStyle} required /></div>
                            <div><label className="block text-xs font-black text-slate-500 uppercase mb-1">Sale Rate</label><input type="number" step="0.01" value={editingBatch.batch.saleRate} onChange={e => setEditingBatch({...editingBatch, batch: {...editingBatch.batch, saleRate: parseFloat(e.target.value) || 0}})} className={inputStyle} /></div>
                            <div><label className="block text-xs font-black text-slate-500 uppercase mb-1">Purchase Price</label><input type="number" step="0.01" value={editingBatch.batch.purchasePrice} onChange={e => setEditingBatch({...editingBatch, batch: {...editingBatch.batch, purchasePrice: parseFloat(e.target.value) || 0}})} className={inputStyle} required /></div>
                            <div><label className="block text-xs font-black text-slate-500 uppercase mb-1">Current Stock (U)</label><input type="number" value={editingBatch.batch.stock} onChange={e => setEditingBatch({...editingBatch, batch: {...editingBatch.batch, stock: parseInt(e.target.value) || 0}})} className={`${inputStyle} bg-slate-100`} /></div>
                        </div>
                        <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                            <button type="button" onClick={() => setEditingBatch(null)} className="px-6 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Cancel</button>
                            <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-black shadow-lg flex items-center gap-2 hover:bg-indigo-700 uppercase tracking-widest text-xs">
                                <CheckCircleIcon className="h-5 w-5" /> Update Batch
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default BatchMaster;