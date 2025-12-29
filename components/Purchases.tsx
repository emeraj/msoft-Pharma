import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, PurchaseLineItem, Company, Supplier, SystemConfig, GstRate, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BarcodeIcon, CameraIcon, UploadIcon, CheckCircleIcon, AdjustmentsIcon, XIcon, CloudIcon, InformationCircleIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';
import { GoogleGenAI, Type } from "@google/genai";

// Helper for matching technical codes (removes dashes, dots, spaces)
const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '');

interface PurchasesProps {
    products: Product[];
    purchases: Purchase[];
    companies: Company[];
    suppliers: Supplier[];
    systemConfig: SystemConfig;
    gstRates: GstRate[];
    onAddPurchase: (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => void;
    onUpdatePurchase: (id: string, updatedData: Omit<Purchase, 'id'>, originalPurchase: Purchase) => void;
    onDeletePurchase: (purchase: Purchase) => void;
    onAddSupplier: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier | null>;
    onUpdateConfig: (config: SystemConfig) => void;
    editingPurchase?: Purchase | null;
    onCancelEdit?: () => void;
    isSubscriptionExpired?: boolean;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 transition-all";
const tableInputStyle = "w-full bg-slate-700/30 border border-transparent focus:border-indigo-500 focus:bg-slate-700 rounded px-1.5 py-1 text-slate-200 focus:outline-none transition-all";
const formSelectStyle = `${formInputStyle} appearance-none`;

const UpgradeQuotaModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const upiId = "9890072651@upi"; // M. Soft India
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("M. Soft India")}&am=5000&cu=INR`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;

    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Premium Feature" maxWidth="max-w-md">
            <div className="text-center p-2">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-xl mb-6 flex flex-col items-center gap-2">
                    <CloudIcon className="h-10 w-10 text-indigo-600" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">AI Inward is a Pro Feature</p>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Upgrade to Premium</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">Enjoy unlimited AI Purchase Inward, multiple operator support, and specialized reports.</p>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed border-indigo-300 mb-6">
                    <img src={qrCodeUrl} alt="Payment QR" className="w-40 h-40 mx-auto border-4 border-white rounded-lg shadow-sm" />
                    <p className="mt-3 text-2xl font-black text-indigo-600">₹5,000 <span className="text-xs text-slate-400 font-normal">/ Year</span></p>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/20 py-3 px-4 rounded-lg flex items-center justify-center gap-2 mb-4">
                    <CheckCircleIcon className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp Screenshot: 9890072651</span>
                </div>
                
                <button onClick={onClose} className="w-full py-2 text-slate-500 hover:text-slate-700 font-bold text-sm">Maybe Later</button>
            </div>
        </Modal>
    );
};

const AddSupplierModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAddSupplier: (supplierData: Omit<Supplier, 'id'>) => void;
    initialName?: string;
}> = ({ isOpen, onClose, onAddSupplier, initialName = '' }) => {
    const [formState, setFormState] = useState({ name: '', address: '', phone: '', gstin: '', openingBalance: '' });
    useEffect(() => { if (isOpen) { setFormState({ name: initialName, address: '', phone: '', gstin: '', openingBalance: '0' }); } }, [isOpen, initialName]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { setFormState({ ...formState, [e.target.name]: e.target.value }); };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name) { alert('Supplier Name is required.'); return; }
        onAddSupplier({ ...formState, openingBalance: parseFloat(formState.openingBalance) || 0 });
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Supplier">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name*</label><input name="name" value={formState.name} onChange={handleChange} className={formInputStyle} required /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label><input name="phone" value={formState.phone} onChange={handleChange} className={formInputStyle} /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label><input name="address" value={formState.address} onChange={handleChange} className={formInputStyle} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN</label><input name="gstin" value={formState.gstin} onChange={handleChange} className={formInputStyle} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Balance</label><input name="openingBalance" value={formState.openingBalance} onChange={handleChange} type="number" step="0.01" className={formInputStyle} /></div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add Supplier</button>
                </div>
            </form>
        </Modal>
    );
};

interface OcrPreviewModalProps {
    isOpen: boolean; onClose: () => void; data: { supplierName: string; supplierGstin?: string; supplierAddress?: string; invoiceNumber: string; invoiceDate: string; items: PurchaseLineItem[]; };
    suppliers: Supplier[]; onImport: (data: any) => void; isPharmaMode: boolean;
}

const OcrPreviewModal: React.FC<OcrPreviewModalProps> = ({ isOpen, onClose, data, suppliers, onImport, isPharmaMode }) => {
    const [supplierName, setSupplierName] = useState(data.supplierName);
    const [supplierGstin, setSupplierGstin] = useState(data.supplierGstin || '');
    const [supplierAddress, setSupplierAddress] = useState(data.supplierAddress || '');
    const [invoiceNumber, setInvoiceNumber] = useState(data.invoiceNumber);
    const [invoiceDate, setInvoiceDate] = useState(data.invoiceDate);
    const [items, setItems] = useState<(PurchaseLineItem & { selected: boolean })[]>([]);

    useEffect(() => { 
        if (isOpen) { 
            setSupplierName(data.supplierName); 
            setSupplierGstin(data.supplierGstin || ''); 
            setSupplierAddress(data.supplierAddress || ''); 
            setInvoiceNumber(data.invoiceNumber); 
            setInvoiceDate(data.invoiceDate); 
            setItems(data.items.map(i => ({ ...i, selected: true }))); 
        } 
    }, [isOpen, data]);

    const handleItemChange = (index: number, field: keyof PurchaseLineItem, value: any) => { 
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item)); 
    };

    const handleImport = () => { 
        onImport({ 
            supplierName, 
            supplierGstin, 
            supplierAddress, 
            invoiceNumber, 
            invoiceDate, 
            items: items.filter(i => i.selected).map(({ selected, ...rest }) => rest) 
        }); 
        onClose(); 
    };

    const addMissingItem = () => {
        const newItem: PurchaseLineItem & { selected: boolean } = {
            isNewProduct: true,
            productName: '',
            company: supplierName || 'General',
            hsnCode: '',
            gst: 18,
            batchNumber: isPharmaMode ? 'BATCH' : 'DEFAULT',
            expiryDate: '2025-12',
            quantity: 1,
            mrp: 0,
            purchasePrice: 0,
            discount: 0,
            selected: true
        };
        setItems([...items, newItem]);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Verify & Edit Scanned Data" maxWidth="max-w-full">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Supplier Name</label>
                        <input value={supplierName} onChange={e => setSupplierName(e.target.value)} className={formInputStyle} list="supplier-list-ocr" />
                        <datalist id="supplier-list-ocr">{suppliers.map(s => <option key={s.id} value={s.name} />)}</datalist>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Invoice No</label>
                        <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={formInputStyle} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Date</label>
                        <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={formInputStyle} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Supplier GSTIN</label>
                        <input value={supplierGstin} onChange={e => setSupplierGstin(e.target.value)} className={formInputStyle} placeholder="Optional GSTIN" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-wider">Supplier Address</label>
                        <input value={supplierAddress} onChange={e => setSupplierAddress(e.target.value)} className={formInputStyle} placeholder="Optional Address" />
                    </div>
                </div>

                <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner bg-slate-800/50">
                    <div className="overflow-x-auto max-h-[50vh]">
                        <table className="w-full text-[12px] text-left border-collapse">
                            <thead className="bg-[#1e293b] text-slate-300 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10 shadow-md">
                                <tr>
                                    <th className="px-4 py-4 w-10 text-center">
                                        <input type="checkbox" checked={items.length > 0 && items.every(i => i.selected)} onChange={e => setItems(prev => prev.map(i => ({...i, selected: e.target.checked})))} />
                                    </th>
                                    <th className="px-4 py-4 min-w-[180px]">PRODUCT / DESC</th>
                                    <th className="px-4 py-4 text-center min-w-[100px]">CODE / PART #</th>
                                    <th className="px-4 py-4 text-center min-w-[80px]">HSN</th>
                                    {isPharmaMode && <th className="px-4 py-4 text-center min-w-[100px]">BATCH</th>}
                                    {isPharmaMode && <th className="px-4 py-4 text-center min-w-[100px]">EXPIRY</th>}
                                    <th className="px-4 py-4 text-center min-w-[60px]">QTY</th>
                                    <th className="px-4 py-4 text-right min-w-[80px]">RATE</th>
                                    <th className="px-4 py-4 text-center min-w-[60px]">DISC%</th>
                                    <th className="px-4 py-4 text-center min-w-[60px]">TAX%</th>
                                    <th className="px-4 py-4 text-right min-w-[90px]">AMOUNT</th>
                                    <th className="px-4 py-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700 bg-slate-800">
                                {items.map((item, index) => {
                                    const amount = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100) * (1 + (item.gst || 0) / 100);
                                    return (
                                        <tr key={index} className={`hover:bg-slate-700/50 transition-colors ${!item.selected ? 'opacity-30' : ''}`}>
                                            <td className="px-4 py-3 text-center">
                                                <input type="checkbox" checked={item.selected} onChange={() => setItems(prev => prev.map((it, i) => i === index ? { ...it, selected: !it.selected } : it))} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input value={item.productName} onChange={e => handleItemChange(index, 'productName', e.target.value)} className={`${tableInputStyle} font-bold`} placeholder="Product Name" />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input value={item.barcode || ''} onChange={e => handleItemChange(index, 'barcode', e.target.value)} className={`${tableInputStyle} text-center font-mono text-[10px]`} placeholder="Technical Code" />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input value={item.hsnCode} onChange={e => handleItemChange(index, 'hsnCode', e.target.value)} className={`${tableInputStyle} text-center`} placeholder="HSN" />
                                            </td>
                                            {isPharmaMode && (
                                                <td className="px-4 py-3 text-center">
                                                    <input value={item.batchNumber} onChange={e => handleItemChange(index, 'batchNumber', e.target.value)} className={`${tableInputStyle} text-center font-mono`} placeholder="Batch" />
                                                </td>
                                            )}
                                            {isPharmaMode && (
                                                <td className="px-4 py-3 text-center">
                                                    <input type="month" value={item.expiryDate} onChange={e => handleItemChange(index, 'expiryDate', e.target.value)} className={`${tableInputStyle} text-center text-[10px]`} />
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-center">
                                                <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} className={`${tableInputStyle} text-center`} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input type="number" value={item.purchasePrice} onChange={e => handleItemChange(index, 'purchasePrice', parseFloat(e.target.value) || 0)} className={`${tableInputStyle} text-right`} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input type="number" value={item.discount} onChange={e => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} className={`${tableInputStyle} text-center`} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input type="number" value={item.gst} onChange={e => handleItemChange(index, 'gst', parseFloat(e.target.value) || 0)} className={`${tableInputStyle} text-center`} />
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-indigo-400">
                                                {amount.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => setItems(prev => prev.filter((_, i) => i !== index))} className="text-rose-500 hover:text-rose-400 p-1">
                                                    <TrashIcon className="h-4 w-4"/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-between items-center px-2">
                    <button onClick={addMissingItem} className="text-indigo-400 font-bold hover:underline flex items-center gap-2 text-sm bg-indigo-900/20 px-4 py-2 rounded-lg border border-indigo-500/30">
                        <PlusIcon className="h-4 w-4" /> Add Missing Row
                    </button>
                    <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700">
                        Items Ready: <span className="text-emerald-400 text-sm ml-1">{items.filter(i => i.selected).length}</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-8 py-2.5 bg-slate-700 text-slate-200 font-bold rounded-xl hover:bg-slate-600 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleImport} className="px-10 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-xl hover:bg-emerald-700 flex items-center gap-2 transform active:scale-95 transition-all">
                        <CheckCircleIcon className="h-6 w-6" /> IMPORT TO LEDGER
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const AddItemForm: React.FC<{ products: Product[], onAddItem: (item: PurchaseLineItem) => void, companies: Company[], systemConfig: SystemConfig, gstRates: GstRate[], disabled?: boolean, itemToEdit?: PurchaseLineItem | null }> = ({ products, onAddItem, companies, systemConfig, gstRates, disabled = false, itemToEdit }) => {
    const sortedGstRates = useMemo(() => [...gstRates].sort((a, b) => a.rate - b.rate), [gstRates]);
    const defaultGst = useMemo(() => sortedGstRates.find(r => r.rate === 12)?.rate.toString() || sortedGstRates[0]?.rate.toString() || '0', [sortedGstRates]);
    const getInitialFormState = () => ({ isNewProduct: false, productSearch: '', selectedProduct: null as Product | null, productName: '', company: '', hsnCode: '', gst: defaultGst, composition: '', unitsPerStrip: '', isScheduleH: 'No', batchNumber: '', expiryDate: '', quantity: '', mrp: '', purchasePrice: '', barcode: '', discount: '', tax: defaultGst });
    const [formState, setFormState] = useState(getInitialFormState());
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [isScannerOpen, setScannerOpen] = useState(false);
    
    // Keyboard navigation state for Product search
    const [activeProductIndex, setActiveProductIndex] = useState(-1);

    const filteredProductSuggestions = useMemo(() => {
        if (!formState.productSearch || formState.selectedProduct) return [];
        return products.filter(p => p.name.toLowerCase().includes(formState.productSearch.toLowerCase())).slice(0, 5);
    }, [formState.productSearch, formState.selectedProduct, products]);

    useEffect(() => {
        if (formState.productSearch) setActiveProductIndex(-1);
    }, [formState.productSearch]);

    useEffect(() => { if (itemToEdit) { const existingProduct = itemToEdit.productId ? products.find(p => p.id === itemToEdit.productId) : null; setFormState({ isNewProduct: itemToEdit.isNewProduct, productSearch: itemToEdit.productName, selectedProduct: existingProduct || null, productName: itemToEdit.productName, company: itemToEdit.company, hsnCode: itemToEdit.hsnCode, gst: String(itemToEdit.gst), composition: itemToEdit.composition || '', unitsPerStrip: String(itemToEdit.unitsPerStrip || ''), isScheduleH: itemToEdit.isScheduleH ? 'Yes' : 'No', batchNumber: itemToEdit.batchNumber, expiryDate: itemToEdit.expiryDate, quantity: String(itemToEdit.quantity), mrp: String(itemToEdit.mrp), purchasePrice: String(itemToEdit.purchasePrice), barcode: itemToEdit.barcode || '', discount: itemToEdit.discount ? String(itemToEdit.discount) : '', tax: String(itemToEdit.gst) }); } }, [itemToEdit, products]);
    
    const handleSelectProduct = (product: Product) => { setFormState(prev => ({ ...prev, selectedProduct: product, productSearch: product.name, productName: product.name, company: product.company, hsnCode: product.hsnCode, gst: String(product.gst), tax: String(product.gst), unitsPerStrip: String(product.unitsPerStrip || ''), isScheduleH: product.isScheduleH ? 'Yes' : 'No', isNewProduct: false, barcode: product.barcode || '' })); setActiveProductIndex(-1); };
    
    const handleAddItem = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const { isNewProduct, selectedProduct, productName, company, hsnCode, gst, batchNumber, expiryDate, quantity, mrp, purchasePrice, discount, tax, barcode } = formState;
        
        // Validation: Alert if barcode already exists when creating a 'New' product
        if (isNewProduct && barcode) {
            const exists = products.find(p => p.barcode && p.barcode.toLowerCase().trim() === barcode.toLowerCase().trim());
            if (exists) {
                alert(`Product with barcode "${barcode}" already exists as "${exists.name}". Please search and select the existing product instead of creating a new one.`);
                return;
            }
        }

        if (isNewProduct && (!productName || !company)) { alert('Name and Company required.'); return; }
        const item: PurchaseLineItem = { isNewProduct, productName: isNewProduct ? productName : selectedProduct!.name, company: company.trim(), hsnCode: isNewProduct ? hsnCode : selectedProduct!.hsnCode, gst: parseFloat(tax) || parseFloat(gst) || 0, batchNumber: isPharmaMode ? batchNumber : 'DEFAULT', expiryDate: isPharmaMode ? expiryDate : '9999-12', quantity: parseInt(quantity, 10), mrp: parseFloat(mrp), purchasePrice: parseFloat(purchasePrice), discount: parseFloat(discount) || 0, barcode: barcode || (selectedProduct?.barcode || '') };
        if (!isNewProduct && selectedProduct) item.productId = selectedProduct.id;
        onAddItem(item);
        setFormState(getInitialFormState());
    };

    const handleProductKeyDown = (e: React.KeyboardEvent) => {
        if (filteredProductSuggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveProductIndex(prev => (prev < filteredProductSuggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveProductIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            if (activeProductIndex >= 0) {
                e.preventDefault();
                handleSelectProduct(filteredProductSuggestions[activeProductIndex]);
            }
        } else if (e.key === 'Escape') {
            setActiveProductIndex(-1);
            setFormState(prev => ({ ...prev, productSearch: '' }));
        }
    };

    return (
        <form onSubmit={handleAddItem} className={`p-4 my-4 space-y-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border dark:border-slate-700 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 relative">
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Search Product</label>
                    <input type="text" name="productSearch" value={formState.productSearch} onChange={e => setFormState({...formState, productSearch: e.target.value, selectedProduct: null, isNewProduct: false})} onKeyDown={handleProductKeyDown} placeholder="Type to search..." className={formInputStyle} autoComplete="off" />
                    {filteredProductSuggestions.length > 0 && (
                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-700 border shadow-lg rounded max-h-48 overflow-y-auto">
                            {filteredProductSuggestions.map((p, idx) => (
                                <li key={p.id} onClick={() => handleSelectProduct(p)} className={`p-2 cursor-pointer text-slate-800 dark:text-slate-200 transition-colors ${idx === activeProductIndex ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-indigo-50 dark:hover:bg-slate-600'}`}>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-[10px] opacity-70 uppercase">{p.company}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button type="button" onClick={() => setFormState({...getInitialFormState(), isNewProduct: true})} className="w-full h-10 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-md font-bold transition-all hover:bg-emerald-200">Add New Product</button>
            </div>
            {formState.isNewProduct && (
                 <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded border border-emerald-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <input name="productName" value={formState.productName} onChange={e => setFormState({...formState, productName: e.target.value})} placeholder="Product Name*" className={formInputStyle} required />
                        <div className="relative">
                            <input 
                                name="company" 
                                list="purchase-company-list"
                                value={formState.company} 
                                onChange={e => setFormState({...formState, company: e.target.value})} 
                                placeholder="Company*" 
                                className={formInputStyle} 
                                required 
                                autoComplete="off"
                            />
                            <datalist id="purchase-company-list">
                                {companies.map(c => <option key={c.id} value={c.name} />)}
                            </datalist>
                        </div>
                        <input name="hsnCode" value={formState.hsnCode} onChange={e => setFormState({...formState, hsnCode: e.target.value})} placeholder="HSN Code" className={formInputStyle} />
                        <select name="gst" value={formState.gst} onChange={e => setFormState({...formState, gst: e.target.value, tax: e.target.value})} className={formSelectStyle}>{sortedGstRates.map(r => <option key={r.id} value={r.rate}>GST {r.rate}%</option>)}</select>
                    </div>
                </div>
            )}
            {(formState.selectedProduct || formState.isNewProduct) && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
                    <div className="flex gap-1 md:col-span-2">
                        <input name="barcode" value={formState.barcode} onChange={e => setFormState({...formState, barcode: e.target.value})} placeholder="Barcode" className={formInputStyle} />
                        <button type="button" onClick={() => setScannerOpen(true)} className="p-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors" title="Scan Barcode"><CameraIcon className="h-5 w-5" /></button>
                    </div>
                    {isPharmaMode && <input name="batchNumber" value={formState.batchNumber} onChange={e => setFormState({...formState, batchNumber: e.target.value})} placeholder="Batch No.*" className={formInputStyle} required />}
                    {isPharmaMode && <input name="expiryDate" value={formState.expiryDate} onChange={e => setFormState({...formState, expiryDate: e.target.value})} type="month" className={formInputStyle} required />}
                    <input name="quantity" value={formState.quantity} onChange={e => setFormState({...formState, quantity: e.target.value})} type="number" placeholder="Qty*" className={formInputStyle} required />
                    <input name="purchasePrice" value={formState.purchasePrice} onChange={e => setFormState({...formState, purchasePrice: e.target.value})} type="number" placeholder="Price*" className={formInputStyle} required step="0.01" />
                    <input name="discount" value={formState.discount} onChange={e => setFormState({...formState, discount: e.target.value})} type="number" placeholder="Disc%" className={formInputStyle} step="0.01" />
                    <input name="mrp" value={formState.mrp} onChange={e => setFormState({...formState, mrp: e.target.value})} type="number" placeholder="MRP*" className={formInputStyle} required step="0.01" />
                    <button type="submit" className="bg-indigo-600 text-white rounded-lg px-4 py-2 font-bold shadow hover:bg-indigo-700 transition-colors md:col-span-2 lg:col-span-1">{itemToEdit ? 'Update' : 'Add'}</button>
                </div>
            )}
            <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} onScanSuccess={(code) => { setFormState({...formState, barcode: code}); setScannerOpen(false); }} />
        </form>
    );
};

const Purchases: React.FC<PurchasesProps> = ({ products, purchases, companies, suppliers, systemConfig, gstRates, onAddPurchase, onUpdatePurchase, onDeletePurchase, onAddSupplier, onUpdateConfig, editingPurchase, onCancelEdit, isSubscriptionExpired }) => {
    const initialFormState = { supplierName: '', invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0], currentItems: [] as PurchaseLineItem[], roundOff: 0 };
    const [formState, setFormState] = useState(initialFormState);
    const [localEditingPurchase, setLocalEditingPurchase] = useState<Purchase | null>(null);
    const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
    const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isOcrPreviewOpen, setIsOcrPreviewOpen] = useState(false);
    const [ocrData, setOcrData] = useState<{ supplierName: string; invoiceNumber: string; invoiceDate: string; supplierGstin?: string; supplierAddress?: string; items: PurchaseLineItem[]; }>({ supplierName: '', invoiceNumber: '', invoiceDate: '', items: [] });
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [editingLineItem, setEditingLineItem] = useState<PurchaseLineItem | null>(null);

