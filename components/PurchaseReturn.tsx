
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, PurchaseReturn, PurchaseReturnLineItem, Company, Supplier, SystemConfig, GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, CheckCircleIcon, AdjustmentsIcon, SearchIcon, CloudIcon } from './icons/Icons';
import { getTranslation } from '../utils/translationHelper';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '');

interface PurchaseReturnProps {
    products: Product[];
    returns: PurchaseReturn[];
    suppliers: Supplier[];
    systemConfig: SystemConfig;
    gstRates: GstRate[];
    onAddReturn: (returnData: Omit<PurchaseReturn, 'id' | 'totalAmount'>) => void;
    onDeleteReturn: (pr: PurchaseReturn) => void;
    isSubscriptionExpired?: boolean;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 transition-all";

const AddItemForm: React.FC<{ products: Product[], onAddItem: (item: PurchaseReturnLineItem) => void, systemConfig: SystemConfig, gstRates: GstRate[], disabled?: boolean }> = ({ products, onAddItem, systemConfig, gstRates, disabled = false }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [search, setSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState({ batchNumber: '', expiryDate: '', quantity: '', mrp: '', purchasePrice: '', discount: '', gst: '12' });
    const [activeIndex, setActiveIndex] = useState(-1);

    const suggestions = useMemo(() => {
        if (!search || selectedProduct) return [];
        return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5);
    }, [search, selectedProduct, products]);

    const handleSelectProduct = (p: Product) => {
        setSelectedProduct(p);
        setSearch(p.name);
        setFormData(prev => ({ ...prev, gst: String(p.gst) }));
        setActiveIndex(-1);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;
        const item: PurchaseReturnLineItem = {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            company: selectedProduct.company,
            hsnCode: selectedProduct.hsnCode,
            gst: parseFloat(formData.gst) || 0,
            batchNumber: formData.batchNumber || (isPharmaMode ? '' : 'DEFAULT'),
            expiryDate: formData.expiryDate || '9999-12',
            quantity: parseInt(formData.quantity, 10),
            mrp: parseFloat(formData.mrp),
            purchasePrice: parseFloat(formData.purchasePrice),
            discount: parseFloat(formData.discount) || 0,
            barcode: selectedProduct.barcode
        };
        onAddItem(item);
        setSelectedProduct(null);
        setSearch('');
        setFormData({ batchNumber: '', expiryDate: '', quantity: '', mrp: '', purchasePrice: '', discount: '', gst: '12' });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (suggestions.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(prev => (prev > 0 ? prev - 1 : prev)); }
        else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelectProduct(suggestions[activeIndex]); }
    };

    return (
        <form onSubmit={handleSubmit} className={`p-4 my-4 space-y-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border dark:border-slate-700 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="relative">
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Select Product to Return</label>
                <div className="relative">
                    <input type="text" value={search} onChange={e => { setSearch(e.target.value); setSelectedProduct(null); }} onKeyDown={handleKeyDown} placeholder="Search product..." className={formInputStyle} autoComplete="off" />
                    <SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                </div>
                {suggestions.length > 0 && (
                    <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-700 border shadow-xl rounded max-h-48 overflow-y-auto">
                        {suggestions.map((p, idx) => (
                            <li key={p.id} onClick={() => handleSelectProduct(p)} className={`p-3 cursor-pointer text-slate-800 dark:text-slate-200 transition-colors ${idx === activeIndex ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-indigo-50 dark:hover:bg-slate-600'}`}>
                                <div className="font-bold">{p.name}</div>
                                <div className="text-[10px] opacity-70 uppercase">{p.company}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {selectedProduct && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end animate-fade-in">
                    {isPharmaMode && <input value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} placeholder="Batch*" className={formInputStyle} required />}
                    {isPharmaMode && <input value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} type="month" className={formInputStyle} required />}
                    <input value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} type="number" placeholder="Qty*" className={formInputStyle} required />
                    <input value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} type="number" placeholder="Rate*" className={formInputStyle} required step="0.01" />
                    <input value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} type="number" placeholder="Disc%" className={formInputStyle} step="0.01" />
                    <input value={formData.mrp} onChange={e => setFormData({...formData, mrp: e.target.value})} type="number" placeholder="MRP*" className={formInputStyle} required step="0.01" />
                    <button type="submit" className="bg-indigo-600 text-white rounded-lg px-4 py-2 font-bold shadow hover:bg-indigo-700 h-10">Add</button>
                </div>
            )}
        </form>
    );
};

