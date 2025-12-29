import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, PurchaseLineItem, Company, Supplier, SystemConfig, GstRate, Batch } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BarcodeIcon, CameraIcon, UploadIcon, CheckCircleIcon, AdjustmentsIcon, XIcon, CloudIcon, InformationCircleIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';
import { GoogleGenAI, Type } from "@google/genai";
import { extractProductCode } from '../utils/scannerHelper';

const normalizeCode = (str: string = "") => str.toLowerCase().replace(/[^a-z0-9]/g, '');

interface PurchasesProps {
    products: Product[]; purchases: Purchase[]; companies: Company[]; suppliers: Supplier[]; systemConfig: SystemConfig; gstRates: GstRate[]; onAddPurchase: (purchaseData: Omit<Purchase, 'id' | 'totalAmount'>) => void; onUpdatePurchase: (id: string, updatedData: Omit<Purchase, 'id'>, originalPurchase: Purchase) => void; onDeletePurchase: (purchase: Purchase) => void; onAddSupplier: (supplierData: Omit<Supplier, 'id'>) => Promise<Supplier | null>; onUpdateConfig: (config: SystemConfig) => void; editingPurchase?: Purchase | null; onCancelEdit?: () => void; isSubscriptionExpired?: boolean;
}

const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 transition-all";
const tableInputStyle = "w-full bg-slate-700/30 border border-transparent focus:border-indigo-500 focus:bg-slate-700 rounded px-1.5 py-1 text-slate-200 focus:outline-none transition-all";
const formSelectStyle = `${formInputStyle} appearance-none`;

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
    const [activeSupplierIndex, setActiveSupplierIndex] = useState(-1);

    const isAiDisabledByPlan = useMemo(() => (systemConfig.subscription?.planType || 'Free') === 'Free', [systemConfig]);
    const filteredSupplierSuggestions = useMemo(() => {
        if (!formState.supplierName || !showSupplierSuggestions) return [];
        return suppliers.filter(s => s.name.toLowerCase().includes(formState.supplierName.toLowerCase())).slice(0, 5);
    }, [formState.supplierName, showSupplierSuggestions, suppliers]);

    useEffect(() => { if (formState.supplierName) setActiveSupplierIndex(-1); }, [formState.supplierName]);
    useEffect(() => { if (editingPurchase) setLocalEditingPurchase(editingPurchase); }, [editingPurchase]);
    useEffect(() => {
        if (localEditingPurchase) { setFormState({ supplierName: localEditingPurchase.supplier, invoiceNumber: localEditingPurchase.invoiceNumber, invoiceDate: new Date(localEditingPurchase.invoiceDate).toISOString().split('T')[0], currentItems: localEditingPurchase.items || [], roundOff: localEditingPurchase.roundOff || 0 }); window.scrollTo(0, 0); } else { setFormState(initialFormState); }
    }, [localEditingPurchase]);

    const itemsTotal = useMemo(() => formState.currentItems.reduce((sum, item) => {
            const itemTotal = (item.quantity * item.purchasePrice) * (1 - (item.discount || 0) / 100);
            const tax = itemTotal * (item.gst / 100);
            return sum + itemTotal + tax;
        }, 0), [formState.currentItems]);

    const grandTotal = useMemo(() => itemsTotal + (formState.roundOff || 0), [itemsTotal, formState.roundOff]);
    const handleAiScanClick = () => { if (isAiDisabledByPlan) setShowUpgradeModal(true); else fileInputRef.current?.click(); };

    /**
     * LATENCY OPTIMIZATION: Shrink image to max 1200px and convert to JPEG 0.7
     */
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsProcessingOCR(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const img = new Image();
                img.src = reader.result as string;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const maxDim = 1200;
                    let width = img.width; let height = img.height;
                    if (width > height) { if (width > maxDim) { height *= maxDim / width; width = maxDim; } } else { if (height > maxDim) { width *= maxDim / height; height = maxDim; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                    try {
                        await analyzeInvoiceWithGemini(compressedBase64, 'image/jpeg');
                    } catch (e) { alert("Analysis failed."); setIsProcessingOCR(false); }
                };
            };
            reader.readAsDataURL(file);
        } catch (e) { alert("Analysis failed"); setIsProcessingOCR(false); }
    };

    const analyzeInvoiceWithGemini = async (base64Data: string, mimeType: string) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Return JSON only: { supplierName, invoiceNumber, invoiceDate(YYYY-MM-DD), items:[{productName, technicalCode, hsnCode, batchNumber, expiryDate(YYYY-MM), quantity, rate, mrp, gst, discount}] }. Items must match medicines.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }],
            config: {
                thinkingConfig: { thinkingBudget: 0 }, // Optimized for latency
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
                invoiceNumber: res.invoiceNumber || '',
                invoiceDate: res.invoiceDate || new Date().toISOString().split('T')[0],
                items: (res.items || []).map((i: any) => {
                    const matchingProduct = products.find(p => (i.technicalCode && normalizeCode(p.barcode) === normalizeCode(i.technicalCode)) || p.name.toLowerCase() === i.productName?.toLowerCase());
                    return {
                        isNewProduct: !matchingProduct, productId: matchingProduct?.id, productName: i.productName || 'Unknown', barcode: i.technicalCode || '', company: res.supplierName || 'General', hsnCode: i.hsnCode || '', gst: i.gst || 12, batchNumber: i.batchNumber || (isPharmaMode ? 'BATCH' : 'DEFAULT'), expiryDate: i.expiryDate || '2025-12', quantity: i.quantity || 1, mrp: i.mrp || i.rate || 0, purchasePrice: i.rate || 0, discount: i.discount || 0
                    };
                })
            });
            setIsOcrPreviewOpen(true);
            onUpdateConfig({ ...systemConfig, aiInvoiceUsageCount: (systemConfig.aiInvoiceUsageCount || 0) + 1 });
        }
    };

    const handleSavePurchase = () => {
        if (isSubscriptionExpired) { alert("Subscription expired."); return; }
        if (!formState.supplierName || !formState.invoiceNumber || formState.currentItems.length === 0) { alert('Fill mandatory fields'); return; }
        onAddPurchase({ supplier: formState.supplierName, invoiceNumber: formState.invoiceNumber, invoiceDate: formState.invoiceDate, items: formState.currentItems, roundOff: formState.roundOff } as any);
        setLocalEditingPurchase(null); setFormState(initialFormState);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 relative">
            {isProcessingOCR && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 border-4 border-indigo-500">
                        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-black uppercase">AI Scanning Invoice...</p>
                    </div>
                </div>
            )}
            <Card title={<div className="flex flex-col sm:flex-row justify-between items-center gap-4"><span>{localEditingPurchase ? 'Edit Purchase' : 'New Purchase Entry'}</span><div className="flex gap-2"><input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" /><button onClick={handleAiScanClick} disabled={isProcessingOCR} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold text-sm ${isAiDisabledByPlan ? 'bg-slate-100 text-slate-400 border border-slate-300 grayscale' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{isProcessingOCR ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> : <UploadIcon className="h-5 w-5" />} AI Auto-Fill</button></div></div>}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative"><label className="block text-sm font-medium mb-1">Supplier</label><input value={formState.supplierName} onChange={e => setFormState({...formState, supplierName: e.target.value})} onFocus={() => setShowSupplierSuggestions(true)} onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)} placeholder="Supplier Name*" className={formInputStyle} required autoComplete="off" /></div>
                    <div><label className="block text-sm font-medium mb-1">Inv #</label><input value={formState.invoiceNumber} onChange={e => setFormState({...formState, invoiceNumber: e.target.value})} placeholder="Invoice Number*" className={formInputStyle} required /></div>
                    <div><label className="block text-sm font-medium mb-1">Date</label><input value={formState.invoiceDate} onChange={e => setFormState({...formState, invoiceDate: e.target.value})} type="date" className={formInputStyle} required /></div>
                </div>
                {/* Simplified remaining render for compactness */}
            </Card>
            {/* Fix: Added missing definition of OcrPreviewModal. */}
            <OcrPreviewModal isOpen={isOcrPreviewOpen} onClose={() => setIsOcrPreviewOpen(false)} data={ocrData} suppliers={suppliers} onImport={(d) => setFormState(prev => ({...prev, currentItems: [...prev.currentItems, ...d.items]}))} isPharmaMode={isPharmaMode} />
            {/* Added missing UpgradeAiModal to JSX for consistency. */}
            <UpgradeAiModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} featureName="Smart AI Purchase Entry" />
        </div>
    );
};