    // Keyboard navigation state for Supplier search
    const [activeSupplierIndex, setActiveSupplierIndex] = useState(-1);

    const isAiDisabledByPlan = useMemo(() => {
        return (systemConfig.subscription?.planType || 'Free') === 'Free';
    }, [systemConfig]);

    const filteredSupplierSuggestions = useMemo(() => {
        if (!formState.supplierName || !showSupplierSuggestions) return [];
        return suppliers.filter(s => s.name.toLowerCase().includes(formState.supplierName.toLowerCase())).slice(0, 5);
    }, [formState.supplierName, showSupplierSuggestions, suppliers]);

    useEffect(() => {
        if (formState.supplierName) setActiveSupplierIndex(-1);
    }, [formState.supplierName]);

    useEffect(() => { if (editingPurchase) setLocalEditingPurchase(editingPurchase); }, [editingPurchase]);
    useEffect(() => {
        if (localEditingPurchase) {
            setFormState({ supplierName: localEditingPurchase.supplier, invoiceNumber: localEditingPurchase.invoiceNumber, invoiceDate: new Date(localEditingPurchase.invoiceDate).toISOString().split('T')[0], currentItems: localEditingPurchase.items || [], roundOff: localEditingPurchase.roundOff || 0 });
            window.scrollTo(0, 0);
        } else { setFormState(initialFormState); }
    }, [localEditingPurchase]);

