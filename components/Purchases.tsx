
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Purchase, PurchaseLineItem, Company, Supplier, SystemConfig, GstRate } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BarcodeIcon, CameraIcon, UploadIcon, CheckCircleIcon, AdjustmentsIcon } from './icons/Icons';
import BarcodeScannerModal from './BarcodeScannerModal';
import { GoogleGenAI } from "@google/genai";

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
    purchaseToEdit?: Purchase | null;
    onCancelEdit?: () => void;
}

// --- Utility function to export data to CSV ---
const exportToCsv = (filename: string, data: any[]) => {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','), // header row
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        // handle commas, quotes, and newlines in data
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
    const [formState, setFormState] = useState({
        name: '', address: '', phone: '', gstin: '', openingBalance: ''
    });

    useEffect(() => {
        if (isOpen) {
            setFormState({
                name: initialName, address: '', phone: '', gstin: '', openingBalance: '0'
            });
        }
    }, [isOpen, initialName]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormState({ ...formState, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name) {
            alert('Supplier Name is required.');
            return;
        }
        onAddSupplier({
            ...formState,
            openingBalance: parseFloat(formState.openingBalance) || 0
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Supplier">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name*</label>
                        <input name="name" value={formState.name} onChange={handleChange} className={formInputStyle} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                        <input name="phone" value={formState.phone} onChange={handleChange} className={formInputStyle} />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                    <input name="address" value={formState.address} onChange={handleChange} className={formInputStyle} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN</label>
                        <input name="gstin" value={formState.gstin} onChange={handleChange} className={formInputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Balance</label>
                        <input name="openingBalance" value={formState.openingBalance} onChange={handleChange} type="number" step="0.01" className={formInputStyle} />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Add Supplier</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Premium Upgrade Modal ---
const PremiumModal: React.FC<{ isOpen: boolean; onClose: () => void; usageCount: number; quota: number; }> = ({ isOpen, onClose, usageCount, quota }) => {
  const upiId = "emeraj@oksbi"; // Syed Meraj
  const amount = "5000";
  const name = "Syed Meraj";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Top-up AI Quota">
        <div className="flex flex-col items-center text-center space-y-6 p-4">
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
                Quota Reached ({usageCount}/{quota})
            </div>
            
            <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Increase Your AI Invoice Quota
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                    Automate your purchase entry with AI. Pay to get Unlimited additional AI invoice scans.
                </p>
            </div>
            
            <div className="border-2 border-indigo-500 rounded-2xl p-6 bg-white shadow-xl transform transition-transform hover:scale-105">
                <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48 mx-auto mb-4" />
                <p className="font-bold text-2xl text-indigo-700">₹5,000 <span className="text-sm font-normal text-slate-500">/ Unlimited</span></p>
            </div>

            <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1 bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg w-full max-w-sm">
                <div>
                    <p className="font-bold text-red-500 dark:text-red-400">Important:</p>
                    <p>After payment, please send the screenshot to Admin to update your quota.</p>
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-200 mt-1">Call/WhatsApp: 9890072651</p>
                </div>
            </div>

            <button onClick={onClose} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-8 py-3 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors w-full sm:w-auto">
                Close
            </button>
        </div>
    </Modal>
  );
};

// --- Sub Components (Restored Inline) ---

interface AddItemFormProps {
    products: Product[];
    onAddItem: (item: PurchaseLineItem) => void;
    companies: Company[];
    systemConfig: SystemConfig;
    gstRates: GstRate[];
    itemToEdit?: PurchaseLineItem | null;
}

const AddItemForm: React.FC<AddItemFormProps> = ({ products, onAddItem, companies, systemConfig, gstRates, itemToEdit }) => {
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    const sortedGstRates = useMemo(() => [...gstRates].sort((a, b) => a.rate - b.rate), [gstRates]);
    const defaultGst = useMemo(() => sortedGstRates.find(r => r.rate === 12)?.rate.toString() || sortedGstRates[0]?.rate.toString() || '0', [sortedGstRates]);

    const initialItemState = {
        productName: '',
        isNewProduct: false,
        productId: '',
        company: '',
        hsnCode: '',
        gst: defaultGst,
        batchNumber: '',
        expiryDate: '',
        quantity: '',
        mrp: '',
        purchasePrice: '',
        discount: '0',
        unitsPerStrip: '',
        isScheduleH: 'No',
        composition: '',
        barcode: '',
    };

    const [newItem, setNewItem] = useState(initialItemState);
    const [showProductSuggestions, setShowProductSuggestions] = useState(false);
    
    // Derived state for suggestions
    const productSuggestions = useMemo(() => {
        if (!newItem.productName) return [];
        const term = newItem.productName.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(term)).slice(0, 10);
    }, [newItem.productName, products]);

    useEffect(() => {
        if (itemToEdit) {
            setNewItem({
                productName: itemToEdit.productName,
                isNewProduct: itemToEdit.isNewProduct,
                productId: itemToEdit.productId || '',
                company: itemToEdit.company,
                hsnCode: itemToEdit.hsnCode,
                gst: String(itemToEdit.gst),
                batchNumber: itemToEdit.batchNumber,
                expiryDate: itemToEdit.expiryDate,
                quantity: String(itemToEdit.quantity),
                mrp: String(itemToEdit.mrp),
                purchasePrice: String(itemToEdit.purchasePrice),
                discount: String(itemToEdit.discount || 0),
                unitsPerStrip: String(itemToEdit.unitsPerStrip || ''),
                isScheduleH: itemToEdit.isScheduleH ? 'Yes' : 'No',
                composition: itemToEdit.composition || '',
                barcode: itemToEdit.barcode || '',
            });
        }
    }, [itemToEdit]);

    const handleProductSelect = (product: Product) => {
        setNewItem(prev => ({
            ...prev,
            productName: product.name,
            productId: product.id,
            isNewProduct: false,
            company: product.company,
            hsnCode: product.hsnCode,
            gst: String(product.gst),
            unitsPerStrip: String(product.unitsPerStrip || ''),
            isScheduleH: product.isScheduleH ? 'Yes' : 'No',
            composition: product.composition || '',
            barcode: product.barcode || '',
        }));
        setShowProductSuggestions(false);
    };

    const handleAddItemClick = () => {
        if (!newItem.productName || !newItem.quantity || !newItem.purchasePrice || !newItem.mrp) {
            alert("Please fill all required fields");
            return;
        }
        if (isPharmaMode && (!newItem.batchNumber || !newItem.expiryDate)) {
            alert("Batch and Expiry are required for Pharma mode");
            return;
        }

        const item: PurchaseLineItem = {
            isNewProduct: newItem.isNewProduct,
            productName: newItem.productName,
            productId: newItem.isNewProduct ? undefined : newItem.productId,
            company: newItem.company,
            hsnCode: newItem.hsnCode,
            gst: parseFloat(newItem.gst),
            batchNumber: newItem.batchNumber,
            expiryDate: newItem.expiryDate,
            quantity: parseInt(newItem.quantity),
            mrp: parseFloat(newItem.mrp),
            purchasePrice: parseFloat(newItem.purchasePrice),
            discount: parseFloat(newItem.discount) || 0,
            unitsPerStrip: newItem.unitsPerStrip ? parseInt(newItem.unitsPerStrip) : undefined,
            isScheduleH: newItem.isScheduleH === 'Yes',
            composition: newItem.composition,
            barcode: newItem.barcode,
        };

        onAddItem(item);
        setNewItem(initialItemState);
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border dark:border-slate-700 space-y-4">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200">{itemToEdit ? 'Edit Item' : 'Add Item'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Product Name*</label>
                    <input 
                        value={newItem.productName} 
                        onChange={e => {
                            setNewItem({...newItem, productName: e.target.value, isNewProduct: true, productId: ''});
                            setShowProductSuggestions(true);
                        }}
                        onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                        placeholder="Search or Enter Product Name"
                        className={formInputStyle}
                    />
                    {showProductSuggestions && productSuggestions.length > 0 && (
                        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {productSuggestions.map(p => (
                                <li key={p.id} onClick={() => handleProductSelect(p)} className="px-4 py-2 hover:bg-indigo-100 dark:hover:bg-indigo-900 cursor-pointer text-slate-800 dark:text-slate-200 text-sm">
                                    {p.name} <span className="text-xs text-slate-500">({p.company})</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                {newItem.isNewProduct && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company*</label>
                            <input value={newItem.company} onChange={e => setNewItem({...newItem, company: e.target.value})} className={formInputStyle} placeholder="Manufacturer" list="companies" />
                            <datalist id="companies">
                                {companies.map(c => <option key={c.id} value={c.name} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Composition</label>
                            <input value={newItem.composition} onChange={e => setNewItem({...newItem, composition: e.target.value})} className={formInputStyle} placeholder="Generic Name" />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">HSN Code</label>
                    <input value={newItem.hsnCode} onChange={e => setNewItem({...newItem, hsnCode: e.target.value})} className={formInputStyle} />
                </div>
                
                {isPharmaMode && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Batch No.*</label>
                            <input value={newItem.batchNumber} onChange={e => setNewItem({...newItem, batchNumber: e.target.value})} className={formInputStyle} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry (YYYY-MM)*</label>
                            <input type="month" value={newItem.expiryDate} onChange={e => setNewItem({...newItem, expiryDate: e.target.value})} className={formInputStyle} />
                        </div>
                    </>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity* {isPharmaMode ? '(Strips)' : ''}</label>
                    <input type="number" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} className={formInputStyle} min="1" />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Purchase Rate*</label>
                    <input type="number" step="0.01" value={newItem.purchasePrice} onChange={e => setNewItem({...newItem, purchasePrice: e.target.value})} className={formInputStyle} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">MRP*</label>
                    <input type="number" step="0.01" value={newItem.mrp} onChange={e => setNewItem({...newItem, mrp: e.target.value})} className={formInputStyle} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Discount (%)</label>
                    <input type="number" step="0.01" value={newItem.discount} onChange={e => setNewItem({...newItem, discount: e.target.value})} className={formInputStyle} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GST (%)</label>
                    <select value={newItem.gst} onChange={e => setNewItem({...newItem, gst: e.target.value})} className={formSelectStyle}>
                        {sortedGstRates.map(r => <option key={r.id} value={r.rate}>{r.rate}%</option>)}
                    </select>
                </div>
                
                {isPharmaMode && newItem.isNewProduct && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Units/Strip</label>
                        <input type="number" value={newItem.unitsPerStrip} onChange={e => setNewItem({...newItem, unitsPerStrip: e.target.value})} className={formInputStyle} placeholder="10" />
                    </div>
                )}
            </div>
            <div className="flex justify-end pt-2">
                <button 
                    onClick={handleAddItemClick}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-colors"
                >
                    <PlusIcon className="h-5 w-5" /> {itemToEdit ? 'Update Item' : 'Add Item'}
                </button>
            </div>
        </div>
    );
};

const OcrPreviewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    data: any;
    suppliers: Supplier[];
    onImport: (data: any) => void;
    isPharmaMode: boolean;
}> = ({ isOpen, onClose, data, suppliers, onImport, isPharmaMode }) => {
    if (!isOpen) return null;

    // This is a placeholder for the full OCR implementation.
    // In a real scenario, this would have a table to review items extracted by AI.
    // For now, we will just pass-through the data or show a simple confirmation.
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Review Imported Invoice">
            <div className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                    AI extraction is experimental. Please verify all details below before importing.
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-xs text-slate-500">Supplier</span>
                        <p className="font-medium">{data.supplierName || 'Unknown'}</p>
                    </div>
                    <div>
                        <span className="text-xs text-slate-500">Invoice No</span>
                        <p className="font-medium">{data.invoiceNumber || 'Unknown'}</p>
                    </div>
                </div>

                <div className="max-h-60 overflow-y-auto border rounded dark:border-slate-700">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="p-2">Item</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2 text-right">Rate</th>
                                <th className="p-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items?.map((item: any, i: number) => (
                                <tr key={i} className="border-t dark:border-slate-600">
                                    <td className="p-2">{item.productName}</td>
                                    <td className="p-2 text-right">{item.quantity}</td>
                                    <td className="p-2 text-right">{item.purchasePrice}</td>
                                    <td className="p-2 text-right">{(item.quantity * item.purchasePrice).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded">Cancel</button>
                    <button onClick={() => onImport(data)} className="px-4 py-2 bg-green-600 text-white rounded shadow">Confirm Import</button>
                </div>
            </div>
        </Modal>
    );
};


const Purchases: React.FC<PurchasesProps> = ({ products, purchases, companies, suppliers, systemConfig, gstRates, onAddPurchase, onUpdatePurchase, onDeletePurchase, onAddSupplier, onUpdateConfig, purchaseToEdit, onCancelEdit }) => {
    const initialFormState = {
        supplierName: '',
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        currentItems: [] as PurchaseLineItem[],
        roundOff: 0
    };
    
    const [formState, setFormState] = useState(initialFormState);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
    const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<PurchaseLineItem | null>(null);
    const isPharmaMode = systemConfig.softwareMode === 'Pharma';
    
    // OCR Processing State
    const [isProcessingOCR, setIsProcessingOCR] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isOcrPreviewOpen, setIsOcrPreviewOpen] = useState(false);
    const [ocrData, setOcrData] = useState<{
        supplierName: string;
        supplierGstin?: string;
        supplierAddress?: string;
        invoiceNumber: string;
        invoiceDate: string;
        items: PurchaseLineItem[];
    }>({ supplierName: '', invoiceNumber: '', invoiceDate: '', items: [] });

    // Premium Feature State
    const [showPremiumModal, setShowPremiumModal] = useState(false);

    // State for purchase history filtering
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

    // Supplier Keyboard Navigation State
    const [activeSupplierIndex, setActiveSupplierIndex] = useState(-1);
    const activeSupplierRef = useRef<HTMLLIElement>(null);

    // Helper function to calculate line item total
    const calculateLineTotal = (item: PurchaseLineItem) => {
        const amount = item.purchasePrice * item.quantity;
        const discountAmount = amount * ((item.discount || 0) / 100);
        const taxableAmount = amount - discountAmount;
        const taxAmount = taxableAmount * (item.gst / 100);
        return taxableAmount + taxAmount;
    };

    useEffect(() => {
        const purchase = purchaseToEdit || editingPurchase;
        if (purchase) {
            // Calculate derived roundOff for legacy records if field doesn't exist
            const itemsSum = purchase.items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
            const existingRoundOff = purchase.roundOff !== undefined 
                ? purchase.roundOff 
                : (purchase.totalAmount - itemsSum);

            setFormState({
                supplierName: purchase.supplier,
                invoiceNumber: purchase.invoiceNumber,
                invoiceDate: new Date(purchase.invoiceDate).toISOString().split('T')[0],
                currentItems: purchase.items || [],
                roundOff: parseFloat(existingRoundOff.toFixed(2))
            });
            window.scrollTo(0, 0); // Scroll to top to see the form
            if (purchaseToEdit && !editingPurchase) {
                setEditingPurchase(purchaseToEdit);
            }
        } else {
            setFormState(initialFormState);
            setEditingPurchase(null);
        }
    }, [editingPurchase, purchaseToEdit]);

    const supplierSuggestions = useMemo(() => {
        if (!formState.supplierName) return [];
        return suppliers.filter(s => s.name.toLowerCase().includes(formState.supplierName.toLowerCase()));
    }, [formState.supplierName, suppliers]);

    const exactMatch = useMemo(() => {
        return suppliers.some(s => s.name.toLowerCase() === formState.supplierName.trim().toLowerCase());
    }, [formState.supplierName, suppliers]);

    // Reset supplier index when search term changes
    useEffect(() => {
        setActiveSupplierIndex(-1);
    }, [formState.supplierName]);

    // Scroll active supplier item into view
    useEffect(() => {
        if (showSupplierSuggestions && activeSupplierIndex !== -1) {
             activeSupplierRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [activeSupplierIndex, showSupplierSuggestions]);

    const handleSelectSupplier = (name: string) => {
        setFormState(prev => ({ ...prev, supplierName: name }));
        setShowSupplierSuggestions(false);
    };

    const handleOpenSupplierModal = () => {
        setSupplierModalOpen(true);
        setShowSupplierSuggestions(false);
    };

    const handleAddNewSupplier = async (supplierData: Omit<Supplier, 'id'>) => {
        const newSupplier = await onAddSupplier(supplierData);
        if (newSupplier) {
            setFormState(prev => ({ ...prev, supplierName: newSupplier.name }));
            setSupplierModalOpen(false);
        }
    };

    const handleSupplierKeyDown = (e: React.KeyboardEvent) => {
        const showAddOption = !exactMatch && formState.supplierName.trim().length > 0;
        const totalItems = supplierSuggestions.length + (showAddOption ? 1 : 0);

        if (totalItems === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveSupplierIndex(prev => (prev + 1) % totalItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveSupplierIndex(prev => (prev - 1 + totalItems) % totalItems);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeSupplierIndex >= 0 && activeSupplierIndex < supplierSuggestions.length) {
                    handleSelectSupplier(supplierSuggestions[activeSupplierIndex].name);
                } else if (showAddOption && activeSupplierIndex === supplierSuggestions.length) {
                    handleOpenSupplierModal();
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowSupplierSuggestions(false);
                break;
        }
    };

    const handleAddItem = (item: PurchaseLineItem) => {
        setFormState(prev => ({...prev, currentItems: [...prev.currentItems, item]}));
        setItemToEdit(null); // Clear edit state after adding
    };

    const handleRemoveItem = (index: number) => {
        setFormState(prev => ({...prev, currentItems: prev.currentItems.filter((_, i) => i !== index)}));
    };

    const handleEditItem = (index: number) => {
        const item = formState.currentItems[index];
        setItemToEdit(item);
        handleRemoveItem(index); // Remove from list to be re-added after edit
        // Optionally, scroll to top/form
        const formElement = document.querySelector('form');
        if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const itemsTotal = useMemo(() => {
        return formState.currentItems.reduce((total, item) => total + calculateLineTotal(item), 0);
    }, [formState.currentItems]);

    const totalAmount = useMemo(() => {
        return itemsTotal + (parseFloat(formState.roundOff.toString()) || 0);
    }, [itemsTotal, formState.roundOff]);
    
    const resetForm = () => {
        setEditingPurchase(null);
        setFormState(initialFormState);
        setItemToEdit(null);
        if(onCancelEdit) onCancelEdit();
    };

    const handleAutoRound = () => {
        const rounded = Math.round(itemsTotal);
        const diff = rounded - itemsTotal;
        setFormState(prev => ({ ...prev, roundOff: parseFloat(diff.toFixed(2)) }));
    };

    const handleSavePurchase = () => {
        if (!formState.supplierName || !formState.invoiceDate || formState.currentItems.length === 0) {
            alert('Please select a supplier, set the date, and add at least one item.');
            return;
        }
        if (!formState.invoiceNumber.trim()) {
            alert('Invoice Number is required.');
            return;
        }
        
        const purchaseData = { 
            supplier: formState.supplierName, 
            invoiceNumber: formState.invoiceNumber, 
            invoiceDate: formState.invoiceDate, 
            items: formState.currentItems,
            totalAmount,
            roundOff: parseFloat(formState.roundOff.toString()) || 0
        };

        if (editingPurchase && editingPurchase.id) {
             onUpdatePurchase(editingPurchase.id, purchaseData, editingPurchase);
        } else {
            onAddPurchase(purchaseData);
        }
        resetForm();
    };

    // ... (Gemini AI Logic maintained, same as before) ...
    // Note: Reusing the same functions from previous file content for AI logic (handleFileUpload, analyzeInvoiceWithGemini, etc.)
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!systemConfig.isPremium) {
            const usageCount = systemConfig.aiInvoiceUsageCount || 0;
            const limit = systemConfig.aiInvoiceQuota || 5; 
            if (usageCount >= limit) {
                setShowPremiumModal(true);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            } else {
                onUpdateConfig({ ...systemConfig, aiInvoiceUsageCount: usageCount + 1 });
            }
        }
        const file = event.target.files?.[0];
        if (!file) return;
        if (!process.env.API_KEY) { alert("API Key is missing."); return; }
        setIsProcessingOCR(true);
        try {
            let base64Data = "";
            let mimeType = file.type;
            if (file.type === 'application/pdf') {
                const pdfjsLib = (window as any).pdfjsLib;
                if (!pdfjsLib) throw new Error("PDF.js not loaded");
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1); 
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                if (context) {
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    base64Data = canvas.toDataURL('image/png');
                    mimeType = "image/png";
                }
            } else if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                base64Data = await new Promise((resolve) => { reader.onload = () => resolve(reader.result as string); });
            } else { alert('Unsupported file type.'); setIsProcessingOCR(false); return; }
            if (base64Data) {
                const cleanBase64 = base64Data.split(',')[1];
                // Reuse existing AI function
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const model = 'gemini-2.5-flash';
                const prompt = `Analyze this purchase invoice image. Extract supplier name, invoice number, date, and line items.
                For each item, identify product name, quantity, rate, and HSN if available.
                Return JSON structure: { supplierName: string, invoiceNumber: string, invoiceDate: string (YYYY-MM-DD), items: [{ productName, quantity, purchasePrice, hsnCode }] }`;
                
                const response = await ai.models.generateContent({
                    model: model,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: mimeType, data: cleanBase64 } }
                            ]
                        }
                    ]
                });
                
                const text = response.text; // Fixed: Use direct getter property
                if (!text) throw new Error("No text returned from AI analysis.");

                // Basic clean up of markdown code blocks if present
                const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const data = JSON.parse(jsonStr);
                
                setOcrData(data);
                setIsOcrPreviewOpen(true);
            }
        } catch (error: any) { console.error('AI Analysis Error:', error); alert(`Failed: ${error.message}`); } finally { setIsProcessingOCR(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    
    // Stub for handleImportFromOcr - effectively same as previous file
    const handleImportFromOcr = (data: any) => {
         setFormState(prev => ({
             ...prev,
             supplierName: data.supplierName || '',
             invoiceNumber: data.invoiceNumber || '',
             invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
             currentItems: data.items.map((i: any) => ({
                 ...i, 
                 isNewProduct: true, // Assume new unless mapped manually, simplistic logic
                 company: '',
                 gst: 12,
                 mrp: i.purchasePrice * 1.5, // Dummy calculation
                 discount: 0
             }))
         }));
         setIsOcrPreviewOpen(false);
    };

    const filteredPurchases = useMemo(() => {
        return purchases
            .filter(p => {
                const purchaseDate = new Date(p.invoiceDate);
                purchaseDate.setHours(0,0,0,0);
                
                if (fromDate) {
                    const start = new Date(fromDate);
                    start.setHours(0,0,0,0);
                    if (purchaseDate < start) return false;
                }
                
                if (toDate) {
                    const end = new Date(toDate);
                    end.setHours(0,0,0,0);
                    if (purchaseDate > end) return false;
                }
                
                return true;
            })
            .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
    }, [purchases, fromDate, toDate]);
    
    const handleExport = () => {
        if (filteredPurchases.length === 0) {
            alert("No purchase data to export for the selected date range.");
            return;
        }
        const exportData = filteredPurchases.map(p => ({
            'Date': new Date(p.invoiceDate).toLocaleDateString(),
            'Invoice #': p.invoiceNumber,
            'Supplier': p.supplier,
            'Items': p.items.length,
            'Total Amount': p.totalAmount.toFixed(2),
        }));
        const filename = `purchase_history_${fromDate || 'all-time'}_to_${toDate || 'today'}`;
        exportToCsv(filename, exportData);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card title={
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span>{editingPurchase ? `Editing Purchase: ${editingPurchase.invoiceNumber}` : 'New Purchase Entry'}</span>
                    {!editingPurchase && (
                        <div className="relative">
                            <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingOCR} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-md hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                                {isProcessingOCR ? ( <> <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> <span>Analyzing...</span> </> ) : ( <> <UploadIcon className="h-5 w-5" /> <span>Auto-Fill (AI)</span> </> )}
                            </button>
                        </div>
                    )}
                </div>
            }>
                {/* ... (Existing Supplier/Invoice inputs) ... */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier Name</label>
                        <input value={formState.supplierName} onChange={e => setFormState(prev => ({...prev, supplierName: e.target.value}))} onFocus={() => setShowSupplierSuggestions(true)} onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)} onKeyDown={handleSupplierKeyDown} placeholder="Search or Add Supplier*" className={formInputStyle} required autoComplete="off" />
                         {showSupplierSuggestions && formState.supplierName.length > 0 && (
                          <ul className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {supplierSuggestions.map((s, index) => (
                                  <li key={s.id} ref={index === activeSupplierIndex ? activeSupplierRef : null} onClick={() => handleSelectSupplier(s.name)} onMouseEnter={() => setActiveSupplierIndex(index)} className={`px-4 py-2 cursor-pointer text-slate-800 dark:text-slate-200 ${ index === activeSupplierIndex ? 'bg-indigo-200 dark:bg-indigo-700' : 'hover:bg-indigo-100 dark:hover:bg-indigo-900' }`}> {s.name} </li>
                              ))}
                              {!exactMatch && formState.supplierName.trim().length > 0 && (
                                  <li ref={supplierSuggestions.length === activeSupplierIndex ? activeSupplierRef : null} onClick={handleOpenSupplierModal} onMouseEnter={() => setActiveSupplierIndex(supplierSuggestions.length)} className={`px-4 py-2 cursor-pointer font-semibold text-green-600 dark:text-green-400 ${ supplierSuggestions.length === activeSupplierIndex ? 'bg-green-100 dark:bg-green-900/50' : 'hover:bg-indigo-100 dark:hover:bg-indigo-900' }`}> <PlusIcon className="h-4 w-4 inline mr-2"/> Add new: "{formState.supplierName.trim()}" </li>
                              )}
                          </ul>
                        )}
                    </div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice Number</label><input value={formState.invoiceNumber} onChange={e => setFormState(prev => ({...prev, invoiceNumber: e.target.value}))} placeholder="Invoice Number*" className={formInputStyle} required/></div>
                    <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice Date</label><input value={formState.invoiceDate} onChange={e => setFormState(prev => ({...prev, invoiceDate: e.target.value}))} type="date" className={formInputStyle} required/></div>
                </div>

                <AddItemForm products={products} onAddItem={handleAddItem} companies={companies} systemConfig={systemConfig} gstRates={gstRates} itemToEdit={itemToEdit} />
                
                {formState.currentItems.length > 0 && (
                    <div className="mt-4">
                         <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Items in Current Purchase</h3>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-slate-800 dark:text-slate-300">
                                <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Product</th>
                                        <th className="px-4 py-2 text-left">HSN</th>
                                        {isPharmaMode && <th className="px-4 py-2 text-left">Batch</th>}
                                        <th className="px-4 py-2 text-center">Qty</th>
                                        <th className="px-4 py-2 text-right">Rate</th>
                                        <th className="px-4 py-2 text-center">Disc (%)</th>
                                        <th className="px-4 py-2 text-center">Tax (%)</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                        <th className="px-4 py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formState.currentItems.map((item, index) => (
                                        <tr key={index} className="border-b dark:border-slate-700">
                                            <td className="px-4 py-2 font-medium">{item.productName} {item.isNewProduct && <span className="text-xs text-green-600 dark:text-green-400 font-semibold">(New)</span>}</td>
                                            <td className="px-4 py-2">{item.hsnCode}</td>
                                            {isPharmaMode && <td className="px-4 py-2">{item.batchNumber}</td>}
                                            <td className="px-4 py-2 text-center">{item.quantity}</td>
                                            <td className="px-4 py-2 text-right">₹{item.purchasePrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-center">{item.discount || 0}%</td>
                                            <td className="px-4 py-2 text-center">{item.gst}%</td>
                                            <td className="px-4 py-2 text-right font-semibold">₹{calculateLineTotal(item).toFixed(2)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex justify-center gap-3">
                                                    <button onClick={() => handleEditItem(index)} className="text-blue-500 hover:text-blue-700" title="Edit Item"><PencilIcon className="h-4 w-4" /></button>
                                                    <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700" title="Remove Item"><TrashIcon className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                         
                         <div className="mt-4 flex flex-col sm:flex-row justify-end items-end sm:items-center gap-4 border-t dark:border-slate-700 pt-4">
                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                                <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400 gap-8"><span>Items Total:</span><span>₹{itemsTotal.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center gap-4">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Round Off:</label>
                                    <div className="flex gap-1">
                                        <input type="number" step="0.01" value={formState.roundOff} onChange={e => setFormState({...formState, roundOff: parseFloat(e.target.value) || 0})} className="w-20 p-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm" />
                                        <button onClick={handleAutoRound} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold hover:bg-indigo-200" title="Auto Round">Auto</button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xl font-bold text-slate-800 dark:text-slate-200 border-t dark:border-slate-600 pt-2 mt-1"><span>Grand Total:</span><span>₹{totalAmount.toFixed(2)}</span></div>
                            </div>
                         </div>

                         <div className="flex flex-col sm:flex-row justify-end items-center mt-4 gap-4">
                            {editingPurchase && (
                                <button type="button" onClick={resetForm} className="bg-slate-500 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-md hover:bg-slate-600 transition-colors w-full sm:w-auto">Cancel Edit</button>
                            )}
                            <button onClick={handleSavePurchase} className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-md hover:bg-green-700 transition-colors w-full sm:w-auto">{editingPurchase ? 'Update Purchase' : 'Save Purchase'}</button>
                         </div>
                    </div>
                )}
            </Card>
            
            <AddSupplierModal isOpen={isSupplierModalOpen} onClose={() => setSupplierModalOpen(false)} onAddSupplier={handleAddNewSupplier} initialName={formState.supplierName} />
            <OcrPreviewModal isOpen={isOcrPreviewOpen} onClose={() => setIsOcrPreviewOpen(false)} data={ocrData} suppliers={suppliers} onImport={handleImportFromOcr} isPharmaMode={isPharmaMode} />
            <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} usageCount={systemConfig.aiInvoiceUsageCount || 0} quota={systemConfig.aiInvoiceQuota || 5} />

            <Card title="Purchase History">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <label htmlFor="fromDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">From</label>
                        <input type="date" id="fromDate" value={fromDate} onChange={e => setFromDate(e.target.value)} className={formInputStyle} />
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="toDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">To</label>
                        <input type="date" id="toDate" value={toDate} onChange={e => setToDate(e.target.value)} className={formInputStyle} />
                    </div>
                    <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors duration-200"><DownloadIcon className="h-5 w-5" /> Export to Excel</button>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-800 dark:text-slate-300">
                        <thead className="text-xs text-slate-800 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Invoice #</th>
                                <th className="px-6 py-3">Supplier</th>
                                <th className="px-6 py-3 text-center">Items</th>
                                <th className="px-6 py-3 text-right">Total Amount</th>
                                <th className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPurchases.map(p => (
                                <tr key={p.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <td className="px-6 py-4">{new Date(p.invoiceDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{p.invoiceNumber}</td>
                                    <td className="px-6 py-4">{p.supplier}</td>
                                    <td className="px-6 py-4 text-center">{p.items.length}</td>
                                    <td className="px-6 py-4 font-semibold text-right">₹{p.totalAmount.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center items-center gap-4">
                                            <button onClick={() => setEditingPurchase(p)} title="Edit Purchase" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"><PencilIcon className="h-5 w-5" /></button>
                                            <button onClick={() => onDeletePurchase(p)} title="Delete Purchase" className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"><TrashIcon className="h-5 w-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredPurchases.length === 0 && <p className="text-center py-6 text-slate-600 dark:text-slate-400">No purchase history found for the selected dates.</p>}
                 </div>
            </Card>
        </div>
    );
};

export default Purchases;
