import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, PurchaseLineItem, Company, Supplier, SystemConfig, GstRate, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BarcodeIcon, CameraIcon, UploadIcon, CheckCircleIcon, AdjustmentsIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';
import { GoogleGenAI, Type } from "@google/genai";

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
}

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

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";
const formSelectStyle = `${formInputStyle} appearance-none`;

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

const PremiumModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const upiId = "9890072651@upi";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("M. Soft India")}&am=5000&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade to Premium">
        <div className="flex flex-col items-center text-center space-y-6 p-4">
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-bold shadow-sm">Free Limit Reached</div>
            <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Unlock Unlimited AI Invoices</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">Automate your purchase entry with AI. Upgrade now to enjoy unlimited auto-fills.</p>
            </div>
            <div className="border-2 border-indigo-500 rounded-2xl p-6 bg-white shadow-xl transform transition-transform hover:scale-105">
                <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 mx-auto mb-4" />
                <p className="font-bold text-2xl text-indigo-700">₹5,000 <span className="text-sm font-normal text-slate-500">/ Year</span></p>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-medium text-slate-700 dark:text-slate-300">Scan to pay via UPI</p>
                <p>After payment, contact support to activate.</p>
                <p className="font-bold text-lg text-slate-800 dark:text-slate-200 mt-2">WhatsApp: 9890072651</p>
            </div>
            <button onClick={onClose} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-8 py-3 rounded-lg font-semibold hover:bg-slate-300 transition-colors w-full sm:w-auto">Close</button>
        </div>
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
    useEffect(() => { if (isOpen) { setSupplierName(data.supplierName); setSupplierGstin(data.supplierGstin || ''); setSupplierAddress(data.supplierAddress || ''); setInvoiceNumber(data.invoiceNumber); setInvoiceDate(data.invoiceDate); setItems(data.items.map(i => ({ ...i, selected: true }))); } }, [isOpen, data]);
    const handleItemChange = (index: number, field: keyof PurchaseLineItem, value: any) => { setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item)); };
    const handleImport = () => { onImport({ supplierName, supplierGstin, supplierAddress, invoiceNumber, invoiceDate, items: items.filter(i => i.selected).map(({ selected, ...rest }) => rest) }); onClose(); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Verify Extracted Data" maxWidth="max-w-6xl">
            <div className="space-y-4">
                <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Supplier</label><input value={supplierName} onChange={e => setSupplierName(e.target.value)} className={formInputStyle} list="supplier-list-ocr" /><datalist id="supplier-list-ocr">{suppliers.map(s => <option key={s.id} value={s.name} />)}</datalist></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Inv #</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={formInputStyle} /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Date</label><input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={formInputStyle} /></div>
                    </div>
                </div>
                <div className="overflow-x-auto border dark:border-slate-700 rounded-lg max-h-[50vh]">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700 uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-3 w-8 text-center"><input type="checkbox" checked={items.every(i => i.selected)} onChange={e => setItems(prev => prev.map(i => ({...i, selected: e.target.checked})))} /></th>
                                <th className="px-2 py-3">Product Name</th>
                                <th className="px-2 py-3 w-20">Qty</th>
                                <th className="px-2 py-3 w-24 text-right">Rate</th>
                                <th className="px-2 py-3 w-24 text-right">Total</th>
                                <th className="px-2 py-3 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} className={!item.selected ? 'opacity-50' : ''}>
                                    <td className="px-2 py-2 text-center"><input type="checkbox" checked={item.selected} onChange={() => setItems(prev => prev.map((it, i) => i === index ? { ...it, selected: !it.selected } : it))} /></td>
                                    <td className="px-2 py-2"><input value={item.productName} onChange={e => handleItemChange(index, 'productName', e.target.value)} className="w-full bg-transparent border-b focus:outline-none" /></td>
                                    <td className="px-2 py-2"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent border-b" /></td>
                                    <td className="px-2 py-2"><input type="number" value={item.purchasePrice} onChange={e => handleItemChange(index, 'purchasePrice', parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent border-b" /></td>
                                    <td className="px-2 py-2 text-right font-bold">{(item.quantity * item.purchasePrice).toFixed(2)}</td>
                                    <td className="px-2 py-2"><button onClick={() => setItems(prev => prev.filter((_, i) => i !== index))} className="text-red-500"><TrashIcon className="h-4 w-4"/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-lg">Cancel</button>
                    <button onClick={handleImport} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow hover:bg-emerald-700 flex items-center gap-2"><CheckCircleIcon className="h-5 w-5" /> Import Data</button>
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
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeItemRef = useRef<HTMLLIElement>(null);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [isScanning, setIsScanning] = useState(false);
    useEffect(() => { if (itemToEdit) { const existingProduct = itemToEdit.productId ? products.find(p => p.id === itemToEdit.productId) : null; setFormState({ isNewProduct: itemToEdit.isNewProduct, productSearch: itemToEdit.productName, selectedProduct: existingProduct || null, productName: itemToEdit.productName, company: itemToEdit.company, hsnCode: itemToEdit.hsnCode, gst: String(itemToEdit.gst), composition: itemToEdit.composition || '', unitsPerStrip: String(itemToEdit.unitsPerStrip || ''), isScheduleH: itemToEdit.isScheduleH ? 'Yes' : 'No', batchNumber: itemToEdit.batchNumber, expiryDate: itemToEdit.expiryDate, quantity: String(itemToEdit.quantity), mrp: String(itemToEdit.mrp), purchasePrice: String(itemToEdit.purchasePrice), barcode: itemToEdit.barcode || '', discount: itemToEdit.discount ? String(itemToEdit.discount) : '', tax: String(itemToEdit.gst) }); } }, [itemToEdit, products]);
    const companySuggestions = useMemo(() => formState.company ? companies.filter(c => c.name.toLowerCase().includes(formState.company.toLowerCase())) : companies.slice(0, 5), [formState.company, companies]);
    const handleSelectProduct = (product: Product) => { setFormState(prev => ({ ...prev, selectedProduct: product, productSearch: product.name, productName: product.name, company: product.company, hsnCode: product.hsnCode, gst: String(product.gst), tax: String(product.gst), unitsPerStrip: String(product.unitsPerStrip || ''), isScheduleH: product.isScheduleH ? 'Yes' : 'No', isNewProduct: false, })); setActiveIndex(-1); };
    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const { isNewProduct, selectedProduct, productName, company, hsnCode, gst, batchNumber, expiryDate, quantity, mrp, purchasePrice, discount, tax } = formState;
        if (isNewProduct && (!productName || !company)) { alert('Name and Company required.'); return; }
        const item: PurchaseLineItem = { isNewProduct, productName: isNewProduct ? productName : selectedProduct!.name, company: company.trim(), hsnCode: isNewProduct ? hsnCode : selectedProduct!.hsnCode, gst: parseFloat(tax) || parseFloat(gst) || 0, batchNumber: isPharmaMode ? batchNumber : 'DEFAULT', expiryDate: isPharmaMode ? expiryDate : '9999-12', quantity: parseInt(quantity, 10), mrp: parseFloat(mrp), purchasePrice: parseFloat(purchasePrice), discount: parseFloat(discount) || 0 };
        if (!isNewProduct && selectedProduct) item.productId = selectedProduct.id;
        onAddItem(item);
        setFormState(getInitialFormState());
    };
    return (
        <form onSubmit={handleAddItem} className={`p-4 my-4 space-y-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg border dark:border-slate-700 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 relative">
                    <label className="block text-sm font-medium mb-1">Search Product</label>
                    <input type="text" name="productSearch" value={formState.productSearch} onChange={e => setFormState({...formState, productSearch: e.target.value, selectedProduct: null, isNewProduct: false})} placeholder="Type to search..." className={formInputStyle} />
                    {formState.productSearch && !formState.selectedProduct && products.filter(p => p.name.toLowerCase().includes(formState.productSearch.toLowerCase())).length > 0 && (
                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-700 border shadow-lg rounded max-h-48 overflow-y-auto">
                            {products.filter(p => p.name.toLowerCase().includes(formState.productSearch.toLowerCase())).slice(0, 5).map(p => (
                                <li key={p.id} onClick={() => handleSelectProduct(p)} className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900 cursor-pointer">{p.name} ({p.company})</li>
                            ))}
                        </ul>
                    )}
                </div>
                <button type="button" onClick={() => setFormState({...getInitialFormState(), isNewProduct: true})} className="w-full h-10 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-md font-bold">Add New Product</button>
            </div>
            {formState.isNewProduct && (
                 <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded border border-emerald-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <input name="productName" value={formState.productName} onChange={e => setFormState({...formState, productName: e.target.value})} placeholder="Product Name*" className={formInputStyle} required />
                        <input name="company" value={formState.company} onChange={e => setFormState({...formState, company: e.target.value})} placeholder="Company*" className={formInputStyle} required />
                        <input name="hsnCode" value={formState.hsnCode} onChange={e => setFormState({...formState, hsnCode: e.target.value})} placeholder="HSN Code" className={formInputStyle} />
                        <select name="gst" value={formState.gst} onChange={e => setFormState({...formState, gst: e.target.value, tax: e.target.value})} className={formSelectStyle}>{sortedGstRates.map(r => <option key={r.id} value={r.rate}>GST {r.rate}%</option>)}</select>
                    </div>
                </div>
            )}
            {(formState.selectedProduct || formState.isNewProduct) && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {isPharmaMode && <input name="batchNumber" value={formState.batchNumber} onChange={e => setFormState({...formState, batchNumber: e.target.value})} placeholder="Batch No.*" className={formInputStyle} required />}
                    {isPharmaMode && <input name="expiryDate" value={formState.expiryDate} onChange={e => setFormState({...formState, expiryDate: e.target.value})} type="month" className={formInputStyle} required />}
                    <input name="quantity" value={formState.quantity} onChange={e => setFormState({...formState, quantity: e.target.value})} type="number" placeholder="Qty*" className={formInputStyle} required />
                    <input name="purchasePrice" value={formState.purchasePrice} onChange={e => setFormState({...formState, purchasePrice: e.target.value})} type="number" placeholder="Price*" className={formInputStyle} required step="0.01" />
                    <input name="mrp" value={formState.mrp} onChange={e => setFormState({...formState, mrp: e.target.value})} type="number" placeholder="MRP*" className={formInputStyle} required step="0.01" />
                    <button type="submit" className="bg-indigo-600 text-white rounded-lg px-4 py-2 font-bold shadow hover:bg-indigo-700 transition-colors">Add to List</button>
                </div>
            )}
        </form>
    );
};

const Purchases: React.FC<PurchasesProps> = ({ products, purchases, suppliers, systemConfig, gstRates, onAddPurchase, onUpdatePurchase, onDeletePurchase, onAddSupplier, onUpdateConfig, editingPurchase, onCancelEdit }) => {
    const initialFormState = { supplierName: '', invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0], currentItems: [] as PurchaseLineItem[], roundOff: 0 };
    const [formState, setFormState] = useState(initialFormState);
    const [localEditingPurchase, setLocalEditingPurchase] = useState<Purchase | null>(null);
    const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
    const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isOcrPreviewOpen, setIsOcrPreviewOpen] = useState(false);
    const [ocrData, setOcrData] = useState<{ supplierName: string; invoiceNumber: string; invoiceDate: string; items: PurchaseLineItem[]; }>({ supplierName: '', invoiceNumber: '', invoiceDate: '', items: [] });
    const [showPremiumModal, setShowPremiumModal] = useState(false);

    useEffect(() => { if (editingPurchase) setLocalEditingPurchase(editingPurchase); }, [editingPurchase]);
    useEffect(() => {
        if (localEditingPurchase) {
            setFormState({ supplierName: localEditingPurchase.supplier, invoiceNumber: localEditingPurchase.invoiceNumber, invoiceDate: new Date(localEditingPurchase.invoiceDate).toISOString().split('T')[0], currentItems: localEditingPurchase.items || [], roundOff: localEditingPurchase.roundOff || 0 });
            window.scrollTo(0, 0);
        } else { setFormState(initialFormState); }
    }, [localEditingPurchase]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!systemConfig.subscription?.isPremium && (systemConfig.aiInvoiceUsageCount || 0) >= (systemConfig.aiInvoiceQuota || 5)) { setShowPremiumModal(true); return; }
        setIsProcessingOCR(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                await analyzeInvoiceWithGemini(base64Data, file.type);
            };
        } catch (e) { alert("Analysis failed"); } finally { setIsProcessingOCR(false); }
    };

    const analyzeInvoiceWithGemini = async (base64Data: string, mimeType: string) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Analyze this purchase invoice. Extract: Supplier Name, Invoice Number, Invoice Date (YYYY-MM-DD), and Line Items (Product Name, HSN, Batch, Expiry YYYY-MM, Qty, Rate, MRP, Tax %).`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        supplierName: { type: Type.STRING },
                        invoiceNumber: { type: Type.STRING },
                        invoiceDate: { type: Type.STRING },
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    productName: { type: Type.STRING },
                                    hsnCode: { type: Type.STRING },
                                    batchNumber: { type: Type.STRING },
                                    expiryDate: { type: Type.STRING },
                                    quantity: { type: Type.NUMBER },
                                    rate: { type: Type.NUMBER },
                                    mrp: { type: Type.NUMBER },
                                    gst: { type: Type.NUMBER }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (response.text) {
            const res = JSON.parse(response.text);
            setOcrData({
                supplierName: res.supplierName || '',
                invoiceNumber: res.invoiceNumber || '',
                invoiceDate: res.invoiceDate || new Date().toISOString().split('T')[0],
                items: (res.items || []).map((i: any) => ({
                    isNewProduct: !products.some(p => p.name.toLowerCase() === i.productName?.toLowerCase()),
                    productName: i.productName || 'Unknown',
                    company: res.supplierName || 'General',
                    hsnCode: i.hsnCode || '',
                    gst: i.gst || 12,
                    batchNumber: i.batchNumber || (isPharmaMode ? 'BATCH' : 'DEFAULT'),
                    expiryDate: i.expiryDate || '2025-12',
                    quantity: i.quantity || 1,
                    mrp: i.mrp || i.rate || 0,
                    purchasePrice: i.rate || 0
                }))
            });
            setIsOcrPreviewOpen(true);
            onUpdateConfig({ ...systemConfig, aiInvoiceUsageCount: (systemConfig.aiInvoiceUsageCount || 0) + 1 });
        }
    };

    const handleSavePurchase = () => {
        if (!formState.supplierName || !formState.invoiceNumber || formState.currentItems.length === 0) { alert('Fill mandatory fields'); return; }
        const purchaseData = { supplier: formState.supplierName, invoiceNumber: formState.invoiceNumber, invoiceDate: formState.invoiceDate, items: formState.currentItems, roundOff: formState.roundOff };
        if (localEditingPurchase) onUpdatePurchase(localEditingPurchase.id, purchaseData as any, localEditingPurchase);
        else onAddPurchase(purchaseData as any);
        setLocalEditingPurchase(null); setFormState(initialFormState);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title={<div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <span>{localEditingPurchase ? 'Edit Purchase' : 'New Purchase Entry'}</span>
                <div className="flex gap-2">
                    <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingOCR} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-all">
                        {isProcessingOCR ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> : <UploadIcon className="h-5 w-5" />} AI Auto-Fill
                    </button>
                </div>
            </div>}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <label className="block text-sm font-medium mb-1">Supplier</label>
                        <input value={formState.supplierName} onChange={e => setFormState({...formState, supplierName: e.target.value})} onFocus={() => setShowSupplierSuggestions(true)} onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)} placeholder="Supplier Name*" className={formInputStyle} required />
                        {showSupplierSuggestions && formState.supplierName && (
                            <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-700 border rounded shadow-lg max-h-48 overflow-y-auto">
                                {suppliers.filter(s => s.name.toLowerCase().includes(formState.supplierName.toLowerCase())).map(s => <li key={s.id} onClick={() => setFormState({...formState, supplierName: s.name})} className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900 cursor-pointer">{s.name}</li>)}
                                <li onClick={() => setSupplierModalOpen(true)} className="p-2 text-indigo-600 font-bold border-t cursor-pointer">+ Add New Supplier</li>
                            </ul>
                        )}
                    </div>
                    <div><label className="block text-sm font-medium mb-1">Inv #</label><input value={formState.invoiceNumber} onChange={e => setFormState({...formState, invoiceNumber: e.target.value})} placeholder="Invoice Number*" className={formInputStyle} required /></div>
                    <div><label className="block text-sm font-medium mb-1">Date</label><input value={formState.invoiceDate} onChange={e => setFormState({...formState, invoiceDate: e.target.value})} type="date" className={formInputStyle} required /></div>
                </div>
                <AddItemForm products={products} onAddItem={item => setFormState(prev => ({...prev, currentItems: [...prev.currentItems, item]}))} companies={[]} systemConfig={systemConfig} gstRates={gstRates} />
                {formState.currentItems.length > 0 && (
                    <div className="mt-4 space-y-4">
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 uppercase text-xs"><tr><th className="px-4 py-2">Product</th><th className="px-4 py-2 text-center">Qty</th><th className="px-4 py-2 text-right">Rate</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-center">Action</th></tr></thead>
                                <tbody>{formState.currentItems.map((item, idx) => (
                                    <tr key={idx} className="border-b dark:border-slate-700"><td className="px-4 py-2 font-medium">{item.productName}</td><td className="px-4 py-2 text-center">{item.quantity}</td><td className="px-4 py-2 text-right">₹{item.purchasePrice.toFixed(2)}</td><td className="px-4 py-2 text-right">₹{(item.quantity * item.purchasePrice).toFixed(2)}</td><td className="px-4 py-2 text-center"><button onClick={() => setFormState(prev => ({...prev, currentItems: prev.currentItems.filter((_, i) => i !== idx)}))} className="text-red-500"><TrashIcon className="h-4 w-4" /></button></td></tr>
                                ))}</tbody>
                            </table>
                        </div>
                        <div className="flex justify-end gap-3"><button onClick={handleSavePurchase} className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold shadow hover:bg-emerald-700 transition-colors">{localEditingPurchase ? 'Update Purchase' : 'Save Purchase'}</button></div>
                    </div>
                )}
            </Card>
            <Card title="Purchase History">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 uppercase text-xs"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Invoice #</th><th className="px-6 py-3">Supplier</th><th className="px-6 py-3 text-right">Total Amount</th><th className="px-6 py-3 text-center">Actions</th></tr></thead>
                        <tbody>{purchases.map(p => (
                            <tr key={p.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="px-6 py-4">{new Date(p.invoiceDate).toLocaleDateString()}</td><td className="px-6 py-4 font-bold">{p.invoiceNumber}</td><td className="px-6 py-4">{p.supplier}</td><td className="px-6 py-4 text-right font-black">₹{p.totalAmount.toFixed(2)}</td><td className="px-6 py-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => setLocalEditingPurchase(p)} className="text-blue-600"><PencilIcon className="h-4 w-4" /></button><button onClick={() => onDeletePurchase(p)} className="text-rose-600"><TrashIcon className="h-4 w-4" /></button></div></td></tr>
                        ))}</tbody>
                    </table>
                </div>
            </Card>
            <OcrPreviewModal isOpen={isOcrPreviewOpen} onClose={() => setIsOcrPreviewOpen(false)} data={ocrData} suppliers={suppliers} onImport={data => setFormState(prev => ({...prev, supplierName: data.supplierName, invoiceNumber: data.invoiceNumber, invoiceDate: data.invoiceDate, currentItems: [...prev.currentItems, ...data.items]}))} isPharmaMode={isPharmaMode} />
            <AddSupplierModal isOpen={isSupplierModalOpen} onClose={() => setSupplierModalOpen(false)} onAddSupplier={onAddSupplier} initialName={formState.supplierName} />
            <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
        </div>
    );
};

export default Purchases;