    const itemsTotal = useMemo(() => {
        return formState.currentItems.reduce((sum, item) => {
            const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
            const tax = itemTotal * (item.gst / 100);
            return sum + itemTotal + tax;
        }, 0);
    }, [formState.currentItems]);

    const grandTotal = useMemo(() => {
        return itemsTotal + (formState.roundOff || 0);
    }, [itemsTotal, formState.roundOff]);

    const autoRoundOff = () => {
        const rounded = Math.round(itemsTotal);
        setFormState(prev => ({ ...prev, roundOff: rounded - itemsTotal }));
    };

    const handleAiScanClick = () => {
        if (isAiDisabledByPlan) {
            setShowUpgradeModal(true);
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setIsProcessingOCR(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                try {
                    await analyzeInvoiceWithGemini(base64Data, file.type);
                } catch (e) {
                    alert("Analysis failed. Please check your internet or try another file.");
                    setIsProcessingOCR(false);
                }
            };
            reader.onerror = () => {
                alert("File read error.");
                setIsProcessingOCR(false);
            };
            reader.readAsDataURL(file);
        } catch (e) { 
            alert("Analysis failed"); 
            setIsProcessingOCR(false);
        }
    };

    const analyzeInvoiceWithGemini = async (base64Data: string, mimeType: string) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // REFINED INVOICE PROMPT FOR PART NUMBERS
        const prompt = `Analyze this purchase invoice with high precision. 
        Extract: Supplier Name, Supplier GSTIN, Supplier Address, Invoice Number, Invoice Date (YYYY-MM-DD), and Line Items.
        
        For each line item, capture accurately:
        1. Product Description / Name.
        2. Technical Code / Part Number / SKU / Barcode numeric string if printed in its own column or as part of description.
        3. HSN.
        4. Batch Number.
        5. Expiry Date (YYYY-MM).
        6. Qty, Rate, MRP, Tax%, and Discount%.
        
        Return JSON object with fields: supplierName, supplierGstin, supplierAddress, invoiceNumber, invoiceDate, and items (array of objects).`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        supplierName: { type: Type.STRING },
                        supplierGstin: { type: Type.STRING },
                        supplierAddress: { type: Type.STRING },
                        invoiceNumber: { type: Type.STRING },
                        invoiceDate: { type: Type.STRING },
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    productName: { type: Type.STRING },
                                    technicalCode: { type: Type.STRING },
                                    hsnCode: { type: Type.STRING },
                                    batchNumber: { type: Type.STRING },
                                    expiryDate: { type: Type.STRING },
                                    quantity: { type: Type.NUMBER },
                                    rate: { type: Type.NUMBER },
                                    mrp: { type: Type.NUMBER },
                                    gst: { type: Type.NUMBER },
                                    discount: { type: Type.NUMBER }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        setIsProcessingOCR(false); 