const PurchaseReturn: React.FC<PurchaseReturnProps> = ({ products, returns, suppliers, systemConfig, onAddReturn, onDeleteReturn, isSubscriptionExpired }) => {
    const [supplier, setSupplier] = useState('');
    const [returnNumber, setReturnNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<PurchaseReturnLineItem[]>([]);
    const [roundOff, setRoundOff] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredSuppliers = useMemo(() => supplier ? suppliers.filter(s => s.name.toLowerCase().includes(supplier.toLowerCase())).slice(0, 5) : [], [supplier, suppliers]);

    const subtotal = useMemo(() => items.reduce((sum, item) => {
        const lineVal = (item.quantity * item.purchasePrice) * (1 - item.discount / 100);
        return sum + lineVal + (lineVal * item.gst / 100);
    }, 0), [items]);

    const grandTotal = Math.round(subtotal + roundOff);

    const handleSave = () => {
        if (!supplier || !returnNumber || items.length === 0) { alert("Fill all required fields"); return; }
        onAddReturn({ supplier, returnNumber, date, items, roundOff });
        setSupplier(''); setReturnNumber(''); setItems([]); setRoundOff(0);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title="Purchase Return Voucher (Stock Reduction)">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <label className="block text-sm font-medium mb-1 dark:text-slate-300">Supplier Name*</label>
                        <input value={supplier} onChange={e => { setSupplier(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Search Supplier..." className={formInputStyle} required />
                        {showSuggestions && filteredSuppliers.length > 0 && (
                            <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-700 border rounded shadow-xl">
                                {filteredSuppliers.map(s => <li key={s.id} onClick={() => setSupplier(s.name)} className="p-2 hover:bg-indigo-50 dark:hover:bg-slate-600 cursor-pointer">{s.name}</li>)}
                            </ul>
                        )}
                    </div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Return Ref #*</label><input value={returnNumber} onChange={e => setReturnNumber(e.target.value)} placeholder="e.g. PR-001" className={formInputStyle} required /></div>
                    <div><label className="block text-sm font-medium mb-1 dark:text-slate-300">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={formInputStyle} required /></div>
                </div>

                <AddItemForm products={products} onAddItem={item => setItems([...items, item])} systemConfig={systemConfig} gstRates={[]} disabled={isSubscriptionExpired} />

                {items.length > 0 && (
                    <div className="mt-6 space-y-4">
                        <div className="overflow-x-auto rounded-xl border dark:border-slate-700">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-900 text-slate-300 uppercase text-[10px] font-black tracking-widest">
                                    <tr>
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3">Batch</th>
                                        <th className="px-4 py-3 text-center">Qty</th>
                                        <th className="px-4 py-3 text-right">Price</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {items.map((it, idx) => {
                                        const lineTotal = (it.quantity * it.purchasePrice) * (1 - it.discount / 100) * (1 + it.gst / 100);
                                        return (
                                            <tr key={idx} className="bg-white dark:bg-slate-800">
                                                <td className="px-4 py-3 font-bold">{it.productName}</td>
                                                <td className="px-4 py-3 font-mono text-xs">{it.batchNumber}</td>
                                                <td className="px-4 py-3 text-center">{it.quantity}</td>
                                                <td className="px-4 py-3 text-right">₹{it.purchasePrice.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-bold">₹{lineTotal.toFixed(2)}</td>
                                                <td className="px-4 py-3"><button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-rose-500"><TrashIcon className="h-4 w-4" /></button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-col items-end gap-2 pr-4">
                            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">Total Return Value: ₹{grandTotal.toFixed(2)}</div>
                            <button onClick={handleSave} className="bg-emerald-600 text-white px-10 py-3 rounded-xl font-black shadow-xl hover:bg-emerald-700 transform active:scale-95 transition-all">POST RETURN</button>
                        </div>
                    </div>
                )}
            </Card>

            <Card title="Recent Returns History">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 uppercase text-[10px] font-black text-slate-500"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Return #</th><th className="px-6 py-4">Supplier</th><th className="px-6 py-4 text-right">Total Amount</th><th className="px-6 py-4 text-center">Actions</th></tr></thead>
                        <tbody className="divide-y dark:divide-slate-700">{returns.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-6 py-4 text-slate-700 dark:text-slate-300">{new Date(r.date).toLocaleDateString()}</td><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{r.returnNumber}</td><td className="px-6 py-4 text-slate-700 dark:text-slate-300">{r.supplier}</td><td className="px-6 py-4 text-right font-black text-rose-600">₹{r.totalAmount.toFixed(2)}</td><td className="px-6 py-4 text-center"><button onClick={() => onDeleteReturn(r)} className="text-rose-600 hover:text-rose-800 transition-colors"><TrashIcon className="h-5 w-5" /></button></td></tr>
                        ))}</tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default PurchaseReturn;