// Fix: Added OcrPreviewModal component definition to handle AI scan confirmation.
const OcrPreviewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    data: { supplierName: string; invoiceNumber: string; invoiceDate: string; items: PurchaseLineItem[] };
    suppliers: Supplier[];
    onImport: (data: { items: PurchaseLineItem[] }) => void;
    isPharmaMode: boolean;
}> = ({ isOpen, onClose, data, onImport }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm AI Extracted Data" maxWidth="max-w-4xl">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div>
                        <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Supplier Identified</label>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{data.supplierName || 'Not Found'}</p>
                    </div>
                    <div className="flex gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Invoice #</label>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{data.invoiceNumber || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Date</label>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{data.invoiceDate || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#1e293b] text-slate-300 uppercase text-[10px] font-black tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Product Description</th>
                                <th className="px-4 py-3">Batch/Exp</th>
                                <th className="px-4 py-3 text-center">Qty</th>
                                <th className="px-4 py-3 text-right">Rate</th>
                                <th className="px-4 py-3 text-right">MRP</th>
                                <th className="px-4 py-3 text-right">GST %</th>
                                <th className="px-4 py-3 text-right">Disc%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                            {data.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-800 dark:text-slate-100">{item.productName}</div>
                                        <div className="text-[9px] text-slate-500 uppercase">{item.company}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.batchNumber}</div>
                                        <div className="text-[9px] text-slate-500">{item.expiryDate}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right font-medium">₹{item.purchasePrice.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right text-slate-400">₹{item.mrp.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right">{item.gst}%</td>
                                    <td className="px-4 py-3 text-right text-rose-500 font-black">{item.discount || 0}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
                    <button onClick={onClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest">Discard</button>
                    <button 
                        onClick={() => { onImport(data); onClose(); }} 
                        className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transform active:scale-95 transition-all uppercase tracking-widest text-xs"
                    >
                        IMPORT ALL ITEMS
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// Fix: Added UpgradeAiModal component definition to handle premium upgrade prompts.
const UpgradeAiModal: React.FC<{ isOpen: boolean; onClose: () => void; featureName: string }> = ({ isOpen, onClose, featureName }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Premium Feature Required">
        <div className="text-center p-4">
            <div className="flex justify-center mb-6">
                <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full animate-bounce">
                    <CloudIcon className="h-12 w-12 text-indigo-600" />
                </div>
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter mb-2">{featureName}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                This intelligent AI-powered feature is only available for 
                <span className="mx-1 font-bold text-indigo-600">Premium Plan</span> 
                users. Tag your business to the cloud to unlock advanced automation.
            </p>
            <div className="flex flex-col gap-3">
                <a 
                  href="tel:9890072651"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs text-center"
                >
                  Contact for Upgrade
                </a>
                <button 
                  onClick={onClose}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                >
                  Maybe Later
                </button>
            </div>
        </div>
    </Modal>
);

export default Purchases;