        if (response.text) {
            const res = JSON.parse(response.text);
            setOcrData({
                supplierName: res.supplierName || '',
                supplierGstin: res.supplierGstin || '',
                supplierAddress: res.supplierAddress || '',
                invoiceNumber: res.invoiceNumber || '',
                invoiceDate: res.invoiceDate || new Date().toISOString().split('T')[0],
                items: (res.items || []).map((i: any) => {
                    const normCode = i.technicalCode ? normalizeCode(i.technicalCode) : "";
                    const matchingProduct = products.find(p => 
                        (normCode !== "" && normalizeCode(p.barcode) === normCode) ||
                        p.name.toLowerCase() === i.productName?.toLowerCase()
                    );

                    return {
                        isNewProduct: !matchingProduct,
                        productId: matchingProduct?.id,
                        productName: i.productName || 'Unknown',
                        barcode: i.technicalCode || '', // Map technical code to barcode field
                        company: res.supplierName || 'General',
                        hsnCode: i.hsnCode || '',
                        gst: i.gst || 12,
                        batchNumber: i.batchNumber || (isPharmaMode ? 'BATCH' : 'DEFAULT'),
                        expiryDate: i.expiryDate || '2025-12',
                        quantity: i.quantity || 1,
                        mrp: i.mrp || i.rate || 0,
                        purchasePrice: i.rate || 0,
                        discount: i.discount || 0
                    };
                })
            });
            setIsOcrPreviewOpen(true);
            onUpdateConfig({ ...systemConfig, aiInvoiceUsageCount: (systemConfig.aiInvoiceUsageCount || 0) + 1 });
        }
    };

    const handleSavePurchase = () => {
        if (isSubscriptionExpired) { alert("Your subscription has expired. Please renew to continue entering purchases."); return; }
        if (!formState.supplierName || !formState.invoiceNumber || formState.currentItems.length === 0) { alert('Fill mandatory fields'); return; }
        const purchaseData = { supplier: formState.supplierName, invoiceNumber: formState.invoiceNumber, invoiceDate: formState.invoiceDate, items: formState.currentItems, roundOff: formState.roundOff };
        if (localEditingPurchase) onUpdatePurchase(localEditingPurchase.id, purchaseData as any, localEditingPurchase);
        else onAddPurchase(purchaseData as any);
        setLocalEditingPurchase(null); setFormState(initialFormState);
    };

    const onImportData = (data: any) => {
        const newItems = [...formState.currentItems, ...data.items];
        const tempTotal = newItems.reduce((sum, item) => {
            const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
            const tax = itemTotal * (item.gst / 100);
            return sum + itemTotal + tax;
        }, 0);
        const autoRound = Math.round(tempTotal) - tempTotal;
        setFormState(prev => ({
            ...prev,
            supplierName: data.supplierName || prev.supplierName,
            invoiceNumber: data.invoiceNumber || prev.invoiceNumber,
            invoiceDate: data.invoiceDate || prev.invoiceDate,
            currentItems: newItems,
            roundOff: autoRound 
        }));
    };

    const handleEditLineItem = (item: PurchaseLineItem, index: number) => {
        setEditingLineItem(item);
        setFormState(prev => ({
            ...prev,
            currentItems: prev.currentItems.filter((_, i) => i !== index)
        }));
        window.scrollTo({ top: 150, behavior: 'smooth' });
    };

    const handleSupplierKeyDown = (e: React.KeyboardEvent) => {
        // Range: 0 to suggestions.length (for the 'Add New' option)
        const totalItems = filteredSupplierSuggestions.length + 1; 

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSupplierIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSupplierIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSupplierIndex >= 0 && activeSupplierIndex < filteredSupplierSuggestions.length) {
                setFormState({...formState, supplierName: filteredSupplierSuggestions[activeSupplierIndex].name});
                setShowSupplierSuggestions(false);
                setActiveSupplierIndex(-1);
            } else if (activeSupplierIndex === filteredSupplierSuggestions.length || (formState.supplierName && filteredSupplierSuggestions.length === 0)) {
                // If 'Add New' is selected or Enter pressed on an empty suggestion list with input text
                setSupplierModalOpen(true);
                setShowSupplierSuggestions(false);
                setActiveSupplierIndex(-1);
            }
        } else if (e.key === 'Escape') {
            setShowSupplierSuggestions(false);
            setActiveSupplierIndex(-1);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 relative">
            {isProcessingOCR && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4 text-center border-4 border-indigo-500">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            <CloudIcon className="h-8 w-8 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">AI is Working</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Reading your invoice and extracting items. Please wait a moment...</p>
                        </div>
                    </div>
                </div>
            )}

            <Card title={<div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <span>{localEditingPurchase ? 'Edit Purchase' : 'New Purchase Entry'}</span>
                {!isSubscriptionExpired && (
                    <div className="flex gap-2">
                        <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        <button 
                            onClick={handleAiScanClick} 
                            disabled={isProcessingOCR} 
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold text-sm ${isAiDisabledByPlan ? 'bg-slate-100 text-slate-400 border border-slate-300 grayscale' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {isProcessingOCR ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> : <UploadIcon className="h-5 w-5" />} 
                            AI Auto-Fill (Scan)
                        </button>
                    </div>
                )}
            </div>}>
                {isSubscriptionExpired ? (
                    <div className="p-8 text-center bg-rose-50 dark:bg-rose-900/10 border-2 border-dashed border-rose-300 dark:border-rose-800 rounded-2xl">
                        <div className="inline-block p-4 bg-rose-100 dark:bg-rose-900/40 rounded-full mb-4">
                            <CloudIcon className="h-12 w-12 text-rose-600" />
                        </div>
                        <h3 className="text-xl font-black text-rose-700 dark:text-rose-400 uppercase tracking-tighter">Account Blocked</h3>
                        <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
                            Subscription expired. Purchase entries are disabled until the account is renewed.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Supplier</label>
                                <input value={formState.supplierName} onChange={e => setFormState({...formState, supplierName: e.target.value})} onFocus={() => setShowSupplierSuggestions(true)} onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)} onKeyDown={handleSupplierKeyDown} placeholder="Supplier Name*" className={formInputStyle} required autoComplete="off" />
                                {showSupplierSuggestions && (formState.supplierName || filteredSupplierSuggestions.length > 0) && (
                                    <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-700 border rounded shadow-lg max-h-48 overflow-y-auto">
                                        {filteredSupplierSuggestions.map((s, idx) => (
                                            <li key={s.id} onClick={() => setFormState({...formState, supplierName: s.name})} className={`p-2 cursor-pointer text-slate-800 dark:text-slate-200 transition-colors ${idx === activeSupplierIndex ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-indigo-50 dark:hover:bg-slate-600'}`}>
                                                {s.name}
                                            </li>
                                        ))}
                                        <li 
                                            onClick={() => setSupplierModalOpen(true)} 
                                            className={`p-2 text-indigo-600 font-bold border-t cursor-pointer transition-colors ${activeSupplierIndex === filteredSupplierSuggestions.length ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                        >
                                            + Add New Supplier
                                        </li>
                                    </ul>
                                )}
                            </div>
                            <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Inv #</label><input value={formState.invoiceNumber} onChange={e => setFormState({...formState, invoiceNumber: e.target.value})} placeholder="Invoice Number*" className={formInputStyle} required /></div>
                            <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date</label><input value={formState.invoiceDate} onChange={e => setFormState({...formState, invoiceDate: e.target.value})} type="date" className={formInputStyle} required /></div>
                        </div>

                        <AddItemForm 
                            products={products} 
                            onAddItem={item => { 
                                setFormState(prev => ({...prev, currentItems: [...prev.currentItems, item]}));
                                setEditingLineItem(null);
                            }} 
                            itemToEdit={editingLineItem}
                            companies={companies} 
                            systemConfig={systemConfig} 
                            gstRates={gstRates} 
                        />
                        
                        {formState.currentItems.length > 0 && (
                            <div className="mt-8 space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <AdjustmentsIcon className="h-5 w-5 text-indigo-500" />
                                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Items in Current Purchase</h4>
                                </div>
                                <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner bg-[#1e293b]/20">
                                    <table className="w-full text-[12px] text-left border-collapse">
                                        <thead className="bg-[#1e293b] text-slate-300 uppercase text-[9px] font-black tracking-widest">
                                            <tr>
                                                <th className="px-4 py-4 min-w-[200px]">PRODUCT</th>
                                                <th className="px-4 py-4 text-center">HSN</th>
                                                <th className="px-4 py-4 text-center">QTY</th>
                                                <th className="px-4 py-4 text-right">RATE</th>
                                                <th className="px-4 py-4 text-center">DISC (%)</th>
                                                <th className="px-4 py-4 text-center">TAX (%)</th>
                                                <th className="px-4 py-4 text-right">TOTAL</th>
                                                <th className="px-4 py-4 text-center">ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700 bg-white dark:bg-slate-800">
                                            {formState.currentItems.map((item, idx) => {
                                                const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
                                                const lineTotal = itemTotal * (1 + (item.gst || 0) / 100);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                                                            {item.productName}
                                                            {isPharmaMode && <div className="text-[9px] text-slate-500 font-normal uppercase mt-0.5">B: {item.batchNumber} / EXP: {item.expiryDate}</div>}
                                                            {item.barcode && <div className="text-[8px] text-indigo-400 font-mono mt-0.5 uppercase">Barcode: {item.barcode}</div>}
                                                            <div className="text-[8px] text-slate-400 uppercase font-medium">Company: {item.company}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{item.hsnCode || '-'}</td>
                                                        <td className="px-4 py-3 text-center text-slate-800 dark:text-slate-200 font-bold">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-right text-slate-800 dark:text-slate-200">₹{item.purchasePrice.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{item.discount || 0}%</td>
                                                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{item.gst}%</td>
                                                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/20">₹{lineTotal.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center gap-3">
                                                                <button 
                                                                    onClick={() => handleEditLineItem(item, idx)} 
                                                                    className="text-blue-500 hover:text-blue-700 transition-colors"
                                                                    title="Edit Item"
                                                                >
                                                                    <PencilIcon className="h-4 w-4" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => setFormState(prev => ({...prev, currentItems: prev.currentItems.filter((_, i) => i !== idx)}))} 
                                                                    className="text-rose-500 hover:text-rose-700 transition-colors"
                                                                    title="Remove Item"
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-col items-end gap-3 pr-4">
                                    <div className="flex items-center gap-8 text-sm font-bold text-slate-500">
                                        <span>Items Total:</span>
                                        <span className="w-32 text-right text-slate-800 dark:text-slate-200">₹{itemsTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
                                        <span>Round Off:</span>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={formState.roundOff.toFixed(2)} 
                                                onChange={e => setFormState({...formState, roundOff: parseFloat(e.target.value) || 0})}
                                                className="w-24 p-1.5 text-right bg-slate-100 dark:bg-slate-700 border dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 font-bold"
                                            />
                                            <button 
                                                onClick={autoRoundOff}
                                                className="px-4 py-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded font-black text-[11px] uppercase tracking-tighter hover:bg-indigo-200 transition-all border border-indigo-200 dark:border-indigo-800 shadow-sm"
                                            >
                                                Auto
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8 mt-2">
                                        <span className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter">Grand Total:</span>
                                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 w-32 text-right">₹{grandTotal.toFixed(2)}</span>
                                    </div>

                                    <button 
                                        onClick={handleSavePurchase} 
                                        className="mt-6 w-full sm:w-64 bg-emerald-600 text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all transform active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <CheckCircleIcon className="h-6 w-6" /> Save Purchase
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>

            <Card title="Recent Purchase Invoices">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 uppercase text-xs font-bold text-slate-600 dark:text-slate-400"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Invoice #</th><th className="px-6 py-3">Supplier</th><th className="px-6 py-3 text-right">Total Amount</th><th className="px-6 py-3 text-center">Actions</th></tr></thead>
                        <tbody className="divide-y dark:divide-slate-700">{purchases.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="px-6 py-4 text-slate-700 dark:text-slate-300">{new Date(p.invoiceDate).toLocaleDateString()}</td><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{p.invoiceNumber}</td><td className="px-6 py-4 text-slate-700 dark:text-slate-300">{p.supplier}</td><td className="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-400">₹{p.totalAmount.toFixed(2)}</td><td className="px-6 py-4 text-center"><div className="flex justify-center gap-3"><button onClick={() => setLocalEditingPurchase(p)} className="text-blue-600 hover:text-blue-800 transition-colors"><PencilIcon className="h-5 w-5" /></button><button onClick={() => onDeletePurchase(p)} className="text-rose-600 hover:text-rose-800 transition-colors"><TrashIcon className="h-5 w-5" /></button></div></td></tr>
                        ))}</tbody>
                    </table>
                </div>
            </Card>
            <OcrPreviewModal isOpen={isOcrPreviewOpen} onClose={() => setIsOcrPreviewOpen(false)} data={ocrData} suppliers={suppliers} onImport={onImportData} isPharmaMode={isPharmaMode} />
            <AddSupplierModal isOpen={isSupplierModalOpen} onClose={() => setSupplierModalOpen(false)} onAddSupplier={onAddSupplier} initialName={formState.supplierName} />
            <UpgradeQuotaModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
        </div>
    );
};

export default Purchases;